import type { BaseFirebaseDocument } from "./base-firebase-document";

export type Team = BaseFirebaseDocument & {
  sport?: string;
  league?: string;
  category?: string;
};
