/**
 * Roster config — who drafted which two divisions (8 teams) each.
 *
 * This part is fixed once the draft happens, so it stays a static file.
 * Everything that changes over the season (win totals, playoff berths, the
 * Super Bowl winner) is NOT in here — it lives in Firestore (see app.js /
 * README) so it can update live and stay in sync across everyone's devices.
 */

const LEAGUE = {
  season: 2025,

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

  // `abbr` doubles as the ESPN team slug (used for live win totals + logos).
  teams: [
    // Troy — AFC North + AFC East
    { abbr: "CIN", name: "Bengals", division: "AFC North", owner: "troy" },
    { abbr: "CLE", name: "Browns", division: "AFC North", owner: "troy" },
    { abbr: "BAL", name: "Ravens", division: "AFC North", owner: "troy" },
    { abbr: "PIT", name: "Steelers", division: "AFC North", owner: "troy" },
    { abbr: "BUF", name: "Bills", division: "AFC East", owner: "troy" },
    { abbr: "MIA", name: "Dolphins", division: "AFC East", owner: "troy" },
    { abbr: "NE", name: "Patriots", division: "AFC East", owner: "troy" },
    { abbr: "NYJ", name: "Jets", division: "AFC East", owner: "troy" },

    // Papadoc — AFC South + AFC West
    { abbr: "IND", name: "Colts", division: "AFC South", owner: "papadoc" },
    { abbr: "JAX", name: "Jaguars", division: "AFC South", owner: "papadoc" },
    { abbr: "HOU", name: "Texans", division: "AFC South", owner: "papadoc" },
    { abbr: "TEN", name: "Titans", division: "AFC South", owner: "papadoc" },
    { abbr: "DEN", name: "Broncos", division: "AFC West", owner: "papadoc" },
    { abbr: "LAC", name: "Chargers", division: "AFC West", owner: "papadoc" },
    { abbr: "KC", name: "Chiefs", division: "AFC West", owner: "papadoc" },
    { abbr: "LV", name: "Raiders", division: "AFC West", owner: "papadoc" },

    // Ryan — NFC North + NFC East
    { abbr: "CHI", name: "Bears", division: "NFC North", owner: "ryan" },
    { abbr: "GB", name: "Packers", division: "NFC North", owner: "ryan" },
    { abbr: "MIN", name: "Vikings", division: "NFC North", owner: "ryan" },
    { abbr: "DET", name: "Lions", division: "NFC North", owner: "ryan" },
    { abbr: "WSH", name: "Commanders", division: "NFC East", owner: "ryan" },
    { abbr: "DAL", name: "Cowboys", division: "NFC East", owner: "ryan" },
    { abbr: "PHI", name: "Eagles", division: "NFC East", owner: "ryan" },
    { abbr: "NYG", name: "Giants", division: "NFC East", owner: "ryan" },

    // Max — NFC South + NFC West
    { abbr: "TB", name: "Buccaneers", division: "NFC South", owner: "max" },
    { abbr: "ATL", name: "Falcons", division: "NFC South", owner: "max" },
    { abbr: "CAR", name: "Panthers", division: "NFC South", owner: "max" },
    { abbr: "NO", name: "Saints", division: "NFC South", owner: "max" },
    { abbr: "SF", name: "49ers", division: "NFC West", owner: "max" },
    { abbr: "ARI", name: "Cardinals", division: "NFC West", owner: "max" },
    { abbr: "LAR", name: "Rams", division: "NFC West", owner: "max" },
    { abbr: "SEA", name: "Seahawks", division: "NFC West", owner: "max" },
  ],
};
