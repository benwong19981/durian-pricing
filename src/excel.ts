import * as XLSX from "xlsx";
import { pulpPrice, wholePrice } from "./pricing";
import { uid, type Grade, type State, type Variety } from "./state";
import { numOf } from "./util";

export const HEAD_W = ["Date", "Variety", "Grade", "Buy per kg", "Premium per kg", "Sell per kg"] as const;
export const HEAD_P = [
  "Date",
  "Variety",
  "Avg buy per kg",
  "Pulp ratio %",
  "Cost per 100g",
  "Premium per 100g",
  "Sell per 100g",
  "Sell per kg pulp",
] as const;
export const SHEET_W = "Whole fruit";
export const SHEET_P = "Pulp";

type WholeRow = Record<(typeof HEAD_W)[number], string | number>;
type PulpRow = Record<(typeof HEAD_P)[number], string | number>;

export function todayRows(state: State): { w: WholeRow[]; p: PulpRow[] } {
  const w: WholeRow[] = [];
  const p: PulpRow[] = [];
  state.varieties.forEach((v) => {
    state.grades.forEach((g) => {
      const r = wholePrice(v.buy[g.id], v.premKg, state.premKg, state.roundStep, state.roundDir);
      if (r) {
        w.push({
          Date: state.date,
          Variety: v.name,
          Grade: g.name,
          "Buy per kg": +r.buy.toFixed(2),
          "Premium per kg": +r.prem.toFixed(2),
          "Sell per kg": +r.sell.toFixed(2),
        });
      }
    });
    const r = pulpPrice(v.pulp.avg, v.pulp.ratio, v.prem100, state.prem100, state.roundStep, state.roundDir);
    if (r) {
      p.push({
        Date: state.date,
        Variety: v.name,
        "Avg buy per kg": +r.avg.toFixed(2),
        "Pulp ratio %": r.ratio,
        "Cost per 100g": +r.cost100.toFixed(2),
        "Premium per 100g": +r.prem.toFixed(2),
        "Sell per 100g": +r.sell.toFixed(2),
        "Sell per kg pulp": +r.sellPerKg.toFixed(2),
      });
    }
  });
  return { w, p };
}

function sheetRows(wb: XLSX.WorkBook | null | undefined, name: string): Record<string, unknown>[] {
  if (!wb || !wb.Sheets || !wb.Sheets[name]) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
}

export class NothingToSaveError extends Error {
  constructor() {
    super("Nothing to save. Enter at least one price first.");
    this.name = "NothingToSaveError";
  }
}

export function buildWorkbook(state: State, existing: XLSX.WorkBook | null | undefined): { wb: XLSX.WorkBook; count: number } {
  const { w, p } = todayRows(state);
  if (!w.length && !p.length) throw new NothingToSaveError();

  const oldW = sheetRows(existing, SHEET_W).filter((r) => String(r.Date) !== state.date);
  const oldP = sheetRows(existing, SHEET_P).filter((r) => String(r.Date) !== state.date);

  const wb = XLSX.utils.book_new();
  const wsW = XLSX.utils.json_to_sheet([...oldW, ...w], { header: [...HEAD_W] });
  const wsP = XLSX.utils.json_to_sheet([...oldP, ...p], { header: [...HEAD_P] });
  wsW["!cols"] = HEAD_W.map((h) => ({ wch: Math.max(12, h.length + 3) }));
  wsP["!cols"] = HEAD_P.map((h) => ({ wch: Math.max(12, h.length + 3) }));
  XLSX.utils.book_append_sheet(wb, wsW, SHEET_W);
  XLSX.utils.book_append_sheet(wb, wsP, SHEET_P);
  return { wb, count: w.length + p.length };
}

export function workbookBlob(wb: XLSX.WorkBook): Blob {
  return new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function readWorkbookFromFile(file: File): Promise<XLSX.WorkBook | null> {
  if (!file.size) return null;
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array" });
}

export function readWorkbookFromArrayBuffer(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: "array" });
}

export interface LoadResult {
  grades: Grade[];
  varieties: Variety[];
  premKg: number | null;
  prem100: number | null;
  latestDate: string;
}

/** Repopulates from the workbook's most recent date. Returns null if the workbook has no usable rows. */
export function loadLatest(wb: XLSX.WorkBook): LoadResult | null {
  const rowsW = sheetRows(wb, SHEET_W);
  const rowsP = sheetRows(wb, SHEET_P);
  if (!rowsW.length && !rowsP.length) return null;

  const dates = [...rowsW, ...rowsP]
    .map((r) => String(r.Date))
    .filter(Boolean)
    .sort();
  const latest = dates[dates.length - 1];
  if (!latest) return null;

  const w = rowsW.filter((r) => String(r.Date) === latest);
  const p = rowsP.filter((r) => String(r.Date) === latest);

  const gradeNames: string[] = [];
  w.forEach((r) => {
    const g = String(r.Grade ?? "");
    if (g && !gradeNames.includes(g)) gradeNames.push(g);
  });
  const varNames: string[] = [];
  [...w, ...p].forEach((r) => {
    const n = String(r.Variety ?? "");
    if (n && !varNames.includes(n)) varNames.push(n);
  });
  if (!varNames.length) return null;

  const grades: Grade[] = gradeNames.length ? gradeNames.map((name) => ({ id: uid(), name })) : [{ id: uid(), name: "A" }, { id: uid(), name: "B" }, { id: uid(), name: "C" }];
  const gidByName = (name: string) => grades.find((g) => g.name === name)?.id;

  const varieties: Variety[] = varNames.map((name) => {
    const v: Variety = { id: uid(), name, buy: {}, premKg: null, pulp: { avg: null, ratio: null }, prem100: null };
    grades.forEach((g) => {
      v.buy[g.id] = null;
    });
    return v;
  });
  const byName = (name: string) => varieties.find((v) => v.name === name);

  w.forEach((r) => {
    const v = byName(String(r.Variety ?? ""));
    const gid = gidByName(String(r.Grade ?? ""));
    if (v && gid) v.buy[gid] = numOf(r["Buy per kg"]);
  });
  p.forEach((r) => {
    const v = byName(String(r.Variety ?? ""));
    if (v) v.pulp = { avg: numOf(r["Avg buy per kg"]), ratio: numOf(r["Pulp ratio %"]) };
  });

  const premKg = w.length ? numOf(w[0]["Premium per kg"]) : null;
  const prem100 = p.length ? numOf(p[0]["Premium per 100g"]) : null;

  return { grades, varieties, premKg, prem100, latestDate: latest };
}

export function buildCsv(state: State): string {
  const rows: (string | number)[][] = [];
  const { w, p } = todayRows(state);
  rows.push(["SL Durian price list", state.date, state.currency]);
  rows.push([]);
  rows.push(["WHOLE FRUIT"]);
  rows.push([...HEAD_W]);
  w.forEach((r) => rows.push(HEAD_W.map((h) => r[h])));
  rows.push([]);
  rows.push(["PULP"]);
  rows.push([...HEAD_P]);
  p.forEach((r) => rows.push(HEAD_P.map((h) => r[h])));
  return rows
    .map((r) =>
      r
        .map((c) => {
          const t = String(c ?? "");
          return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
        })
        .join(",")
    )
    .join("\n");
}
