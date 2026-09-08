import { exportPriceCard } from "../card";
import * as db from "../db";
import { buildCsv } from "../excel";
import { newVariety, seedState, uid, type Grade, type State, type Variety } from "../state";
import { loadState, saveState } from "../storage";
import { downloadBlob, esc } from "../util";
import { pulpPrice } from "../pricing";
import { buildCards } from "./cards";
import { emptyRefs, refreshOutputs, type Refs } from "./fields";
import { buildWholeTable, buildPulpTable } from "./tables";
import { toast } from "./toast";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const MQ = window.matchMedia("(max-width: 720px)");

let state: State;
let refs: Refs = emptyRefs();
let tab: "whole" | "pulp" = "whole";
let saveDebounce: ReturnType<typeof setTimeout> | undefined;

function persist(): void {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    void saveState(state);
  }, 300);
}

function onInput(): void {
  refreshOutputs(state, refs);
  updateNote();
  persist();
}

function updateNote(): void {
  const cur = state.currency;
  let example: ReturnType<typeof pulpPrice> = null;
  let exampleVariety: Variety | null = null;
  for (const v of state.varieties) {
    const r = pulpPrice(v.pulp.avg, v.pulp.ratio, v.prem100, state.prem100, state.roundStep, state.roundDir);
    if (r) {
      example = r;
      exampleVariety = v;
      break;
    }
  }
  let html = `Pulp is priced per variety on its own average buying price and ratio. <code>average buy ÷ ratio ÷ 10 + premium</code>.`;
  if (example && exampleVariety) {
    html +=
      ` ${esc(exampleVariety.name)}: ${esc(cur)} ${example.avg.toFixed(2)} ÷ ${(example.ratio / 100).toFixed(2)} ÷ 10 = ` +
      `${esc(cur)} ${example.cost100.toFixed(2)}, plus ${esc(cur)} ${example.prem.toFixed(2)}, giving ${esc(cur)} ${example.sell.toFixed(2)} per 100 g.`;
  }
  $("pulpNote").innerHTML = html;
}

function rebuild(): void {
  refs = emptyRefs();
  const mobile = MQ.matches;
  $("wrapWhole").hidden = mobile;
  $("cardsWhole").hidden = !mobile;
  $("wrapPulp").hidden = mobile;
  $("cardsPulp").hidden = !mobile;

  const cb = { onInput, onRemove };
  if (mobile) {
    buildCards(state, refs, $("cardsWhole"), "whole", cb);
    buildCards(state, refs, $("cardsPulp"), "pulp", cb);
  } else {
    buildWholeTable(state, refs, $<HTMLTableElement>("tblWhole"), cb);
    buildPulpTable(state, refs, $<HTMLTableElement>("tblPulp"), cb);
  }
  refreshOutputs(state, refs);
  updateNote();
}

function onRemove(v: Variety): void {
  state.varieties = state.varieties.filter((o) => o.id !== v.id);
  rebuild();
  persist();
}

function renderGrades(): void {
  const wrap = $("grades");
  wrap.innerHTML = "";
  state.grades.forEach((g: Grade) => {
    const chip = document.createElement("div");
    chip.className = "gchip";
    const inp = document.createElement("input");
    inp.value = g.name;
    inp.setAttribute("aria-label", "Grade name");
    inp.addEventListener("input", (e) => {
      g.name = (e.target as HTMLInputElement).value;
      rebuild();
      persist();
    });
    chip.appendChild(inp);
    if (state.grades.length > 1) {
      const x = document.createElement("button");
      x.textContent = "×";
      x.title = "Remove grade";
      x.addEventListener("click", () => {
        state.grades = state.grades.filter((o) => o.id !== g.id);
        state.varieties.forEach((v) => delete v.buy[g.id]);
        renderGrades();
        rebuild();
        persist();
      });
      chip.appendChild(x);
    }
    wrap.appendChild(chip);
  });
}

function setDbBarUI(): void {
  const info = db.getBarInfo();
  $("dbName").textContent = info.name;
  $("dbMode").textContent = info.modeText;
}

function showTab(which: "whole" | "pulp"): void {
  tab = which;
  const whole = which === "whole";
  $("paneWhole").hidden = !whole;
  $("panePulp").hidden = whole;
  $("tabWhole").setAttribute("aria-selected", String(whole));
  $("tabPulp").setAttribute("aria-selected", String(!whole));
}

function applyLoadResult(result: { grades: Grade[]; varieties: Variety[]; premKg: number | null; prem100: number | null; latestDate: string }): void {
  state.grades = result.grades;
  state.varieties = result.varieties;
  if (result.premKg !== null) state.premKg = result.premKg;
  if (result.prem100 !== null) state.prem100 = result.prem100;
  $<HTMLInputElement>("premKg").value = state.premKg.toFixed(2);
  $<HTMLInputElement>("prem100").value = state.prem100.toFixed(2);
  renderGrades();
  rebuild();
  setDbBarUI();
  persist();
  toast(`Loaded prices from ${result.latestDate}. Change the date before saving today's.`);
}

async function handleSave(): Promise<void> {
  try {
    const message = await db.saveToDb(state);
    setDbBarUI();
    toast(message);
  } catch (e) {
    toast((e as Error).message || "Save failed.", true);
  }
}

async function handleSaveAs(): Promise<void> {
  try {
    const message = await db.saveAsDb(state);
    setDbBarUI();
    toast(message);
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return;
    toast((e as Error).message || "Save failed.", true);
  }
}

async function handleOpen(): Promise<void> {
  if (!db.canPick()) {
    $<HTMLInputElement>("fileIn").click();
    return;
  }
  try {
    const { result } = await db.openDb();
    applyLoadResult(result);
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return;
    toast((e as Error).message || "Could not open that file.", true);
  }
}

