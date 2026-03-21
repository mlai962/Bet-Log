import { useState } from "react";
import { Handicap, OverUnder } from "../model/binary-option-and-number";
import { LineType, type Line } from "../model/line";
import type { Team } from "../model/team";
import type { User } from "../model/user";
import BottomDrawer from "../common-components/bottom-drawer";
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
}: BetSummaryProps) {
  const [teamPickerSlot, setTeamPickerSlot] = useState<"A" | "B" | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [linePickerOpen, setLinePickerOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState("");

  const [overUnder, setOverUnder] = useState<OverUnder>({
    over: true,
    value: 0.5,
  });
  const [handicap, setHandicap] = useState<Handicap>({
    plus: true,
    value: 0.5,
  });

  const TEAM_MAX_FONT_SIZE = 64;
  const [teamAFitSize, setTeamAFitSize] = useState<number | null>(null);
  const [teamBFitSize, setTeamBFitSize] = useState<number | null>(null);

  const syncedCap =
    teamAFitSize !== null && teamBFitSize !== null
      ? Math.min(teamAFitSize, teamBFitSize)
      : TEAM_MAX_FONT_SIZE;

  const openTeamPicker = (slot: "A" | "B") => {
    setTeamPickerSlot(slot);
    onTeamPickerOpenChange(true);
  };

  const closeTeamPicker = () => {
    setTeamPickerSlot(null);
    setTeamSearch("");
    onTeamPickerOpenChange(false);
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
  const filteredTeams = teams
    .filter((t) => t.name.toLowerCase().includes(teamSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      <BottomDrawer isOpen={teamPickerSlot !== null} onClose={closeTeamPicker} direction="top">
        <div className="space-y-3 text-purple-200">
          <div className="text-xl font-bold text-center">
            Select Team {teamPickerSlot === "A" ? "1" : "2"}
          </div>

          <input
            type="text"
            placeholder="Search teams..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="w-full h-10 rounded-lg px-3 border-1 bg-transparent
              border-purple-500 dark:border-purple-700
              text-purple-200 focus:outline-none"
            autoFocus
          />

          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pb-1">
            {filteredTeams.map((t) => (
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
          </div>
        </div>
      </BottomDrawer>

      {/* Line picker drawer */}
      <BottomDrawer isOpen={linePickerOpen} onClose={closeLinePicker} direction="top">
        <div className="space-y-3 text-purple-200">
          <div className="text-xl font-bold text-center">Select Line</div>

          <input
            type="text"
            placeholder="Search lines..."
            value={lineSearch}
            onChange={(e) => setLineSearch(e.target.value)}
            className="w-full h-10 rounded-lg px-3 border-1 bg-transparent
              border-purple-500 dark:border-purple-700
              text-purple-200 focus:outline-none"
            autoFocus
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
      </BottomDrawer>
    </>
  );
}
