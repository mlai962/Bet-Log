import { useEffect, useMemo, useRef, useState } from "react";
import { LineType, type Line } from "../model/line";
import type { Team } from "../model/team";
import type { User } from "../model/user";
import {
  Bet,
  type BetDto,
} from "../model/bet";
import type { Transfer, TransferDto } from "../model/transfer";
import {
  type BalancesDoc,
  type BalanceBet,
  type BalanceTransfer,
  betPairContribution,
  computeBalances,
  computeTransferBalances,
  owedVs,
  pairsDrifted,
  profitVs,
  totalOwed,
  totalProfit,
  transferPairContribution,
  transferredVs,
} from "../model/balances";
import BetHistory from "./bet-history";
import {
  addDoc,
  collection,
  CollectionReference,
  doc,
  getDoc,
  increment,
  onSnapshot,
  setDoc,
  Timestamp,
  writeBatch,
  type WriteBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../firebase";
import Drawer from "../common-components/drawer";
import Spinner from "../common-components/spinner";
import BetHistorySkeleton from "../common-components/bet-history-skeleton";
import {
  AppTitle,
  FAB_BASE_CLASS,
  FAB_CONTAINER_CLASS,
} from "../common-components/app-chrome";
import { useBetFormState } from "./use-bet-form-state";
import BetFormFields from "./bet-form-fields";
import BetEditDrawer from "./bet-edit-drawer";
import { ToastProvider } from "../common-components/toast";

type BetLogProps = {
  _users: User[];
  _teams: Team[];
  _lines: Line[];
};

const COLLECTIONS = ["Users", "Teams", "Maps", "Lines"] as const;
type CollectionName = (typeof COLLECTIONS)[number];

const FIRESTORE_COLLECTION: Record<CollectionName, string> = {
  Users: "users",
  Teams: " teams",
  Maps: "maps",
  Lines: "lines",
};

/**
 * Apply an old->new balance contribution change to the aggregate doc within a
 * batch. Deltas are coalesced per pair key into a single increment so multiple
 * writes to the same field in one batch don't clobber each other.
 */
const applyBalanceDeltas = (
  batch: WriteBatch,
  aggRef: DocumentReference<BalancesDoc>,
  oldC: { key: string; amount: number } | null,
  newC: { key: string; amount: number } | null,
) => {
  const deltas = new Map<string, number>();
  if (oldC) deltas.set(oldC.key, (deltas.get(oldC.key) ?? 0) - oldC.amount);
  if (newC)
    deltas.set(
      newC.key,
      Math.round(((deltas.get(newC.key) ?? 0) + newC.amount) * 100) / 100,
    );
  const pairs: Record<string, ReturnType<typeof increment>> = {};
  for (const [k, amt] of deltas) if (amt !== 0) pairs[k] = increment(amt);
  if (Object.keys(pairs).length)
    batch.set(aggRef, { pairs } as never, { merge: true });
};

export function BetLog({ _users, _teams, _lines }: BetLogProps) {
  const [users, setUsers] = useState<User[]>(_users);
  const [teams, setTeams] = useState<Team[]>(_teams);
  const [lines, setLines] = useState<Line[]>(_lines);
  const [bets, setBets] = useState<Bet[]>([]);
  const [balances, setBalances] = useState<BalancesDoc>({ pairs: {} });
  const [betsLoaded, setBetsLoaded] = useState(false);
  const [balancesLoaded, setBalancesLoaded] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferBalances, setTransferBalances] = useState<BalancesDoc>({
    pairs: {},
  });
  const [transfersLoaded, setTransfersLoaded] = useState(false);
  const [transferBalancesLoaded, setTransferBalancesLoaded] = useState(false);

  // Balance-aggregate writes use non-idempotent increment()s, so a duplicated
  // handler invocation (e.g. two confirm events for one gesture) would apply
  // the same delta twice. Refs update synchronously, unlike state, so this
  // gate holds even when duplicate calls land before the next render.
  const balanceWriteInFlightRef = useRef(false);

  const aggRef = doc(db, "aggregates", "balances") as DocumentReference<BalancesDoc>;
  const transferAggRef = doc(db, "aggregates", "transfers") as DocumentReference<BalancesDoc>;

  const [maps, setMaps] = useState<{ id: string; name: string }[]>([
    { id: "mapMatch", name: "Match" },
    { id: "map1", name: "Map 1" },
    { id: "map2", name: "Map 2" },
    { id: "map3", name: "Map 3" },
    { id: "map4", name: "Map 4" },
    { id: "map5", name: "Map 5" },
  ]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "bets") as CollectionReference<BetDto>,
      async (snapshot) => {
        // Resolve userA/userB/teamA/teamB/line from already-loaded collections
        // (the DocumentReference carries its .id) — no per-bet getDoc reads.
        const usersById = new Map(users.map((u) => [u.id, u]));
        const teamsById = new Map(teams.map((t) => [t.id, t]));
        const linesById = new Map(lines.map((l) => [l.id, l]));

        const bets = await Promise.all(
          snapshot.docs.map(async (snapDoc) => {
            const d = snapDoc.data();

            // Edge case: a reference may point at an entity created on another
            // device after this session loaded. Fetch only those misses.
            const userA =
              usersById.get(d.userA.id) ??
              ({ ...(await getDoc(d.userA)).data()!, id: d.userA.id } as User);
            const userB =
              usersById.get(d.userB.id) ??
              ({ ...(await getDoc(d.userB)).data()!, id: d.userB.id } as User);
            const teamA =
              teamsById.get(d.teamA.id) ??
              ({ ...(await getDoc(d.teamA)).data()!, id: d.teamA.id } as Team);
            const teamB =
              teamsById.get(d.teamB.id) ??
              ({ ...(await getDoc(d.teamB)).data()!, id: d.teamB.id } as Team);
            const line =
              linesById.get(d.line.id) ??
              ({ ...(await getDoc(d.line)).data()!, id: d.line.id } as Line);

            return new Bet(d, snapDoc.id, userA, userB, teamA, teamB, line);
          }),
        );

        setBets(
          [...bets].sort((a, b) => {
            const dateDiff = b.date.toMillis() - a.date.toMillis();
            if (dateDiff !== 0) return dateDiff;
            const mapDiff = a.map.localeCompare(b.map);
            if (mapDiff !== 0) return mapDiff;
            return a.line.name.localeCompare(b.line.name);
          }),
        );

        setBetsLoaded(true);
        setIsShowBetSubmitSpinner(false);
        setIsShowBetSettlementSpinner(false);
        setCurrentBetIdBeingSettled("");
      },
    );

    return () => unsubscribe();
  }, [users, teams, lines]);

  // Persisted balances aggregate — one tiny doc, updated at write-time.
  useEffect(() => {
    const unsubscribe = onSnapshot(aggRef, (snap) => {
      setBalances(snap.data() ?? { pairs: {} });
      setBalancesLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Money transferred between users, tracked in parallel with bet profit.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "transfers") as CollectionReference<TransferDto>,
      async (snapshot) => {
        const usersById = new Map(users.map((u) => [u.id, u]));

        const loaded = await Promise.all(
          snapshot.docs.map(async (snapDoc) => {
            const d = snapDoc.data();
            const from =
              usersById.get(d.from.id) ??
              ({ ...(await getDoc(d.from)).data()!, id: d.from.id } as User);
            const to =
              usersById.get(d.to.id) ??
              ({ ...(await getDoc(d.to)).data()!, id: d.to.id } as User);
            return {
              id: snapDoc.id,
              from,
              to,
              amount: d.amount,
              date: d.date,
            } satisfies Transfer;
          }),
        );

        setTransfers(
          [...loaded].sort((a, b) => b.date.toMillis() - a.date.toMillis()),
        );
        setTransfersLoaded(true);
      },
    );

    return () => unsubscribe();
  }, [users]);

  // Persisted transfers aggregate — same shape as the balances aggregate.
  useEffect(() => {
    const unsubscribe = onSnapshot(transferAggRef, (snap) => {
      setTransferBalances(snap.data() ?? { pairs: {} });
      setTransferBalancesLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Self-healing safety net: every bet is already in memory, so the persisted
  // aggregate can always be checked against a from-scratch recompute. If they
  // disagree (e.g. a past duplicated increment left drifted values), overwrite
  // the aggregate with the recomputed truth. Also acts as the initial
  // backfill when the aggregate doc doesn't exist yet.
  const computedBalances = useMemo(() => computeBalances(bets as BalanceBet[]), [bets]);
  const computedTransferBalances = useMemo(
    () => computeTransferBalances(transfers as BalanceTransfer[]),
    [transfers],
  );

  // Debounce: the source and aggregate listeners update in separate ticks, so
  // a just-committed write looks like drift for a moment. Only repair drift
  // that survives both listeners settling and no write in flight.
  const useAggregateRepair = (
    label: string,
    ready: boolean,
    persisted: BalancesDoc,
    recomputed: BalancesDoc,
    ref: DocumentReference<BalancesDoc>,
  ) =>
    useEffect(() => {
      if (!ready) return;
      if (!pairsDrifted(persisted.pairs, recomputed.pairs)) return;
      const timer = setTimeout(() => {
        if (balanceWriteInFlightRef.current) return;
        console.warn(
          `[${label} drift] persisted aggregate disagrees with recompute — repairing`,
          { persisted: persisted.pairs, recomputed: recomputed.pairs },
        );
        setDoc(ref, recomputed).catch((error) =>
          console.error(`Error repairing ${label} aggregate:`, error),
        );
      }, 2000);
      return () => clearTimeout(timer);
    }, [ready, persisted, recomputed]);

  useAggregateRepair(
    "balances",
    betsLoaded && balancesLoaded,
    balances,
    computedBalances,
    aggRef,
  );
  useAggregateRepair(
    "transfers",
    transfersLoaded && transferBalancesLoaded,
    transferBalances,
    computedTransferBalances,
    transferAggRef,
  );

  const form = useBetFormState({
    maps,
    defaultLineId: _lines.find((l) => l.name === "Main Line")?.id ?? "",
  });

  const [isShowBetSubmitSpinner, setIsShowBetSubmitSpinner] =
    useState<boolean>(false);
  const [isCreateBetDrawerOpen, setIsCreateBetDrawerOpen] =
    useState<boolean>(false);
  const handleBetSubmit = async () => {
    const data = form.buildWriteData(lines);
    if (!data) return;

    setIsShowBetSubmitSpinner(true);
    await addDoc(collection(db, "bets"), { ...data, winner: "" });
    setIsCreateBetDrawerOpen(false);
  };

  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const editingBet = editingBetId
    ? bets.find((b) => b.id === editingBetId) ?? null
    : null;
  const handleBetEditSave = async (betId: string, data: Partial<BetDto>) => {
    if (balanceWriteInFlightRef.current) return;
    balanceWriteInFlightRef.current = true;
    try {
      const oldBet = bets.find((b) => b.id === betId);
      const betRef = doc(db, "bets", betId);
      const batch = writeBatch(db);
      batch.update(betRef, data);
      if (oldBet) {
        const newView: BalanceBet = {
          userA: { id: data.userA?.id ?? oldBet.userA.id },
          userB: { id: data.userB?.id ?? oldBet.userB.id },
          betAmount: data.betAmount ?? oldBet.betAmount,
          odds: data.odds ?? oldBet.odds,
          winner: data.winner ?? oldBet.winner,
        };
        applyBalanceDeltas(
          batch,
          aggRef,
          betPairContribution(oldBet as unknown as BalanceBet),
          betPairContribution(newView),
        );
      }
      await batch.commit();
    } finally {
      balanceWriteInFlightRef.current = false;
    }
  };

  const [isShowBetSettlementSpinner, setIsShowBetSettlementSpinner] =
    useState<boolean>(false);
  const [currentBetIdBeingSettled, setCurrentBetIdBeingSettled] =
    useState<string>("");
  const handleBetSettlement = async (betId: string, winner: string) => {
    if (balanceWriteInFlightRef.current) return;
    const oldBet = bets.find((b) => b.id === betId);
    if (oldBet && oldBet.winner === winner) return; // no-op settle
    balanceWriteInFlightRef.current = true;

    setIsShowBetSettlementSpinner(true);
    setCurrentBetIdBeingSettled(betId);

    const betRef = doc(db, "bets", betId);

    try {
      const batch = writeBatch(db);
      batch.update(betRef, { winner });
      if (oldBet) {
        applyBalanceDeltas(
          batch,
          aggRef,
          betPairContribution(oldBet as unknown as BalanceBet),
          betPairContribution({ ...oldBet, winner } as unknown as BalanceBet),
        );
      }
      await batch.commit();

      const updated = bets.map((bet) =>
        bet.id === betId ? { ...bet, winner: winner } : bet,
      );

      setBets(updated);
    } catch (error) {
      console.error("Error updating document:", error);
    } finally {
      balanceWriteInFlightRef.current = false;
    }

    setIsShowBetSettlementSpinner(false);
    setCurrentBetIdBeingSettled("");
  };
  const handleBetDeletion = async (betId: string) => {
    if (balanceWriteInFlightRef.current) return;
    balanceWriteInFlightRef.current = true;

    setIsShowBetSettlementSpinner(true);
    setCurrentBetIdBeingSettled(betId);

    try {
      const oldBet = bets.find((b) => b.id === betId);
      const batch = writeBatch(db);
      batch.delete(doc(db, "bets", betId));
      if (oldBet) {
        applyBalanceDeltas(
          batch,
          aggRef,
          betPairContribution(oldBet as unknown as BalanceBet),
          null,
        );
      }
      await batch.commit();
    } finally {
      balanceWriteInFlightRef.current = false;
    }
  };

  // Transfer entry form state
  const [transferFromId, setTransferFromId] = useState<string>("");
  const [transferToId, setTransferToId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );
  const [confirmingTransferDeleteId, setConfirmingTransferDeleteId] =
    useState<string | null>(null);

  const transferAmountNumber = Number(transferAmount);
  const isTransferValid =
    transferFromId !== "" &&
    transferToId !== "" &&
    transferFromId !== transferToId &&
    Number.isFinite(transferAmountNumber) &&
    transferAmountNumber > 0;

  const handleTransferSubmit = async () => {
    if (!isTransferValid) return;
    if (balanceWriteInFlightRef.current) return;
    balanceWriteInFlightRef.current = true;

    try {
      const amount = Math.round(transferAmountNumber * 100) / 100;
      const batch = writeBatch(db);
      const transferRef = doc(collection(db, "transfers"));
      batch.set(transferRef, {
        from: doc(db, "users", transferFromId),
        to: doc(db, "users", transferToId),
        amount,
        date: Timestamp.fromDate(new Date(transferDate)),
      });
      applyBalanceDeltas(
        batch,
        transferAggRef,
        null,
        transferPairContribution({
          from: { id: transferFromId },
          to: { id: transferToId },
          amount,
        }),
      );
      await batch.commit();
      setTransferAmount("");
    } catch (error) {
      console.error("Error recording transfer:", error);
    } finally {
      balanceWriteInFlightRef.current = false;
    }
  };

  const handleTransferDeletion = async (transferId: string) => {
    if (balanceWriteInFlightRef.current) return;
    balanceWriteInFlightRef.current = true;

    try {
      const oldTransfer = transfers.find((t) => t.id === transferId);
      const batch = writeBatch(db);
      batch.delete(doc(db, "transfers", transferId));
      if (oldTransfer) {
        applyBalanceDeltas(
          batch,
          transferAggRef,
          transferPairContribution(oldTransfer as unknown as BalanceTransfer),
          null,
        );
      }
      await batch.commit();
    } catch (error) {
      console.error("Error deleting transfer:", error);
    } finally {
      balanceWriteInFlightRef.current = false;
      setConfirmingTransferDeleteId(null);
    }
  };

  // Add entry drawer state
  const [isAddEntryDrawerOpen, setIsAddEntryDrawerOpen] =
    useState<boolean>(false);
  const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState<boolean>(false);
  const [isSettleDrawerOpen, setIsSettleDrawerOpen] = useState<boolean>(false);
  const [isBalancesDrawerOpen, setIsBalancesDrawerOpen] =
    useState<boolean>(false);
  const [addEntryCollection, setAddEntryCollection] =
    useState<CollectionName | null>(null);
  const [newOptionName, setNewOptionName] = useState<string>("");
  const [newLineType, setNewLineType] = useState<LineType>(LineType.NONE);
  const [newTeamSport, setNewTeamSport] = useState<string>("");
  const [newTeamLeague, setNewTeamLeague] = useState<string>("");
  const [newTeamCategory, setNewTeamCategory] = useState<string>("");
  const [isNewSport, setIsNewSport] = useState<boolean>(false);
  const [isNewLeague, setIsNewLeague] = useState<boolean>(false);
  const [isNewCategory, setIsNewCategory] = useState<boolean>(false);

  const resetAddEntryForm = () => {
    setAddEntryCollection(null);
    setNewOptionName("");
    setNewLineType(LineType.NONE);
    setNewTeamSport("");
    setNewTeamLeague("");
    setNewTeamCategory("");
    setIsNewSport(false);
    setIsNewLeague(false);
    setIsNewCategory(false);
  };

  const handleAddNewOption = async () => {
    if (!newOptionName.trim() || !addEntryCollection) return;

    setIsAddEntryDrawerOpen(false);
    resetAddEntryForm();

    const collectionName = FIRESTORE_COLLECTION[addEntryCollection];

    if (collectionName === "maps") {
      setMaps((prev) => [
        ...prev,
        { id: `newOptionName-${Date.now()}`, name: newOptionName },
      ]);
    } else {
      const newOption = {
        name: newOptionName,
        ...(collectionName === "lines" && { lineType: newLineType }),
        ...(collectionName === FIRESTORE_COLLECTION.Teams && {
          ...(newTeamSport && { sport: newTeamSport }),
          ...(newTeamLeague && { league: newTeamLeague }),
          ...(newTeamCategory && { category: newTeamCategory }),
        }),
      };

      const docRef = await addDoc(collection(db, collectionName), newOption);

      if (collectionName === "users") {
        setUsers((prev) => [...prev, { ...newOption, id: docRef.id }]);
      } else if (collectionName === FIRESTORE_COLLECTION.Teams) {
        setTeams((prev) => [...prev, { ...newOption, id: docRef.id }]);
      } else if (collectionName === "lines") {
        setLines((prev) => [
          ...prev,
          { name: newOptionName, lineType: newLineType, id: docRef.id },
        ]);
      }
    }
  };

  const lineTypeButtonClass = (active: boolean) =>
    `w-16 h-16 rounded-lg border-1
    border-purple-500 dark:border-purple-700
    hover:bg-purple-200 dark:hover:bg-purple-600
    active:bg-purple-300 dark:active:bg-purple-500
    hover:cursor-pointer
    ${
      active
        ? "bg-purple-300 dark:bg-purple-500/75"
        : "bg-gray-400 dark:bg-purple-700/50"
    }`;

  // Derived sport/league/category option lists for the add-team form
  const existingSports = [
    ...new Set(
      teams.map((t) => t.sport).filter((s): s is string => Boolean(s)),
    ),
  ].sort();
  const existingLeagues = [
    ...new Set(
      teams
        .filter((t) => t.sport === newTeamSport)
        .map((t) => t.league)
        .filter((l): l is string => Boolean(l)),
    ),
  ].sort();
  const existingCategories = [
    ...new Set(
      teams
        .filter(
          (t) =>
            t.sport === newTeamSport &&
            (!newTeamLeague || t.league === newTeamLeague),
        )
        .map((t) => t.category)
        .filter((c): c is string => Boolean(c)),
    ),
  ].sort();

  const teamFieldSelectClass =
    "w-full bg-transparent border border-purple-600 rounded text-purple-200 text-sm cursor-pointer focus:outline-none p-2 dark:bg-gray-900";
  const teamFieldInputClass =
    "w-full h-9 focus:outline-none text-sm text-left px-2 bg-transparent border border-purple-600 rounded text-purple-200";

  const allDrawersClosed =
    !isAddEntryDrawerOpen &&
    !isDeleteDrawerOpen &&
    !isSettleDrawerOpen &&
    !isBalancesDrawerOpen &&
    !isCreateBetDrawerOpen &&
    editingBetId === null;

  const fabClass = `${FAB_BASE_CLASS} text-purple-200 text-3xl font-bold hover:bg-gray-800 hover:border-2 cursor-pointer focus:outline-none flex items-center justify-center`;

  // Read balances from the persisted aggregate; fall back to an in-memory
  // computation until the one-time backfill has populated the aggregate doc.
  const balanceSrc = Object.keys(balances.pairs).length
    ? balances.pairs
    : computedBalances.pairs;
  const transferSrc = Object.keys(transferBalances.pairs).length
    ? transferBalances.pairs
    : computedTransferBalances.pairs;
  const userIds = users.map((u) => u.id);

  return (
    <ToastProvider>
    <main className="flex-col p-3 space-y-4">
      {/* Floating bottom-right button group */}
      <div className={FAB_CONTAINER_CLASS}>
        {/* + FAB */}
        {allDrawersClosed && (
          <button
            onClick={() => {
              resetAddEntryForm();
              setIsAddEntryDrawerOpen(true);
            }}
            className={fabClass}
            aria-label="Add new entry"
          >
            +
          </button>
        )}

        {/* Show Balances */}
        {allDrawersClosed && (
          <button
            onClick={() => setIsBalancesDrawerOpen(true)}
            className={fabClass}
            aria-label="Show balances"
          >
            $
          </button>
        )}

        {/* New Bet */}
        {allDrawersClosed && (
          <button
            onClick={() => setIsCreateBetDrawerOpen(true)}
            className={fabClass}
            aria-label="New bet"
          >
            <svg
              className="w-7 h-7"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              <circle cx="8" cy="8" r="1.4" fill="currentColor" />
              <circle cx="16" cy="8" r="1.4" fill="currentColor" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" />
              <circle cx="8" cy="16" r="1.4" fill="currentColor" />
              <circle cx="16" cy="16" r="1.4" fill="currentColor" />
            </svg>
          </button>
        )}
        <Drawer
          isOpen={isBalancesDrawerOpen}
          onClose={() => {
            setIsBalancesDrawerOpen(false);
            setConfirmingTransferDeleteId(null);
          }}
          direction="right"
          size="w-96 max-w-[92vw]"
        >
          <div className="flex flex-col space-y-5 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain pr-1">
            {/* Per-user balances: profit from bets, transfers, and what's left owing */}
            <div className="space-y-4">
              {users.map((u) => {
                return (
                  <div key={`${u.id}-profit`}>
                    <div className="font-extrabold underline">{u.name}</div>
                    <div>
                      Total Net Profit:{" "}
                      {formatProfit(totalProfit(balanceSrc, u.id, userIds))}
                    </div>
                    <div>
                      Total Unsettled:{" "}
                      {formatProfit(
                        totalOwed(balanceSrc, transferSrc, u.id, userIds),
                      )}
                    </div>
                    {users
                      .filter((u2) => u2.id != u.id)
                      .map((u2) => {
                        const profit = profitVs(balanceSrc, u.id, u2.id);
                        const paid = transferredVs(transferSrc, u.id, u2.id);
                        const owed = owedVs(
                          balanceSrc,
                          transferSrc,
                          u.id,
                          u2.id,
                        );
                        return (
                          <div
                            key={`${u.id}-${u2.id}-profit`}
                            className="mt-1 text-sm"
                          >
                            <div>
                              Profit vs {u2.name}: {formatProfit(profit)}
                            </div>
                            <div className="text-purple-400">
                              {paid === 0
                                ? `no transfers with ${u2.name}`
                                : paid > 0
                                ? `paid ${u2.name} $${paid}`
                                : `received $${-paid} from ${u2.name}`}
                            </div>
                            <div
                              className={
                                owed > 0
                                  ? "text-purple-300 font-semibold"
                                  : owed < 0
                                  ? "text-red-400 font-semibold"
                                  : "text-purple-500"
                              }
                            >
                              {owed === 0
                                ? `settled up with ${u2.name}`
                                : owed > 0
                                ? `${u2.name} owes $${owed}`
                                : `owes ${u2.name} $${-owed}`}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {/* Record a transfer between two users */}
            <div className="space-y-2 border-t border-purple-800 pt-3">
              <div className="font-extrabold">Record Transfer</div>
              <div className="flex items-center gap-2">
                <select
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className={teamFieldSelectClass}
                  aria-label="Transfer from"
                >
                  <option value="" className="bg-gray-900">
                    from...
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-gray-900">
                      {u.name}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">→</span>
                <select
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className={teamFieldSelectClass}
                  aria-label="Transfer to"
                >
                  <option value="" className="bg-gray-900">
                    to...
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-gray-900">
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="amount $"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className={teamFieldInputClass}
                  aria-label="Transfer amount"
                />
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className={teamFieldInputClass}
                  aria-label="Transfer date"
                />
              </div>
              <button
                onClick={handleTransferSubmit}
                disabled={!isTransferValid}
                className="w-full h-10 rounded-lg border-1 font-semibold
                  bg-gray-400 dark:bg-purple-950/10
                  border-purple-500 dark:border-purple-700
                  hover:bg-purple-200 dark:hover:bg-purple-600
                  active:bg-purple-300 dark:active:bg-purple-500
                  cursor-pointer focus:outline-none
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                save transfer
              </button>
            </div>

            {/* Transfer history */}
            <div className="space-y-1 border-t border-purple-800 pt-3">
              <div className="font-extrabold">Transfer History</div>
              {transfers.length === 0 && (
                <div className="text-sm text-purple-500">no transfers yet</div>
              )}
              {transfers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    {t.date.toDate().toLocaleDateString()} — {t.from.name} paid{" "}
                    {t.to.name} ${t.amount}
                  </div>
                  {confirmingTransferDeleteId === t.id ? (
                    <button
                      onClick={() => handleTransferDeletion(t.id)}
                      className="text-red-400 font-semibold cursor-pointer shrink-0"
                    >
                      confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmingTransferDeleteId(t.id)}
                      aria-label="Delete transfer"
                      className="cursor-pointer shrink-0 text-purple-400 hover:text-red-500/75"
                    >
                      <svg
                        className="w-5 h-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      </div>

      {/* Add Entry Drawer */}
      <Drawer
        isOpen={isAddEntryDrawerOpen}
        onClose={() => setIsAddEntryDrawerOpen(false)}
        direction="top"
      >
        <div className="space-y-4 text-purple-200">
          <div className="text-xl font-bold text-center">Add New Entry</div>

          {/* Collection selector */}
          <div className="flex gap-2 flex-wrap justify-center">
            {COLLECTIONS.map((col) => (
              <button
                key={col}
                onClick={() => {
                  resetAddEntryForm();
                  setAddEntryCollection(col);
                }}
                className={`px-4 py-2 rounded-lg border-1 font-semibold cursor-pointer
                  border-purple-500 dark:border-purple-700
                  hover:bg-purple-200 dark:hover:bg-purple-600
                  ${
                    addEntryCollection === col
                      ? "bg-purple-300 dark:bg-purple-500/75"
                      : "bg-gray-400 dark:bg-purple-700/50"
                  }`}
              >
                {col}
              </button>
            ))}
          </div>

          {/* Entry form */}
          {addEntryCollection && (
            <div className="space-y-4">
              <div
                className="flex w-full h-14 rounded-lg gap-2 p-2 border-1 items-center
                  bg-gray-400 dark:bg-purple-950/10
                  border-purple-500 dark:border-purple-700"
              >
                <input
                  className="w-full h-8 focus:outline-none text-xl text-center font-semibold bg-transparent"
                  type="text"
                  placeholder={`New ${addEntryCollection.toLowerCase()} name...`}
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNewOption();
                  }}
                  autoFocus
                />
              </div>

              {addEntryCollection === "Teams" && (
                <div className="space-y-3">
                  {/* Sport */}
                  <div className="space-y-1">
                    <div className="text-xs text-purple-400 font-semibold uppercase tracking-wide">
                      Sport *
                    </div>
                    {!isNewSport ? (
                      <select
                        value={newTeamSport}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setIsNewSport(true);
                            setNewTeamSport("");
                            setNewTeamLeague("");
                            setNewTeamCategory("");
                          } else {
                            setNewTeamSport(e.target.value);
                            setNewTeamLeague("");
                            setNewTeamCategory("");
                            setIsNewLeague(false);
                            setIsNewCategory(false);
                          }
                        }}
                        className={teamFieldSelectClass}
                      >
                        <option value="" className="bg-gray-900">
                          Select sport…
                        </option>
                        {existingSports.map((s) => (
                          <option key={s} value={s} className="bg-gray-900">
                            {s}
                          </option>
                        ))}
                        <option value="__new__" className="bg-gray-900">
                          + New sport…
                        </option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="New sport name…"
                        value={newTeamSport}
                        onChange={(e) => setNewTeamSport(e.target.value)}
                        className={teamFieldInputClass}
                        autoFocus
                      />
                    )}
                  </div>

                  {/* League — shown once sport is chosen */}
                  {newTeamSport && (
                    <div className="space-y-1">
                      <div className="text-xs text-purple-400 font-semibold uppercase tracking-wide">
                        League (optional)
                      </div>
                      {!isNewLeague ? (
                        <select
                          value={newTeamLeague}
                          onChange={(e) => {
                            if (e.target.value === "__new__") {
                              setIsNewLeague(true);
                              setNewTeamLeague("");
                            } else {
                              setNewTeamLeague(e.target.value);
                              setNewTeamCategory("");
                              setIsNewCategory(false);
                            }
                          }}
                          className={teamFieldSelectClass}
                        >
                          <option value="" className="bg-gray-900">
                            None
                          </option>
                          {existingLeagues.map((l) => (
                            <option key={l} value={l} className="bg-gray-900">
                              {l}
                            </option>
                          ))}
                          <option value="__new__" className="bg-gray-900">
                            + New league…
                          </option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="New league name…"
                          value={newTeamLeague}
                          onChange={(e) => setNewTeamLeague(e.target.value)}
                          className={teamFieldInputClass}
                        />
                      )}
                    </div>
                  )}

                  {/* Category — shown once sport is chosen */}
                  {newTeamSport && (
                    <div className="space-y-1">
                      <div className="text-xs text-purple-400 font-semibold uppercase tracking-wide">
                        Category (optional)
                      </div>
                      {!isNewCategory ? (
                        <select
                          value={newTeamCategory}
                          onChange={(e) => {
                            if (e.target.value === "__new__") {
                              setIsNewCategory(true);
                              setNewTeamCategory("");
                            } else {
                              setNewTeamCategory(e.target.value);
                            }
                          }}
                          className={teamFieldSelectClass}
                        >
                          <option value="" className="bg-gray-900">
                            None
                          </option>
                          {existingCategories.map((c) => (
                            <option key={c} value={c} className="bg-gray-900">
                              {c}
                            </option>
                          ))}
                          <option value="__new__" className="bg-gray-900">
                            + New category…
                          </option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="New category name…"
                          value={newTeamCategory}
                          onChange={(e) => setNewTeamCategory(e.target.value)}
                          className={teamFieldInputClass}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {addEntryCollection === "Lines" && (
                <div className="w-full flex justify-between">
                  <button
                    className={lineTypeButtonClass(
                      newLineType === LineType.NONE,
                    )}
                    onClick={() => setNewLineType(LineType.NONE)}
                  >
                    N/A
                  </button>
                  <button
                    className={lineTypeButtonClass(
                      newLineType === LineType.OVER_UNDER,
                    )}
                    onClick={() => setNewLineType(LineType.OVER_UNDER)}
                  >
                    O/U
                  </button>
                  <button
                    className={lineTypeButtonClass(
                      newLineType === LineType.HANDICAP,
                    )}
                    onClick={() => setNewLineType(LineType.HANDICAP)}
                  >
                    +/-
                  </button>
                </div>
              )}

              <button
                className="flex w-full h-14 rounded-lg gap-2 p-2 border-1 items-center justify-center text-2xl font-bold
                  bg-gray-400 dark:bg-purple-950/10
                  border-purple-500 dark:border-purple-700
                  hover:bg-purple-200 dark:hover:bg-purple-600
                  cursor-pointer focus:outline-none
                  disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleAddNewOption}
                disabled={
                  !newOptionName.trim() ||
                  (addEntryCollection === "Teams" && !newTeamSport)
                }
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </Drawer>

      <AppTitle />

      {/* Create Bet Drawer */}
      <Drawer
        isOpen={isCreateBetDrawerOpen}
        onClose={() => setIsCreateBetDrawerOpen(false)}
        direction="top"
      >
        <div className="space-y-4 text-purple-200">
          <div className="text-xl font-bold text-center">New Bet</div>

          <div className="space-y-2">
            <BetFormFields
              form={form}
              users={users}
              teams={teams}
              lines={lines}
              maps={maps}
            />

            <div className="grid grid-cols-2 gap-2">
              <div
                className="h-[82px] p-2 rounded-lg border-1 text-purple-200 overflow-hidden
                bg-gray-400 dark:bg-purple-950/10
                border-purple-500 dark:border-purple-700"
              >
                <input
                  type="date"
                  value={form.date}
                  className="w-full min-w-0 h-full focus:outline-none"
                  onChange={(e) => form.setDate(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={() => handleBetSubmit()}
                className="h-[82px] rounded-lg border-1 text-purple-200 relative
                bg-gray-400 dark:bg-purple-950/10
                border-purple-500 dark:border-purple-700
                hover:bg-purple-200 dark:hover:bg-purple-600
                active:bg-purple-300 dark:active:bg-purple-500
                hover:cursor-pointer hover:disabled:cursor-not-allowed"
              >
                <span
                  className={`${isShowBetSubmitSpinner ? "opacity-20" : ""}`}
                >
                  submit gamba
                </span>
                <Spinner isShowSpinner={isShowBetSubmitSpinner} />
              </button>
            </div>
          </div>
        </div>
      </Drawer>

      <div className="w-full min-h-32 relative">
        {bets.length === 0 && <BetHistorySkeleton />}

        <BetHistory
          bets={bets}
          handleBetSettlement={handleBetSettlement}
          handleBetDeletion={handleBetDeletion}
          isShowBetSettlementSpinner={isShowBetSettlementSpinner}
          currentBetIdBeingSettled={currentBetIdBeingSettled}
          onDeleteDrawerOpenChange={setIsDeleteDrawerOpen}
          onSettleDrawerOpenChange={setIsSettleDrawerOpen}
          onEditRequest={(betId) => setEditingBetId(betId)}
        />
      </div>

      <BetEditDrawer
        bet={editingBet}
        users={users}
        teams={teams}
        lines={lines}
        maps={maps}
        onClose={() => setEditingBetId(null)}
        onSave={handleBetEditSave}
      />
    </main>
    </ToastProvider>
  );
}

const formatProfit = (profit: number) => {
  return `${profit < 0 ? "-" : "+"}$${profit < 0 ? -profit : profit}`;
};
