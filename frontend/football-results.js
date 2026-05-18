(function () {
  "use strict";
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const state = { competitions: [], scorecards: [], activeCompetitionId: params.get("competitionId") || "", teamId: params.get("teamId") || "", searchApplied: false };
  const els = { msg: document.getElementById("pageMessage"), tabs: document.getElementById("competitionTabs"), season: document.getElementById("seasonFilter"), outcome: document.getElementById("outcomeFilter"), opponent: document.getElementById("opponentFilter"), searchButton: document.getElementById("resultsSearchButton"), count: document.getElementById("resultCount"), grid: document.getElementById("resultsGrid") };
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Football Results" });
    if (!session) return;
    try {
      const [competitions, statLines] = await Promise.all([APP.apiGet("/competitions", true), APP.apiGet("/competition-stat-lines", true)]);
      state.competitions = normalizeArray(competitions);
      state.scorecards = normalizeArray(statLines).map(normalizeLine).filter(isFootballScorecard).filter((line) => !state.teamId || String(line.teamId || line.statData?.uwiTeamId || "") === String(state.teamId));
      renderFilters();
      bind();
      render();
    } catch (error) {
      show(error?.message || "Football results could not be loaded.");
    }
  }

  function bind() {
    [els.season, els.outcome, els.opponent].forEach((el) => el.addEventListener("input", () => { state.searchApplied = false; }));
    els.searchButton?.addEventListener("click", () => { state.searchApplied = true; saveCurrentSearch(); mountRecentSearches(); render(); });
    mountRecentSearches();
  }

  function renderFilters() {
    const footballCompetitions = state.competitions.filter((competition) => scorecardsFor(competition.id).length);
    els.tabs.innerHTML = `<button class="result-tab ${state.activeCompetitionId ? "" : "active"}" type="button" data-competition="">Matches (${state.scorecards.length})</button>${footballCompetitions.map((competition) => `<button class="result-tab ${String(competition.id) === String(state.activeCompetitionId) ? "active" : ""}" type="button" data-competition="${escapeHtml(competition.id)}">${escapeHtml(competition.title || competition.name || "Competition")} (${scorecardsFor(competition.id).length})</button>`).join("")}`;
    els.tabs.querySelectorAll("[data-competition]").forEach((button) => button.addEventListener("click", () => { state.activeCompetitionId = button.dataset.competition; renderFilters(); render(); }));
    const seasons = [...new Set(state.scorecards.map((line) => line.season || competitionFor(line.competitionId)?.season || "").filter(Boolean))].sort().reverse();
    els.season.innerHTML = `<option value="">All seasons</option>${seasons.map((season) => `<option value="${escapeHtml(season)}">${escapeHtml(season)}</option>`).join("")}`;
  }

  function render() {
    if (!state.searchApplied) {
      els.count.textContent = "Choose filters, then click Search.";
      els.grid.innerHTML = `<div class="empty-state">Click Search to view saved football match details.</div>`;
      return;
    }
    const rows = state.scorecards.filter(matchesFilters).sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    els.count.textContent = `${rows.length} saved result${rows.length === 1 ? "" : "s"}`;
    els.grid.innerHTML = rows.length ? rows.map(renderCard).join("") : `<div class="empty-state">No football results match those filters.</div>`;
  }

  function matchesFilters(line) {
    const data = line.statData || {};
    const competition = competitionFor(line.competitionId);
    if (state.activeCompetitionId && String(line.competitionId) !== String(state.activeCompetitionId)) return false;
    if (els.season.value && String(line.season || competition?.season || "") !== els.season.value) return false;
    if (els.opponent.value && !String(data.opponentName || "").toLowerCase().includes(els.opponent.value.toLowerCase())) return false;
    const outcome = classifyOutcome(data);
    if (els.outcome.value && outcome !== els.outcome.value) return false;
    return true;
  }

  function renderCard(line) {
    const data = line.statData || {};
    const competition = competitionFor(line.competitionId);
    return `<article class="result-card"><div class="result-card-top"><span>Result</span><small>${escapeHtml(competition?.title || competition?.name || "Competition")}</small></div><div class="result-card-title">${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))} ${escapeHtml(formatScore(data))} ${escapeHtml(opponentLabel(data))}</div>${goalSummary(data)}<p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p><div class="result-card-actions"><a href="football-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Match Details</a><a href="football-scorecard.html?competitionId=${encodeURIComponent(line.competitionId)}&scorecardId=${encodeURIComponent(line.id)}">Edit Score Sheet</a><a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a></div></article>`;
  }

  function goalSummary(data) {
    const goals = Array.isArray(data.goals) ? data.goals : [];
    if (!goals.length) return `<p class="muted">No goalscorers recorded.</p>`;
    return `<p class="result-text">${goals.map((goal) => `${escapeHtml(goal.scorerName || (goal.team === "uwi" ? "UWI player" : "Opponent"))} ${escapeHtml(goal.minute ?? "")}'`).join("<br>")}</p>`;
  }

  function normalizeLine(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : row?.data && typeof row.data === "object" ? row.data : {};
    return { ...row, ...data, id: row.id, competitionId: row.competitionId || data.competitionId, teamId: row.teamId || data.teamId || data.uwiTeamId, sport: row.sport || data.sport, sportSlug: row.sportSlug || data.sportSlug, eventType: row.eventType || data.eventType, eventName: row.eventName || data.eventName || data.title, date: row.date || data.date || row.createdAt, season: row.season || data.season, statData: data };
  }

  function isFootballScorecard(line) {
    return APP.normalizeSportSlug(line.sportSlug || line.sport) === "football" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
  }

  function scorecardsFor(id) { return state.scorecards.filter((line) => String(line.competitionId) === String(id)); }
  function competitionFor(id) { return state.competitions.find((competition) => String(competition.id) === String(id)); }
  function classifyOutcome(data) {
    const result = String(data.result || "").toLowerCase();
    const uwi = String(data.uwiTeamName || "uwi").toLowerCase();
    if (result.includes("draw")) return "draw";
    if (result.includes("won") && (result.includes("uwi") || result.includes(uwi))) return "win";
    if (result.includes("won")) return "loss";
    return "other";
  }
  function formatScore(data) { const score = data.score || {}; return `${score.uwi?.total ?? 0}-${score.opponent?.total ?? 0}`; }
  function compactUwiResultLabel(value) { const text = String(value || "").trim(); if (!text) return ""; return text.replace(/\bUWI\s+Blackbirds(?:\s+[A-Za-z& -]+?)?\s+Team\b/gi, "Blackbirds").replace(/\bUWI\s+Blackbirds\b/gi, "Blackbirds"); }
  function compactUwiTeamLabel(value, fallback = "Blackbirds") { const text = compactUwiResultLabel(value); return text || fallback; }
  function opponentLabel(data) { return String(data?.opponentName || data?.opponentTeamName || data?.opponent?.name || "Opponent").trim() || "Opponent"; }
  function normalizeArray(payload) { if (Array.isArray(payload)) return payload; if (Array.isArray(payload?.data)) return payload.data; return []; }
  function saveCurrentSearch() {
    if (!APP.saveRecentSearch) return;
    const values = { season: els.season?.value || "", outcome: els.outcome?.value || "", opponent: els.opponent?.value || "", competitionId: state.activeCompetitionId || "" };
    const label = [values.opponent, values.season, values.outcome].filter(Boolean).join(" / ") || "Football results";
    APP.saveRecentSearch("football-results", label, values);
  }
  function mountRecentSearches() {
    if (!APP.renderRecentSearches || !els.searchButton?.parentElement) return;
    document.querySelector("[data-recent-searches='football-results']")?.remove();
    els.searchButton.parentElement.insertAdjacentHTML("afterend", APP.renderRecentSearches("football-results"));
    document.querySelectorAll("[data-recent-searches='football-results'] [data-recent-search-index]").forEach((button) => button.addEventListener("click", function () {
      const item = APP.readRecentSearches("football-results")[Number(this.dataset.recentSearchIndex)];
      if (!item) return;
      state.activeCompetitionId = item.values.competitionId || "";
      renderFilters();
      if (els.season) els.season.value = item.values.season || "";
      if (els.outcome) els.outcome.value = item.values.outcome || "";
      if (els.opponent) els.opponent.value = item.values.opponent || "";
      state.searchApplied = true;
      render();
    }));
  }
  function show(text) { els.msg.className = "message error is-visible"; els.msg.textContent = text; }
  function escapeHtml(value) { return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
})();
