(function () {
  "use strict";

  /**
   * Chess score sheet engine.
   *
   * Captures board, color, result, opponent, opening, and move score. The saved
   * summary is preserved because chess outcomes are not simple numeric totals.
   */
  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  const MOVE_ROWS = 60;
  const state = { competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("chessScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    playerSelect: document.getElementById("uwiPlayerSelect"),
    color: document.getElementById("uwiColor"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    result: document.getElementById("gameResult"),
    moveGrid: document.getElementById("moveGrid"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Chess Score Sheet" });
    if (!session) return;
    if (!competitionId) return showPageError("Open this page from a chess competition.");
    try {
      const [competition, athletes, teams] = await Promise.all([
        APP.apiGet(`/competitions/${encodeURIComponent(competitionId)}`),
        APP.apiGet("/athletes", true),
        APP.apiGet("/teams", true)
      ]);
      state.competition = competition?.competition || competition?.data?.competition || competition?.data || competition;
      state.athletes = normalizeArray(athletes, "athletes");
      state.teams = normalizeArray(teams, "teams");
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "chess") {
        showPageError("This score sheet workflow is available for chess competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      showPageError(error?.message || "Chess score sheet could not be loaded.");
    }
  }

  /**
   * Builds the initial page UI from loaded campus-scoped data and default workflow state.
   */
  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Chess Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "chess")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Chess Team")}</option>`)
      .join("")}`;
    renderPlayerOptions();
    renderMoveGrid();
  }

  /**
   * Centralizes event wiring so rendering functions can rebuild dynamic controls safely.
   */
  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", renderPlayerOptions);
    els.playerSelect.addEventListener("change", () => handlePlayerSelectChange(els.playerSelect));
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", updateDerivedFields);
    els.form.addEventListener("submit", handleSubmit);
  }

  /**
   * Renders the player options section from normalized page state without mutating backend data.
   */
  function renderPlayerOptions() {
    const previous = els.playerSelect.value;
    els.playerSelect.innerHTML = `<option value="">Select player</option>${getRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}<option value="__quick_add__">Quick Add New Athlete</option>`;
    els.playerSelect.value = previous;
  }

  /**
   * Renders the move grid section from normalized page state without mutating backend data.
   */
  function renderMoveGrid() {
    const first = `<div class="move-head">#</div><div class="move-head">White</div><div class="move-head">Black</div><div class="move-head wide-only">#</div><div class="move-head wide-only">White</div><div class="move-head wide-only">Black</div>`;
    const rows = Array.from({ length: 30 }, (_, index) => {
      const left = index + 1;
      const right = index + 31;
      return `
        <div class="move-no">${left}</div><input class="input" id="whiteMove${left}" type="text"/><input class="input" id="blackMove${left}" type="text"/>
        <div class="move-no wide-only">${right}</div><input class="input wide-only" id="whiteMove${right}" type="text"/><input class="input wide-only" id="blackMove${right}" type="text"/>
      `;
    }).join("");
    els.moveGrid.innerHTML = first + rows;
  }

  /**
   * Recalculates derived display values from editable fields without saving until submit.
   */
  function updateDerivedFields() {
    const summary = summarizeGame();
    document.getElementById("uwiScoreText").textContent = String(summary.uwiScore);
    document.getElementById("resultText").textContent = summary.resultLabel || "-";
    document.getElementById("heroResult").textContent = summary.resultLabel || "-";
    document.getElementById("moveCountText").textContent = String(readMoves().length);
    document.getElementById("colorText").textContent = els.color.value === "white" ? "White" : "Black";
  }

  /**
   * Validates and persists the workflow payload through the shared API helper.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!els.teamSelect.value) return showError("Select a UWI chess team.");
    if (!els.playerSelect.value) return showError("Select the UWI player.");
    const athlete = state.athletes.find((item) => String(item.id) === String(els.playerSelect.value));
    const moves = readMoves();
    const summary = summarizeGame();
    const payload = {
      competitionId,
      sport: "chess",
      subjectType: "athlete",
      subjectId: els.playerSelect.value,
      teamId: els.teamSelect.value,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Chess score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        round: valueOf("roundName"),
        board: valueOf("boardNumber"),
        section: valueOf("sectionName"),
        opening: valueOf("openingName"),
        timeControl: valueOf("timeControl"),
        pairingNumber: valueOf("pairingNumber"),
        duration: valueOf("durationText"),
        result: summary.resultLabel,
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        uwiPlayer: { athleteId: els.playerSelect.value, name: displayName(athlete), color: els.color.value, ranking: valueOf("uwiRanking") },
        opponent: { name: valueOf("opponentName"), color: els.color.value === "white" ? "black" : "white", ranking: valueOf("opponentRanking") },
        moves,
        summary,
        signatures: { arbiter: valueOf("arbiterName"), player: valueOf("playerSignature") },
        notes: valueOf("matchNotes")
      },
      verified: true,
      source: "chess-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Chess score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Chess score sheet could not be saved.");
    }
  }

  /**
   * Reads moves values into the structured payload consumed by reports and result views.
   */
  function readMoves() {
    return Array.from({ length: MOVE_ROWS }, (_, index) => {
      const number = index + 1;
      const white = valueOf(`whiteMove${number}`);
      const black = valueOf(`blackMove${number}`);
      return white || black ? { number, white, black } : null;
    }).filter(Boolean);
  }

  function summarizeGame() {
    const result = els.result.value;
    const color = els.color.value;
    let uwiScore = 0;
    let resultLabel = "";
    if (result === "draw") {
      uwiScore = 0.5;
      resultLabel = "Draw";
    } else if (result === "forfeit-win") {
      uwiScore = 1;
      resultLabel = "UWI won by forfeit";
    } else if (result === "forfeit-loss") {
      uwiScore = 0;
      resultLabel = "UWI lost by forfeit";
    } else if (result === "white" || result === "black") {
      const uwiWon = result === color;
      uwiScore = uwiWon ? 1 : 0;
      resultLabel = uwiWon ? "UWI won" : "UWI lost";
    }
    return {
      uwiScore,
      opponentScore: resultLabel ? 1 - uwiScore : 0,
      resultCode: result,
      resultLabel,
      moveCount: readMoves().length,
      color
    };
  }

  /**
   * Handles the player select change workflow and keeps side effects inside the intended API/action path.
   */
  async function handlePlayerSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "chess" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    renderPlayerOptions();
    els.playerSelect.value = athlete.id;
  }

  /**
   * Filters athlete choices by selected team/sport to prevent duplicate manual stat attribution.
   */
  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "chess"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  /**
   * Resolves the selected UWI team label from backend data for saved statData and display.
   */
  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Chess";
  }

  /**
   * Accepts current and nested API response shapes so pages remain compatible during backend evolution.
   */
  function normalizeArray(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function displayName(athlete) {
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function valueOf(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  function formatDateInput(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  /**
   * Resets message state before a new fetch or submit attempt.
   */
  function clearMessage() {
    els.message.className = "message";
    els.message.textContent = "";
  }

  /**
   * Displays blocking load errors without throwing away the signed-in shell.
   */
  function showPageError(text) {
    els.pageMessage.className = "message error is-visible";
    els.pageMessage.textContent = text;
  }

  /**
   * Displays recoverable workflow errors near the relevant form or result section.
   */
  function showError(text) {
    els.message.className = "message error is-visible";
    els.message.textContent = text;
  }

  /**
   * Confirms successful backend persistence without changing page state unexpectedly.
   */
  function showSuccess(text) {
    els.message.className = "message success is-visible";
    els.message.textContent = text;
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
