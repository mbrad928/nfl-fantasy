/**
 * Renders the whole page from LEAGUE (data.js). No frameworks, no build step.
 */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const playerById = Object.fromEntries(LEAGUE.players.map((p) => [p.id, p]));
  const teamsByOwner = Object.fromEntries(LEAGUE.players.map((p) => [p.id, []]));
  for (const t of LEAGUE.teams) teamsByOwner[t.owner].push(t);

  function logoUrl(abbr) {
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
  }

  function fmtPoints(n) {
    return n === null || n === undefined ? "TBD" : String(n);
  }

  // ---- per-player totals -------------------------------------------------
  function computeStanding(player) {
    const teams = teamsByOwner[player.id];
    const known = teams.filter((t) => t.wins !== null);
    const pending = teams.filter((t) => t.wins === null);
    const winsTotal = known.reduce((sum, t) => sum + t.wins, 0);
    const playoff = LEAGUE.playoffPoints[player.id];
    const sb = LEAGUE.sbPoints[player.id];
    const isPending = pending.length > 0 || playoff === null || sb === null;
    const total = winsTotal + (playoff ?? 0) + (sb ?? 0);
    return { player, teams, winsTotal, pending, playoff, sb, total, isPending };
  }

  const standings = LEAGUE.players.map(computeStanding);

  // ---- leaderboard --------------------------------------------------------
  function renderLeaderboard() {
    const ranked = [...standings].sort((a, b) => b.total - a.total);
    const tbody = $("#leaderboard tbody");
    tbody.innerHTML = "";
    ranked.forEach((s, i) => {
      const tr = document.createElement("tr");
      tr.style.setProperty("--owner-color", s.player.color);
      tr.innerHTML = `
        <td class="rank">${i === 0 ? "🏆" : `#${i + 1}`}</td>
        <td class="owner-cell">
          <span class="dot" style="background:${s.player.color}"></span>
          ${s.player.name}
        </td>
        <td>${s.winsTotal}${s.pending.length ? `<span class="tbd-note">+${s.pending.length} TBD</span>` : ""}</td>
        <td>${fmtPoints(s.playoff)}</td>
        <td>${fmtPoints(s.sb)}</td>
        <td class="total-cell">${s.total}${s.isPending ? '<span class="pending-star">*</span>' : ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---- player cards ---------------------------------------------------
  function renderPlayerCards() {
    const wrap = $("#player-cards");
    wrap.innerHTML = "";
    standings.forEach((s) => {
      const card = document.createElement("section");
      card.className = "player-card";
      card.style.setProperty("--owner-color", s.player.color);

      const teamRows = s.teams
        .map(
          (t) => `
        <li class="team-row">
          <img class="logo" src="${logoUrl(t.abbr)}" alt="" loading="lazy"
               onerror="this.style.visibility='hidden'" />
          <span class="team-name">${t.name}</span>
          <span class="team-wins ${t.wins === null ? "tbd" : ""}">${t.wins === null ? "TBD" : t.wins + "W"}</span>
        </li>`
        )
        .join("");

      card.innerHTML = `
        <header>
          <h3><span class="dot" style="background:${s.player.color}"></span>${s.player.name}</h3>
          <span class="card-total">${s.total}<small>pts</small></span>
        </header>
        <p class="drafted-divisions">${s.player.divisions.join(" &nbsp;+&nbsp; ")}</p>
        <ul class="team-list">${teamRows}</ul>
        <dl class="score-breakdown">
          <div><dt>Wins</dt><dd>${s.winsTotal}</dd></div>
          <div><dt>Playoff pts</dt><dd>${fmtPoints(s.playoff)}</dd></div>
          <div><dt>SB pts</dt><dd>${fmtPoints(s.sb)}</dd></div>
        </dl>
      `;
      wrap.appendChild(card);
    });
  }

  // ---- draft board (divisions) -----------------------------------------
  function renderDraftBoard() {
    const wrap = $("#draft-board");
    wrap.innerHTML = "";
    const teamsByDivision = {};
    for (const t of LEAGUE.teams) {
      (teamsByDivision[t.division] ||= []).push(t);
    }
    for (const divName of LEAGUE.divisionOrder) {
      const teams = teamsByDivision[divName] || [];
      const owner = teams[0] ? playerById[teams[0].owner] : null;
      const card = document.createElement("div");
      card.className = "division-card";
      if (owner) card.style.setProperty("--owner-color", owner.color);
      card.innerHTML = `
        <h4>${divName}</h4>
        <ul>
          ${teams
            .map(
              (t) => `<li>
                <img class="logo small" src="${logoUrl(t.abbr)}" alt="" loading="lazy"
                     onerror="this.style.visibility='hidden'" />
                ${t.name}
              </li>`
            )
            .join("")}
        </ul>
        ${owner ? `<footer><span class="dot" style="background:${owner.color}"></span>${owner.name}</footer>` : ""}
      `;
      wrap.appendChild(card);
    }
  }

  function renderMeta() {
    $("#season-year").textContent = LEAGUE.season;
    $("#updated-date").textContent = new Date(LEAGUE.updated + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  renderMeta();
  renderLeaderboard();
  renderPlayerCards();
  renderDraftBoard();
})();
