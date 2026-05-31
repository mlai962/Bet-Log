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
