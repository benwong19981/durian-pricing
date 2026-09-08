/**
 * Shared field builders plus the "live refs" registry.
 *
 * The single worst bug the spec calls out is rebuilding the DOM on every input event,
 * which yanks focus out from under whatever the owner is typing into. So structural
 * building (buildXTable / buildCards) happens only on structural change, and every
 * keystroke instead goes through refreshOutputs(), which walks these ref arrays and
 * patches only the text of the cells that could have changed. Nothing here remounts
 * an element that might be focused.
 */
import { pulpPrice, wholePrice, type PulpResult } from "../pricing";
import type { State, Variety } from "../state";
import { numOf } from "../util";

export type Kind = "whole" | "pulp";

export interface OutRef {
  el: HTMLElement;
  kind: Kind;
  v: Variety;
  gid: string | null;
}
export interface PremRef {
  el: HTMLInputElement;
  kind: Kind;
}
export interface NameRef {
  el: HTMLInputElement;
  v: Variety;
}
export interface CostRef {
  el: HTMLElement;
  v: Variety;
}
export interface Refs {
  out: OutRef[];
  prem: PremRef[];
  name: NameRef[];
  cost: CostRef[];
}

export function emptyRefs(): Refs {
  return { out: [], prem: [], name: [], cost: [] };
}

export function refreshOutputs(state: State, refs: Refs): void {
  refs.out.forEach((r) => {
    const res =
      r.kind === "whole"
        ? wholePrice(r.v.buy[r.gid!], r.v.premKg, state.premKg, state.roundStep, state.roundDir)
        : pulpPrice(r.v.pulp.avg, r.v.pulp.ratio, r.v.prem100, state.prem100, state.roundStep, state.roundDir);
    r.el.querySelectorAll(".subout").forEach((n) => n.remove());
    if (!res) {
      r.el.className = "out void";
      r.el.textContent = "–";
      return;
    }
    r.el.className = "out";
    r.el.textContent = res.sell.toFixed(2);
    if (r.kind === "pulp") {
      const s = document.createElement("span");
      s.className = "subout";
      s.textContent = (res as PulpResult).sellPerKg.toFixed(2) + " /kg";
      r.el.appendChild(s);
    }
  });
  refs.cost.forEach((r) => {
    const res = pulpPrice(r.v.pulp.avg, r.v.pulp.ratio, r.v.prem100, state.prem100, state.roundStep, state.roundDir);
    r.el.textContent = res ? res.cost100.toFixed(2) : "–";
  });
  refs.prem.forEach((r) => {
    r.el.placeholder = (r.kind === "whole" ? state.premKg : state.prem100).toFixed(2);
  });
}

export function syncName(refs: Refs, v: Variety, from: HTMLInputElement): void {
  refs.name.forEach((r) => {
    if (r.v === v && r.el !== from) r.el.value = v.name;
  });
}

export function cellInput(
  value: number | null,
  onChange: (v: number | null) => void,
  onInput: () => void,
  opts: { cls?: string; step?: string; placeholder?: string; label?: string } = {}
): HTMLInputElement {
  const i = document.createElement("input");
  i.type = "number";
  i.inputMode = "decimal";
  i.className = "cell" + (opts.cls ? " " + opts.cls : "");
  i.value = value === null || value === undefined ? "" : String(value);
  i.min = "0";
  i.step = opts.step || "0.5";
  i.placeholder = opts.placeholder || "–";
  if (opts.label) i.setAttribute("aria-label", opts.label);
  i.addEventListener("input", (e) => {
    onChange(numOf((e.target as HTMLInputElement).value));
    onInput();
  });
  i.addEventListener("focus", (e) => (e.target as HTMLInputElement).select());
  return i;
}

export function nameInput(refs: Refs, v: Variety, onInput: () => void): HTMLInputElement {
  const i = document.createElement("input");
  i.className = "vname";
  i.value = v.name;
  i.setAttribute("aria-label", "Variety name");
  i.addEventListener("input", (e) => {
    v.name = (e.target as HTMLInputElement).value;
    syncName(refs, v, e.target as HTMLInputElement);
    onInput();
  });
  refs.name.push({ el: i, v });
  return i;
}

export function removeBtn(onRemove: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "rm";
  b.textContent = "×";
  b.title = "Remove variety";
  b.setAttribute("aria-label", "Remove variety");
  b.addEventListener("click", onRemove);
  return b;
}

export function outCell(refs: Refs, kind: Kind, v: Variety, gid: string | null, tag?: string): HTMLElement {
  const el = document.createElement(tag || "td");
  el.className = "out void";
  refs.out.push({ el, kind, v, gid });
  return el;
}

export function premInput(refs: Refs, kind: Kind, v: Variety, onInput: () => void): HTMLInputElement {
  const i = cellInput(
    kind === "whole" ? v.premKg : v.prem100,
    (val) => {
      if (kind === "whole") v.premKg = val;
      else v.prem100 = val;
    },
    onInput,
    { cls: "thin ovr", label: "Premium override for " + v.name }
  );
  refs.prem.push({ el: i, kind });
  return i;
}

export function labelled(text: string, input: HTMLElement): HTMLDivElement {
  const wrap = document.createElement("div");
  const l = document.createElement("span");
  l.className = "fieldlab";
  l.textContent = text;
  wrap.appendChild(l);
  wrap.appendChild(input);
  return wrap;
}
