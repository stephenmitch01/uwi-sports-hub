(function () {
  "use strict";

  // Shared App Access
  /**
   * Athlete football stats projection.
   *
   * Uses athlete-linked football score sheet rows to present goals, assists,
   * minutes, cards, saves, and match logs for the selected player.
   */
  const APP = window.UWISportsHub;
  // URL Parameters
  const params = new URLSearchParams(window.location.search);
  const athleteId = params.get("athleteId") || params.get("id") || "";
  const selectedSeason = params.get("season") || "all";
  const selectedCompetition = params.get("competitionId") || "all";

  // Page Elements
  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("pageTitle"),
    back: document.getElementById("backLink"),
    summary: document.getElementById("summarySection"),
    attacking: document.getElementById("attackingSection"),
    goalkeeping: document.getElementById("goalkeepingSection"),
    discipline: document.getElementById("disciplineSection"),
    log: document.getElementById("matchLogSection")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "athletes", contextLabel: "Football Stats" });
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
      const rows = normalizeArray(stats).map(normalizeRow).filter((row) => APP.normalizeSportSlug(row.sport || row.sportSlug) === "football");
      els.title.textContent = `${displayName(athlete)} Football Stats`;
      els.back.href = `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;
      render(rows);
    } catch (error) {
      show(error?.message || "Detailed football stats could not be loaded.");
    }
  }

  // Page Display
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
      <div class="section-title"><div><h2>Football Summary</h2><p>Football match-sheet records from 2026 onwards. Filter by season or competition.</p></div></div>
      <div class="stats-toolbar compact-filter-row">
        <div><label for="seasonScope">Season</label><select class="select" id="seasonScope">${seasons.map((season) => `<option value="${escapeHtml(season)}" ${season === selectedSeason ? "selected" : ""}>${escapeHtml(season === "all" ? "All-Time" : season)}</option>`).join("")}</select></div>
        <div><label for="competitionScope">Competition</label><select class="select" id="competitionScope"><option value="all">All Competitions</option>${competitions.map((row) => {
          const id = row.competitionId || row.linkedCompetitionId || row.competitionName;
          return `<option value="${escapeHtml(id)}" ${String(id) === String(selectedCompetition) ? "selected" : ""}>${escapeHtml(row.competitionName || row.eventName || "Competition")}</option>`;
        }).join("")}</select></div>
        <a class="btn btn-soft" href="athlete-view.html?athleteId=${encodeURIComponent(athleteId)}">Back to Profile</a>
      </div>
      <div class="summary-cards">
        ${mini("Matches", totals.matches, "Appearances")}
        ${mini("Goals", totals.goals, "Scoring")}
        ${mini("Assists", totals.assists, "Chance creation")}
        ${mini("Goal Contributions", totals.goalContributions, "Goals + assists")}
      </div>
    `;
    bindScopeFilters();
    els.attacking.innerHTML = statsTable("Attacking & Possession", totals, [
      ["matches", "Matches"], ["minutes", "Minutes"], ["goals", "Goals"], ["assists", "Assists"], ["goalContributions", "G+A"], ["shots", "Shots"], ["shotsOnTarget", "Shots OT"], ["shotAccuracy", "Shot Accuracy"]
    ]);
    els.goalkeeping.innerHTML = statsTable("Defending & Goalkeeping", totals, [
      ["saves", "Saves"], ["goalsConceded", "Goals Conceded"], ["tackles", "Tackles"], ["interceptions", "Interceptions"], ["fouls", "Fouls"], ["offsides", "Offsides"]
    ]);
    els.discipline.innerHTML = statsTable("Discipline", totals, [
      ["yellowCards", "Yellow Cards"], ["redCards", "Red Cards"], ["cards", "Total Cards"]
    ]);
    els.log.innerHTML = collapsibleMatchLog(matches);
  }

  function statsTable(title, totals, columns) {
    return `<div class="section-title"><div><h2>${escapeHtml(title)}</h2><p>Aggregated from linked football match sheets.</p></div></div>
      <div class="data-table-wrap"><table class="table"><thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody><tr>${columns.map(([key]) => `<td>${escapeHtml(totals[key] ?? 0)}</td>`).join("")}</tr></tbody></table></div>`;
  }

  function matchLog(rows) {
    return `
      <div class="data-table-wrap"><table class="table"><thead><tr><th>Date</th><th>Competition</th><th>Result</th><th>Goals</th><th>Assists</th><th>Shots</th><th>Saves</th><th>Cards</th><th>Minutes</th></tr></thead><tbody>
      ${rows.length ? rows.map((row) => {
        const d = row.statData || {};
        return `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(row.competitionName || "Competition")}</td><td>${escapeHtml(d.result || row.category || "")}</td><td>${escapeHtml(d.goals ?? 0)}</td><td>${escapeHtml(d.assists ?? 0)}</td><td>${escapeHtml(d.shots ?? 0)}</td><td>${escapeHtml(d.saves ?? 0)}</td><td>${escapeHtml(`${d.yellowCards ?? 0}Y / ${d.redCards ?? 0}R`)}</td><td>${escapeHtml(d.minutes ?? 0)}</td></tr>`;
      }).join("") : `<tr><td colspan="9">No football match rows are linked yet.</td></tr>`}
      </tbody></table></div>`;
  }

  function collapsibleMatchLog(rows) {
    return `<details class="nested-detail">
      <summary>Match Log (${rows.length})</summary>
      <p class="muted" style="margin:8px 0 12px;">Open this section when you need game-by-game football records.</p>
      ${matchLog(rows)}
    </details>`;
  }

  function aggregate(rows) {
    const totals = rows.reduce((acc, row) => {
      const d = row.statData || {};
      ["goals", "assists", "shots", "shotsOnTarget", "saves", "goalsConceded", "fouls", "offsides", "yellowCards", "redCards", "minutes", "tackles", "interceptions"].forEach((key) => {
        acc[key] += number(d[key] ?? d[key === "offsides" ? "offside" : key]);
      });
      return acc;
    }, { goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, goalsConceded: 0, fouls: 0, offsides: 0, yellowCards: 0, redCards: 0, minutes: 0, tackles: 0, interceptions: 0 });
    totals.matches = uniqueMatches(rows);
    totals.goalContributions = totals.goals + totals.assists;
    totals.cards = totals.yellowCards + totals.redCards;
    totals.shotAccuracy = totals.shots ? `${round((totals.shotsOnTarget / totals.shots) * 100)}%` : "—";
    return totals;
  }

  function rowsOf(rows, type) {
    return rows.filter((row) => String(row.eventType || "") === type);
  }

  // Event Wiring
  /**
   * Binds the scope filters interactions once so rerenders do not duplicate listeners.
   */
  function bindScopeFilters() {
    document.getElementById("seasonScope")?.addEventListener("change", updateScope);
    document.getElementById("competitionScope")?.addEventListener("change", updateScope);
  }

  // Filter Scope
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

  // Normalize Row
  /**
   * Normalizes row data across current API and legacy nested shapes.
   */
  function normalizeRow(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || row?.data || {};
    return { ...row, statData: data, date: row.date || data.date || row.createdAt };
  }

  function uniqueMatches(rows) {
    return new Set(rows.map((row) => row.sourceId || String(row.id || "").split("-football-")[0] || row.id).filter(Boolean)).size;
  }

  // Normalize Array
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

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
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
