(function () {
  "use strict";

  /**
   * Athlete basketball stats projection.
   *
   * Reads linked score sheet rows and converts them into aggregate and game-log
   * views without changing the source competition stat lines.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const athleteId = params.get("athleteId") || params.get("id") || "";
  const selectedSeason = params.get("season") || "all";
  const selectedCompetition = params.get("competitionId") || "all";

  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("pageTitle"),
    back: document.getElementById("backLink"),
    summary: document.getElementById("summarySection"),
    scoring: document.getElementById("scoringSection"),
    playmaking: document.getElementById("playmakingSection"),
    defense: document.getElementById("defenseSection"),
    log: document.getElementById("matchLogSection")
  };

  document.addEventListener("DOMContentLoaded", init);

  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "athletes", contextLabel: "Basketball Stats" });
    if (!session) return;
    if (!athleteId) {
      show("Open this page from an athlete profile.");
      return;
    }
    try {
      const [athlete, stats] = await Promise.all([
        APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}`),
        APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}/stats`, true)
      ]);
      const rows = normalizeArray(stats).map(normalizeRow).filter((row) => APP.normalizeSportSlug(row.sport || row.sportSlug) === "basketball");
      els.title.textContent = `${displayName(athlete)} Basketball Stats`;
      els.back.href = `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;
      render(rows);
    } catch (error) {
      show(error?.message || "Detailed basketball stats could not be loaded.");
    }
  }

  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(rows) {
    const scopedRows = rows.filter((row) => {
      const seasonOk = selectedSeason === "all" || String(row.season || "") === selectedSeason;
      const competitionOk = selectedCompetition === "all" || String(row.competitionId || row.linkedCompetitionId || "") === selectedCompetition;
      return seasonOk && competitionOk;
    });
    const matches = rowsOf(scopedRows, "match");
    const totals = aggregate(matches);
    const seasons = ["all"].concat(unique(rows.map((row) => row.season).filter(Boolean)));
    const competitions = uniqueBy(rows.filter((row) => row.competitionId || row.linkedCompetitionId || row.competitionName), (row) => row.competitionId || row.linkedCompetitionId || row.competitionName);

    els.summary.innerHTML = `
      <div class="section-title"><div><h2>Basketball Summary</h2><p>Basketball score-sheet records from 2026 onwards. Filter by season or competition.</p></div></div>
      <div class="stats-toolbar compact-filter-row">
        <div><label for="seasonScope">Season</label><select class="select" id="seasonScope">${seasons.map((season) => `<option value="${escapeHtml(season)}" ${season === selectedSeason ? "selected" : ""}>${escapeHtml(season === "all" ? "All-Time" : season)}</option>`).join("")}</select></div>
        <div><label for="competitionScope">Competition</label><select class="select" id="competitionScope"><option value="all">All Competitions</option>${competitions.map((row) => {
          const id = row.competitionId || row.linkedCompetitionId || row.competitionName;
          return `<option value="${escapeHtml(id)}" ${String(id) === String(selectedCompetition) ? "selected" : ""}>${escapeHtml(row.competitionName || row.eventName || "Competition")}</option>`;
        }).join("")}</select></div>
        <a class="btn btn-soft" href="athlete-view.html?athleteId=${encodeURIComponent(athleteId)}">Back to Profile</a>
      </div>
      <div class="summary-cards">
        ${mini("Games", totals.matches, "Appearances")}
        ${mini("Points", totals.points, "Scoring")}
        ${mini("Rebounds", totals.rebounds, "Boards")}
        ${mini("Assists", totals.assists, "Playmaking")}
      </div>
    `;
    bindScopeFilters();
    els.scoring.innerHTML = statsTable("Scoring & Efficiency", totals, [
      ["matches", "Games"], ["minutes", "Minutes"], ["points", "Points"], ["pointsPerGame", "PPG"], ["twoMade", "2PM"], ["threeMade", "3PM"], ["freeThrowsMade", "FTM"], ["threePointRate", "3PM/Game"]
    ]);
    els.playmaking.innerHTML = statsTable("Playmaking & Possession", totals, [
      ["assists", "Assists"], ["assistsPerGame", "APG"], ["turnovers", "Turnovers"], ["assistTurnoverRatio", "AST/TO"], ["fouls", "Fouls"]
    ]);
    els.defense.innerHTML = statsTable("Rebounding & Defense", totals, [
      ["rebounds", "Rebounds"], ["reboundsPerGame", "RPG"], ["steals", "Steals"], ["blocks", "Blocks"], ["stocks", "STL+BLK"]
    ]);
    els.log.innerHTML = collapsibleMatchLog(matches);
  }

  function statsTable(title, totals, columns) {
    return `<div class="section-title"><div><h2>${escapeHtml(title)}</h2><p>Aggregated from linked basketball score sheets.</p></div></div>
      <div class="data-table-wrap"><table class="table"><thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody><tr>${columns.map(([key]) => `<td>${escapeHtml(totals[key] ?? 0)}</td>`).join("")}</tr></tbody></table></div>`;
  }

  function matchLog(rows) {
    return `
      <div class="data-table-wrap"><table class="table"><thead><tr><th>Date</th><th>Competition</th><th>Result</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>MIN</th></tr></thead><tbody>
      ${rows.length ? rows.map((row) => {
        const d = row.statData || {};
        return `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(row.competitionName || "Competition")}</td><td>${escapeHtml(d.result || row.category || "")}</td><td>${escapeHtml(d.points ?? 0)}</td><td>${escapeHtml(d.rebounds ?? 0)}</td><td>${escapeHtml(d.assists ?? 0)}</td><td>${escapeHtml(d.steals ?? 0)}</td><td>${escapeHtml(d.blocks ?? 0)}</td><td>${escapeHtml(d.turnovers ?? 0)}</td><td>${escapeHtml(d.minutes ?? 0)}</td></tr>`;
      }).join("") : `<tr><td colspan="10">No basketball match rows are linked yet.</td></tr>`}
      </tbody></table></div>`;
  }

  function collapsibleMatchLog(rows) {
    return `<details class="nested-detail">
      <summary>Game Log (${rows.length})</summary>
      <p class="muted" style="margin:8px 0 12px;">Open this section when you need game-by-game basketball records.</p>
      ${matchLog(rows)}
    </details>`;
  }

  function aggregate(rows) {
    const totals = rows.reduce((acc, row) => {
      const d = row.statData || {};
      ["points", "rebounds", "assists", "steals", "blocks", "turnovers", "fouls", "minutes", "twoMade", "threeMade", "freeThrowsMade"].forEach((key) => {
        acc[key] += number(d[key]);
      });
      return acc;
    }, { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0, minutes: 0, twoMade: 0, threeMade: 0, freeThrowsMade: 0 });
    totals.matches = uniqueMatches(rows);
    totals.stocks = totals.steals + totals.blocks;
    totals.pointsPerGame = perGame(totals.points, totals.matches);
    totals.reboundsPerGame = perGame(totals.rebounds, totals.matches);
    totals.assistsPerGame = perGame(totals.assists, totals.matches);
    totals.threePointRate = perGame(totals.threeMade, totals.matches);
    totals.assistTurnoverRatio = totals.turnovers ? round(totals.assists / totals.turnovers, 2) : totals.assists ? "No TO" : 0;
    return totals;
  }

  function rowsOf(rows, type) {
    return rows.filter((row) => String(row.eventType || "") === type);
  }

  /**
   * Binds the scope filters interactions once so rerenders do not duplicate listeners.
   */
  function bindScopeFilters() {
    document.getElementById("seasonScope")?.addEventListener("change", updateScope);
    document.getElementById("competitionScope")?.addEventListener("change", updateScope);
  }

  /**
   * Updates derived UI state from the current form/model values without persisting changes directly.
   */
  function updateScope() {
    const url = new URL(window.location.href);
    url.searchParams.set("athleteId", athleteId);
    url.searchParams.set("season", document.getElementById("seasonScope")?.value || "all");
    url.searchParams.set("competitionId", document.getElementById("competitionScope")?.value || "all");
    window.location.href = url.toString();
  }

  function mini(label, value, sub) {
    return `<div class="mini-card"><div class="mini-label">${escapeHtml(label)}</div><div class="mini-value">${escapeHtml(value)}</div><div class="mini-sub">${escapeHtml(sub)}</div></div>`;
  }

  /**
   * Normalizes row data across current API and legacy nested shapes.
   */
  function normalizeRow(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || row?.data || {};
    return { ...row, statData: data, date: row.date || data.date || row.createdAt };
  }

  function uniqueMatches(rows) {
    return new Set(rows.map((row) => row.sourceId || String(row.id || "").split("-basketball-")[0] || row.id).filter(Boolean)).size;
  }

  /**
   * Accepts current and nested API response shapes so pages remain compatible during backend evolution.
   */
  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.stats)) return payload.stats;
    return [];
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function uniqueBy(rows, getKey) {
    const map = new Map();
    rows.forEach((row) => {
      const key = getKey(row);
      if (key && !map.has(key)) map.set(key, row);
    });
    return Array.from(map.values());
  }

  function displayName(athlete) {
    const data = athlete?.data || athlete;
    return data?.fullName || [data?.firstName, data?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function perGame(total, games) {
    return games ? round(total / games, 2) : 0;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value, places) {
    const factor = 10 ** (places || 0);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  }

  function show(text) {
    els.msg.className = "message error is-visible";
    els.msg.textContent = text;
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }
})();
