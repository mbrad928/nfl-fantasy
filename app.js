/**
 * Renders the page from LEAGUE (data.js, static roster) + live/shared state:
 *
 *   - Win totals: fetched live from ESPN's public NFL API, per team, and
 *     cached into Firestore so every viewer sees the latest successful
 *     fetch even before their own browser's request lands (or if it fails).
 *   - Playoff berths + Super Bowl winner: not reliably available from a
 *     free live feed, so they're simple checkboxes / a dropdown that any
 *     owner can set — writes go to Firestore and sync to everyone instantly.
 *
 * Firebase is loaded via dynamic import() (not a static top-level import) so
 * that a blocked/unreachable Firebase CDN only disables sync — it can't take
 * the whole page down. Everything else (roster, draft board, live ESPN wins)
 * works with or without it.
 *
 * See README.md for one-time Firebase project setup.
 */

// ── Firebase config — paste your project's values here (see README.md) ────────
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const WINS_REFRESH_MS = 60 * 60 * 1000; // re-pull live win totals hourly

const $ = (sel, el = document) => el.querySelector(sel);

const playerById = Object.fromEntries(LEAGUE.players.map((p) => [p.id, p]));
const teamsByOwner = Object.fromEntries(LEAGUE.players.map((p) => [p.id, []]));
for (const t of LEAGUE.teams) teamsByOwner[t.owner].push(t);

// ── Shared state (Firestore-backed) ─────────────────────────────────────────
let _fs = null; // { doc, getDoc, setDoc, updateDoc, onSnapshot } once loaded
let _leagueDocRef = null;
let liveWins = {}; // abbr -> wins (number). Missing = not yet loaded.
let playoffTeams = {}; // abbr -> true
let sbWinner = null; // abbr | null
let lastSynced = null; // ISO string | null
let firestoreReady = false;

function logoUrl(abbr) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
}

// ── Live win totals (ESPN public API) ───────────────────────────────────────
async function fetchTeamWins(abbr) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr.toLowerCase()}`);
  if (!res.ok) throw new Error(`ESPN request failed for ${abbr}: ${res.status}`);
  const json = await res.json();
  const items = json?.team?.record?.items || [];
  const record = items.find((i) => i.type === "total") || items[0];
  if (!record) throw new Error(`no record block for ${abbr}`);
  const winStat = (record.stats || []).find((s) => s.name === "wins");
  if (winStat && typeof winStat.value === "number") return winStat.value;
  // Fallback: parse a "W-L" / "W-L-T" summary string.
  const parsed = parseInt(String(record.summary || "").split("-")[0], 10);
  if (!isNaN(parsed)) return parsed;
  throw new Error(`couldn't parse wins for ${abbr}`);
}

async function pullLiveWins() {
  const results = await Promise.allSettled(
    LEAGUE.teams.map((t) => fetchTeamWins(t.abbr).then((wins) => [t.abbr, wins]))
  );
  const updates = {};
  for (const r of results) {
    if (r.status === "fulfilled") updates[r.value[0]] = r.value[1];
  }
  const failures = results.length - Object.keys(updates).length;
  if (failures) console.warn(`Live win totals: ${failures}/${results.length} teams failed to fetch.`);
  if (Object.keys(updates).length === 0) return false;

  liveWins = { ...liveWins, ...updates };
  lastSynced = new Date().toISOString();
  render();

  if (_fs && _leagueDocRef) {
    const dotted = {};
    for (const [abbr, wins] of Object.entries(updates)) dotted[`wins.${abbr}`] = wins;
    dotted.lastSynced = lastSynced;
    _fs.updateDoc(_leagueDocRef, dotted).catch((err) => console.error("Firestore wins sync failed:", err));
  }
  return true;
}