async function handleFileInput(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const { result } = await db.openDbFromFile(file);
    applyLoadResult(result);
  } catch (err) {
    toast((err as Error).message || "Could not read that workbook.", true);
  }
}

async function handlePng(): Promise<void> {
  try {
    await exportPriceCard(state);
    toast("Price card saved. Ready to post.");
  } catch (e) {
    toast((e as Error).message || "Could not create the price card.", true);
  }
}

function handleCsv(): void {
  const csv = buildCsv(state);
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "sl-durian-prices-" + state.date + ".csv");
}

function handleReset(): void {
  if (!window.confirm("Reset every variety, grade and premium back to the seed data? This cannot be undone.")) return;
  state = seedState();
  $<HTMLInputElement>("cur").value = state.currency;
  $<HTMLInputElement>("pdate").value = state.date;
  $<HTMLInputElement>("premKg").value = state.premKg.toFixed(2);
  $<HTMLInputElement>("prem100").value = state.prem100.toFixed(2);
  $<HTMLSelectElement>("roundStep").value = String(state.roundStep);
  $<HTMLSelectElement>("roundDir").value = state.roundDir === "up" ? "up" : "near";
  $<HTMLInputElement>("cardMsg").value = state.cardMsg;
  $<HTMLInputElement>("bilingual").checked = state.bilingual;
  document.querySelectorAll<HTMLElement>("[data-cur]").forEach((el) => (el.textContent = state.currency));
  renderGrades();
  rebuild();
  persist();
  toast("Reset to seed data.");
}

let deferredPrompt: Event & { prompt?: () => void; userChoice?: Promise<unknown> };
function wireInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as typeof deferredPrompt;
    $("btnInstall").hidden = false;
  });
  $("btnInstall").addEventListener("click", async () => {
    if (!deferredPrompt?.prompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = undefined as never;
    $("btnInstall").hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    $("btnInstall").hidden = true;
    toast("Added to your home screen.");
  });
}

export async function initApp(): Promise<void> {
  const restored = await loadState();
  state = restored ?? seedState();

  await db.restorePersistedHandle();

  $<HTMLInputElement>("pdate").value = state.date;
  $<HTMLInputElement>("cur").value = state.currency;
  $<HTMLInputElement>("premKg").value = state.premKg.toFixed(2);
  $<HTMLInputElement>("prem100").value = state.prem100.toFixed(2);
  $<HTMLSelectElement>("roundStep").value = String(state.roundStep);
  $<HTMLSelectElement>("roundDir").value = state.roundDir === "up" ? "up" : "near";
  $<HTMLInputElement>("cardMsg").value = state.cardMsg;
  $<HTMLInputElement>("bilingual").checked = state.bilingual;
  document.querySelectorAll<HTMLElement>("[data-cur]").forEach((el) => (el.textContent = state.currency));

  ["premKg", "prem100"].forEach((id) => {
    $<HTMLInputElement>(id).addEventListener("input", (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (id === "premKg") state.premKg = isFinite(val) ? val : 0;
      else state.prem100 = isFinite(val) ? val : 0;
      onInput();
    });
  });
  $<HTMLSelectElement>("roundStep").addEventListener("change", (e) => {
    state.roundStep = parseFloat((e.target as HTMLSelectElement).value) || 0;
    onInput();
  });
  $<HTMLSelectElement>("roundDir").addEventListener("change", (e) => {
    state.roundDir = (e.target as HTMLSelectElement).value === "up" ? "up" : "nearest";
    onInput();
  });
  $<HTMLInputElement>("cur").addEventListener("input", (e) => {
    state.currency = (e.target as HTMLInputElement).value || "RM";
    document.querySelectorAll<HTMLElement>("[data-cur]").forEach((el) => (el.textContent = state.currency));
    rebuild();
    persist();
  });
  $<HTMLInputElement>("pdate").addEventListener("change", (e) => {
    state.date = (e.target as HTMLInputElement).value;
    persist();
  });
  $<HTMLInputElement>("cardMsg").addEventListener("input", (e) => {
    state.cardMsg = (e.target as HTMLInputElement).value;
    persist();
  });
  $<HTMLInputElement>("bilingual").addEventListener("change", (e) => {
    state.bilingual = (e.target as HTMLInputElement).checked;
    persist();
  });

  $("tabWhole").addEventListener("click", () => showTab("whole"));
  $("tabPulp").addEventListener("click", () => showTab("pulp"));

  $("addGrade").addEventListener("click", () => {
    const g: Grade = { id: uid(), name: "New" };
    state.grades.push(g);
    state.varieties.forEach((v) => {
      v.buy[g.id] = null;
    });
    renderGrades();
    rebuild();
    persist();
  });
  document.querySelectorAll<HTMLButtonElement>(".addVar").forEach((b) =>
    b.addEventListener("click", () => {
      state.varieties.push(newVariety(state.grades));
      rebuild();
      persist();
    })
  );

  $("btnSave").addEventListener("click", () => void handleSave());
  $("btnSaveAs").addEventListener("click", () => void handleSaveAs());
  $("btnOpen").addEventListener("click", () => void handleOpen());
  $("btnPng").addEventListener("click", () => void handlePng());
  $("btnCsv").addEventListener("click", handleCsv);
  $("btnPrint").addEventListener("click", () => window.print());
  $("btnReset").addEventListener("click", handleReset);
  $<HTMLInputElement>("fileIn").addEventListener("change", (e) => void handleFileInput(e));

  MQ.addEventListener("change", rebuild);

  wireInstallPrompt();
  renderGrades();
  rebuild();
  showTab(tab);
  setDbBarUI();
}
