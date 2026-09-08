import { describe, expect, it } from "vitest";
import { pulpPrice, roundPrice, wholePrice } from "./pricing";

describe("roundPrice", () => {
  it("does nothing when step is 0", () => {
    expect(roundPrice(13.64, 0, "up")).toBe(13.64);
  });
  it("rounds up to the step", () => {
    expect(roundPrice(13.64, 0.5, "up")).toBe(14);
    expect(roundPrice(12.01, 1, "up")).toBe(13);
  });
  it("does not bump an exact multiple to the next step", () => {
    expect(roundPrice(14, 0.5, "up")).toBe(14);
    expect(roundPrice(15, 5, "up")).toBe(15);
    // classic float error case: 0.7/0.1 is 6.999999999999999 in IEEE754
    expect(roundPrice(0.7, 0.1, "up")).toBeCloseTo(0.7, 10);
  });
  it("rounds to nearest", () => {
    expect(roundPrice(13.2, 0.5, "nearest")).toBe(13);
    expect(roundPrice(13.3, 0.5, "nearest")).toBe(13.5);
  });
});

describe("wholePrice", () => {
  it("returns null when buy is missing or zero", () => {
    expect(wholePrice(null, null, 8, 0.5, "up")).toBeNull();
    expect(wholePrice(0, null, 8, 0.5, "up")).toBeNull();
  });
  it("adds the global premium when there is no override", () => {
    const r = wholePrice(45, null, 8, 0.5, "up");
    expect(r).toEqual({ buy: 45, prem: 8, sell: 53 });
  });
  it("uses the row override instead of the global premium", () => {
    const r = wholePrice(45, 10, 8, 0.5, "up");
    expect(r).toEqual({ buy: 45, prem: 10, sell: 55 });
  });
});

describe("pulpPrice", () => {
  it("returns null when avg or ratio is missing or zero", () => {
    expect(pulpPrice(null, 33, 3, 3, 0.5, "up")).toBeNull();
    expect(pulpPrice(45, null, 3, 3, 0.5, "up")).toBeNull();
    expect(pulpPrice(45, 0, 3, 3, 0.5, "up")).toBeNull();
    expect(pulpPrice(0, 33, 3, 3, 0.5, "up")).toBeNull();
  });

  it("matches the spec's worked example: RM45 at 33% + RM3 premium, rounded up to 0.50", () => {
    const r = pulpPrice(45, 33, null, 3, 0.5, "up")!;
    expect(r.cost100).toBeCloseTo(13.636363636, 6);
    expect(r.sell).toBe(17);
    expect(r.sellPerKg).toBe(170);
  });

  it("falls back to the global premium when the row override is null", () => {
    const r = pulpPrice(45, 33, null, 3, 0.5, "up")!;
    expect(r.prem).toBe(3);
  });

  it("uses the row override instead of the global premium", () => {
    const r = pulpPrice(45, 33, 5, 3, 0.5, "up")!;
    expect(r.prem).toBe(5);
  });

  it("never produces Infinity or NaN", () => {
    const r = pulpPrice(45, 33, null, 3, 0, "up")!;
    expect(Number.isFinite(r.cost100)).toBe(true);
    expect(Number.isFinite(r.sell)).toBe(true);
  });
});
