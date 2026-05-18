(function () {
  "use strict";
  // Shared App Access
  /**
   * Track and field results archive.
   *
   * Lists saved event sheets and exposes view/edit links. Filters read event
   * metadata from statData so official marks stay tied to the original entry.
   */
  const APP = window.UWISportsHub;
  // URL Parameters
  const params = new URLSearchParams(window.location.search);
  // Page State
  const state = { competitions: [], scorecards: [], activeCompetitionId: params.get("competitionId") || "", teamId: params.get("teamId") || "", searchApplied: false };
  // Page Elements
  const els = { msg: document.getElementById("pageMessage"), tabs: document.getElementById("competitionTabs"), season: document.getElementById("seasonFilter"), type: document.getElementById("typeFilter"), event: document.getElementById("eventFilter"), searchButton: document.getElementById("resultsSearchButton"), count: document.getElementById("resultCount"), grid: document.getElementById("resultsGrid") };
  document.addEventListener("DOMContentLoaded", init);
  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Track and Field Results" });
    if (!session) return;
    try {
      const [competitions, statLines] = await Promise.all([APP.apiGet("/competitions", true), APP.apiGet("/competition-stat-lines", true)]);
      state.competitions = normalizeArray(competitions);
      state.scorecards = normalizeArray(statLines).map(normalizeLine).filter(isTrackFieldScorecard).filter((line) => !state.teamId || String(line.teamId || line.statData?.uwiTeamId || "") === String(state.teamId));
      renderFilters();
      bind();
      render();
    } catch (error) { show(error?.message || "Track and field results could not be loaded."); }
  }
  // Event Wiring
  /**
   * Centralizes event wiring so rendering functions can rebuild markup without duplicating listeners.
   */
  function bind() {
    [els.season, els.type, els.event].forEach((el) => el.addEventListener("input", () => { state.searchApplied = false; }));
    els.searchButton?.addEventListener("click", () => { state.searchApplied = true; render(); });
  }
  // Filters
  /**
   * Builds filter controls from available backend records so searches reflect saved data.
   */
  function renderFilters() {
    const competitions = state.competitions.filter((competition) => scorecardsFor(competition.id).length);
    els.tabs.innerHTML = `<button class="result-tab ${state.activeCompetitionId ? "" : "active"}" type="button" data-competition="">Events (${state.scorecards.length})</button>${competitions.map((competition) => `<button class="result-tab ${String(competition.id) === String(state.activeCompetitionId) ? "active" : ""}" type="button" data-competition="${escapeHtml(competition.id)}">${escapeHtml(competition.title || competition.name || "Competition")} (${scorecardsFor(competition.id).length})</button>`).join("")}`;
    els.tabs.querySelectorAll("[data-competition]").forEach((button) => button.addEventListener("click", () => { state.activeCompetitionId = button.dataset.competition; renderFilters(); render(); }));
    const seasons = [...new Set(state.scorecards.map((line) => line.season || competitionFor(line.competitionId)?.season || "").filter(Boolean))].sort().reverse();
    els.season.innerHTML = `<option value="">All seasons</option>${seasons.map((season) => `<option value="${escapeHtml(season)}">${escapeHtml(season)}</option>`).join("")}`;
  }
  // Page Display
  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render() {
    if (!state.searchApplied) { els.count.textContent = "Choose filters, then click Search."; els.grid.innerHTML = `<div class="empty-state">Click Search to view saved track and field results.</div>`; return; }
    const rows = state.scorecards.filter(matchesFilters).sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    els.count.textContent = `${rows.length} saved result sheet${rows.length === 1 ? "" : "s"}`;
    els.grid.innerHTML = rows.length ? rows.map(renderCard).join("") : `<div class="empty-state">No result sheets match those filters.</div>`;
  }
  function matchesFilters(line) {
    const data = line.statData || {};
    const competition = competitionFor(line.competitionId);
    if (state.activeCompetitionId && String(line.competitionId) !== String(state.activeCompetitionId)) return false;
    if (els.season.value && String(line.season || competition?.season || "") !== els.season.value) return false;
    if (els.type.value && String(data.resultType || "") !== els.type.value) return false;
    if (els.event.value && !String(data.eventName || line.eventName || "").toLowerCase().includes(els.event.value.toLowerCase())) return false;
    return true;
  }
  // Card
  /**
   * Renders one result card from normalized stat data while preserving links to view/edit workflows.
   */
  function renderCard(line) {
    const data = line.statData || {};
    const competition = competitionFor(line.competitionId);
    const topUwi = Array.isArray(data.entries) ? data.entries.filter((entry) => entry.entryType === "uwi").sort((a, b) => data.resultType === "field" ? Number(a.finalRank || 999) - Number(b.finalRank || 999) : Number(a.place || 999) - Number(b.place || 999))[0] : null;
    const mark = data.resultType === "field" ? topUwi?.best : topUwi?.time;
    return `<article class="result-card"><div class="result-card-top"><span>${escapeHtml(data.resultType === "field" ? "Field" : "Track")}</span><small>${escapeHtml(competition?.title || competition?.name || "Competition")}</small></div><div class="result-card-title">${escapeHtml(compactUwiResultLabel(data.eventName || line.eventName || "Track and field event"))}</div><div class="result-team-row"><span>${escapeHtml(topUwi?.name || "Top UWI")}</span><strong>${escapeHtml(mark || "—")}</strong></div><p class="result-text">${escapeHtml(compactUwiResultLabel(data.summary?.topUwiResult || data.summary?.winningResult || "Result recorded"))}</p><div class="result-card-actions"><a href="track-field-results-view.html?scorecardId=${encodeURIComponent(line.id)}">View Results Sheet</a><a href="track-field-results.html?competitionId=${encodeURIComponent(line.competitionId)}&scorecardId=${encodeURIComponent(line.id)}">Edit Results Sheet</a><a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a></div></article>`;
  }
  // Normalize Line
  /**
   * Flattens current and legacy stat-line shapes into one structure for filters and renderers.
   */
  function normalizeLine(row) { const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : row?.data && typeof row.data === "object" ? row.data : {}; return { ...row, ...data, id: row.id, competitionId: row.competitionId || data.competitionId, teamId: row.teamId || data.teamId || data.uwiTeamId, sport: row.sport || data.sport, sportSlug: row.sportSlug || data.sportSlug, eventType: row.eventType || data.eventType, eventName: row.eventName || data.eventName || data.title, date: row.date || data.date || row.createdAt, season: row.season || data.season, statData: data }; }
  function isTrackFieldScorecard(line) { return APP.normalizeSportSlug(line.sportSlug || line.sport) === "track-and-field" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard"); }
  function scorecardsFor(id) { return state.scorecards.filter((line) => String(line.competitionId) === String(id)); }
  function competitionFor(id) { return state.competitions.find((competition) => String(competition.id) === String(id)); }
  // Normalize Array
  /**
   * Accepts current and nested API response shapes so pages remain compatible during backend evolution.
   */
  function normalizeArray(payload) { if (Array.isArray(payload)) return payload; if (Array.isArray(payload?.data)) return payload.data; return []; }
  function compactUwiResultLabel(value) { const text = String(value || "").trim(); if (!text) return ""; return text.replace(/\bUWI\s+Blackbirds(?:\s+[A-Za-z& -]+?)?\s+Team\b/gi, "Blackbirds").replace(/\bUWI\s+Blackbirds\b/gi, "Blackbirds"); }
  function show(text) { els.msg.className = "message error is-visible"; els.msg.textContent = text; }
  function escapeHtml(value) { return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
})();
