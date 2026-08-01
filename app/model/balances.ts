import { getBetOutcome } from "./bet";

/**
 * Persisted balances aggregate. Keyed by stable user IDs (rename-safe) as
 * canonical unordered pairs so each pair is stored once.
 *
 * pairs[key] = net profit of the LOWER id against the HIGHER id.
 */
export type BalancesDoc = { pairs: Record<string, number> };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Canonical, order-independent key for a pair of user ids. */
export const pairKey = (a: string, b: string): string =>
  a < b ? `${a}__${b}` : `${b}__${a}`;

/** A bet-shaped value with just the fields balances care about. */
export type BalanceBet = {
  userA: { id: string };
  userB: { id: string };
  betAmount: number;
  odds: number;
  winner: string;
};

/**
 * Net contribution of a single bet to its canonical pair, expressed as the
 * lower id's profit against the higher id. Returns null for unsettled bets.
 */
export const betPairContribution = (
  bet: BalanceBet,
): { key: string; amount: number } | null => {
  const outcome = getBetOutcome(bet as any);
  if (!outcome) return null;
  const a = bet.userA.id;
  const b = bet.userB.id;
  return { key: pairKey(a, b), amount: a < b ? outcome.userA : outcome.userB };
};

/** Build the full aggregate from a list of bets (single O(N) pass). */
export const computeBalances = (bets: BalanceBet[]): BalancesDoc => {
  const pairs: Record<string, number> = {};
  for (const bet of bets) {
    const c = betPairContribution(bet);
    if (!c) continue;
    pairs[c.key] = round2((pairs[c.key] ?? 0) + c.amount);
  }
  return { pairs };
};

/** Net profit of user `aId` against user `bId`, read from the aggregate. */
export const profitVs = (
  pairs: Record<string, number>,
  aId: string,
  bId: string,
): number => {
  const v = pairs[pairKey(aId, bId)] ?? 0;
  return aId < bId ? v : -v;
};

/** Total net profit of user `aId` across every other user. */
export const totalProfit = (
  pairs: Record<string, number>,
  aId: string,
  allUserIds: string[],
): number =>
  allUserIds
    .filter((id) => id !== aId)
    .reduce((sum, bId) => round2(sum + profitVs(pairs, aId, bId)), 0);

/** True when two pairs maps disagree beyond rounding noise. */
export const pairsDrifted = (
  a: Record<string, number>,
  b: Record<string, number>,
): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 0.005) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Transfers: cash settlements between users, tracked in parallel with bet
// profit. Their aggregate doc has the same shape as the profit aggregate:
// pairs[key] = net amount the LOWER id has PAID the HIGHER id.
// ---------------------------------------------------------------------------

/** A transfer-shaped value with just the fields balances care about. */
export type BalanceTransfer = {
  from: { id: string };
  to: { id: string };
  amount: number;
};

/**
 * Net contribution of a single transfer to its canonical pair, expressed as
 * the lower id's net payment to the higher id. Returns null for degenerate
 * transfers (self-payments, non-positive amounts).
 */
export const transferPairContribution = (
  t: BalanceTransfer,
): { key: string; amount: number } | null => {
  if (t.from.id === t.to.id || !(t.amount > 0)) return null;
  return {
    key: pairKey(t.from.id, t.to.id),
    amount: t.from.id < t.to.id ? t.amount : -t.amount,
  };
};

/** Build the full transfers aggregate from a list of transfers. */
export const computeTransferBalances = (
  transfers: BalanceTransfer[],
): BalancesDoc => {
  const pairs: Record<string, number> = {};
  for (const t of transfers) {
    const c = transferPairContribution(t);
    if (!c) continue;
    pairs[c.key] = round2((pairs[c.key] ?? 0) + c.amount);
  }
  return { pairs };
};

/**
 * Net amount user `aId` has paid user `bId` (negative = net received).
 * Same read as profitVs — both aggregates store the lower id's value.
 */
export const transferredVs = (
  pairs: Record<string, number>,
  aId: string,
  bId: string,
): number => profitVs(pairs, aId, bId);

/**
 * What user `bId` still owes user `aId` once transfers are netted against
 * profit. Positive: `bId` owes `aId`; negative: `aId` owes `bId`. Paying
 * someone increases your standing against them, so this is profit plus net
 * paid: if Bob owes Alice 100 of profit and pays her 40, Alice's profit is
 * still +100 but her received 40 (transferredVs = -40) leaves +60 owed.
 */
export const owedVs = (
  profitPairs: Record<string, number>,
  transferPairs: Record<string, number>,
  aId: string,
  bId: string,
): number =>
  round2(
    profitVs(profitPairs, aId, bId) + transferredVs(transferPairs, aId, bId),
  );

/** Total still owed to user `aId` across every other user (negative = owes). */
export const totalOwed = (
  profitPairs: Record<string, number>,
  transferPairs: Record<string, number>,
  aId: string,
  allUserIds: string[],
): number =>
  allUserIds
    .filter((id) => id !== aId)
    .reduce(
      (sum, bId) => round2(sum + owedVs(profitPairs, transferPairs, aId, bId)),
      0,
    );
