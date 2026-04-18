import { useEffect, useMemo, useRef, useState } from "react";
import { Handicap, OverUnder } from "../model/binary-option-and-number";
import { LineType, type Line } from "../model/line";
import type { Team } from "../model/team";
import { getCategories, getLeagues, groupTeams } from "../model/team-grouping";
import type { User } from "../model/user";
import Drawer from "../common-components/drawer";
import FitText from "../common-components/fit-text";
import BinaryOptionAndNumberInput, {
  BinaryOptionType,
} from "../inputs/binary-option-and-number-input";

type BetSummaryProps = {
  users: User[];
  teams: Team[];
  userA: User | null;
  userB: User | null;
  onUserAChange: (userId: string) => void;
  onUserBChange: (userId: string) => void;
  teamA: Team | null;
  teamB: Team | null;
  onTeamAChange: (teamId: string) => void;
  onTeamBChange: (teamId: string) => void;
  onTeamPickerOpenChange: (isOpen: boolean) => void;
  maps: { id: string; name: string }[];
  selectedMapId: string;
  onMapChange: (mapId: string) => void;
  lines: Line[];
  selectedLineId: string;
  onLineChange: (lineId: string) => void;
  onLinePickerOpenChange: (isOpen: boolean) => void;
  onOverUnderChange: (val: OverUnder) => void;
  onHandicapChange: (val: Handicap) => void;
  odds: number | null;
  betAmount: number | null;
  date: string;
  initialOverUnder?: OverUnder;
  initialHandicap?: Handicap;
};

