/**
 * The branded price card. Layout numbers, colors and copy come straight from the
 * reference draft (`exportPng`, `sectionBar`, `priceRow`, `prepareLogo`) — they are
 * tuned and the spec says to keep them.
 */
import { pulpPrice, wholePrice } from "./pricing";
import type { State } from "./state";
import { downloadBlob, formatDate } from "./util";

const C = {
  bg: "#11523A",
  gold: "#F2D26D",
  goldDim: "#C9A23C",
  cream: "#FFF8E7",
  dim: "#8FB7A0",
};
const FB = (w: number, s: number) => `${w} ${s}px "Barlow Semi Condensed", system-ui, sans-serif`;
const FC = (w: number, s: number) => `${w} ${s}px "Noto Sans SC", "Barlow Semi Condensed", sans-serif`;

const logoImg = new Image();
let logoReady = false;
let logoArt: HTMLCanvasElement | null = null;
let logoLoadPromise: Promise<void> | null = null;

/**
 * logo-full.jpg carries the brand green as a flat background. Drawing it directly
 * leaves a visible rectangle against the card, so key it out once: walk the pixel
 * data and set alpha from the distance to rgb(17,82,58).
 */
function prepareLogo(): void {
  const w = logoImg.naturalWidth;
  const h = logoImg.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(logoImg, 0, 0);
  try {
    const d = x.getImageData(0, 0, w, h);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const dist = Math.abs(px[i] - 17) + Math.abs(px[i + 1] - 82) + Math.abs(px[i + 2] - 58);
      px[i + 3] = Math.max(0, Math.min(255, ((dist - 42) * 255) / 62));
    }
    x.putImageData(d, 0, 0);
  } catch {
    /* keep the unkeyed logo */
  }
  logoArt = c;
}

export function initCardAssets(): Promise<void> {
  if (!logoLoadPromise) {
    logoLoadPromise = new Promise((resolve) => {
      logoImg.onload = () => {
        prepareLogo();
        logoReady = true;
        resolve();
      };
      logoImg.onerror = () => resolve();
      logoImg.src = "logo-full.jpg";
    });
  }
  return logoLoadPromise;
}

