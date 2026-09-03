# Division Draft Fantasy League

A static GitHub Pages site recreating the league's Google Sheet:

- Four owners (Troy, Papadoc, Ryan, Max) each draft **two full NFL divisions** (8 teams).
- Scoring = 1 point per regular-season win + 5 points per team that makes the playoffs + 5 points (once) if any team wins the Super Bowl.
- The site renders a live standings table, per-owner roster cards, and a full draft board of all 8 divisions — all computed from `data.js`.

## Updating scores

All league data lives in [`data.js`](./data.js). Open it and edit:

- `teams[].wins` — each team's regular-season win total. Use `null` for "not yet known" (shows as **TBD** and is excluded from totals, same as the source sheet's unresolved formulas).
- `playoffPoints` / `sbPoints` — per-owner bonus points (`null` = TBD).

No build step — just edit the file, commit, and push. The standings table and totals recompute automatically in the browser.

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Deployment

A GitHub Actions workflow (`.github/workflows/pages.yml`) deploys the site to GitHub Pages on every push to `main`. In the repo settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
