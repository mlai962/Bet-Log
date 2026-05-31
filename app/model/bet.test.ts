import { describe, it, expect } from "vitest";
import { getBetMultiplier, getBetOutcome, type Bet } from "./bet";

// These pure functions are the core money math. They are unchanged by the
// balances refactor, so this file must stay green BEFORE and AFTER.

describe("getBetMultiplier", () => {
  it("returns plain decimal odds unchanged", () => {
    expect(getBetMultiplier(2)).toBe(2);
    expect(getBetMultiplier(1.5)).toBe(1.5);
    expect(getBetMultiplier(3.25)).toBe(3.25);
  });

  it("expands X.33 to exact thirds (integerPart*3 + 1)/3", () => {
    // 1.33 -> (1*3 + 1)/3 = 4/3
    expect(getBetMultiplier(1.33)).toBeCloseTo(4 / 3, 10);
    // 2.33 -> (2*3 + 1)/3 = 7/3
    expect(getBetMultiplier(2.33)).toBeCloseTo(7 / 3, 10);
  });

  it("expands X.66 to exact thirds (integerPart*3 + 2)/3", () => {
    // 1.66 -> (1*3 + 2)/3 = 5/3
    expect(getBetMultiplier(1.66)).toBeCloseTo(5 / 3, 10);
    // 3.66 -> (3*3 + 2)/3 = 11/3
    expect(getBetMultiplier(3.66)).toBeCloseTo(11 / 3, 10);
  });
});

// Minimal structural bet — getBetOutcome only reads winner/betAmount/odds.
const bet = (over: Partial<Bet>): Bet =>
  ({ betAmount: 100, odds: 2, winner: "", ...over }) as Bet;

describe("getBetOutcome", () => {
  it("returns null when unsettled", () => {
    expect(getBetOutcome(bet({ winner: "" }))).toBeNull();
    expect(getBetOutcome(bet({ winner: "draw" }))).toBeNull();
  });

  it("userA win: profit = betAmount * (multiplier - 1), userB loses that", () => {
    // odds 2, stake 100 -> profit 100
    expect(getBetOutcome(bet({ winner: "userA", betAmount: 100, odds: 2 }))).toEqual({
      userA: 100,
      userB: -100,
    });
    // odds 1.5, stake 100 -> profit 50
    expect(getBetOutcome(bet({ winner: "userA", betAmount: 100, odds: 1.5 }))).toEqual({
      userA: 50,
      userB: -50,
    });
  });

  it("userA win with thirds odds rounds to cents", () => {
    // 1.33 -> 4/3 multiplier; stake 90 -> 90*(4/3 - 1) = 30
    expect(getBetOutcome(bet({ winner: "userA", betAmount: 90, odds: 1.33 }))).toEqual({
      userA: 30,
      userB: -30,
    });
  });

  it("userB win: userA loses the stake, userB gains the stake", () => {
    expect(getBetOutcome(bet({ winner: "userB", betAmount: 100, odds: 2 }))).toEqual({
      userA: -100,
      userB: 100,
    });
  });
});
