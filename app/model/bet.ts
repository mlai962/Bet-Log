import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import type { BaseFirebaseDocument } from "./base-firebase-document";
import type { User } from "./user";
import type { Team } from "./team";
import type { Line } from "./line";

export const EXTRA_BINARY_LINE_OPTION: string = "binaryLineOption"; // boolean
export const EXTRA_BINARY_LINE_VALUE: string = "binaryLineValue"; // number

export type BetDto = BaseFirebaseDocument & {
  userA: DocumentReference<User>;
  userB: DocumentReference<User>;
  teamA: DocumentReference<Team>;
  teamB: DocumentReference<Team>;
  line: DocumentReference<Line>;
  map: string;
  extras: Record<string, any>;
  betAmount: number;
  date: Timestamp;
  odds: number;
  winner: string;
};

export class Bet {
  public readonly id: string;
  public readonly userA: User;
  public readonly userB: User;
  public readonly teamA: Team;
  public readonly teamB: Team;
  public readonly line: Line;
  public readonly map: string;
  public readonly extras: Record<string, any>;
  public readonly betAmount: number;
  public readonly date: Timestamp;
  public readonly odds: number;
  public winner: string;

  constructor(
    dto: BetDto,
    id: string,
    userA: DocumentSnapshot<User, DocumentData>,
    userB: DocumentSnapshot<User, DocumentData>,
    teamA: DocumentSnapshot<Team, DocumentData>,
    teamB: DocumentSnapshot<Team, DocumentData>,
    line: DocumentSnapshot<Line, DocumentData>,
  ) {
    this.id = id;

    this.userA = {
      ...userA.data()!,
      id: userA.id,
    };

    this.userB = {
      ...userB.data()!,
      id: userB.id,
    };

    this.teamA = {
      ...teamA.data()!,
      id: teamA.id,
    };

    this.teamB = {
      ...teamB.data()!,
      id: teamB.id,
    };

    this.line = {
      ...line.data()!,
      id: line.id,
    };

    this.map = dto.map;
    this.extras = dto.extras as Record<string, any>;
    this.betAmount = dto.betAmount;
    this.date = dto.date;
    this.odds = dto.odds;
    this.winner = dto.winner;
  }
}
