/**
 * Renders the page from LEAGUE (data.js: players + real NFL divisions) plus
 * shared, synced state that lives in a single Firestore doc:
 *
 *   - draft: a live snake draft over individual teams. Owners (LEAGUE.players)
 *     take turns picking one NFL team at a time, LEAGUE.roundsPerOwner rounds
 *     each — round 1 goes in `draft.order`, even rounds snake back in
 *     reverse, odd rounds forward again. roundsPerOwner * players.length can
 *     be less than the full 32 teams (currently 5 owners x 6 rounds = 30),
 *     so some teams are deliberately left undrafted once the draft ends.
 *     Divisions are just how the draft board groups teams for browsing;
 *     they aren't drafted as a unit.
 *   - Win totals: computed from each team's ESPN schedule, counting only
 *     completed regular-season games (preseason/postseason excluded) —
 *     ESPN's aggregate "record" field ignores season-type filtering
 *     entirely, so this counts wins itself instead of trusting it. Cached
 *     into Firestore so every viewer sees the latest successful fetch even
 *     before their own browser's request lands (or if it fails).
 *   - Playoff berths + Super Bowl winner: not reliably available from a
 *     free live feed, so they're simple checkboxes / a dropdown that any
 *     owner can set — writes go to Firestore and sync to everyone instantly.
 *
 * Firebase is loaded via dynamic import() (not a static top-level import) so
 * that a blocked/unreachable Firebase CDN only disables sync — it can't take
 * the whole page down. Everything else (draft, roster, live ESPN wins) works
 * with or without it, just local-only instead of synced.
 *
 * See README.md for one-time Firebase project setup.
 */

// ── Firebase config — paste your project's values here (see README.md) ────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCJ1w0Aa4S30BEzjdFdtyKI_m_dyNnoR0s",
  authDomain: "nfl-fantasy-ee0d6.firebaseapp.com",
  projectId: "nfl-fantasy-ee0d6",
  storageBucket: "nfl-fantasy-ee0d6.firebasestorage.app",
  messagingSenderId: "835503281149",
  appId: "1:835503281149:web:0024bf78a29bcfe6823f94",
};

const WINS_REFRESH_MS = 60 * 60 * 1000; // re-pull live win totals hourly

const $ = (sel, el = document) => el.querySelector(sel);

const playerById = Object.fromEntries(LEAGUE.players.map((p) => [p.id, p]));
const defaultColors = Object.fromEntries(LEAGUE.players.map((p) => [p.id, p.color])); // data.js fallback, used until an owner picks their own
const teamByAbbr = Object.fromEntries(LEAGUE.teams.map((t) => [t.abbr, t]));
const teamsByDivision = {};
for (const t of LEAGUE.teams) (teamsByDivision[t.division] ||= []).push(t);

const NUM_OWNERS = LEAGUE.players.length;
const ROUNDS = LEAGUE.roundsPerOwner; // teams drafted per owner
const TOTAL_PICKS = ROUNDS * NUM_OWNERS; // may be less than LEAGUE.teams.length — leftover teams go undrafted

// ── Shared state (Firestore-backed) ─────────────────────────────────────────
let _fs = null; // { doc, getDoc, setDoc, updateDoc, onSnapshot } once loaded
let _leagueDocRef = null;
let draft = { order: [], picks: [] }; // order: up to 4 owner ids (round-1 order). picks: [{team, owner}, ...] in the order made, one NFL team (abbr) per pick.
let liveWins = {}; // abbr -> wins (number). Missing = not yet loaded.
let playoffTeams = {}; // abbr -> true
let sbWinner = null; // abbr | null
let playerColors = {}; // ownerId -> hex color. Missing = use data.js's default. Duplicates across owners are fine — no uniqueness is enforced.
let lastSynced = null; // ISO string | null
let firestoreReady = false;

function logoUrl(abbr) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
}

// Mutates each LEAGUE.players entry's .color in place so every existing
// `player.color` / `s.player.color` reference site picks up custom colors
// automatically, with no need to thread a lookup through every call site.
function applyPlayerColors() {
  for (const p of LEAGUE.players) p.color = playerColors[p.id] || defaultColors[p.id];
}

