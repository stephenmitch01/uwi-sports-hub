(function () {
  "use strict";
  // Shared App Access
  /**
   * Hockey score sheet engine.
   *
   * Stores period scoring, roster-linked player stats, cards, shots, saves, and
   * opponent/team labels in one stat line so match results and athlete summaries
   * can be rendered from the same saved source.
   */
  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  // Scorecard State
  const state = { session: null, competition: null, athletes: [], teams: [] };
  // Scorecard Fields
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    subtitle: document.getElementById("scorecardSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("hockeyScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    league: document.getElementById("leagueName"),
    arena: document.getElementById("arenaName"),
    homeTeamLabel: document.getElementById("homeTeamLabel"),
    rosterGrid: document.getElementById("rosterGrid"),
    homeScoringRows: document.getElementById("homeScoringRows"),
    visitScoringRows: document.getElementById("visitScoringRows"),
    homePenaltyRows: document.getElementById("homePenaltyRows"),
    visitPenaltyRows: document.getElementById("visitPenaltyRows"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Hockey Score Sheet" });
    if (!session) return;
    state.session = session;
    if (!competitionId) {
      showPageError("Open this page from a hockey competition.");
      return;
    }
    try {
      const [competition, athletes, teams] = await Promise.all([
        APP.apiGet(`/competitions/${encodeURIComponent(competitionId)}`),
        APP.apiGet("/athletes", true),
        APP.apiGet("/teams", true)
      ]);
      state.competition = competition?.competition || competition?.data?.competition || competition?.data || competition;
      state.athletes = normalizeArray(athletes);
      state.teams = normalizeArray(teams);
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "hockey") {
        showPageError("This score sheet workflow is available for hockey competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      console.error("Hockey score sheet load error:", error);
      showPageError(error?.message || "Hockey score sheet could not be loaded.");
    }
  }

  // Page Layout
  /**
   * Builds the initial page UI from loaded campus-scoped data and default workflow state.
   */
  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Hockey Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.subtitle.textContent = "Select the UWI roster first. UWI scoring and penalty rows then link to athlete records.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "hockey")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Hockey Team")}</option>`)
      .join("")}`;
    renderRoster();
    renderScoringRows();
    renderPenaltyRows();
  }

  // Event Wiring
  /**
   * Centralizes event wiring so rendering functions can rebuild dynamic controls safely.
   */
  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", () => {
      els.homeTeamLabel.value = getUwiTeamName();
      renderRoster();
      renderScoringRows();
      renderPenaltyRows();
      updateDerivedFields();
    });
    els.opponentName.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-roster-select]")) handleRosterSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  // Roster
  /**
   * Renders the roster section from normalized page state without mutating backend data.
   */
  function renderRoster() {
    const roster = getRosterAthletes();
    els.rosterGrid.innerHTML = Array.from({ length: 18 }, (_, index) => {
      const number = index + 1;
      return `<div><label for="roster${number}">Roster Player ${number}</label><select class="select" id="roster${number}" data-roster-select><option value="">Select player ${number}</option>${roster.map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}<option value="__quick_add__">Quick Add New Athlete</option></select></div>`;
    }).join("");
  }

  // Scoring Rows
  /**
   * Renders the scoring rows section from normalized page state without mutating backend data.
   */
  function renderScoringRows() {
    els.homeScoringRows.innerHTML = Array.from({ length: 12 }, (_, index) => scoringRow("home", index + 1, true)).join("");
    els.visitScoringRows.innerHTML = Array.from({ length: 12 }, (_, index) => scoringRow("visit", index + 1, false)).join("");
  }

  function scoringRow(side, row, uwiSide) {
    const id = `${side}Goal${row}`;
    return `<tr><td><input class="input" id="${id}Number" type="number" min="0"/></td><td>${uwiSide ? playerControl(`${id}Scorer`) : `<input class="input" id="${id}ScorerName" type="text" value="Opp ${row}"/>`}</td><td><select class="select" id="${id}Period"><option value="">Period</option><option>1</option><option>2</option><option>3</option><option>OT</option></select></td><td><input class="input" id="${id}Goal" type="number" min="0" max="1"/></td><td>${uwiSide ? playerControl(`${id}Assist1`, "Assist 1") : `<input class="input" id="${id}Assist1Name" type="text"/>`}</td><td>${uwiSide ? playerControl(`${id}Assist2`, "Assist 2") : `<input class="input" id="${id}Assist2Name" type="text"/>`}</td></tr>`;
  }

  // Penalty Rows
  /**
   * Renders the penalty rows section from normalized page state without mutating backend data.
   */
  function renderPenaltyRows() {
    els.homePenaltyRows.innerHTML = Array.from({ length: 8 }, (_, index) => penaltyRow("home", index + 1, true)).join("");
    els.visitPenaltyRows.innerHTML = Array.from({ length: 8 }, (_, index) => penaltyRow("visit", index + 1, false)).join("");
  }

  function penaltyRow(side, row, uwiSide) {
    const id = `${side}Penalty${row}`;
    return `<div><label for="${id}Period">Period</label><select class="select" id="${id}Period"><option value="">Period</option><option>1</option><option>2</option><option>3</option><option>OT</option></select></div><div><label for="${id}Player">Player</label>${uwiSide ? playerControl(`${id}Player`) : `<input class="input" id="${id}PlayerName" type="text" value="Opp ${row}"/>`}</div><div><label for="${id}Minutes">Min</label><input class="input" id="${id}Minutes" type="number" min="0"/></div><div><label for="${id}Infraction">Infraction</label><input class="input" id="${id}Infraction" type="text"/></div><div><label for="${id}Time">Time</label><input class="input" id="${id}Time" type="text" placeholder="12:34"/></div>`;
  }

  function playerControl(prefix, label) {
    return `<select class="select" id="${prefix}AthleteId" data-uwi-player-control><option value="">${escapeHtml(label || "Select player")}</option>${selectedRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
  }

  function refreshRosterPlayerOptions() {
    const options = selectedRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("");
    document.querySelectorAll("[data-uwi-player-control]").forEach((select) => {
      const previous = select.value;
      select.innerHTML = `<option value="">Select player</option>${options}`;
      select.value = previous;
    });
  }

  // Derived Fields
  /**
   * Recalculates derived display values from editable fields without saving until submit.
   */
  function updateDerivedFields() {
    setValue("visitTeamLabel", opponentName(), false);
    setValue("homePeriodLabel", getUwiTeamName(), false);
    setValue("visitPeriodLabel", opponentName(), false);
    const homeTotal = sum(["homeP1", "homeP2", "homeP3", "homeOT"]);
    const visitTotal = sum(["visitP1", "visitP2", "visitP3", "visitOT"]);
    setValue("homeFinal", homeTotal);
    setValue("visitFinal", visitTotal);
    setValue("matchResult", deriveResult(homeTotal, visitTotal), false);
    setValue("teamGoals", countUwiGoals());
    setValue("teamAssists", countUwiAssists());
    setValue("teamPenalties", readPenalties("home", true).length);
    setValue("penaltyMinutes", readPenalties("home", true).reduce((total, item) => total + (item.minutes || 0), 0));
  }

  // Derived Result
  /**
   * Builds result text from score inputs while leaving manual corrections possible before save.
   */
  function deriveResult(homeTotal, visitTotal) {
    if (homeTotal === 0 && visitTotal === 0 && !hasScoreEntered()) return "";
    if (homeTotal > visitTotal) return `${getUwiTeamName()} won ${homeTotal}-${visitTotal}`;
    if (visitTotal > homeTotal) return `${opponentName()} won ${visitTotal}-${homeTotal}`;
    return `Draw ${homeTotal}-${visitTotal}`;
  }

  // Save Workflow
  /**
   * Validates and persists the workflow payload through the shared API helper.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "hockey")) return;
    if (!els.teamSelect.value) {
      showError("Select a UWI hockey team.");
      return;
    }
    const payload = {
      competitionId,
      sport: "hockey",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Hockey score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        league: els.league.value.trim(),
        arena: els.arena.value.trim(),
        result: valueOf("matchResult"),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        score: {
          uwi: { p1: numberValue("homeP1"), p2: numberValue("homeP2"), p3: numberValue("homeP3"), overtime: numberValue("homeOT"), total: numberValue("homeFinal") },
          opponent: { p1: numberValue("visitP1"), p2: numberValue("visitP2"), p3: numberValue("visitP3"), overtime: numberValue("visitOT"), total: numberValue("visitFinal") }
        },
        roster: selectedRosterAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        scoring: [...readScoring("home", true), ...readScoring("visit", false)],
        penalties: [...readPenalties("home", true), ...readPenalties("visit", false)],
        goalieSaves: numberValue("goalieSaves"),
        teamTotals: { goals: numberValue("teamGoals"), assists: numberValue("teamAssists"), penalties: numberValue("teamPenalties"), penaltyMinutes: numberValue("penaltyMinutes") }
      },
      verified: true,
      source: "hockey-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Hockey score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Hockey score sheet could not be saved.");
    }
  }

  // Collect Scoring
  /**
   * Reads scoring values into the structured payload consumed by reports and result views.
   */
  function readScoring(side, uwiSide) {
    return Array.from({ length: 12 }, (_, index) => {
      const row = index + 1;
      const id = `${side}Goal${row}`;
      const scorerId = valueOf(`${id}ScorerAthleteId`);
      const assist1Id = valueOf(`${id}Assist1AthleteId`);
      const assist2Id = valueOf(`${id}Assist2AthleteId`);
      return {
        side: uwiSide ? "uwi" : "opponent",
        period: valueOf(`${id}Period`),
        number: numberValue(`${id}Number`),
        goal: numberValue(`${id}Goal`) || (scorerId || valueOf(`${id}ScorerName`) ? 1 : null),
        scorerAthleteId: scorerId,
        scorerName: scorerId ? athleteName(scorerId) : valueOf(`${id}ScorerName`),
        assist1AthleteId: assist1Id,
        assist1Name: assist1Id ? athleteName(assist1Id) : valueOf(`${id}Assist1Name`),
        assist2AthleteId: assist2Id,
        assist2Name: assist2Id ? athleteName(assist2Id) : valueOf(`${id}Assist2Name`)
      };
    }).filter((row) => row.period || row.scorerAthleteId || row.scorerName || row.assist1AthleteId || row.assist2AthleteId);
  }

  // Collect Penalties
  /**
   * Reads penalties values into the structured payload consumed by reports and result views.
   */
  function readPenalties(side, uwiSide) {
    return Array.from({ length: 8 }, (_, index) => {
      const row = index + 1;
      const id = `${side}Penalty${row}`;
      const athleteId = valueOf(`${id}PlayerAthleteId`);
      return { side: uwiSide ? "uwi" : "opponent", period: valueOf(`${id}Period`), athleteId, name: athleteId ? athleteName(athleteId) : valueOf(`${id}PlayerName`), minutes: numberValue(`${id}Minutes`), infraction: valueOf(`${id}Infraction`), time: valueOf(`${id}Time`) };
    }).filter((row) => row.period || row.athleteId || row.name || row.minutes || row.infraction || row.time);
  }

  function countUwiGoals() {
    return readScoring("home", true).reduce((total, row) => total + (row.goal || 0), 0);
  }

  function countUwiAssists() {
    return readScoring("home", true).reduce((total, row) => total + (row.assist1AthleteId || row.assist1Name ? 1 : 0) + (row.assist2AthleteId || row.assist2Name ? 1 : 0), 0);
  }

  // Lookup Roster Athletes
  /**
   * Filters athlete choices by selected team/sport to prevent duplicate manual stat attribution.
   */
  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "hockey"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function selectedRosterAthletes() {
    const ids = Array.from(document.querySelectorAll("[data-roster-select]")).map((select) => select.value).filter((value) => value && value !== "__quick_add__");
    return ids.map((id) => state.athletes.find((athlete) => String(athlete.id) === String(id))).filter(Boolean);
  }

  // Workflow: Roster Select Change
  /**
   * Handles the roster select change workflow and keeps side effects inside the intended API/action path.
   */
  async function handleRosterSelectChange(select) {
    if (select.value !== "__quick_add__") {
      refreshRosterPlayerOptions();
      return;
    }
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "hockey" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    renderRoster();
    const target = document.getElementById(select.id);
    if (target) target.value = athlete.id;
    refreshRosterPlayerOptions();
  }

  function athleteName(id) {
    return displayName(state.athletes.find((athlete) => String(athlete.id) === String(id)));
  }

  // Lookup UWI Team Name
  /**
   * Resolves the selected UWI team label from backend data for saved statData and display.
   */
  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return els.homeTeamLabel.value.trim() || team?.name || team?.teamName || "UWI Team";
  }

  // Opponent Name
  /**
   * Returns the typed opponent label, falling back only when staff did not enter one.
   */
  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
  }

  // Normalize Array
  /**
   * Accepts current and nested API response shapes so pages remain compatible during backend evolution.
   */
  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.teams)) return payload.teams;
    if (Array.isArray(payload?.athletes)) return payload.athletes;
    if (Array.isArray(payload?.data?.teams)) return payload.data.teams;
    if (Array.isArray(payload?.data?.athletes)) return payload.data.athletes;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function displayName(athlete) {
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function hasScoreEntered() {
    return ["homeP1", "homeP2", "homeP3", "homeOT", "visitP1", "visitP2", "visitP3", "visitOT"].some((id) => numberValue(id) !== null);
  }

  function sum(ids) {
    return ids.reduce((total, id) => total + (numberValue(id) || 0), 0);
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
    el.value = value == null ? (allowNullAsZero ? "0" : "") : String(value);
  }

  function formatDateInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
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
