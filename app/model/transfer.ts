import type { DocumentReference, Timestamp } from "firebase/firestore";
import type { BaseFirebaseDocument } from "./base-firebase-document";
import type { User } from "./user";

/**
 * A cash settlement between two users, recorded when money actually changes
 * hands. Transfers live alongside bets: bets accrue profit, transfers pay it
 * down, and the difference is what's still owed.
 */
export type TransferDto = BaseFirebaseDocument & {
  from: DocumentReference<User>;
  to: DocumentReference<User>;
  amount: number;
  date: Timestamp;
};

/** A transfer with its user references resolved. */
export type Transfer = {
  id: string;
  from: User;
  to: User;
  amount: number;
  date: Timestamp;
};
