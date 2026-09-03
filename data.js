/**
 * Single source of truth for the league.
 *
 * Concept (recreated from the original Google Sheet):
 *   - Four owners each draft two full NFL divisions (8 teams).
 *   - Scoring = (1 point per regular-season win, across all 8 teams)
 *             + (5 points for every one of your teams that makes the playoffs)
 *             + (5 points, once, if any of your teams wins the Super Bowl)
 *
 * `wins`, `playoffPoints`, and `sbPoints` are `null` when the source sheet
 * had them as an unresolved live formula (=AI(...)) rather than a settled
 * number — same as the original, this site shows those as "TBD" instead of
 * guessing, and leaves them out of the running total until you fill them in.
 *
 * To update the league: edit the numbers below and refresh the page.
 * Nothing here needs a build step.
 */

const LEAGUE = {
  season: 2025,
  updated: "2026-09-03",

  players: [
    { id: "troy", name: "Troy's Team", color: "#2563eb", divisions: ["AFC North", "AFC East"] },
    { id: "papadoc", name: "Papadoc's Team", color: "#ea580c", divisions: ["AFC South", "AFC West"] },
    { id: "ryan", name: "Ryan's Team", color: "#16a34a", divisions: ["NFC North", "NFC East"] },
    { id: "max", name: "Max's Team", color: "#9333ea", divisions: ["NFC South", "NFC West"] },
  ],

  divisionOrder: [
    "AFC North", "AFC East", "AFC South", "AFC West",
    "NFC North", "NFC East", "NFC South", "NFC West",
  ],

  // wins: number = settled 2025 regular-season win total, null = TBD (still an =AI() formula in the sheet)
  teams: [
    // Troy — AFC North + AFC East
    { abbr: "CIN", name: "Bengals", division: "AFC North", owner: "troy", wins: 8 },
    { abbr: "CLE", name: "Browns", division: "AFC North", owner: "troy", wins: 5 },
    { abbr: "BAL", name: "Ravens", division: "AFC North", owner: "troy", wins: 8 },
    { abbr: "PIT", name: "Steelers", division: "AFC North", owner: "troy", wins: 10 },
    { abbr: "BUF", name: "Bills", division: "AFC East", owner: "troy", wins: 12 },
    { abbr: "MIA", name: "Dolphins", division: "AFC East", owner: "troy", wins: 7 },
    { abbr: "NE", name: "Patriots", division: "AFC East", owner: "troy", wins: 14 },
    { abbr: "NYJ", name: "Jets", division: "AFC East", owner: "troy", wins: 3 },

    // Papadoc — AFC South + AFC West
    { abbr: "IND", name: "Colts", division: "AFC South", owner: "papadoc", wins: 8 },
    { abbr: "JAX", name: "Jaguars", division: "AFC South", owner: "papadoc", wins: 13 },
    { abbr: "HOU", name: "Texans", division: "AFC South", owner: "papadoc", wins: 12 },
    { abbr: "TEN", name: "Titans", division: "AFC South", owner: "papadoc", wins: 3 },
    { abbr: "DEN", name: "Broncos", division: "AFC West", owner: "papadoc", wins: 14 },
    { abbr: "LAC", name: "Chargers", division: "AFC West", owner: "papadoc", wins: 11 },
    { abbr: "KC", name: "Chiefs", division: "AFC West", owner: "papadoc", wins: 6 },
    { abbr: "LV", name: "Raiders", division: "AFC West", owner: "papadoc", wins: 3 },

    // Ryan — NFC North + NFC East
    { abbr: "CHI", name: "Bears", division: "NFC North", owner: "ryan", wins: 8 },
    { abbr: "GB", name: "Packers", division: "NFC North", owner: "ryan", wins: 9 },
    { abbr: "MIN", name: "Vikings", division: "NFC North", owner: "ryan", wins: 9 },
    { abbr: "DET", name: "Lions", division: "NFC North", owner: "ryan", wins: 9 },
    { abbr: "WSH", name: "Commanders", division: "NFC East", owner: "ryan", wins: null },
    { abbr: "DAL", name: "Cowboys", division: "NFC East", owner: "ryan", wins: null },
    { abbr: "PHI", name: "Eagles", division: "NFC East", owner: "ryan", wins: null },
    { abbr: "NYG", name: "Giants", division: "NFC East", owner: "ryan", wins: null },

    // Max — NFC South + NFC West
    { abbr: "TB", name: "Buccaneers", division: "NFC South", owner: "max", wins: 8 },
    { abbr: "ATL", name: "Falcons", division: "NFC South", owner: "max", wins: null },
    { abbr: "CAR", name: "Panthers", division: "NFC South", owner: "max", wins: null },
    { abbr: "NO", name: "Saints", division: "NFC South", owner: "max", wins: null },
    { abbr: "SF", name: "49ers", division: "NFC West", owner: "max", wins: null },
    { abbr: "ARI", name: "Cardinals", division: "NFC West", owner: "max", wins: null },
    { abbr: "LAR", name: "Rams", division: "NFC West", owner: "max", wins: null },
    { abbr: "SEA", name: "Seahawks", division: "NFC West", owner: "max", wins: null },
  ],

  // 5 pts per team that made the 2025 playoffs
  playoffPoints: { troy: 15, papadoc: 20, ryan: 25, max: null },

  // flat 5 pts if any of the owner's 8 teams won Super Bowl LX, else 0
  sbPoints: { troy: 0, papadoc: 0, ryan: null, max: null },
};