export default function BetSummary({
  users,
  teams,
  userA,
  userB,
  onUserAChange,
  onUserBChange,
  teamA,
  teamB,
  onTeamAChange,
  onTeamBChange,
  onTeamPickerOpenChange,
  maps,
  selectedMapId,
  onMapChange,
  lines,
  selectedLineId,
  onLineChange,
  onLinePickerOpenChange,
  onOverUnderChange,
  onHandicapChange,
  odds,
  betAmount,
  date,
  initialOverUnder,
  initialHandicap,
}: BetSummaryProps) {
  const [teamPickerSlot, setTeamPickerSlot] = useState<"A" | "B" | null>(null);
  const [pickerScreen, setPickerScreen] = useState<
    "sport" | "league" | "category" | "team"
  >("sport");
  const [pickerSport, setPickerSport] = useState<string | null>(null);
  const [pickerLeague, setPickerLeague] = useState<string | null>(null);
  const [pickerCat, setPickerCat] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");

  const teamGroups = useMemo(() => groupTeams(teams), [teams]);
  const [linePickerOpen, setLinePickerOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState("");

  // Focus picker inputs imperatively when the drawer opens — the Drawer
  // is always mounted in the DOM (just translated off-screen), so autoFocus
  // would fire on every mount and pop up the mobile keyboard even while the
  // drawer is hidden.
  const lineSearchRef = useRef<HTMLInputElement>(null);
  const teamSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linePickerOpen) lineSearchRef.current?.focus();
  }, [linePickerOpen]);

  useEffect(() => {
    if (teamPickerSlot !== null && pickerScreen === "team") {
      teamSearchRef.current?.focus();
    }
  }, [teamPickerSlot, pickerScreen]);

  const [overUnder, setOverUnder] = useState<OverUnder>(
    () => initialOverUnder ?? { over: true, value: 0.5 },
  );
  const [handicap, setHandicap] = useState<Handicap>(
    () => initialHandicap ?? { plus: true, value: 0.5 },
  );

  const TEAM_MAX_FONT_SIZE = 64;
  const [teamAFitSize, setTeamAFitSize] = useState<number | null>(null);
  const [teamBFitSize, setTeamBFitSize] = useState<number | null>(null);

  const syncedCap =
    teamAFitSize !== null && teamBFitSize !== null
      ? Math.min(teamAFitSize, teamBFitSize)
      : TEAM_MAX_FONT_SIZE;

  const openTeamPicker = (slot: "A" | "B") => {
    setTeamPickerSlot(slot);
    setPickerScreen("sport");
    setPickerSport(null);
    setPickerLeague(null);
    setPickerCat(null);
    setTeamSearch("");
    onTeamPickerOpenChange(true);
  };

  const closeTeamPicker = () => {
    setTeamPickerSlot(null);
    setPickerScreen("sport");
    setPickerSport(null);
    setPickerLeague(null);
    setPickerCat(null);
    setTeamSearch("");
    onTeamPickerOpenChange(false);
  };

  /** Advance picker after sport is chosen */
  const selectSport = (sport: string) => {
    setPickerSport(sport);
    const group = teamGroups.find((g) => g.sport === sport);
    if (!group) return;
    const leagues = getLeagues(group);
    if (leagues.length >= 2) {
      setPickerScreen("league");
    } else {
      const league = group.leagues[0]?.league ?? "";
      setPickerLeague(league);
      const leagueGroup = group.leagues[0];
      const cats = leagueGroup ? getCategories(leagueGroup) : [];
      if (cats.length >= 2) {
        setPickerScreen("category");
      } else {
        setPickerCat(leagueGroup?.entries[0]?.category ?? "");
        setPickerScreen("team");
      }
    }
  };

  /** Advance picker after league is chosen */
  const selectLeague = (league: string) => {
    setPickerLeague(league);
    const group = teamGroups.find((g) => g.sport === pickerSport);
    const leagueGroup = group?.leagues.find((l) => l.league === league);
    const cats = leagueGroup ? getCategories(leagueGroup) : [];
    if (cats.length >= 2) {
      setPickerScreen("category");
    } else {
      setPickerCat(leagueGroup?.entries[0]?.category ?? "");
      setPickerScreen("team");
    }
  };

  /** Go back one level in the picker */
  const pickerGoBack = () => {
    if (pickerScreen === "team") {
      const group = teamGroups.find((g) => g.sport === pickerSport);
      const leagueGroup = group?.leagues.find((l) => l.league === pickerLeague);
      if (leagueGroup && getCategories(leagueGroup).length >= 2) {
        setPickerCat(null);
        setPickerScreen("category");
      } else if (group && getLeagues(group).length >= 2) {
        setPickerLeague(null);
        setPickerCat(null);
        setPickerScreen("league");
      } else {
        setPickerSport(null);
        setPickerLeague(null);
        setPickerCat(null);
        setPickerScreen("sport");
      }
    } else if (pickerScreen === "category") {
      const group = teamGroups.find((g) => g.sport === pickerSport);
      if (group && getLeagues(group).length >= 2) {
        setPickerLeague(null);
        setPickerCat(null);
        setPickerScreen("league");
      } else {
        setPickerSport(null);
        setPickerLeague(null);
        setPickerCat(null);
        setPickerScreen("sport");
      }
    } else if (pickerScreen === "league") {
      setPickerSport(null);
      setPickerLeague(null);
      setPickerCat(null);
      setPickerScreen("sport");
    }
  };

  const openLinePicker = () => {
    setLinePickerOpen(true);
    onLinePickerOpenChange(true);
  };

  const closeLinePicker = () => {
    setLinePickerOpen(false);
    setLineSearch("");
    onLinePickerOpenChange(false);
  };

  const selectClass =
    "w-full bg-transparent border border-purple-600 rounded text-purple-200 text-center text-sm cursor-pointer focus:outline-none p-1 dark:bg-gray-900";

  const pillClass = (isSelected: boolean) =>
    `px-3 py-1.5 rounded-lg border-1 font-semibold cursor-pointer text-purple-200
    border-purple-500 dark:border-purple-700
    hover:bg-purple-200 dark:hover:bg-purple-600
    active:bg-purple-300 dark:active:bg-purple-500
    ${
      isSelected
        ? "bg-purple-300 dark:bg-purple-500/75"
        : "bg-gray-400 dark:bg-purple-700/50"
    }`;

  const userOptions = users.map((u) => (
    <option key={u.id} value={u.id} className="bg-gray-900">
      {u.name}
    </option>
  ));

  const activeTeam = teamPickerSlot === "A" ? teamA : teamB;

  /** Teams visible on the final "team" screen */
  const pickerTeams = useMemo(() => {
    if (pickerScreen !== "team") return [];
    return teams
      .filter(
        (t) =>
          (t.sport?.trim() || "Uncategorised") === pickerSport &&
          (t.league?.trim() || "") === (pickerLeague ?? "") &&
          (t.category?.trim() || "") === (pickerCat ?? "") &&
          t.name.toLowerCase().includes(teamSearch.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, pickerScreen, pickerSport, pickerLeague, pickerCat, teamSearch]);

  const pickerTitle =
    pickerScreen === "league"
      ? "Select League"
      : pickerScreen === "category"
      ? "Select Category"
      : `Select Team ${teamPickerSlot === "A" ? "1" : "2"}`;

  const pickerSubtitle =
    pickerScreen === "league"
      ? pickerSport
      : pickerScreen === "category"
      ? [pickerSport, pickerLeague].filter(Boolean).join(" › ")
      : pickerScreen === "team"
      ? [pickerSport, pickerLeague, pickerCat].filter(Boolean).join(" › ")
      : null;

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? null;
  const selectedMap = maps.find((m) => m.id === selectedMapId) ?? null;

  return (
    <>
      <div
        className="w-full h-max rounded-lg p-2 border-1 text-purple-200 space-y-2
          bg-gray-400 dark:bg-purple-950/10
          border-purple-500 dark:border-purple-700"
      >
        {/* Teams + Users */}
        <div className="w-full min-h-32 h-max flex font-bold text-center items-center">
          <div className="w-5/12 h-max space-y-1">
            <button
              onClick={() => openTeamPicker("A")}
              className="w-full cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity overflow-hidden"
            >
              {teamA ? (
                <FitText
                  text={teamA.name}
                  maxSize={TEAM_MAX_FONT_SIZE}
                  cap={syncedCap}
                  onFitSize={setTeamAFitSize}
                  className="w-full whitespace-nowrap overflow-hidden font-bold"
                />
              ) : (
                <span className="text-2xl text-purple-600">team 1</span>
              )}
            </button>
            <select
              value={userA?.id ?? ""}
              onChange={(e) => onUserAChange(e.target.value)}
              className={selectClass}
            >
              <option value="">user 1...</option>
              {userOptions}
            </select>
          </div>

          <div className="w-2/12">{"vs"}</div>

          <div className="w-5/12 h-max space-y-1">
            <button
              onClick={() => openTeamPicker("B")}
              className="w-full cursor-pointer hover:opacity-70 active:opacity-50 transition-opacity overflow-hidden"
            >
              {teamB ? (
                <FitText
                  text={teamB.name}
                  maxSize={TEAM_MAX_FONT_SIZE}
                  cap={syncedCap}
                  onFitSize={setTeamBFitSize}
                  className="w-full whitespace-nowrap overflow-hidden font-bold"
                />
              ) : (
                <span className="text-2xl text-purple-600">team 2</span>
              )}
            </button>
            <select
              value={userB?.id ?? ""}
              onChange={(e) => onUserBChange(e.target.value)}
              className={selectClass}
            >
              <option value="">user 2...</option>
              {userOptions}
            </select>
          </div>
        </div>

        {/* Map dropdown + Line picker + conditional O/U or +/- */}
        <div className="space-y-1">
          <select
            value={selectedMapId}
            onChange={(e) => onMapChange(e.target.value)}
            className={selectClass}
          >
            <option value="">map...</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id} className="bg-gray-900">
                {m.name}
              </option>
            ))}
          </select>

          <button onClick={openLinePicker} className={selectClass}>
            {selectedLine ? selectedLine.name : "line..."}
          </button>

          {selectedLine?.lineType === LineType.OVER_UNDER && (
            <div className="flex justify-center pt-1">
              <BinaryOptionAndNumberInput
                type={BinaryOptionType.OVER_UNDER}
                initialValue={initialOverUnder}
                onChange={(val) => {
                  if (val instanceof OverUnder) {
                    setOverUnder(val);
                    onOverUnderChange(val);
                  }
                }}
              />
            </div>
          )}

          {selectedLine?.lineType === LineType.HANDICAP && (
            <div className="flex justify-center pt-1">
              <BinaryOptionAndNumberInput
                type={BinaryOptionType.HANDICAP}
                initialValue={initialHandicap}
                onChange={(val) => {
                  if (val instanceof Handicap) {
                    setHandicap(val);
                    onHandicapChange(val);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Summary text */}
        <div className="w-full h-max p-2 flex-wrap font-bold text-center items-center text-xl">
          {date} {selectedMap?.name ?? ""} {selectedLine?.name ?? ""}{" "}
          {selectedLine?.lineType === LineType.OVER_UNDER
            ? (overUnder.over ? "o" : "u") + overUnder.value
            : ""}{" "}
          {selectedLine?.lineType === LineType.HANDICAP
            ? (handicap.plus ? "+" : "-") + handicap.value
            : ""}{" "}
          {odds ? "@" + odds.toFixed(2) + "x " : ""}
          {betAmount ? "$" + betAmount : ""}
        </div>
      </div>

      {/* Team picker drawer */}
      <Drawer
        isOpen={teamPickerSlot !== null}
        onClose={closeTeamPicker}
        direction="top"
      >
        <div className="space-y-3 text-purple-200">
          {/* Header: back button + title */}
          <div className="flex items-center gap-2">
            {pickerScreen !== "sport" && (
              <button
                onClick={pickerGoBack}
                className="text-purple-400 hover:text-purple-200 active:text-purple-100 p-1 cursor-pointer"
                aria-label="Go back"
              >
                ←
              </button>
            )}
            <div className="flex-1 text-center">
              <div className="text-xl font-bold">{pickerTitle}</div>
              {pickerSubtitle && (
                <div className="text-sm text-purple-400">{pickerSubtitle}</div>
              )}
            </div>
            {/* Spacer to balance the back button */}
            {pickerScreen !== "sport" && <div className="w-7" />}
          </div>

          {/* Sport screen */}
          {pickerScreen === "sport" && (
            <div className="space-y-2 max-h-64 overflow-y-auto pb-1">
              {teamGroups.map((g) => (
                <button
                  key={g.sport}
                  onClick={() => selectSport(g.sport)}
                  className="w-full py-3 px-4 rounded-lg text-left font-semibold border-1
                    border-purple-500 dark:border-purple-700
                    bg-gray-400 dark:bg-purple-700/50
                    hover:bg-purple-200 dark:hover:bg-purple-600
                    active:bg-purple-300 dark:active:bg-purple-500
                    cursor-pointer"
                >
                  {g.sport}
                </button>
              ))}
            </div>
          )}

          {/* League screen */}
          {pickerScreen === "league" &&
            (() => {
              const group = teamGroups.find((g) => g.sport === pickerSport);
              return (
                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pb-1">
                  {group?.leagues.map((lg) => (
                    <button
                      key={lg.league}
                      className={pillClass(lg.league === pickerLeague)}
                      onClick={() => selectLeague(lg.league)}
                    >
                      {lg.league || "(none)"}
                    </button>
                  ))}
                </div>
              );
            })()}

          {/* Category screen */}
          {pickerScreen === "category" &&
            (() => {
              const group = teamGroups.find((g) => g.sport === pickerSport);
              const leagueGroup = group?.leagues.find(
                (l) => l.league === pickerLeague,
              );
              return (
                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pb-1">
                  {leagueGroup?.entries.map((entry) => (
                    <button
                      key={entry.category}
                      className={pillClass(entry.category === pickerCat)}
                      onClick={() => {
                        setPickerCat(entry.category);
                        setPickerScreen("team");
                      }}
                    >
                      {entry.category || "(none)"}
                    </button>
                  ))}
                </div>
              );
            })()}

          {/* Team screen */}
          {pickerScreen === "team" && (
            <>
              <input
                ref={teamSearchRef}
                type="text"
                placeholder="Search teams..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full h-10 rounded-lg px-3 border-1 bg-transparent
                  border-purple-500 dark:border-purple-700
                  text-purple-200 focus:outline-none"
              />
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pb-1">
                {pickerTeams.map((t) => (
                  <button
                    key={t.id}
                    className={pillClass(t.id === activeTeam?.id)}
                    onClick={() => {
                      if (teamPickerSlot === "A") onTeamAChange(t.id);
                      else onTeamBChange(t.id);
                      closeTeamPicker();
                    }}
                  >
                    {t.name}
                  </button>
                ))}
                {pickerTeams.length === 0 && (
                  <div className="text-purple-500 text-sm">No teams found.</div>
                )}
              </div>
            </>
          )}
        </div>
      </Drawer>

      {/* Line picker drawer */}
      <Drawer
        isOpen={linePickerOpen}
        onClose={closeLinePicker}
        direction="top"
      >
        <div className="space-y-3 text-purple-200">
          <div className="text-xl font-bold text-center">Select Line</div>

          <input
            ref={lineSearchRef}
            type="text"
            placeholder="Search lines..."
            value={lineSearch}
            onChange={(e) => setLineSearch(e.target.value)}
            className="w-full h-10 rounded-lg px-3 border-1 bg-transparent
              border-purple-500 dark:border-purple-700
              text-purple-200 focus:outline-none"
          />

          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pb-1">
            {lines
              .filter((l) =>
                l.name.toLowerCase().includes(lineSearch.toLowerCase()),
              )
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((l) => (
                <button
                  key={l.id}
                  className={pillClass(l.id === selectedLineId)}
                  onClick={() => {
                    onLineChange(l.id);
                    closeLinePicker();
                  }}
                >
                  {l.name}
                </button>
              ))}
          </div>
        </div>
      </Drawer>
    </>
  );
}
