import type { State, Variety } from "../state";
import { esc } from "../util";
import { cellInput, nameInput, outCell, premInput, removeBtn, type Refs } from "./fields";

export interface TableCallbacks {
  onInput: () => void;
  onRemove: (v: Variety) => void;
}

export function buildWholeTable(state: State, refs: Refs, table: HTMLTableElement, cb: TableCallbacks): void {
  const cur = state.currency;
  let h = `<tr><th class='name' rowspan='2'>Variety</th><th rowspan='2'>Premium<br>${esc(cur)}/kg</th>`;
  state.grades.forEach((g) => (h += `<th class='grp gsep' colspan='2'>Grade ${esc(g.name) || "?"}</th>`));
  h += `<th rowspan='2'></th></tr><tr>`;
  state.grades.forEach(() => (h += `<th class='sub gsep'>buy ${esc(cur)}/kg</th><th class='sub'>sell ${esc(cur)}/kg</th>`));
  table.tHead!.innerHTML = h + `</tr>`;

  const body = table.tBodies[0];
  body.innerHTML = "";
  if (!state.varieties.length) {
    body.innerHTML = `<tr><td class="empty" colspan="${3 + state.grades.length * 2}">No varieties yet.</td></tr>`;
    return;
  }
  state.varieties.forEach((v) => {
    const tr = document.createElement("tr");
    const tdN = document.createElement("td");
    tdN.className = "name";
    tdN.appendChild(nameInput(refs, v, cb.onInput));
    tr.appendChild(tdN);

    const tdP = document.createElement("td");
    tdP.appendChild(premInput(refs, "whole", v, cb.onInput));
    tr.appendChild(tdP);

    state.grades.forEach((g) => {
      const tdB = document.createElement("td");
      tdB.className = "gsep";
      tdB.appendChild(
        cellInput(
          v.buy[g.id] ?? null,
          (val) => {
            v.buy[g.id] = val;
          },
          cb.onInput,
          { label: v.name + " grade " + g.name + " buying price" }
        )
      );
      tr.appendChild(tdB);
      tr.appendChild(outCell(refs, "whole", v, g.id));
    });

    const tdR = document.createElement("td");
    tdR.appendChild(removeBtn(() => cb.onRemove(v)));
    tr.appendChild(tdR);
    body.appendChild(tr);
  });
}

export function buildPulpTable(state: State, refs: Refs, table: HTMLTableElement, cb: TableCallbacks): void {
  const cur = state.currency;
  table.tHead!.innerHTML =
    `<tr><th class='name'>Variety</th>` +
    `<th>Average buy<br>${esc(cur)}/kg</th><th>Pulp ratio<br>%</th>` +
    `<th>Premium<br>${esc(cur)}/100 g</th><th class='gsep'>Cost<br>${esc(cur)}/100 g</th>` +
    `<th>Sell<br>${esc(cur)}/100 g</th><th></th></tr>`;

  const body = table.tBodies[0];
  body.innerHTML = "";
  if (!state.varieties.length) {
    body.innerHTML = `<tr><td class="empty" colspan="7">No varieties yet.</td></tr>`;
    return;
  }
  state.varieties.forEach((v) => {
    const tr = document.createElement("tr");
    const tdN = document.createElement("td");
    tdN.className = "name";
    tdN.appendChild(nameInput(refs, v, cb.onInput));
    tr.appendChild(tdN);

    const tdA = document.createElement("td");
    tdA.appendChild(
      cellInput(
        v.pulp.avg,
        (val) => {
          v.pulp.avg = val;
        },
        cb.onInput,
        { label: v.name + " average buying price for pulp" }
      )
    );
    tr.appendChild(tdA);

    const tdR2 = document.createElement("td");
    tdR2.appendChild(
      cellInput(
        v.pulp.ratio,
        (val) => {
          v.pulp.ratio = val;
        },
        cb.onInput,
        { cls: "thin", label: v.name + " pulp ratio" }
      )
    );
    tr.appendChild(tdR2);

    const tdP = document.createElement("td");
    tdP.appendChild(premInput(refs, "pulp", v, cb.onInput));
    tr.appendChild(tdP);

    const tdC = document.createElement("td");
    tdC.className = "gsep muted";
    tdC.textContent = "–";
    refs.cost.push({ el: tdC, v });
    tr.appendChild(tdC);

    tr.appendChild(outCell(refs, "pulp", v, null));

    const tdX = document.createElement("td");
    tdX.appendChild(removeBtn(() => cb.onRemove(v)));
    tr.appendChild(tdX);
    body.appendChild(tr);
  });
}
