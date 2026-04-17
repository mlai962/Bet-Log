import { useEffect, useState } from "react";
import { LineType, type Line } from "../model/line";
import { Handicap, OverUnder } from "../model/binary-option-and-number";
import type { Team } from "../model/team";
import type { User } from "../model/user";
import NumberInput from "../inputs/bet-amount-input";
import BetSummary from "./bet-summary";
import {
  Bet,
  EXTRA_BINARY_LINE_OPTION,
  EXTRA_BINARY_LINE_VALUE,
  getBetOutcome,
  type BetDto,
} from "../model/bet";
import BetHistory from "./bet-history";
import {
  addDoc,
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  Timestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import Drawer from "../common-components/drawer";
import BottomDrawer from "../common-components/bottom-drawer";
import Spinner from "../common-components/spinner";

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

export function BetLog({ _users, _teams, _lines }: BetLogProps) {
  const [users, setUsers] = useState<User[]>(_users);
  const [teams, setTeams] = useState<Team[]>(_teams);
  const [lines, setLines] = useState<Line[]>(_lines);
  const [bets, setBets] = useState<Bet[]>([]);

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
        const bets = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const docData = doc.data();

            const userA = await getDoc(docData.userA);
            const userB = await getDoc(docData.userB);
            const teamA = await getDoc(docData.teamA);
            const teamB = await getDoc(docData.teamB);
            const line = await getDoc(docData.line);

            return new Bet(docData, doc.id, userA, userB, teamA, teamB, line);
          }),
        );

        setBets(
          [...bets].sort((a, b) => b.date.toMillis() - a.date.toMillis()),
        );

        setIsShowBetSubmitSpinner(false);
        setIsShowBetSettlementSpinner(false);
        setCurrentBetIdBeingSettled("");
      },
    );

    return () => unsubscribe();
  }, []);

  // [0] = userA (left), [1] = userB (right)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(["", ""]);
  // [0] = teamA (left), [1] = teamB (right)
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(["", ""]);
  const [selectedMapId, setSelectedMapId] = useState<string>("mapMatch");
  const [selectedLineId, setSelectedLineId] = useState<string>(
    _lines.find((l) => l.name === "Main Line")?.id ?? "",
  );

  const handleUserAChange = (userId: string) => {
    if (userId && userId === selectedUserIds[1]) {
      setSelectedUserIds([userId, selectedUserIds[0]]);
    } else {
      setSelectedUserIds([userId, selectedUserIds[1]]);
    }
  };

  const handleUserBChange = (userId: string) => {
    if (userId && userId === selectedUserIds[0]) {
      setSelectedUserIds([selectedUserIds[1], userId]);
    } else {
      setSelectedUserIds([selectedUserIds[0], userId]);
    }
  };

  const handleTeamAChange = (teamId: string) => {
    if (teamId && teamId === selectedTeamIds[1]) {
      setSelectedTeamIds([teamId, selectedTeamIds[0]]);
    } else {
      setSelectedTeamIds([teamId, selectedTeamIds[1]]);
    }
  };

  const handleTeamBChange = (teamId: string) => {
    if (teamId && teamId === selectedTeamIds[0]) {
      setSelectedTeamIds([selectedTeamIds[1], teamId]);
    } else {
      setSelectedTeamIds([selectedTeamIds[0], teamId]);
    }
  };

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [overUnder, setOverUnder] = useState<OverUnder>({
    over: true,
    value: 0.5,
  });

  const [handicap, setHandicap] = useState<Handicap>({
    plus: true,
    value: 0.5,
  });

  const [odds, setOdds] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(0);

  const [isShowBetSubmitSpinner, setIsShowBetSubmitSpinner] =
    useState<boolean>(false);
  const handleBetSubmit = async () => {
    if (!selectedUserIds[0] || !selectedUserIds[1]) return;
    if (!selectedTeamIds[0] || !selectedTeamIds[1]) return;
    if (selectedMapId.length === 0) return;
    if (selectedLineId.length === 0) return;
    if (odds <= 0) return;
    if (betAmount <= 0) return;

    setIsShowBetSubmitSpinner(true);

    await addDoc(collection(db, "bets"), {
      userA: doc(db, "users", selectedUserIds[0]) as DocumentReference<
        User,
        DocumentData
      >,
      userB: doc(db, "users", selectedUserIds[1]) as DocumentReference<
        User,
        DocumentData
      >,
      teamA: doc(db, " teams", selectedTeamIds[0]) as DocumentReference<
        Team,
        DocumentData
      >,
      teamB: doc(db, " teams", selectedTeamIds[1]) as DocumentReference<
        Team,
        DocumentData
      >,
      line: doc(db, "lines", selectedLineId) as DocumentReference<
        Line,
        DocumentData
      >,
      map: maps.find((m) => m.id === selectedMapId)?.name!,
      extras: {
        [EXTRA_BINARY_LINE_OPTION]:
          lines.find((l) => l.id === selectedLineId)?.lineType ===
          LineType.OVER_UNDER
            ? overUnder.over
            : handicap.plus,
        [EXTRA_BINARY_LINE_VALUE]:
          lines.find((l) => l.id === selectedLineId)?.lineType ===
          LineType.OVER_UNDER
            ? overUnder.value
            : handicap.value,
      },
      betAmount: betAmount,
      date: Timestamp.fromDate(new Date(date)),
      odds: odds,
      winner: "",
    });
  };

  const [isShowBetSettlementSpinner, setIsShowBetSettlementSpinner] =
    useState<boolean>(false);
  const [currentBetIdBeingSettled, setCurrentBetIdBeingSettled] =
    useState<string>("");
  const handleBetSettlement = async (betId: string, winner: string) => {
    setIsShowBetSettlementSpinner(true);
    setCurrentBetIdBeingSettled(betId);

    const betRef = doc(db, "bets", betId);

    try {
      await updateDoc(betRef, {
        winner: winner,
      });

      const updated = bets.map((bet) =>
        bet.id === betId ? { ...bet, winner: winner } : bet,
      );

      setBets(updated);
    } catch (error) {
      console.error("Error updating document:", error);
    }

    setIsShowBetSettlementSpinner(false);
    setCurrentBetIdBeingSettled("");
  };
  const handleBetDeletion = async (betId: string) => {
    setIsShowBetSettlementSpinner(true);
    setCurrentBetIdBeingSettled(betId);

    await deleteDoc(doc(db, "bets", betId));
  };

  // Add entry drawer state
  const [isAddEntryDrawerOpen, setIsAddEntryDrawerOpen] =
    useState<boolean>(false);
  const [isTeamPickerOpen, setIsTeamPickerOpen] = useState<boolean>(false);
  const [isLinePickerOpen, setIsLinePickerOpen] = useState<boolean>(false);
  const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState<boolean>(false);
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
    !isTeamPickerOpen &&
    !isLinePickerOpen &&
    !isDeleteDrawerOpen &&
    !isBalancesDrawerOpen;

  const fabClass =
    "w-14 h-14 rounded-full bg-gray-900 border-1 border-purple-800 text-purple-200 text-3xl font-bold shadow-lg hover:bg-gray-800 hover:border-2 cursor-pointer focus:outline-none flex items-center justify-center";

  return (
    <main className="flex-col p-3 space-y-4">
      {/* Floating bottom-right button group */}
      <div className="fixed bottom-4 right-4 flex items-end gap-2 z-50">
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
        <Drawer
          isOpen={isBalancesDrawerOpen}
          onClose={() => setIsBalancesDrawerOpen(false)}
          width="w-80"
        >
          <div className="flex-col space-y-4">
            {users.map((u) => {
              return (
                <div key={`${u.id}-profit`}>
                  <div className="font-extrabold underline">{u.name}</div>
                  <div>
                    Total Net Profit:{" "}
                    {formatProfit(calculateProfit(u.name, "", bets))}
                    {users
                      .filter((u2) => u2.id != u.id)
                      .map((u2) => {
                        return (
                          <div key={`${u.id}-${u2.id}-profit`}>
                            Profit vs {u2.name}:{" "}
                            {formatProfit(
                              calculateProfit(u.name, u2.name, bets),
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </Drawer>
      </div>

      {/* Add Entry Drawer */}
      <BottomDrawer
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
      </BottomDrawer>

      <div className="w-full h-max text-4xl font-semibold text-center text-purple-200">
        gamba kappachungus deluxe
      </div>

      <div className="w-full max-w-lg mx-auto space-y-2">
        <BetSummary
          users={users}
          teams={teams}
          userA={
            selectedUserIds[0]
              ? users.find((u) => u.id === selectedUserIds[0]) ?? null
              : null
          }
          userB={
            selectedUserIds[1]
              ? users.find((u) => u.id === selectedUserIds[1]) ?? null
              : null
          }
          onUserAChange={handleUserAChange}
          onUserBChange={handleUserBChange}
          teamA={
            selectedTeamIds[0]
              ? teams.find((t) => t.id === selectedTeamIds[0]) ?? null
              : null
          }
          teamB={
            selectedTeamIds[1]
              ? teams.find((t) => t.id === selectedTeamIds[1]) ?? null
              : null
          }
          onTeamAChange={handleTeamAChange}
          onTeamBChange={handleTeamBChange}
          onTeamPickerOpenChange={setIsTeamPickerOpen}
          maps={maps}
          selectedMapId={selectedMapId}
          onMapChange={setSelectedMapId}
          lines={lines}
          selectedLineId={selectedLineId}
          onLineChange={setSelectedLineId}
          onLinePickerOpenChange={setIsLinePickerOpen}
          onOverUnderChange={setOverUnder}
          onHandicapChange={setHandicap}
          odds={odds}
          betAmount={betAmount}
          date={date}
        />

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              onChange={(odds) => setOdds(odds)}
              placeholder="odds..."
              className=""
              svgPath="M8.891 15.107 15.11 8.89m-5.183-.52h.01m3.089 7.254h.01M14.08 3.902a2.849 2.849 0 0 0 2.176.902 2.845 2.845 0 0 1 2.94 2.94 2.849 2.849 0 0 0 .901 2.176 2.847 2.847 0 0 1 0 4.16 2.848 2.848 0 0 0-.901 2.175 2.843 2.843 0 0 1-2.94 2.94 2.848 2.848 0 0 0-2.176.902 2.847 2.847 0 0 1-4.16 0 2.85 2.85 0 0 0-2.176-.902 2.845 2.845 0 0 1-2.94-2.94 2.848 2.848 0 0 0-.901-2.176 2.848 2.848 0 0 1 0-4.16 2.849 2.849 0 0 0 .901-2.176 2.845 2.845 0 0 1 2.941-2.94 2.849 2.849 0 0 0 2.176-.901 2.847 2.847 0 0 1 4.159 0Z"
            />

            <NumberInput
              onChange={(amount) => setBetAmount(amount)}
              placeholder="bet amount..."
              className=""
              svgPath="M8 17.345a4.76 4.76 0 0 0 2.558 1.618c2.274.589 4.512-.446 4.999-2.31.487-1.866-1.273-3.9-3.546-4.49-2.273-.59-4.034-2.623-3.547-4.488.486-1.865 2.724-2.899 4.998-2.31.982.236 1.87.793 2.538 1.592m-3.879 12.171V21m0-18v2.2"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className="h-[82px] p-2 rounded-lg border-1 text-purple-200 overflow-hidden
              bg-gray-400 dark:bg-purple-950/10
              border-purple-500 dark:border-purple-700"
            >
              <input
                type="date"
                value={date}
                className="w-full min-w-0 h-full focus:outline-none"
                onChange={(e) => setDate(e.target.value)}
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
              <span className={`${isShowBetSubmitSpinner ? "opacity-20" : ""}`}>
                submit gamba
              </span>
              <Spinner isShowSpinner={isShowBetSubmitSpinner} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full min-h-32 relative">
        <div className={`mt-10 ${bets.length === 0 ? "block" : "hidden"}`}>
          <Spinner isShowSpinner={bets.length === 0} />
        </div>

        <BetHistory
          bets={bets}
          handleBetSettlement={handleBetSettlement}
          handleBetDeletion={handleBetDeletion}
          isShowBetSettlementSpinner={isShowBetSettlementSpinner}
          currentBetIdBeingSettled={currentBetIdBeingSettled}
          onDeleteDrawerOpenChange={setIsDeleteDrawerOpen}
        />
      </div>
    </main>
  );
}

/**
 * userA: the user whose balance is being calculated, the return value is net profit relative to them
 * userB: the other user who userA's profit is being calculated against, EMPTY STRING if all users
 */
const calculateProfit = (userA: string, userB: string, bets: Bet[]) => {
  return bets.reduce((total, bet) => {
    const outcome = getBetOutcome(bet);
    if (!outcome) return total;

    if (
      bet.userA.name === userA &&
      (bet.userB.name === userB || userB === "")
    ) {
      return total + outcome.userA;
    }
    if (
      bet.userB.name === userA &&
      (bet.userA.name === userB || userB === "")
    ) {
      return total + outcome.userB;
    }

    return total;
  }, 0.0);
};

const formatProfit = (profit: number) => {
  return `${profit < 0 ? "-" : "+"}$${profit < 0 ? -profit : profit}`;
};
