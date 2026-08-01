import { describe, it, expect } from "vitest";
import {
  type BalanceBet,
  type BalanceTransfer,
  betPairContribution,
  computeBalances,
  computeTransferBalances,
  owedVs,
  pairKey,
  pairsDrifted,
  profitVs,
  totalOwed,
  totalProfit,
  transferPairContribution,
  transferredVs,
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

// Transfers are tracked in parallel with profit: profit says who won what,
// transfers say who has actually paid what, and owedVs nets the two.
describe("transfers: pair aggregate and outstanding debt", () => {
  const tf = (
    from: { id: string },
    to: { id: string },
    amount: number,
  ): BalanceTransfer => ({ from, to, amount });

  it("stores the lower id's net payment to the higher id", () => {
    // u1 pays u2: positive from the lower id's side.
    expect(transferPairContribution(tf(ALICE, BOB, 40))).toEqual({
      key: pairKey(ALICE.id, BOB.id),
      amount: 40,
    });
    // u2 pays u1: negative from the lower id's side.
    expect(transferPairContribution(tf(BOB, ALICE, 40))).toEqual({
      key: pairKey(ALICE.id, BOB.id),
      amount: -40,
    });
  });

  it("rejects degenerate transfers", () => {
    expect(transferPairContribution(tf(ALICE, ALICE, 40))).toBeNull();
    expect(transferPairContribution(tf(ALICE, BOB, 0))).toBeNull();
    expect(transferPairContribution(tf(ALICE, BOB, -5))).toBeNull();
  });

  it("nets opposing transfers within a pair", () => {
    const { pairs } = computeTransferBalances([
      tf(ALICE, BOB, 100),
      tf(BOB, ALICE, 30),
    ]);
    expect(transferredVs(pairs, ALICE.id, BOB.id)).toBe(70);
    expect(transferredVs(pairs, BOB.id, ALICE.id)).toBe(-70);
  });

  it("nets transfers against profit into outstanding debt", () => {
    // Alice is +150 profit vs Bob (Bob owes Alice 150).
    const { pairs: profitPairs } = computeBalances([
      { userA: ALICE, userB: BOB, betAmount: 100, odds: 2, winner: "userA" },
      { userA: BOB, userB: ALICE, betAmount: 50, odds: 2, winner: "userB" },
    ]);
    expect(profitVs(profitPairs, ALICE.id, BOB.id)).toBe(150);

    // Bob pays Alice 40 -> still owes 110.
    const { pairs: transferPairs } = computeTransferBalances([
      tf(BOB, ALICE, 40),
    ]);
    expect(owedVs(profitPairs, transferPairs, ALICE.id, BOB.id)).toBe(110);
    expect(owedVs(profitPairs, transferPairs, BOB.id, ALICE.id)).toBe(-110);

    // Bob settles in full -> nothing outstanding, profit history untouched.
    const settled = computeTransferBalances([tf(BOB, ALICE, 150)]).pairs;
    expect(owedVs(profitPairs, settled, ALICE.id, BOB.id)).toBe(0);
    expect(profitVs(profitPairs, ALICE.id, BOB.id)).toBe(150);

    // Overpayment flips the direction of the debt.
    const overpaid = computeTransferBalances([tf(BOB, ALICE, 200)]).pairs;
    expect(owedVs(profitPairs, overpaid, ALICE.id, BOB.id)).toBe(-50);
  });

  it("totalOwed sums outstanding debt across users and stays zero-sum", () => {
    const { pairs: profitPairs } = computeBalances(FIXTURE);
    const { pairs: transferPairs } = computeTransferBalances([
      tf(BOB, ALICE, 100), // Bob pays down part of the 150 he owes Alice
      tf(CAROL, BOB, 200), // Carol settles with Bob in full
    ]);

    expect(totalOwed(profitPairs, transferPairs, ALICE.id, IDS)).toBe(80);
    expect(totalOwed(profitPairs, transferPairs, BOB.id, IDS)).toBe(-50);
    expect(totalOwed(profitPairs, transferPairs, CAROL.id, IDS)).toBe(-30);

    const sum = IDS.reduce(
      (s, id) => s + totalOwed(profitPairs, transferPairs, id, IDS),
      0,
    );
    expect(sum).toBe(0);
  });

  it("pairsDrifted flags real drift and tolerates rounding noise", () => {
    expect(pairsDrifted({ a: 10 }, { a: 10.001 })).toBe(false);
    expect(pairsDrifted({ a: 10 }, { a: 10.02 })).toBe(true);
    expect(pairsDrifted({}, { a: 5 })).toBe(true);
    expect(pairsDrifted({ a: 0 }, {})).toBe(false);
  });
});
