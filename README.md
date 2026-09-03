# Snake Draft Fantasy League

A GitHub Pages site recreating the league's Google Sheet:

- Five owners (Troy, Papadoc, Ryan, Max, Brady) run a **live snake draft** right on the site, one NFL team at a time — 6 rounds, so each ends up with 6 teams (30 of the 32 NFL teams get drafted; 2 are left undrafted every season, by design). Round 1 goes in a set (or randomized) order; every following round snakes back in reverse. Divisions are just how the draft board is organized for browsing, not a unit you draft.
- Scoring = 1 point per regular-season win + 5 points per team that makes the playoffs + 5 points (once) if any team wins the Super Bowl.
- **Win totals** refresh live from ESPN's public NFL API, regular season only (preseason games are excluded), no manual entry needed.
- **The draft itself, playoff berths,** and the **Super Bowl winner** are all shared state that syncs to everyone in real time via Firebase Firestore — same mechanic as the `lawn-care` project's shared watering log. Anyone can make the pick for whoever's currently on the clock; it's the honor system, same as everything else on this site.

Everything (draft board, standings table, roster cards) recomputes automatically in the browser — there's no build step and nothing to redeploy when the draft or scores change.

## Firebase setup (one-time)

Only needed for live syncing across everyone's devices. Without it, the site still works — win totals still pull live from ESPN, and you can still run a draft — but the draft, playoff checkboxes, and Super Bowl pick stay local to your own browser instead of syncing to everyone.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (e.g. "nfl-fantasy").
2. In the project, click **Firestore Database → Create database**. Choose **production mode** and pick a region close to you.
3. Under **Firestore → Rules**, paste and publish:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /league/{season} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Go to **Project Settings → Your apps → Add app → Web**. Register an app (any nickname). Copy the `firebaseConfig` object values.
5. Open `app.js` and fill in your values in the `FIREBASE_CONFIG` block near the top:
   ```js
   const FIREBASE_CONFIG = {
     apiKey:            "...",
     authDomain:        "...",
     projectId:         "...",
     storageBucket:     "...",
     messagingSenderId: "...",
     appId:             "...",
   };
   ```
6. Commit and push. Open the site — drafting a team, checking a "Playoffs" box, or picking the Super Bowl winner now syncs across every device instantly.

The rule above scopes read/write to `league/{season}` documents only (e.g. `league/season-2026`), matching `lawn-care`'s pattern of an open-but-scoped rule rather than locking the whole database down or requiring sign-in.

## How the data flows

- **Owners and the real NFL division alignment** (`data.js`) — static. Which teams belong to which of the 8 NFL divisions doesn't depend on the fantasy draft.
- **The draft** (`draft.order` + `draft.picks` in the shared Firestore doc) — `order` is up to `LEAGUE.players.length` owner ids (round-1 order, set by clicking owners in sequence or the "Randomize order" button); `picks` is an append-only list of `{team, owner}` (one NFL team abbreviation per entry) built one click at a time as the live draft happens, `LEAGUE.roundsPerOwner * LEAGUE.players.length` entries total (currently 30 — 2 of the 32 NFL teams stay undrafted by design). Even-indexed rounds go in `order`, odd-indexed rounds go in `order` reversed. Who owns which team is always derived from `picks`, never stored separately.
- **Win totals** — fetched client-side from `site.api.espn.com` per team (explicitly `seasontype=2`, i.e. regular season only — preseason wins/losses never count) on load and every hour (or via the "Refresh live wins" button), then cached into the Firestore doc so every viewer benefits from the latest successful fetch, not just their own.
- **Playoff berths / Super Bowl winner** — stored directly in the same Firestore doc, read on load and kept live via `onSnapshot`.

If Firebase is unreachable or unconfigured, the page still renders fully (draft, roster, live ESPN wins) — only the cross-device sync is unavailable (the draft still works, just local to your own browser), and a small banner under the standings table says so.

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Deployment

GitHub Pages is set to deploy straight from the `main` branch (Settings → Pages → Build and deployment → Source: **Deploy from a branch**, branch `main`). `.nojekyll` at the repo root tells Pages to serve the files as-is instead of running them through Jekyll. Any push to `main` goes live within a minute or two — no build step, no Actions workflow needed.
