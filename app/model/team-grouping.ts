import type { Team } from "./team";

export type TeamEntry = { category: string; teams: Team[] };
export type LeagueGroup = { league: string; entries: TeamEntry[] };
export type SportGroup = { sport: string; leagues: LeagueGroup[] };

export function groupTeams(teams: Team[]): SportGroup[] {
  const sportMap = new Map<string, Map<string, Map<string, Team[]>>>();

  for (const team of teams) {
    const sport = team.sport?.trim() || "Uncategorised";
    const league = team.league?.trim() || "";
    const category = team.category?.trim() || "";

    if (!sportMap.has(sport)) sportMap.set(sport, new Map());
    const leagueMap = sportMap.get(sport)!;

    if (!leagueMap.has(league)) leagueMap.set(league, new Map());
    const catMap = leagueMap.get(league)!;

    if (!catMap.has(category)) catMap.set(category, []);
    catMap.get(category)!.push(team);
  }

  const result: SportGroup[] = [];

  for (const [sport, leagueMap] of sportMap) {
    const leagues: LeagueGroup[] = [];

    for (const [league, catMap] of leagueMap) {
      const entries: TeamEntry[] = [];

      for (const [category, teamList] of catMap) {
        entries.push({
          category,
          teams: [...teamList].sort((a, b) => a.name.localeCompare(b.name)),
        });
      }

      entries.sort((a, b) => a.category.localeCompare(b.category));
      leagues.push({ league, entries });
    }

    leagues.sort((a, b) => a.league.localeCompare(b.league));
    result.push({ sport, leagues });
  }

  result.sort((a, b) => {
    if (a.sport === "Uncategorised") return 1;
    if (b.sport === "Uncategorised") return -1;
    return a.sport.localeCompare(b.sport);
  });

  return result;
}

/** Returns distinct non-empty leagues for a given sport group */
export function getLeagues(group: SportGroup): string[] {
  return group.leagues.map((l) => l.league).filter(Boolean);
}

/** Returns distinct non-empty categories for a given league group */
export function getCategories(leagueGroup: LeagueGroup): string[] {
  return leagueGroup.entries.map((e) => e.category).filter(Boolean);
}