function rrect(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number): void {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

function sectionBar(x: CanvasRenderingContext2D, y: number, pad: number, inner: number, h: number, label: string, unit: string, bi: boolean): number {
  const g = x.createLinearGradient(pad, y, pad + inner, y);
  g.addColorStop(0, "#F2D26D");
  g.addColorStop(0.55, "#E5BE4F");
  g.addColorStop(1, "#C9A23C");
  x.fillStyle = g;
  rrect(x, pad, y + 8, inner, h - 16, 6);
  x.fill();
  x.fillStyle = "#0B3D2B";
  x.textAlign = "left";
  x.textBaseline = "middle";
  x.font = bi ? FC(700, 30) : FB(700, 33);
  x.fillText(label, pad + 22, y + h / 2 + 1);
  x.textAlign = "right";
  x.font = FB(600, 27);
  x.fillText(unit, pad + inner - 22, y + h / 2 + 1);
  x.textBaseline = "alphabetic";
  return y + h;
}

function clip(x: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (x.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 3 && x.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function priceRow(x: CanvasRenderingContext2D, y: number, pad: number, inner: number, h: number, i: number, name: string, nameW: number): void {
  if (i % 2) {
    x.fillStyle = "rgba(255,255,255,0.05)";
    x.fillRect(pad, y, inner, h);
  }
  x.fillStyle = C.cream;
  x.textAlign = "left";
  x.font = FC(500, 28);
  x.fillText(clip(x, name, nameW - 30), pad + 16, y + h / 2 + 11);
  x.strokeStyle = "rgba(255,255,255,0.09)";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(pad, y + h - 0.5);
  x.lineTo(pad + inner, y + h - 0.5);
  x.stroke();
}

export class NoPricesError extends Error {
  constructor() {
    super("Enter some prices first.");
    this.name = "NoPricesError";
  }
}

export async function exportPriceCard(state: State): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* draw with whatever font is available rather than fail the export */
  }
  const cn = state.currency;
  const bi = state.bilingual;

  const grades = state.grades.filter((g) => state.varieties.some((v) => wholePrice(v.buy[g.id], v.premKg, state.premKg, state.roundStep, state.roundDir)));
  const wList = state.varieties.filter((v) => grades.some((g) => wholePrice(v.buy[g.id], v.premKg, state.premKg, state.roundStep, state.roundDir)));
  const pList = state.varieties.filter((v) => pulpPrice(v.pulp.avg, v.pulp.ratio, v.prem100, state.prem100, state.roundStep, state.roundDir));
  if (!wList.length && !pList.length) throw new NoPricesError();

  const W = 1080;
  const pad = 56;
  const inner = W - pad * 2;
  const colW = grades.length ? Math.max(150, Math.min(210, Math.round(620 / grades.length))) : 0;
  const nameW = inner - colW * grades.length;

  const logoH = logoReady ? Math.round((300 * logoImg.naturalHeight) / logoImg.naturalWidth) : 0;
  const headH = 40 + logoH + 26 + 54 + 40;
  const barH = 74;
  const gradeH = grades.length ? 52 : 0;
  const rowH = 66;
  const gap = 30;
  const wSec = wList.length ? barH + gradeH + rowH * wList.length : 0;
  const pSec = pList.length ? barH + rowH * pList.length : 0;
  const footH = 134;
  const H = headH + wSec + (wSec && pSec ? gap : 0) + pSec + footH;

  const c = document.createElement("canvas");
  const dpr = 2;
  c.width = W * dpr;
  c.height = H * dpr;
  const x = c.getContext("2d")!;
  x.scale(dpr, dpr);

  x.fillStyle = C.bg;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, headH * 0.42, 40, W / 2, headH * 0.42, W * 0.72);
  glow.addColorStop(0, "rgba(242,210,109,0.16)");
  glow.addColorStop(1, "rgba(242,210,109,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, headH + 120);

  x.strokeStyle = "rgba(242,210,109,0.55)";
  x.lineWidth = 2;
  rrect(x, 18, 18, W - 36, H - 36, 10);
  x.stroke();
  x.strokeStyle = "rgba(242,210,109,0.22)";
  x.lineWidth = 1;
  rrect(x, 27, 27, W - 54, H - 54, 6);
  x.stroke();

  let y = 40;
  if (logoReady && logoArt) {
    x.drawImage(logoArt, (W - 300) / 2, y, 300, logoH);
    y += logoH + 26;
  } else {
    y += 20;
  }

  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  x.fillStyle = C.gold;
  x.font = FB(700, 42);
  x.fillText(formatDate(state.date), W / 2, y + 22);
  x.fillStyle = C.dim;
  x.font = bi ? FC(500, 24) : FB(500, 26);
  x.fillText(bi ? "今日榴莲价格  ·  Today's prices" : "Today's prices", W / 2, y + 54);
  y = headH;

  if (wList.length) {
    y = sectionBar(x, y, pad, inner, barH, bi ? "整果  Whole fruit" : "Whole fruit", cn + " / kg", bi);
    x.textAlign = "right";
    x.fillStyle = C.goldDim;
    x.font = FB(600, 25);
    grades.forEach((g, i) => x.fillText("Grade " + g.name, pad + nameW + colW * (i + 1) - 16, y + gradeH / 2 + 8));
    x.strokeStyle = "rgba(242,210,109,0.28)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(pad, y + gradeH - 0.5);
    x.lineTo(W - pad, y + gradeH - 0.5);
    x.stroke();
    y += gradeH;

    wList.forEach((v, i) => {
      priceRow(x, y, pad, inner, rowH, i, v.name, nameW);
      grades.forEach((g, gi) => {
        const r = wholePrice(v.buy[g.id], v.premKg, state.premKg, state.roundStep, state.roundDir);
        x.textAlign = "right";
        if (r) {
          x.fillStyle = C.gold;
          x.font = FB(700, 34);
          x.fillText(r.sell.toFixed(2), pad + nameW + colW * (gi + 1) - 16, y + rowH / 2 + 12);
        } else {
          x.fillStyle = "rgba(255,248,231,0.28)";
          x.font = FB(400, 28);
          x.fillText("–", pad + nameW + colW * (gi + 1) - 16, y + rowH / 2 + 10);
        }
      });
      y += rowH;
    });
    if (pList.length) y += gap;
  }

  if (pList.length) {
    y = sectionBar(x, y, pad, inner, barH, bi ? "果肉  Pulp" : "Pulp", cn + " / 100 g", bi);
    pList.forEach((v, i) => {
      priceRow(x, y, pad, inner, rowH, i, v.name, inner - 260);
      const r = pulpPrice(v.pulp.avg, v.pulp.ratio, v.prem100, state.prem100, state.roundStep, state.roundDir)!;
      x.textAlign = "right";
      x.fillStyle = C.gold;
      x.font = FB(700, 34);
      x.fillText(r.sell.toFixed(2), W - pad - 16, y + rowH / 2 + 12);
      y += rowH;
    });
  }

  const msg = state.cardMsg.trim();
  x.strokeStyle = "rgba(242,210,109,0.3)";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(pad, H - 106);
  x.lineTo(W - pad, H - 106);
  x.stroke();
  x.textAlign = "center";
  if (msg) {
    x.fillStyle = C.cream;
    x.font = bi ? FC(500, 27) : FB(600, 30);
    x.fillText(msg, W / 2, H - 64);
  }
  x.fillStyle = "rgba(143,183,160,0.85)";
  x.font = FB(500, 21);
  x.fillText("Prices subject to change  ·  价格如有更改恕不另行通知", W / 2, H - 26);

  await new Promise<void>((resolve, reject) => {
    c.toBlob((b) => {
      if (!b) {
        reject(new Error("Could not render the price card."));
        return;
      }
      downloadBlob(b, "sl-durian-prices-" + state.date + ".png");
      resolve();
    }, "image/png");
  });
}