window.setPlayerColor = function (ownerId, hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return; // sanity check the value came from a real color input
  playerColors = { ...playerColors, [ownerId]: hex };
  applyPlayerColors();
  render();
  if (_fs && _leagueDocRef) {
    _fs.updateDoc(_leagueDocRef, { [`playerColors.${ownerId}`]: hex }).catch((err) =>
      console.error("Firestore color sync failed:", err)
    );
  }
};

// ── Draft engine ─────────────────────────────────────────────────────────────
function orderReady() {
  return (draft.order || []).length === NUM_OWNERS;
}
function snakePickOrder() {
  if (!orderReady()) return [];
  const seq = [];
  for (let r = 0; r < ROUNDS; r++) {
    seq.push(...(r % 2 === 0 ? draft.order : [...draft.order].reverse()));
  }
  return seq;
}
function currentPickIndex() {
  return draft.picks.length;
}
function currentPickerId() {
  const seq = snakePickOrder();
  return currentPickIndex() < seq.length ? seq[currentPickIndex()] : null;
}
function draftComplete() {
  return orderReady() && draft.picks.length >= TOTAL_PICKS;
}
function teamOwner(abbr) {
  const pick = draft.picks.find((p) => p.team === abbr);
  return pick ? pick.owner : null;
}
function computeTeamsByOwner() {
  const map = Object.fromEntries(LEAGUE.players.map((p) => [p.id, []]));
  for (const t of LEAGUE.teams) {
    const owner = teamOwner(t.abbr);
    if (owner) map[owner].push(t);
  }
  return map;
}

function syncDraft() {
  if (_fs && _leagueDocRef) {
    _fs.updateDoc(_leagueDocRef, { draft }).catch((err) => console.error("Firestore draft sync failed:", err));
  }
}

window.addToDraftOrder = function (ownerId) {
  if (draft.picks.length > 0) return; // order is locked once the draft has started
  const order = draft.order || [];
  if (order.includes(ownerId) || order.length >= NUM_OWNERS) return;
  draft = { ...draft, order: [...order, ownerId] };
  render();
  syncDraft();
};

window.randomizeDraftOrder = function () {
  if (draft.picks.length > 0) return;
  const ids = LEAGUE.players.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  draft = { ...draft, order: ids };
  render();
  syncDraft();
};

window.clearDraftOrder = function () {
  if (draft.picks.length > 0) return;
  draft = { ...draft, order: [] };
  render();
  syncDraft();
};

window.draftTeam = function (abbr) {
  if (!orderReady() || draftComplete() || teamOwner(abbr)) return;
  const owner = currentPickerId();
  draft = { ...draft, picks: [...draft.picks, { team: abbr, owner }] };
  render();
  syncDraft();
};

window.undoLastPick = function () {
  if (!draft.picks.length) return;
  draft = { ...draft, picks: draft.picks.slice(0, -1) };
  render();
  syncDraft();
};

window.resetDraft = function () {
  if (!(draft.order || []).length && !draft.picks.length) return;
  if (!confirm("Reset the entire draft? This clears the draft order and all picks.")) return;
  draft = { order: [], picks: [] };
  render();
  syncDraft();
};