// ── Firestore writes for manually-tracked state ─────────────────────────────
window.togglePlayoff = function (abbr) {
  const next = !playoffTeams[abbr];
  playoffTeams = { ...playoffTeams, [abbr]: next };
  render();
  if (_fs && _leagueDocRef) {
    _fs.updateDoc(_leagueDocRef, { [`playoffTeams.${abbr}`]: next }).catch((err) =>
      console.error("Firestore playoff sync failed:", err)
    );
  }
};

window.setSbWinner = function (abbr) {
  sbWinner = abbr || null;
  render();
  if (_fs && _leagueDocRef) {
    _fs.updateDoc(_leagueDocRef, { sbWinner }).catch((err) => console.error("Firestore SB sync failed:", err));
  }
};

// ── Standings math ───────────────────────────────────────────────────────────
function computeStanding(player) {
  const teams = teamsByOwner[player.id];
  const known = teams.filter((t) => liveWins[t.abbr] !== undefined);
  const loading = teams.length - known.length;
  const winsTotal = known.reduce((sum, t) => sum + liveWins[t.abbr], 0);
  const playoffCount = teams.filter((t) => playoffTeams[t.abbr]).length;
  const playoffPts = playoffCount * 5;
  const sbPts = sbWinner && teams.some((t) => t.abbr === sbWinner) ? 5 : 0;
  const total = winsTotal + playoffPts + sbPts;
  return { player, teams, winsTotal, loading, playoffCount, playoffPts, sbPts, total };
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderLeaderboard(standings) {
  const ranked = [...standings].sort((a, b) => b.total - a.total);
  const tbody = $("#leaderboard tbody");
  tbody.innerHTML = ranked
    .map(
      (s, i) => `
      <tr style="--owner-color:${s.player.color}">
        <td class="rank">${i === 0 ? "🏆" : `#${i + 1}`}</td>
        <td class="owner-cell"><span class="dot" style="background:${s.player.color}"></span>${s.player.name}</td>
        <td>${s.winsTotal}${s.loading ? `<span class="loading-note">${s.loading} loading…</span>` : ""}</td>
        <td>${s.playoffPts} <span class="sub-note">(${s.playoffCount})</span></td>
        <td>${s.sbPts}</td>
        <td class="total-cell">${s.total}</td>
      </tr>`
    )
    .join("");
}

function renderPlayerCards(standings) {
  $("#player-cards").innerHTML = standings
    .map((s) => {
      const teamRows = s.teams
        .map((t) => {
          const wins = liveWins[t.abbr];
          const madePlayoffs = !!playoffTeams[t.abbr];
          const isSbWinner = sbWinner === t.abbr;
          return `
        <li class="team-row">
          <img class="logo" src="${logoUrl(t.abbr)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
          <span class="team-name">${t.name}${isSbWinner ? " 🏆" : ""}</span>
          <label class="playoff-toggle" title="Made the playoffs">
            <input type="checkbox" ${madePlayoffs ? "checked" : ""} onchange="togglePlayoff('${t.abbr}')" />
            <span>Playoffs</span>
          </label>
          <span class="team-wins ${wins === undefined ? "loading" : ""}">${wins === undefined ? "…" : wins + "W"}</span>
        </li>`;
        })
        .join("");

      return `
      <section class="player-card" style="--owner-color:${s.player.color}">
        <header>
          <h3><span class="dot" style="background:${s.player.color}"></span>${s.player.name}</h3>
          <span class="card-total">${s.total}<small>pts</small></span>
        </header>
        <p class="drafted-divisions">${s.player.divisions.join(" &nbsp;+&nbsp; ")}</p>
        <ul class="team-list">${teamRows}</ul>
        <dl class="score-breakdown">
          <div><dt>Wins</dt><dd>${s.winsTotal}</dd></div>
          <div><dt>Playoff pts</dt><dd>${s.playoffPts}</dd></div>
          <div><dt>SB pts</dt><dd>${s.sbPts}</dd></div>
        </dl>
      </section>`;
    })
    .join("");
}

function renderDraftBoard() {
  const teamsByDivision = {};
  for (const t of LEAGUE.teams) (teamsByDivision[t.division] ||= []).push(t);
  $("#draft-board").innerHTML = LEAGUE.divisionOrder
    .map((divName) => {
      const teams = teamsByDivision[divName] || [];
      const owner = teams[0] ? playerById[teams[0].owner] : null;
      return `
      <div class="division-card" style="--owner-color:${owner ? owner.color : "transparent"}">
        <h4>${divName}</h4>
        <ul>
          ${teams
            .map(
              (t) => `<li>
                <img class="logo small" src="${logoUrl(t.abbr)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
                ${t.name}
              </li>`
            )
            .join("")}
        </ul>
        ${owner ? `<footer><span class="dot" style="background:${owner.color}"></span>${owner.name}</footer>` : ""}
      </div>`;
    })
    .join("");
}

function renderSbPicker() {
  const sel = $("#sb-winner-select");
  if (sel.dataset.built !== "1") {
    const groups = LEAGUE.players
      .map((p) => {
        const opts = teamsByOwner[p.id].map((t) => `<option value="${t.abbr}">${t.name}</option>`).join("");
        return `<optgroup label="${p.name}">${opts}</optgroup>`;
      })
      .join("");
    sel.innerHTML = `<option value="">Not decided yet</option>${groups}`;
    sel.dataset.built = "1";
    sel.addEventListener("change", (e) => window.setSbWinner(e.target.value));
  }
  sel.value = sbWinner || "";
}

function renderSyncStatus() {
  const el = $("#sync-status");
  const bits = [];
  bits.push(firestoreReady ? "🔄 synced live across everyone" : "⚠️ Firestore not configured — local only");
  if (lastSynced) {
    bits.push(
      `wins updated ${new Date(lastSynced).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    );
  }
  el.textContent = bits.join(" · ");
}

function render() {
  const standings = LEAGUE.players.map(computeStanding);
  renderLeaderboard(standings);
  renderPlayerCards(standings);
  renderSbPicker();
  renderSyncStatus();
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function initFirestore() {
  if (!FIREBASE_CONFIG.projectId) {
    console.warn("FIREBASE_CONFIG is empty — see README.md to set up Firestore sync.");
    return;
  }
  try {
    const [{ initializeApp }, firestoreMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js"),
    ]);
    const { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } = firestoreMod;
    _fs = { doc, getDoc, setDoc, updateDoc, onSnapshot };

    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    _leagueDocRef = _fs.doc(db, "league", `season-${LEAGUE.season}`);

    const snap = await _fs.getDoc(_leagueDocRef);
    if (snap.exists()) {
      const d = snap.data();
      liveWins = d.wins || {};
      playoffTeams = d.playoffTeams || {};
      sbWinner = d.sbWinner || null;
      lastSynced = d.lastSynced || null;
    } else {
      await _fs.setDoc(_leagueDocRef, { wins: {}, playoffTeams: {}, sbWinner: null, lastSynced: null });
    }
    firestoreReady = true;

    _fs.onSnapshot(_leagueDocRef, (s) => {
      if (!s.exists()) return;
      const d = s.data();
      liveWins = d.wins || {};
      playoffTeams = d.playoffTeams || {};
      sbWinner = d.sbWinner || null;
      lastSynced = d.lastSynced || null;
      render();
    });
  } catch (err) {
    console.warn("Firestore unavailable, continuing without sync:", err);
    _fs = null;
    _leagueDocRef = null;
  }
}

async function init() {
  $("#season-year").textContent = LEAGUE.season;
  renderDraftBoard();

  await initFirestore();
  render(); // show cached/shared state immediately

  pullLiveWins().catch((err) => console.warn("Live win-total fetch failed:", err));
  setInterval(() => pullLiveWins().catch((err) => console.warn("Live win-total refresh failed:", err)), WINS_REFRESH_MS);
}
window.refreshLiveWins = () => pullLiveWins().catch((err) => console.warn("Manual refresh failed:", err));

init();
