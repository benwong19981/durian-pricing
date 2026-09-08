import type { State, Variety } from "../state";
import { cellInput, labelled, nameInput, outCell, premInput, removeBtn, type Kind, type Refs } from "./fields";
import type { TableCallbacks } from "./tables";

export function buildCards(state: State, refs: Refs, host: HTMLElement, kind: Kind, cb: TableCallbacks): void {
  const cur = state.currency;
  host.innerHTML = "";
  if (!state.varieties.length) {
    host.innerHTML = `<p class="empty">No varieties yet.</p>`;
    return;
  }

  state.varieties.forEach((v: Variety) => {
    const card = document.createElement("div");
    card.className = "vcard";
    const head = document.createElement("div");
    head.className = "vhead";
    head.appendChild(nameInput(refs, v, cb.onInput));
    head.appendChild(removeBtn(() => cb.onRemove(v)));
    card.appendChild(head);

    const pr = document.createElement("div");
    pr.className = "vprem";
    const label = document.createElement("span");
    label.textContent = "Premium " + cur + (kind === "whole" ? "/kg" : "/100 g");
    pr.appendChild(label);
    pr.appendChild(premInput(refs, kind, v, cb.onInput));
    card.appendChild(pr);

    if (kind === "whole") {
      state.grades.forEach((g) => {
        const row = document.createElement("div");
        row.className = "grow w";
        const gl = document.createElement("span");
        gl.className = "gl";
        gl.textContent = g.name;
        row.appendChild(gl);
        row.appendChild(
          labelled(
            "buy " + cur + "/kg",
            cellInput(
              v.buy[g.id] ?? null,
              (val) => {
                v.buy[g.id] = val;
              },
              cb.onInput,
              { label: v.name + " grade " + g.name + " buying price" }
            )
          )
        );
        row.appendChild(outCell(refs, "whole", v, g.id, "span"));
        card.appendChild(row);
      });
    } else {
      const row = document.createElement("div");
      row.className = "grow p";
      row.appendChild(
        labelled(
          "avg buy " + cur + "/kg",
          cellInput(
            v.pulp.avg,
            (val) => {
              v.pulp.avg = val;
            },
            cb.onInput,
            { label: v.name + " average buy" }
          )
        )
      );
      row.appendChild(
        labelled(
          "pulp ratio %",
          cellInput(
            v.pulp.ratio,
            (val) => {
              v.pulp.ratio = val;
            },
            cb.onInput,
            { label: v.name + " pulp ratio" }
          )
        )
      );
      row.appendChild(outCell(refs, "pulp", v, null, "span"));
      card.appendChild(row);
    }
    host.appendChild(card);
  });
}
