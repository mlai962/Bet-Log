import { useMemo, useState } from "react";
import {
  doc,
  Timestamp,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Bet,
  EXTRA_BINARY_LINE_OPTION,
  EXTRA_BINARY_LINE_VALUE,
  type BetDto,
} from "../model/bet";
import { LineType, type Line } from "../model/line";
import { Handicap, OverUnder } from "../model/binary-option-and-number";
import type { Team } from "../model/team";
import type { User } from "../model/user";

export type BetFormWriteData = Pick<
  BetDto,
  "userA" | "userB" | "teamA" | "teamB" | "line" | "map" | "extras" | "betAmount" | "date" | "odds"
>;

type MapOption = { id: string; name: string };

type Options = {
  initialBet?: Bet | null;
  defaultLineId?: string;
  maps: MapOption[];
};

const isoDate = (d: Date) => d.toISOString().split("T")[0];

const seedOverUnder = (bet: Bet | null | undefined): OverUnder => {
  if (!bet || bet.line.lineType !== LineType.OVER_UNDER) {
    return new OverUnder(true, 0.5);
  }
  return new OverUnder(
    bet.extras[EXTRA_BINARY_LINE_OPTION] ?? true,
    bet.extras[EXTRA_BINARY_LINE_VALUE] ?? 0.5,
  );
};

const seedHandicap = (bet: Bet | null | undefined): Handicap => {
  if (!bet || bet.line.lineType !== LineType.HANDICAP) {
    return new Handicap(true, 0.5);
  }
  return new Handicap(
    bet.extras[EXTRA_BINARY_LINE_OPTION] ?? true,
    bet.extras[EXTRA_BINARY_LINE_VALUE] ?? 0.5,
  );
};

/**
 * Shared state + validation for the bet-composition form, used by both the
 * "create" surface in bet-log.tsx and the "edit" drawer.
 */
export function useBetFormState({ initialBet, defaultLineId, maps }: Options) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => [
    initialBet?.userA.id ?? "",
    initialBet?.userB.id ?? "",
  ]);

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => [
    initialBet?.teamA.id ?? "",
    initialBet?.teamB.id ?? "",
  ]);

  const [selectedMapId, setSelectedMapId] = useState<string>(() => {
    if (initialBet) {
      return maps.find((m) => m.name === initialBet.map)?.id ?? "";
    }
    return "mapMatch";
  });

  const [selectedLineId, setSelectedLineId] = useState<string>(
    initialBet?.line.id ?? defaultLineId ?? "",
  );

  const [date, setDate] = useState<string>(
    initialBet
      ? isoDate(initialBet.date.toDate())
      : isoDate(new Date()),
  );

  const [overUnder, setOverUnder] = useState<OverUnder>(() =>
    seedOverUnder(initialBet),
  );
  const [handicap, setHandicap] = useState<Handicap>(() =>
    seedHandicap(initialBet),
  );

  const [odds, setOdds] = useState<number>(initialBet?.odds ?? 0);
  const [betAmount, setBetAmount] = useState<number>(
    initialBet?.betAmount ?? 0,
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

  const initialOverUnder = useMemo(() => seedOverUnder(initialBet), [initialBet]);
  const initialHandicap = useMemo(() => seedHandicap(initialBet), [initialBet]);

  const isValid =
    Boolean(selectedUserIds[0]) &&
    Boolean(selectedUserIds[1]) &&
    Boolean(selectedTeamIds[0]) &&
    Boolean(selectedTeamIds[1]) &&
    selectedMapId.length > 0 &&
    selectedLineId.length > 0 &&
    odds > 0 &&
    betAmount > 0;

  const buildWriteData = (lines: Line[]): BetFormWriteData | null => {
    if (!isValid) return null;
    const line = lines.find((l) => l.id === selectedLineId);
    const mapName = maps.find((m) => m.id === selectedMapId)?.name;
    if (!line || !mapName) return null;

    return {
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
      map: mapName,
      extras: {
        [EXTRA_BINARY_LINE_OPTION]:
          line.lineType === LineType.OVER_UNDER
            ? overUnder.over
            : handicap.plus,
        [EXTRA_BINARY_LINE_VALUE]:
          line.lineType === LineType.OVER_UNDER
            ? overUnder.value
            : handicap.value,
      },
      betAmount,
      date: Timestamp.fromDate(new Date(date)),
      odds,
    };
  };

  return {
    selectedUserIds,
    selectedTeamIds,
    selectedMapId,
    selectedLineId,
    date,
    overUnder,
    handicap,
    odds,
    betAmount,
    initialOverUnder,
    initialHandicap,
    isValid,
    setSelectedMapId,
    setSelectedLineId,
    setDate,
    setOverUnder,
    setHandicap,
    setOdds,
    setBetAmount,
    handleUserAChange,
    handleUserBChange,
    handleTeamAChange,
    handleTeamBChange,
    buildWriteData,
  };
}

export type BetFormState = ReturnType<typeof useBetFormState>;