// ── Live win totals (ESPN public API) ───────────────────────────────────────
// The team-profile endpoint's embedded team.record.items ("total") is an
// aggregate that ignores season-type query params entirely -- confirmed
// live: it kept showing a 3-0 preseason record even with &seasontype=2 in
// the URL. So instead this fetches the team's full schedule and counts wins
// itself, game by game, filtering each game by its own seasonType field
// (seasonType.type === 2 is regular season; 1 = preseason, 3 = postseason)
// rather than trusting any server-side filter or aggregate.
async function fetchTeamWins(abbr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr.toLowerCase()}/schedule?season=${LEAGUE.season}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN schedule request failed for ${abbr}: ${res.status}`);
  const json = await res.json();
  const events = json?.events || [];
  let wins = 0;
  for (const event of events) {
    if (event.seasonType?.type !== 2) continue; // regular season only
    const competition = event.competitions?.[0];
    if (competition?.status?.type?.completed === false) continue; // not played yet
    const me = competition?.competitors?.find((c) => c.team?.abbreviation === abbr.toUpperCase());
    if (me?.winner === true) wins++;
  }
  return wins;
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
function computeStanding(player, teamsByOwner) {
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

// ── Render: draft panel ──────────────────────────────────────────────────────
function renderDraftPanel() {
  const idx = currentPickIndex();
  const picker = currentPickerId();
  const complete = draftComplete();
  const started = orderReady();

  const statusEl = $("#draft-status");
  if (!started) {
    const chosen = draft.order || [];
    statusEl.innerHTML = `
      <p class="draft-msg">Set the round 1 draft order — click each owner in the order they'll pick (round 2 snakes back in reverse).</p>
      <div class="order-builder">
        ${LEAGUE.players
          .map((p) => {
            const pos = chosen.indexOf(p.id);
            return `<button class="order-chip" style="--owner-color:${p.color}" ${pos >= 0 ? "disabled" : ""} onclick="addToDraftOrder('${p.id}')">
              ${pos >= 0 ? `${pos + 1}. ` : ""}${p.name}
            </button>`;
          })
          .join("")}
      </div>`;
  } else if (!complete) {
    const round = Math.floor(idx / NUM_OWNERS) + 1;
    const pickInRound = (idx % NUM_OWNERS) + 1;
    const pickerPlayer = playerById[picker];
    statusEl.innerHTML = `
      <p class="draft-msg">
        <span class="dot" style="background:${pickerPlayer.color}"></span>
        <strong>${pickerPlayer.name}</strong> is on the clock —
        Round ${round} of ${ROUNDS}, Pick ${idx + 1} of ${TOTAL_PICKS} (pick ${pickInRound} of ${NUM_OWNERS} this round)
      </p>`;
  } else {
    statusEl.innerHTML = `<p class="draft-msg draft-complete">✅ Draft complete — rosters are set for the season.</p>`;
  }

  $("#btn-randomize").disabled = draft.picks.length > 0;
  $("#btn-clear-order").disabled = draft.picks.length > 0 || !(draft.order || []).length;
  $("#btn-undo").disabled = draft.picks.length === 0;
  $("#btn-reset").disabled = !(draft.order || []).length && draft.picks.length === 0;

  const pickerPlayer = picker ? playerById[picker] : null;
  $("#draft-grid").innerHTML = LEAGUE.divisionOrder
    .map((divName) => {
      const teams = teamsByDivision[divName] || [];
      const draftedCount = teams.filter((t) => teamOwner(t.abbr)).length;
      return `
      <div class="division-card">
        <h4>${divName} <span class="division-progress">${draftedCount}/${teams.length}</span></h4>
        <ul>
          ${teams
            .map((t) => {
              const ownerId = teamOwner(t.abbr);
              const owner = ownerId ? playerById[ownerId] : null;
              const canPick = started && !complete && !owner;
              let right;
              if (owner) {
                right = `<span class="owner-tag" style="--owner-color:${owner.color}"><span class="dot"></span>${owner.name}</span>`;
              } else if (canPick) {
                right = `<button class="draft-pick-btn small" style="--owner-color:${pickerPlayer.color}" onclick="draftTeam('${t.abbr}')">Draft</button>`;
              } else {
                right = `<span class="undrafted-tag">—</span>`;
              }
              return `<li class="draft-team-row ${owner ? "owned" : ""}">
                <img class="logo small" src="${logoUrl(t.abbr)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
                <span class="team-name">${t.name}</span>
                ${right}
              </li>`;
            })
            .join("")}
        </ul>
      </div>`;
    })
    .join("");

  $("#draft-history").innerHTML = draft.picks.length
    ? draft.picks
        .map((p, i) => `<li><strong>#${i + 1}</strong> ${playerById[p.owner].name} — ${teamByAbbr[p.team]?.name ?? p.team}</li>`)
        .join("")
    : `<li class="sub-note">No picks yet.</li>`;
}

