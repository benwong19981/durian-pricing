/** The whole business logic. Pure, unit tested, no DOM. */

export type RoundDir = "up" | "nearest";

/** Step 0 (or falsy) means no rounding. */
export function roundPrice(v: number, step: number, dir: RoundDir): number {
  if (!step) return v;
  return dir === "up" ? Math.ceil(v / step - 1e-9) * step : Math.round(v / step) * step;
}

export interface WholeResult {
  buy: number;
  prem: number;
  sell: number;
}

/** Whole fruit, per kg: sell = round(buy + premium). Null when there is no price to show. */
export function wholePrice(
  buy: number | null | undefined,
  premOverride: number | null | undefined,
  globalPremKg: number,
  step: number,
  dir: RoundDir
): WholeResult | null {
  if (buy === null || buy === undefined || buy <= 0) return null;
  const prem = premOverride === null || premOverride === undefined ? globalPremKg : premOverride;
  return { buy, prem, sell: roundPrice(buy + prem, step, dir) };
}

export interface PulpResult {
  avg: number;
  ratio: number;
  cost100: number;
  prem: number;
  sell: number;
  sellPerKg: number;
}

/**
 * Pulp, per 100 g: costPer100g = (avgBuy / (ratioPercent / 100)) / 10, sell = round(cost + premium).
 * Ratio is a percentage (e.g. 33 for 33%). Null when there is no price to show.
 */
export function pulpPrice(
  avg: number | null | undefined,
  ratio: number | null | undefined,
  premOverride: number | null | undefined,
  globalPrem100: number,
  step: number,
  dir: RoundDir
): PulpResult | null {
  if (avg === null || avg === undefined || avg <= 0) return null;
  if (ratio === null || ratio === undefined || ratio <= 0) return null;
  const cost100 = avg / (ratio / 100) / 10;
  const prem = premOverride === null || premOverride === undefined ? globalPrem100 : premOverride;
  const sell = roundPrice(cost100 + prem, step, dir);
  return { avg, ratio, cost100, prem, sell, sellPerKg: sell * 10 };
}
