# Division Draft Fantasy League

A GitHub Pages site recreating the league's Google Sheet:

- Four owners (Troy, Papadoc, Ryan, Max) each draft **two full NFL divisions** (8 teams). Rosters are fixed once the draft happens — they live in [`data.js`](./data.js).
- Scoring = 1 point per regular-season win + 5 points per team that makes the playoffs + 5 points (once) if any team wins the Super Bowl.
- **Win totals** refresh live from ESPN's public NFL API, no manual entry needed.
- **Playoff berths** and the **Super Bowl winner** are checked off by any of the four of you in the UI, and sync to everyone in real time via Firebase Firestore — same mechanic as the `lawn-care` project's shared watering log.

Everything (standings table, roster cards, draft board) recomputes automatically in the browser — there's no build step and nothing to redeploy when scores change.

## Firebase setup (one-time)

Only needed for live syncing across everyone's devices. Without it, the site still works — win totals still pull live from ESPN — but playoff/Super Bowl checkboxes stay local to your own browser instead of syncing.

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
6. Commit and push. Open the site — checking a "Playoffs" box or picking the Super Bowl winner now syncs across every device instantly.

The rule above scopes read/write to `league/{season}` documents only (e.g. `league/season-2025`), matching `lawn-care`'s pattern of an open-but-scoped rule rather than locking the whole database down or requiring sign-in.

## How the data flows

- **Roster** (`data.js`) — static. Who drafted which divisions/teams. Edit and push if a trade ever happens.
- **Win totals** — fetched client-side from `site.api.espn.com` per team on load and every hour (or via the "Refresh live wins" button), then cached into the Firestore doc so every viewer benefits from the latest successful fetch, not just their own.
- **Playoff berths / Super Bowl winner** — stored directly in the same Firestore doc, read on load and kept live via `onSnapshot`.

If Firebase is unreachable or unconfigured, the page still renders fully (roster, draft board, live ESPN wins) — only the cross-device sync for playoff/SB checkboxes is unavailable, and a small banner under the standings table says so.

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Deployment

A GitHub Actions workflow (`.github/workflows/pages.yml`) deploys the site to GitHub Pages on every push to `main`. In the repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