// ── Render: standings / rosters ─────────────────────────────────────────────
function renderLeaderboard(standings) {
  const ranked = [...standings].sort((a, b) => b.total - a.total);
  const tbody = $("#leaderboard tbody");
  tbody.innerHTML = ranked
    .map(
      (s, i) => `
      <tr style="--owner-color:${s.player.color}">
        <td class="rank">${i === 0 && s.total > 0 ? "🏆" : `#${i + 1}`}</td>
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
          <h3>
            <input type="color" class="color-picker" value="${s.player.color}" title="Change ${s.player.name}'s color"
                   onchange="setPlayerColor('${s.player.id}', this.value)" />
            ${s.player.name}
          </h3>
          <span class="card-total">${s.total}<small>pts</small></span>
        </header>
        <p class="drafted-divisions">${s.teams.length ? `${s.teams.length}/${ROUNDS} teams drafted` : "No teams drafted yet"}</p>
        ${teamRows ? `<ul class="team-list">${teamRows}</ul>` : ""}
        <dl class="score-breakdown">
          <div><dt>Wins</dt><dd>${s.winsTotal}</dd></div>
          <div><dt>Playoff pts</dt><dd>${s.playoffPts}</dd></div>
          <div><dt>SB pts</dt><dd>${s.sbPts}</dd></div>
        </dl>
      </section>`;
    })
    .join("");
}

function renderSbPicker(teamsByOwner) {
  const owningOwnerFor = {};
  for (const [ownerId, teams] of Object.entries(teamsByOwner)) {
    for (const t of teams) owningOwnerFor[t.abbr] = ownerId;
  }
  const groups = LEAGUE.divisionOrder
    .map((div) => {
      const opts = (teamsByDivision[div] || [])
        .map((t) => {
          const ownerId = owningOwnerFor[t.abbr];
          const label = ownerId ? `${t.name} — ${playerById[ownerId].name}` : t.name;
          return `<option value="${t.abbr}">${label}</option>`;
        })
        .join("");
      return `<optgroup label="${div}">${opts}</optgroup>`;
    })
    .join("");

  const sel = $("#sb-winner-select");
  if (sel.dataset.built !== "1") {
    sel.addEventListener("change", (e) => window.setSbWinner(e.target.value));
    sel.dataset.built = "1";
  }
  sel.innerHTML = `<option value="">Not decided yet</option>${groups}`;
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
  const teamsByOwner = computeTeamsByOwner();
  const standings = LEAGUE.players.map((p) => computeStanding(p, teamsByOwner));
  renderDraftPanel();
  renderLeaderboard(standings);
  renderPlayerCards(standings);
  renderSbPicker(teamsByOwner);
  renderSyncStatus();
}

// ── Init ─────────────────────────────────────────────────────────────────────
function applyDocData(d) {
  const rawDraft = d.draft && Array.isArray(d.draft.picks) ? d.draft : { order: [], picks: [] };
  // Drop any picks from the old division-based draft schema ({division, owner})
  // instead of the current per-team one ({team, owner}) — defensive in case the
  // doc was created before this change.
  draft = { order: rawDraft.order || [], picks: (rawDraft.picks || []).filter((p) => typeof p.team === "string") };
  liveWins = d.wins || {};
  playoffTeams = d.playoffTeams || {};
  sbWinner = d.sbWinner || null;
  playerColors = d.playerColors || {};
  applyPlayerColors();
  lastSynced = d.lastSynced || null;
}

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
      applyDocData(snap.data());
    } else {
      await _fs.setDoc(_leagueDocRef, { draft: { order: [], picks: [] }, wins: {}, playoffTeams: {}, sbWinner: null, playerColors: {}, lastSynced: null });
    }
    firestoreReady = true;

    _fs.onSnapshot(_leagueDocRef, (s) => {
      if (!s.exists()) return;
      applyDocData(s.data());
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

  await initFirestore();
  render(); // show cached/shared state immediately

  pullLiveWins().catch((err) => console.warn("Live win-total fetch failed:", err));
  setInterval(() => pullLiveWins().catch((err) => console.warn("Live win-total refresh failed:", err)), WINS_REFRESH_MS);
}
window.refreshLiveWins = () => pullLiveWins().catch((err) => console.warn("Manual refresh failed:", err));

init();
