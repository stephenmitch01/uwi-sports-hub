(function () {
  "use strict";

  // Shared App Access
  /**
   * Badminton match sheet engine.
   *
   * Supports singles/doubles-style participant capture, manual opponent entries,
   * and game-level scoring while preserving UWI athlete IDs for reporting.
   */
  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  // Scorecard State
  const state = { competition: null, athletes: [], teams: [] };
  // Scorecard Fields
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("badmintonScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    matchType: document.getElementById("matchType"),
    discipline: document.getElementById("discipline"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    court: document.getElementById("courtNumber"),
    matchNumber: document.getElementById("matchNumber"),
    status: document.getElementById("matchStatus"),
    result: document.getElementById("scorecardResult"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Badminton Match Sheet" });
    if (!session) return;
    if (!competitionId) {
      showPageError("Open this page from a badminton competition.");
      return;
    }
    try {
      const [competition, athletes, teams] = await Promise.all([
        APP.apiGet(`/competitions/${encodeURIComponent(competitionId)}`),
        APP.apiGet("/athletes", true),
        APP.apiGet("/teams", true)
      ]);
      state.competition = competition?.competition || competition?.data?.competition || competition?.data || competition;
      state.athletes = normalizeArray(athletes, "athletes");
      state.teams = normalizeArray(teams, "teams");
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "badminton") {
        showPageError("This match sheet workflow is available for badminton competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      showPageError(error?.message || "Badminton match sheet could not be loaded.");
    }
  }

  // Page Layout
  /**
   * Builds the initial page UI from loaded campus-scoped data and default workflow state.
   */
  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Badminton Competition";
    els.heading.textContent = `${title} Match Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "badminton")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Badminton Team")}</option>`)
      .join("")}`;
    renderPlayerOptions();
    updateMatchType();
  }

  // Event Wiring
  /**
   * Centralizes event wiring so rendering functions can rebuild dynamic controls safely.
   */
  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", renderPlayerOptions);
    els.matchType.addEventListener("change", () => {
      updateMatchType();
      updateDerivedFields();
    });
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-player-select]")) handlePlayerSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  // Player Options
  /**
   * Renders the player options section from normalized page state without mutating backend data.
   */
  function renderPlayerOptions() {
    ["uwiPlayer1AthleteId", "uwiPlayer2AthleteId"].forEach((id) => {
      const select = document.getElementById(id);
      const previous = select.value;
      select.innerHTML = `<option value="">Select UWI player</option>${getRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}<option value="__quick_add__">Quick Add New Athlete</option>`;
      select.value = previous;
    });
    updateSideLabels();
  }

  // Derived Match Type
  /**
   * Updates derived UI state from the current form/model values without persisting changes directly.
   */
  function updateMatchType() {
    const doubles = els.matchType.value === "doubles";
    document.getElementById("uwiPlayer2Wrap").style.display = doubles ? "" : "none";
    document.getElementById("opponentPlayer2Wrap").style.display = doubles ? "" : "none";
    if (!doubles) {
      document.getElementById("uwiPlayer2AthleteId").value = "";
      document.getElementById("opponentPlayer2").value = "";
    }
    updateSideLabels();
  }

  // Derived Side Labels
  /**
   * Updates derived UI state from the current form/model values without persisting changes directly.
   */
  function updateSideLabels() {
    setText("uwiSideLabel", sideName("uwi") || "UWI");
    setText("opponentSideLabel", sideName("opponent") || "Opponent");
  }

  // Derived Fields
  /**
   * Recalculates derived display values from editable fields without saving until submit.
   */
  function updateDerivedFields() {
    updateSideLabels();
    const games = readGames();
    const uwiGames = games.filter((game) => game.uwi > game.opponent).length;
    const oppGames = games.filter((game) => game.opponent > game.uwi).length;
    const pointsFor = games.reduce((sum, game) => sum + game.uwi, 0);
    const pointsAgainst = games.reduce((sum, game) => sum + game.opponent, 0);
    setValue("uwiGamesWon", uwiGames);
    setValue("oppGamesWon", oppGames);
    setValue("pointsFor", pointsFor);
    setValue("pointsAgainst", pointsAgainst);
    setValue("pointDifferential", pointsFor - pointsAgainst);
    setValue("winnerText", deriveWinner(uwiGames, oppGames));
    setValue("scorecardResult", deriveResult(uwiGames, oppGames), false);
    setValue("durationMinutes", deriveDuration(), false);
  }

  // Save Workflow
  /**
   * Validates and persists the workflow payload through the shared API helper.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "badminton")) return;
    if (!els.teamSelect.value) {
      showError("Select a UWI badminton team.");
      return;
    }
    const uwiPlayers = readUwiPlayers();
    if (!uwiPlayers.length) {
      showError("Select at least one UWI player.");
      return;
    }
    const payload = {
      competitionId,
      sport: "badminton",
      subjectType: els.matchType.value === "doubles" ? "pair" : "athlete",
      subjectId: uwiPlayers[0]?.athleteId || competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Badminton match sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        matchType: els.matchType.value,
        discipline: els.discipline.value,
        matchNumber: els.matchNumber.value.trim(),
        court: els.court.value.trim(),
        status: els.status.value,
        result: els.result.value.trim(),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        uwiPlayers,
        opponentPlayers: readOpponentPlayers(),
        games: readGames(),
        summary: {
          uwiGamesWon: numberValue("uwiGamesWon"),
          opponentGamesWon: numberValue("oppGamesWon"),
          pointsFor: numberValue("pointsFor"),
          pointsAgainst: numberValue("pointsAgainst"),
          pointDifferential: numberValue("pointDifferential"),
          winner: valueOf("winnerText")
        },
        officials: {
          umpire: valueOf("umpireName"),
          serviceJudge: valueOf("serviceJudge")
        },
        timing: {
          startTime: valueOf("startTime"),
          finishTime: valueOf("finishTime"),
          durationMinutes: numberValue("durationMinutes")
        },
        notes: valueOf("matchNotes")
      },
      verified: true,
      source: "badminton-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Badminton match sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Badminton match sheet could not be saved.");
    }
  }

  // Collect Games
  /**
   * Reads games values into the structured payload consumed by reports and result views.
   */
  function readGames() {
    return [1, 2, 3].map((game) => ({
      game,
      uwi: numberValue(`uwiGame${game}`) || 0,
      opponent: numberValue(`oppGame${game}`) || 0
    })).filter((game) => game.uwi || game.opponent);
  }

  // Collect UWI Players
  /**
   * Reads uwi players values into the structured payload consumed by reports and result views.
   */
  function readUwiPlayers() {
    return ["uwiPlayer1AthleteId", "uwiPlayer2AthleteId"].map((id) => {
      const athleteId = valueOf(id);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      return athleteId ? { athleteId, name: displayName(athlete) } : null;
    }).filter(Boolean);
  }

  // Collect Opponent Players
  /**
   * Reads opponent players values into the structured payload consumed by reports and result views.
   */
  function readOpponentPlayers() {
    return ["opponentPlayer1", "opponentPlayer2"].map((id) => valueOf(id)).filter(Boolean).map((name) => ({ name }));
  }

  // Derived Winner
  /**
   * Derives winner from entered data so downstream display stays consistent.
   */
  function deriveWinner(uwiGames, oppGames) {
    if (els.status.value === "walkover") return sideName("uwi") || "UWI";
    if (uwiGames > oppGames) return sideName("uwi") || "UWI";
    if (oppGames > uwiGames) return sideName("opponent") || "Opponent";
    return "";
  }

  // Derived Result
  /**
   * Builds result text from score inputs while leaving manual corrections possible before save.
   */
  function deriveResult(uwiGames, oppGames) {
    const winner = deriveWinner(uwiGames, oppGames);
    if (!winner) return "";
    const loserGames = winner === (sideName("uwi") || "UWI") ? oppGames : uwiGames;
    const winnerGames = Math.max(uwiGames, oppGames);
    return `${winner} won ${winnerGames}-${loserGames}`;
  }

  // Derived Duration
  /**
   * Derives duration from entered data so downstream display stays consistent.
   */
  function deriveDuration() {
    const start = valueOf("startTime");
    const finish = valueOf("finishTime");
    if (!start || !finish) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [fh, fm] = finish.split(":").map(Number);
    if (![sh, sm, fh, fm].every(Number.isFinite)) return "";
    let minutes = (fh * 60 + fm) - (sh * 60 + sm);
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
  }

  // Workflow: Player Select Change
  /**
   * Handles the player select change workflow and keeps side effects inside the intended API/action path.
   */
  async function handlePlayerSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "badminton" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    renderPlayerOptions();
    const target = document.getElementById(select.id);
    if (target) target.value = athlete.id;
  }

  function sideName(side) {
    if (side === "uwi") return readUwiPlayers().map((player) => player.name).join(" / ") || getUwiTeamName();
    return readOpponentPlayers().map((player) => player.name).join(" / ") || "Opponent";
  }

  // Lookup Roster Athletes
  /**
   * Filters athlete choices by selected team/sport to prevent duplicate manual stat attribution.
   */
  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "badminton"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  // Lookup UWI Team Name
  /**
   * Resolves the selected UWI team label from backend data for saved statData and display.
   */
  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Badminton";
  }

  // Normalize Array
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

  function numberValue(id) {
    const value = valueOf(id);
    if (value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function setValue(id, value, allowNullAsZero = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value == null || value === "" ? (allowNullAsZero ? "0" : "") : String(value);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatDateInput(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  // Messages and UI State
  /**
   * Resets message state before a new fetch or submit attempt.
   */
  function clearMessage() {
    els.message.className = "message";
    els.message.textContent = "";
  }

  // Messages and UI State
  /**
   * Displays blocking load errors without throwing away the signed-in shell.
   */
  function showPageError(text) {
    els.pageMessage.className = "message error is-visible";
    els.pageMessage.textContent = text;
  }

  // Messages and UI State
  /**
   * Displays recoverable workflow errors near the relevant form or result section.
   */
  function showError(text) {
    els.message.className = "message error is-visible";
    els.message.textContent = text;
  }

  // Messages and UI State
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
