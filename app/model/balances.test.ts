import { describe, it, expect } from "vitest";
import {
  type BalanceBet,
  betPairContribution,
  computeBalances,
  pairKey,
  profitVs,
  totalProfit,
} from "./balances";

// Same fixture + expected numbers as the BEFORE characterization (which ran
// against the old name-based calculateProfit). Asserting identical values via
// the new id-based helpers proves behavioural equivalence across the refactor.

const ALICE = { id: "u1", name: "Alice" };
const BOB = { id: "u2", name: "Bob" };
const CAROL = { id: "u3", name: "Carol" };
const IDS = [ALICE.id, BOB.id, CAROL.id];

const mk = (
  userA: { id: string },
  userB: { id: string },
  betAmount: number,
  odds: number,
  winner: string,
): BalanceBet => ({ userA, userB, betAmount, odds, winner });

const FIXTURE: BalanceBet[] = [
  mk(ALICE, BOB, 100, 2, "userA"), // Alice +100 vs Bob
  mk(BOB, ALICE, 50, 2, "userB"), // Alice (as userB) +50 vs Bob
  mk(ALICE, CAROL, 90, 1.33, "userA"), // Alice +30 vs Carol (thirds odds)
  mk(CAROL, BOB, 200, 1.5, "userB"), // Bob (as userB) +200 vs Carol
  mk(ALICE, BOB, 999, 3, ""), // unsettled -> ignored
];

const EXPECTED_PAIRWISE = {
  AliceVsBob: 150,
  AliceVsCarol: 30,
  BobVsAlice: -150,
  BobVsCarol: 200,
  CarolVsAlice: -30,
  CarolVsBob: -200,
};

const EXPECTED_TOTALS = { Alice: 180, Bob: 50, Carol: -230 };

describe("balances (AFTER: id-based aggregate helpers)", () => {
  const { pairs } = computeBalances(FIXTURE);

  it("computes pairwise net profit", () => {
    expect(profitVs(pairs, ALICE.id, BOB.id)).toBe(EXPECTED_PAIRWISE.AliceVsBob);
    expect(profitVs(pairs, ALICE.id, CAROL.id)).toBe(EXPECTED_PAIRWISE.AliceVsCarol);
    expect(profitVs(pairs, BOB.id, ALICE.id)).toBe(EXPECTED_PAIRWISE.BobVsAlice);
    expect(profitVs(pairs, BOB.id, CAROL.id)).toBe(EXPECTED_PAIRWISE.BobVsCarol);
    expect(profitVs(pairs, CAROL.id, ALICE.id)).toBe(EXPECTED_PAIRWISE.CarolVsAlice);
    expect(profitVs(pairs, CAROL.id, BOB.id)).toBe(EXPECTED_PAIRWISE.CarolVsBob);
  });

  it("computes total net profit per user", () => {
    expect(totalProfit(pairs, ALICE.id, IDS)).toBe(EXPECTED_TOTALS.Alice);
    expect(totalProfit(pairs, BOB.id, IDS)).toBe(EXPECTED_TOTALS.Bob);
    expect(totalProfit(pairs, CAROL.id, IDS)).toBe(EXPECTED_TOTALS.Carol);
  });

  it("is zero-sum across all users", () => {
    const sum = IDS.reduce((s, id) => s + totalProfit(pairs, id, IDS), 0);
    expect(sum).toBe(0);
  });

  it("ignores unsettled bets", () => {
    const { pairs: p } = computeBalances([mk(ALICE, BOB, 999, 3, "")]);
    expect(profitVs(p, ALICE.id, BOB.id)).toBe(0);
  });

  it("pairKey is order-independent", () => {
    expect(pairKey(ALICE.id, BOB.id)).toBe(pairKey(BOB.id, ALICE.id));
  });
});

// The aggregate write-path applies betPairContribution deltas incrementally.
// This must always equal a from-scratch computeBalances of the surviving bets.
describe("delta invariant: incremental aggregate == full recompute", () => {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Apply old->new contribution to a running pairs map (mirrors applyBalanceDeltas).
  const apply = (
    pairs: Record<string, number>,
    oldC: { key: string; amount: number } | null,
    newC: { key: string; amount: number } | null,
  ) => {
    if (oldC) pairs[oldC.key] = round2((pairs[oldC.key] ?? 0) - oldC.amount);
    if (newC) pairs[newC.key] = round2((pairs[newC.key] ?? 0) + newC.amount);
  };

  it("survives create -> settle -> edit -> unsettle -> delete", () => {
    const running: Record<string, number> = {};
    const live: BalanceBet[] = [];

    const assertParity = () => {
      const full = computeBalances(live).pairs;
      const keys = new Set([...Object.keys(running), ...Object.keys(full)]);
      for (const k of keys) {
        expect(running[k] ?? 0).toBeCloseTo(full[k] ?? 0, 6);
      }
    };

    // create (unsettled) -> no contribution
    const bet1 = mk(ALICE, BOB, 100, 2, "");
    live.push(bet1);
    apply(running, null, betPairContribution(bet1));
    assertParity();

    // settle bet1 -> userA wins
    const bet1Settled = { ...bet1, winner: "userA" };
    apply(running, betPairContribution(bet1), betPairContribution(bet1Settled));
    live[0] = bet1Settled;
    assertParity();

    // add + settle a second bet on a different pair
    const bet2 = mk(CAROL, BOB, 200, 1.5, "userB");
    live.push(bet2);
    apply(running, null, betPairContribution(bet2));
    assertParity();

    // edit bet1: change amount/odds
    const bet1Edited = { ...bet1Settled, betAmount: 90, odds: 1.33 };
    apply(running, betPairContribution(bet1Settled), betPairContribution(bet1Edited));
    live[0] = bet1Edited;
    assertParity();

    // unsettle bet1
    const bet1Unsettled = { ...bet1Edited, winner: "" };
    apply(running, betPairContribution(bet1Edited), betPairContribution(bet1Unsettled));
    live[0] = bet1Unsettled;
    assertParity();

    // delete bet2
    apply(running, betPairContribution(bet2), null);
    live.splice(1, 1);
    assertParity();
  });
});
