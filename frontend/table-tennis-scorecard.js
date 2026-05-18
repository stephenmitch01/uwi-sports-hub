(function () {
  "use strict";

  // Shared App Access
  /**
   * Table tennis score sheet engine.
   *
   * Rubber rows preserve UWI athlete IDs, typed opponent players, games, points,
   * and match winner so reports can summarize both team and player outcomes.
   */
  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  const RUBBERS = [
    { label: "#1 Player", type: "singles" },
    { label: "#2 Player", type: "singles" },
    { label: "#3 Player", type: "singles" },
    { label: "#4 Player", type: "singles" },
    { label: "#1 Pairing", type: "doubles" },
    { label: "#2 Pairing", type: "doubles" }
  ];
  // Scorecard State
  const state = { competition: null, athletes: [], teams: [] };
  // Scorecard Fields
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("tableTennisScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    category: document.getElementById("matchCategory"),
    title: document.getElementById("scorecardTitle"),
    opponent: document.getElementById("opponentTeamName"),
    date: document.getElementById("scorecardDate"),
    status: document.getElementById("matchStatus"),
    result: document.getElementById("scorecardResult"),
    rubberList: document.getElementById("rubberList"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Table Tennis Score Sheet" });
    if (!session) return;
    if (!competitionId) {
      showPageError("Open this page from a table tennis competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "table-tennis") {
        showPageError("This score sheet workflow is available for table tennis competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      showPageError(error?.message || "Table tennis score sheet could not be loaded.");
    }
  }

  // Page Layout
  /**
   * Builds the initial page UI from loaded campus-scoped data and default workflow state.
   */
  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Table Tennis Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "table-tennis")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Table Tennis Team")}</option>`)
      .join("")}`;
    renderRubbers();
  }

  // Event Wiring
  /**
   * Centralizes event wiring so rendering functions can rebuild dynamic controls safely.
   */
  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", renderRubbers);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-rubber-type]")) toggleRubberPair(event.target.closest(".tt-rubber"));
      if (event.target.matches("[data-player-select]")) handlePlayerSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  // Rubbers
  /**
   * Renders the rubbers section from normalized page state without mutating backend data.
   */
  function renderRubbers() {
    els.rubberList.innerHTML = RUBBERS.map((rubber, index) => renderRubber(index + 1, rubber)).join("");
    els.rubberList.querySelectorAll(".tt-rubber").forEach(toggleRubberPair);
    updateDerivedFields();
  }

  // Rubber
  /**
   * Renders the rubber section from normalized page state without mutating backend data.
   */
  function renderRubber(number, rubber) {
    const rosterOptions = getRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("");
    const gameInputs = [1, 2, 3, 4, 5].map((game) => `
      <input class="input" id="rubber${number}UwiGame${game}" type="number" min="0" max="30" data-score-input/>
    `).join("");
    const oppInputs = [1, 2, 3, 4, 5].map((game) => `
      <input class="input" id="rubber${number}OppGame${game}" type="number" min="0" max="30" data-score-input/>
    `).join("");
    return `
      <article class="tt-rubber" data-rubber="${number}">
        <div class="tt-rubber-head">
          <strong>${escapeHtml(rubber.label)}</strong>
          <div><label for="rubber${number}Type">Rubber Type</label><select class="select" id="rubber${number}Type" data-rubber-type><option value="singles" ${rubber.type === "singles" ? "selected" : ""}>Singles</option><option value="doubles" ${rubber.type === "doubles" ? "selected" : ""}>Doubles</option></select></div>
          <div><label for="rubber${number}UwiPlayer1">UWI Player 1</label><select class="select" id="rubber${number}UwiPlayer1" data-player-select><option value="">Select player</option>${rosterOptions}<option value="__quick_add__">Quick Add New Athlete</option></select></div>
          <div data-pair-player><label for="rubber${number}UwiPlayer2">UWI Player 2</label><select class="select" id="rubber${number}UwiPlayer2" data-player-select><option value="">Select player</option>${rosterOptions}<option value="__quick_add__">Quick Add New Athlete</option></select></div>
          <div><label for="rubber${number}UwiGames">UWI Games</label><input class="input derived" id="rubber${number}UwiGames" readonly/></div>
          <div><label for="rubber${number}OppGames">Opp Games</label><input class="input derived" id="rubber${number}OppGames" readonly/></div>
          <div><label for="rubber${number}Winner">Winner</label><input class="input derived" id="rubber${number}Winner" readonly/></div>
        </div>
        <div class="tt-rubber-head">
          <div></div><div></div>
          <div><label for="rubber${number}OppPlayer1">Opponent Player 1</label><input class="input" id="rubber${number}OppPlayer1" type="text"/></div>
          <div data-pair-opponent><label for="rubber${number}OppPlayer2">Opponent Player 2</label><input class="input" id="rubber${number}OppPlayer2" type="text"/></div>
          <div><label for="rubber${number}UwiPoints">UWI Points</label><input class="input derived" id="rubber${number}UwiPoints" readonly/></div>
          <div><label for="rubber${number}OppPoints">Opp Points</label><input class="input derived" id="rubber${number}OppPoints" readonly/></div>
          <div><label for="rubber${number}Status">Status</label><select class="select" id="rubber${number}Status"><option value="played">Played</option><option value="walkover">Walkover</option><option value="retired">Retired</option><option value="defaulted">Defaulted</option></select></div>
        </div>
        <div class="tt-game-grid">
          <div class="tt-label">Side</div><div>Game 1</div><div>Game 2</div><div>Game 3</div><div>Game 4</div><div>Game 5</div><div>Games</div><div>Points</div>
          <div class="tt-label">UWI</div>${gameInputs}<input class="input derived" id="rubber${number}UwiGamesMirror" readonly/><input class="input derived" id="rubber${number}UwiPointsMirror" readonly/>
          <div class="tt-label">Opponent</div>${oppInputs}<input class="input derived" id="rubber${number}OppGamesMirror" readonly/><input class="input derived" id="rubber${number}OppPointsMirror" readonly/>
        </div>
      </article>
    `;
  }

  function toggleRubberPair(rubberEl) {
    if (!rubberEl) return;
    const isDoubles = valueOf(`rubber${rubberEl.dataset.rubber}Type`) === "doubles";
    rubberEl.querySelectorAll("[data-pair-player], [data-pair-opponent]").forEach((el) => { el.style.display = isDoubles ? "" : "none"; });
    if (!isDoubles) {
      setValue(`rubber${rubberEl.dataset.rubber}UwiPlayer2`, "", false);
      setValue(`rubber${rubberEl.dataset.rubber}OppPlayer2`, "", false);
    }
  }

  // Derived Fields
  /**
   * Recalculates derived display values from editable fields without saving until submit.
   */
  function updateDerivedFields() {
    const rubbers = readRubbers();
    let uwiRubbers = 0;
    let oppRubbers = 0;
    let uwiGames = 0;
    let oppGames = 0;
    let uwiPoints = 0;
    let oppPoints = 0;
    rubbers.forEach((rubber) => {
      setValue(`rubber${rubber.number}UwiGames`, rubber.uwiGames);
      setValue(`rubber${rubber.number}OppGames`, rubber.opponentGames);
      setValue(`rubber${rubber.number}UwiGamesMirror`, rubber.uwiGames);
      setValue(`rubber${rubber.number}OppGamesMirror`, rubber.opponentGames);
      setValue(`rubber${rubber.number}UwiPoints`, rubber.uwiPoints);
      setValue(`rubber${rubber.number}OppPoints`, rubber.opponentPoints);
      setValue(`rubber${rubber.number}UwiPointsMirror`, rubber.uwiPoints);
      setValue(`rubber${rubber.number}OppPointsMirror`, rubber.opponentPoints);
      setValue(`rubber${rubber.number}Winner`, rubber.winner, false);
      if (rubber.winner === "UWI") uwiRubbers += 1;
      if (rubber.winner === "Opponent") oppRubbers += 1;
      uwiGames += rubber.uwiGames;
      oppGames += rubber.opponentGames;
      uwiPoints += rubber.uwiPoints;
      oppPoints += rubber.opponentPoints;
    });
    const winner = uwiRubbers > oppRubbers ? getUwiTeamName() : oppRubbers > uwiRubbers ? valueOf("opponentTeamName") || "Opponent" : "";
    document.getElementById("totalRubbers").textContent = `${uwiRubbers}-${oppRubbers}`;
    document.getElementById("totalGames").textContent = `${uwiGames}-${oppGames}`;
    document.getElementById("totalPoints").textContent = `${uwiPoints}-${oppPoints}`;
    document.getElementById("winningTeamText").textContent = winner || "-";
    setValue("scorecardResult", winner ? `${winner} won ${Math.max(uwiRubbers, oppRubbers)}-${Math.min(uwiRubbers, oppRubbers)}` : "", false);
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
    if (!APP.confirmScorecardValues(els.form, "table-tennis")) return;
    if (!els.teamSelect.value) return showError("Select a UWI table tennis team.");
    const rubbers = readRubbers().filter((rubber) => rubber.uwiPlayers.length || rubber.opponentPlayers.length || rubber.uwiPoints || rubber.opponentPoints);
    if (!rubbers.length) return showError("Enter at least one rubber.");
    const summary = summarizeRubbers(rubbers);
    const payload = {
      competitionId,
      sport: "table-tennis",
      subjectType: "team",
      subjectId: els.teamSelect.value,
      teamId: els.teamSelect.value,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Table tennis score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        category: els.category.value,
        status: els.status.value,
        result: els.result.value.trim(),
        matchNumber: valueOf("matchNumber"),
        venue: valueOf("venueName"),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentTeamName: valueOf("opponentTeamName") || "Opponent",
        rubbers,
        summary,
        officials: { referee: valueOf("refereeName"), umpire: valueOf("umpireName") },
        timing: { startTime: valueOf("startTime"), finishTime: valueOf("finishTime"), durationMinutes: numberValue("durationMinutes") },
        notes: valueOf("matchNotes")
      },
      verified: true,
      source: "table-tennis-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Table tennis score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Table tennis score sheet could not be saved.");
    }
  }

  // Collect Rubbers
  /**
   * Reads rubbers values into the structured payload consumed by reports and result views.
   */
  function readRubbers() {
    return RUBBERS.map((template, index) => {
      const number = index + 1;
      const type = valueOf(`rubber${number}Type`) || template.type;
      const games = [1, 2, 3, 4, 5].map((game) => ({
        game,
        uwi: numberValue(`rubber${number}UwiGame${game}`) || 0,
        opponent: numberValue(`rubber${number}OppGame${game}`) || 0
      })).filter((game) => game.uwi || game.opponent);
      const uwiGames = games.filter((game) => game.uwi > game.opponent).length;
      const opponentGames = games.filter((game) => game.opponent > game.uwi).length;
      const status = valueOf(`rubber${number}Status`) || "played";
      const winner = status === "walkover" ? "UWI" : uwiGames > opponentGames ? "UWI" : opponentGames > uwiGames ? "Opponent" : "";
      return {
        number,
        label: template.label,
        type,
        status,
        uwiPlayers: readUwiPlayersForRubber(number, type),
        opponentPlayers: readOpponentPlayersForRubber(number, type),
        games,
        uwiGames,
        opponentGames,
        uwiPoints: games.reduce((sum, game) => sum + game.uwi, 0),
        opponentPoints: games.reduce((sum, game) => sum + game.opponent, 0),
        winner
      };
    });
  }

  function summarizeRubbers(rubbers) {
    const summary = rubbers.reduce((acc, rubber) => {
      acc.uwiRubbers += rubber.winner === "UWI" ? 1 : 0;
      acc.opponentRubbers += rubber.winner === "Opponent" ? 1 : 0;
      acc.uwiGames += rubber.uwiGames;
      acc.opponentGames += rubber.opponentGames;
      acc.pointsFor += rubber.uwiPoints;
      acc.pointsAgainst += rubber.opponentPoints;
      return acc;
    }, { uwiRubbers: 0, opponentRubbers: 0, uwiGames: 0, opponentGames: 0, pointsFor: 0, pointsAgainst: 0 });
    summary.pointDifferential = summary.pointsFor - summary.pointsAgainst;
    summary.winner = summary.uwiRubbers > summary.opponentRubbers ? getUwiTeamName() : summary.opponentRubbers > summary.uwiRubbers ? valueOf("opponentTeamName") || "Opponent" : "";
    return summary;
  }

  // Collect UWI Players For Rubber
  /**
   * Reads uwi players for rubber values into the structured payload consumed by reports and result views.
   */
  function readUwiPlayersForRubber(number, type) {
    return [1, 2].map((slot) => {
      if (slot === 2 && type !== "doubles") return null;
      const athleteId = valueOf(`rubber${number}UwiPlayer${slot}`);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      return athleteId ? { athleteId, name: displayName(athlete), slot } : null;
    }).filter(Boolean);
  }

  // Collect Opponent Players For Rubber
  /**
   * Reads opponent players for rubber values into the structured payload consumed by reports and result views.
   */
  function readOpponentPlayersForRubber(number, type) {
    return [1, 2].map((slot) => {
      if (slot === 2 && type !== "doubles") return null;
      const name = valueOf(`rubber${number}OppPlayer${slot}`);
      return name ? { name, slot } : null;
    }).filter(Boolean);
  }

  // Workflow: Player Select Change
  /**
   * Handles the player select change workflow and keeps side effects inside the intended API/action path.
   */
  async function handlePlayerSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "table-tennis" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    const targetId = select.id;
    renderRubbers();
    const target = document.getElementById(targetId);
    if (target) target.value = athlete.id;
  }

  // Lookup Roster Athletes
  /**
   * Filters athlete choices by selected team/sport to prevent duplicate manual stat attribution.
   */
  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "table-tennis"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  // Lookup UWI Team Name
  /**
   * Resolves the selected UWI team label from backend data for saved statData and display.
   */
  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Table Tennis";
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
