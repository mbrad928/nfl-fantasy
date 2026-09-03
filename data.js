/**
 * Static league config: the 5 owners and the real NFL divisional alignment.
 *
 * Who ends up owning which teams is NOT here — that's the outcome of a live
 * snake draft over individual teams, which is shared/mutable state that
 * lives in Firestore (see app.js / README) so the draft, win totals,
 * playoff berths, and the Super Bowl winner all stay in sync across
 * everyone's devices.
 */

const LEAGUE = {
  season: 2026,

  // Each owner drafts this many teams (a fixed number of snake-draft rounds),
  // not "however many teams exist" — with 5 owners x 6 teams = 30 picks out
  // of 32 NFL teams, 2 teams are deliberately left undrafted every season.
  roundsPerOwner: 6,

  players: [
    { id: "troy", name: "Troy's Team", color: "#2563eb" },
    { id: "papadoc", name: "Papadoc's Team", color: "#ea580c" },
    { id: "ryan", name: "Ryan's Team", color: "#16a34a" },
    { id: "max", name: "Max's Team", color: "#9333ea" },
    { id: "brady", name: "Brady's Team", color: "#0d9488" },
  ],

  // Purely a display grouping for the draft board — teams are drafted one at
  // a time (see snakePickOrder() in app.js), not as a division-sized bundle.
  divisionOrder: [
    "AFC North", "AFC East", "AFC South", "AFC West",
    "NFC North", "NFC East", "NFC South", "NFC West",
  ],

  // `abbr` doubles as the ESPN team slug (used for live win totals + logos).
  // Fixed by the real NFL — not affected by the fantasy draft.
  teams: [
    { abbr: "CIN", name: "Bengals", division: "AFC North" },
    { abbr: "CLE", name: "Browns", division: "AFC North" },
    { abbr: "BAL", name: "Ravens", division: "AFC North" },
    { abbr: "PIT", name: "Steelers", division: "AFC North" },
    { abbr: "BUF", name: "Bills", division: "AFC East" },
    { abbr: "MIA", name: "Dolphins", division: "AFC East" },
    { abbr: "NE", name: "Patriots", division: "AFC East" },
    { abbr: "NYJ", name: "Jets", division: "AFC East" },
    { abbr: "IND", name: "Colts", division: "AFC South" },
    { abbr: "JAX", name: "Jaguars", division: "AFC South" },
    { abbr: "HOU", name: "Texans", division: "AFC South" },
    { abbr: "TEN", name: "Titans", division: "AFC South" },
    { abbr: "DEN", name: "Broncos", division: "AFC West" },
    { abbr: "LAC", name: "Chargers", division: "AFC West" },
    { abbr: "KC", name: "Chiefs", division: "AFC West" },
    { abbr: "LV", name: "Raiders", division: "AFC West" },
    { abbr: "CHI", name: "Bears", division: "NFC North" },
    { abbr: "GB", name: "Packers", division: "NFC North" },
    { abbr: "MIN", name: "Vikings", division: "NFC North" },
    { abbr: "DET", name: "Lions", division: "NFC North" },
    { abbr: "WSH", name: "Commanders", division: "NFC East" },
    { abbr: "DAL", name: "Cowboys", division: "NFC East" },
    { abbr: "PHI", name: "Eagles", division: "NFC East" },
    { abbr: "NYG", name: "Giants", division: "NFC East" },
    { abbr: "TB", name: "Buccaneers", division: "NFC South" },
    { abbr: "ATL", name: "Falcons", division: "NFC South" },
    { abbr: "CAR", name: "Panthers", division: "NFC South" },
    { abbr: "NO", name: "Saints", division: "NFC South" },
    { abbr: "SF", name: "49ers", division: "NFC West" },
    { abbr: "ARI", name: "Cardinals", division: "NFC West" },
    { abbr: "LAR", name: "Rams", division: "NFC West" },
    { abbr: "SEA", name: "Seahawks", division: "NFC West" },
  ],
};
