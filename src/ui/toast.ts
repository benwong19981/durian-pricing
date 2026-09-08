let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string, isErr = false): void {
  clearTimeout(toastTimer);
  let t = document.querySelector<HTMLDivElement>(".toast");
  if (!t) {
    t = document.createElement("div");
    document.body.appendChild(t);
  }
  t.className = "toast" + (isErr ? " err" : "");
  t.textContent = msg;
  toastTimer = setTimeout(() => t!.remove(), 4000);
}
