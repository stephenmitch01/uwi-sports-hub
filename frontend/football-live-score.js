(function () {
  "use strict";

  // Shared App Access
  /**
   * Football live-entry engine.
   *
   * Live entry stays separate from retrospective score-sheet entry while saving
   * into the same `competitionStatLine` payload. Events drive the provisional
   * score, player rows, team totals, and timeline so the completed record can
   * flow through existing football result cards, athlete reports, team views,
   * leaderboards, and campus reports.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";

  // Football Stat Registry
  const TEAM_STATS = [
    ["shots", "Shot"],
    ["shotsOnTarget", "Shot on target"],
    ["corners", "Corner kick"],
    ["freeKicks", "Free kick"],
    ["fouls", "Foul"],
    ["offsides", "Offside"],
    ["crosses", "Cross"],
    ["interceptions", "Interception"],
    ["tackles", "Tackle"],
    ["saves", "Save"],
    ["passesAttempted", "Pass attempted"],
    ["passesCompleted", "Pass completed"]
  ];
  const PLAYER_STATS = [
    ["shots", "Shot"],
    ["shotsOnTarget", "Shot on target"],
    ["assists", "Assist"],
    ["saves", "Save"],
    ["fouls", "Foul"],
    ["offside", "Offside"],
    ["interceptions", "Interception"],
    ["tackles", "Tackle"]
  ];
  const GOAL_TYPES = [
    ["open-play", "Open play"],
    ["penalty", "Penalty"],
    ["free-kick", "Direct free kick"],
    ["header", "Header"],
    ["own-goal", "Own goal"],
    ["unknown", "Unknown scorer"]
  ];
  const CARD_TYPES = [
    ["yellow", "Yellow"],
    ["second-yellow", "Second yellow"],
    ["red", "Straight red"]
  ];
  const PERIOD_LABELS = {
    firstHalf: "First half",
    secondHalf: "Second half",
    extraTime1: "Extra time 1",
    extraTime2: "Extra time 2",
    shootout: "Shootout"
  };

  // Page State
  const state = {
    session: null,
    competition: null,
    athletes: [],
    teams: [],
    events: [],
    draftControl: null
  };

  // Page Fields
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("liveHeading"),
    subtitle: document.getElementById("liveSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    manualLink: document.getElementById("manualScorecardLink"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("matchTitle"),
    date: document.getElementById("matchDate"),
    location: document.getElementById("matchLocation"),
    status: document.getElementById("matchStatus"),
    squadGrid: document.getElementById("squadGrid"),
    eventForm: document.getElementById("eventForm"),
    eventType: document.getElementById("eventType"),
    period: document.getElementById("period"),
    minute: document.getElementById("minute"),
    addedTime: document.getElementById("addedTime"),
    eventFields: document.getElementById("eventFields"),
    notesWrap: document.getElementById("eventNotesWrap"),
    notes: document.getElementById("eventNotes"),
    recordButton: document.getElementById("recordEventButton"),
    uwiTeamLabel: document.getElementById("uwiTeamLabel"),
    score: document.getElementById("scoreText"),
    periodText: document.getElementById("periodText"),
    recentEvent: document.getElementById("recentEvent"),
    eventCount: document.getElementById("eventCount"),
    summary: document.getElementById("liveSummary"),
    timeline: document.getElementById("timeline"),
    undo: document.getElementById("undoEventButton"),
    save: document.getElementById("saveScoreSheetButton"),
    message: document.getElementById("scoreMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Mounts the signed-in shell, validates football competition context, and
   * loads campus-scoped teams/athletes before any live scoring can occur.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Football Live Scoring" });
    if (!session) return;
    state.session = session;
    if (!competitionId) {
      showPageError("Open live scoring from a football competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "football") {
        showPageError("Live scoring is currently available for football competitions only.");
        return;
      }
      renderPage();
      state.draftControl = APP.registerScoringDraft(liveDraftKey(), document.body, {
        prompt: "Restore the unsaved football live scoring draft for this competition?",
        serialize: serializeLiveDraft,
        onRestore: restoreLiveDraft
      });
      bindEvents();
      if (!state.draftControl.restored) renderEventFields();
      updateLiveDisplay();
    } catch (error) {
      console.error("Football live scoring load error:", error);
      showPageError(error?.message || "Football live scoring could not be loaded.");
    }
  }

  // Page Layout
  /**
   * Populates fixture metadata and the UWI squad controls. The selected squad is
   * the source for athlete IDs written into generated player stat rows.
   */
  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Football Competition";
    els.heading.textContent = `${title} Live Scoring`;
    els.subtitle.textContent = "Record football events live, then save the generated score sheet into USH.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.manualLink.href = `football-scorecard.html?competitionId=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.location.value = state.competition?.venue || state.competition?.location || "";
    const footballTeams = state.teams.filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "football");
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${footballTeams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Football Team")}</option>`).join("")}`;
    const preferredTeamId = state.competition?.teamId || state.competition?.uwiTeamId || state.competition?.data?.teamId || "";
    els.teamSelect.value = preferredTeamId && footballTeams.some((team) => String(team.id) === String(preferredTeamId))
      ? String(preferredTeamId)
      : String(footballTeams[0]?.id || "");
    renderSquad();
  }

  // Draft Recovery
  /**
   * Persists the live football event log and current controls locally so a
   * disrupted browser/network session can resume without losing match events.
   */
  function liveDraftKey() {
    return `football-live:${state.session?.id || "session"}:${competitionId}`;
  }

  function serializeLiveDraft() {
    return {
      controls: APP.snapshotFormControls(document.body),
      events: state.events
    };
  }

  function restoreLiveDraft(draft) {
    APP.restoreFormControls(document.body, draft.controls);
    renderSquad();
    renderEventFields();
    APP.restoreFormControls(document.body, draft.controls);
    state.events = Array.isArray(draft.events) ? draft.events : [];
  }

  function saveLiveDraft() {
    if (state.draftControl) state.draftControl.save();
  }

  // Event Wiring
  /**
   * Centralizes events so dynamic form sections can be rebuilt without losing
   * the already-recorded match timeline.
   */
  function bindEvents() {
    APP.trackUnsavedChanges(document.body);
    els.teamSelect.addEventListener("change", () => {
      renderSquad();
      renderEventFields();
      updateLiveDisplay();
    });
    els.eventType.addEventListener("change", () => renderEventFields());
    els.period.addEventListener("change", updateLiveDisplay);
    els.opponentName.addEventListener("input", () => {
      renderEventFields();
      updateLiveDisplay();
    });
    els.status.addEventListener("change", updateLiveDisplay);
    els.squadGrid.addEventListener("change", () => {
      renderEventFields();
      updateLiveDisplay();
    });
    els.eventForm.addEventListener("submit", handleEventSubmit);
    document.querySelectorAll("[data-quick-event]").forEach((button) => {
      button.addEventListener("click", () => {
        els.eventType.value = button.dataset.quickEvent || "goal";
        renderEventFields(button.dataset.quickStat || "");
      });
    });
    els.undo.addEventListener("click", undoLastEvent);
    els.save.addEventListener("click", saveScoreSheet);
  }

  // Squad
  /**
   * Renders the selected football squad. Live attribution uses this squad rather
   * than every football athlete so player rows stay tied to matchday context.
   */
  function renderSquad() {
    const roster = getRosterAthletes();
    els.squadGrid.innerHTML = Array.from({ length: 18 }, (_, index) => {
      const number = index + 1;
      const selected = roster[index]?.id || "";
      return `<div>
        <label for="squad${number}">Squad Player ${number}</label>
        <select class="select" id="squad${number}" data-squad-select>
          <option value="">Select player ${number}</option>
          ${roster.map((athlete) => `<option value="${escapeHtml(athlete.id)}" ${String(athlete.id) === String(selected) ? "selected" : ""}>${escapeHtml(displayName(athlete))}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
  }

  // Event Form
  /**
   * Renders the event-specific fields. Core events are quick to enter, while
   * optional statistics remain available without blocking match completion.
   */
  function renderEventFields(preselectedStat) {
    const type = els.eventType.value;
    toggleEventDetailState(type, preselectedStat);
    if (!type) {
      els.eventFields.innerHTML = `<div class="live-event-empty">Choose an event above, or use a quick event button, to open the fields needed for that specific football event.</div>`;
      return;
    }
    if (type === "goal") renderGoalFields();
    else if (type === "card") renderCardFields();
    else if (type === "substitution") renderSubstitutionFields();
    else if (type === "team-stat") renderTeamStatFields(preselectedStat);
    else if (type === "player-stat") renderPlayerStatFields(preselectedStat);
    else renderShootoutFields();
  }

  function renderGoalFields() {
    els.eventFields.innerHTML = `
      <div class="live-event-grid">
        <div><label for="goalTeam">Scoring Team</label><select class="select" id="goalTeam" data-live-team><option value="uwi">${escapeHtml(getUwiTeamName())}</option><option value="opponent">${escapeHtml(opponentName())}</option></select></div>
        <div><label for="goalType">Goal Type</label><select class="select" id="goalType">${GOAL_TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
        <div id="goalPlayerField" data-team-player-field><label for="goalPlayer">Scorer</label>${teamPlayerControl("goalPlayer", "uwi", "Select scorer")}</div>
        <div id="assistPlayerField" data-team-player-field><label for="assistPlayer">Assist</label>${teamPlayerControl("assistPlayer", "uwi", "No assist / not recorded", true)}</div>
      </div>`;
    document.getElementById("goalTeam").addEventListener("change", syncGoalTypeControls);
    document.getElementById("goalType").addEventListener("change", syncGoalTypeControls);
  }

  function renderCardFields() {
    els.eventFields.innerHTML = `
      <div class="live-event-grid">
        <div><label for="cardTeam">Team</label><select class="select" id="cardTeam" data-live-team><option value="uwi">${escapeHtml(getUwiTeamName())}</option><option value="opponent">${escapeHtml(opponentName())}</option></select></div>
        <div><label for="cardType">Card</label><select class="select" id="cardType">${CARD_TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
        <div data-team-player-field><label for="cardPlayer">Player / Staff</label>${teamPlayerControl("cardPlayer", "uwi", "Select player")}</div>
        <div><label for="cardReason">Reason</label><input class="input" id="cardReason" type="text" placeholder="Optional reason"/></div>
      </div>`;
    document.getElementById("cardTeam").addEventListener("change", syncTeamPlayerControls);
  }

  function renderSubstitutionFields() {
    els.eventFields.innerHTML = `
      <div class="live-event-grid">
        <div><label for="subTeam">Team</label><select class="select" id="subTeam" data-live-team><option value="uwi">${escapeHtml(getUwiTeamName())}</option><option value="opponent">${escapeHtml(opponentName())}</option></select></div>
        <div data-team-player-field><label for="playerOff">Player Off</label>${teamPlayerControl("playerOff", "uwi", "Select player off")}</div>
        <div data-team-player-field><label for="playerOn">Player On</label>${teamPlayerControl("playerOn", "uwi", "Select player on")}</div>
        <div><label for="subReason">Reason</label><input class="input" id="subReason" type="text" placeholder="Tactical, injury, half-time, etc."/></div>
      </div>`;
    document.getElementById("subTeam").addEventListener("change", syncTeamPlayerControls);
  }

  function renderTeamStatFields(preselectedStat) {
    els.eventFields.innerHTML = `
      <div class="live-event-grid">
        <div><label for="statTeam">Team</label><select class="select" id="statTeam"><option value="uwi">${escapeHtml(getUwiTeamName())}</option><option value="opponent">${escapeHtml(opponentName())}</option></select></div>
        <div><label for="teamStatType">Team Stat</label><select class="select" id="teamStatType">${TEAM_STATS.map(([value, label]) => `<option value="${value}" ${value === preselectedStat ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div><label for="statAmount">Amount</label><input class="input" id="statAmount" type="number" min="1" value="1"/></div>
      </div>`;
  }

  function renderPlayerStatFields(preselectedStat) {
    els.eventFields.innerHTML = `
      <div class="live-event-grid">
        <div><label for="playerStatPlayer">UWI Player</label>${teamPlayerControl("playerStatPlayer", "uwi", "Select player")}</div>
        <div><label for="playerStatType">Player Stat</label><select class="select" id="playerStatType">${PLAYER_STATS.map(([value, label]) => `<option value="${value}" ${value === preselectedStat ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div><label for="playerStatAmount">Amount</label><input class="input" id="playerStatAmount" type="number" min="1" value="1"/></div>
      </div>`;
  }

  function renderShootoutFields() {
    els.eventFields.innerHTML = `
      <div class="live-event-grid">
        <div><label for="shootoutTeam">Team</label><select class="select" id="shootoutTeam" data-live-team><option value="uwi">${escapeHtml(getUwiTeamName())}</option><option value="opponent">${escapeHtml(opponentName())}</option></select></div>
        <div data-team-player-field><label for="shootoutTaker">Taker</label>${teamPlayerControl("shootoutTaker", "uwi", "Select taker")}</div>
        <div><label for="shootoutOutcome">Outcome</label><select class="select" id="shootoutOutcome"><option value="scored">Scored</option><option value="saved">Saved</option><option value="missed">Missed / off target</option><option value="woodwork">Woodwork</option><option value="retaken">Retaken</option></select></div>
      </div>`;
    els.period.value = "shootout";
    document.getElementById("shootoutTeam").addEventListener("change", syncTeamPlayerControls);
  }

  function syncTeamPlayerControls(event) {
    const team = event.target.value;
    const container = event.target.closest(".live-event-grid");
    container.querySelectorAll("[data-team-player-field]").forEach((field) => {
      const label = field.querySelector("label")?.textContent || "Player";
      const id = controlPrefix(field.querySelector("select,input")?.id || "eventPlayer");
      const optional = id.includes("assist");
      field.innerHTML = `<label for="${escapeHtml(id)}">${escapeHtml(label)}</label>${teamPlayerControl(id, team, optional ? "No assist / not recorded" : "Enter player", optional)}`;
    });
  }

  function syncGoalTypeControls() {
    const scoringTeam = valueOf("goalTeam") || "uwi";
    const goalType = document.getElementById("goalType")?.value || "";
    const scorerTeam = goalType === "own-goal" ? otherTeam(scoringTeam) : scoringTeam;
    const scorerField = document.getElementById("goalPlayerField");
    const assistField = document.getElementById("assistPlayerField");
    if (scorerField) {
      const label = goalType === "own-goal" ? "Own Goal Player" : "Scorer";
      const helper = goalType === "unknown" ? "Unknown scorer" : goalType === "own-goal" ? "Enter own-goal player" : "Select scorer";
      scorerField.innerHTML = `<label for="goalPlayer">${label}</label>${teamPlayerControl("goalPlayer", scorerTeam, helper, goalType === "unknown")}`;
    }
    if (assistField) {
      const disabled = goalType === "own-goal" || goalType === "unknown";
      assistField.innerHTML = `<label for="assistPlayer">Assist</label>${disabled ? `<input class="input" id="assistPlayerName" type="text" disabled placeholder="No assist"/>` : teamPlayerControl("assistPlayer", scoringTeam, "No assist / not recorded", true)}`;
    }
  }

  // Event Capture
  /**
   * Converts form values into a normalized timeline event, then recalculates all
   * derived score-sheet state from the event log.
   */
  function handleEventSubmit(event) {
    event.preventDefault();
    clearScoreMessage();
    const liveEvent = readEvent();
    if (!liveEvent.valid) {
      showScoreMessage(liveEvent.message, "error");
      return;
    }
    state.events.push(liveEvent.event);
    resetEventEntry();
    updateLiveDisplay();
  }

  function readEvent() {
    const base = {
      id: APP.cryptoRandomId ? APP.cryptoRandomId() : `${Date.now()}-${Math.random()}`,
      type: els.eventType.value,
      period: els.period.value,
      minute: numberValue("minute"),
      addedTime: numberValue("addedTime"),
      notes: els.notes.value.trim(),
      enteredAt: new Date().toISOString()
    };
    if (!base.type) return invalid("Choose a live event before recording.");
    if (base.type === "goal") return readGoalEvent(base);
    if (base.type === "card") return readCardEvent(base);
    if (base.type === "substitution") return readSubEvent(base);
    if (base.type === "team-stat") return readTeamStatEvent(base);
    if (base.type === "player-stat") return readPlayerStatEvent(base);
    return readShootoutEvent(base);
  }

  function resetEventEntry() {
    els.eventType.value = "";
    els.notes.value = "";
    renderEventFields();
  }

  function toggleEventDetailState(type, preselectedStat) {
    if (els.notesWrap) els.notesWrap.classList.toggle("is-visible", Boolean(type));
    if (els.recordButton) els.recordButton.disabled = !type;
    document.querySelectorAll("[data-quick-event]").forEach((button) => {
      const eventMatches = Boolean(type) && button.dataset.quickEvent === type;
      const statMatches = !button.dataset.quickStat || button.dataset.quickStat === preselectedStat;
      button.classList.toggle("is-active", eventMatches && statMatches);
    });
  }

  function readGoalEvent(base) {
    const team = valueOf("goalTeam");
    const goalType = valueOf("goalType");
    const scorerTeam = goalType === "own-goal" ? otherTeam(team) : team;
    const scorer = goalType === "unknown" ? blankPlayer() : readTeamPlayer("goalPlayer", scorerTeam);
    const assist = readTeamPlayer("assistPlayer", team);
    if (goalType !== "unknown" && !scorer.name) return invalid("Select or enter the goal scorer.");
    if (assist.name && scorer.name && assist.name === scorer.name) return invalid("Scorer and assister must be different.");
    return valid({ ...base, team, goalType, scoringTeam: team, player: scorer, assist });
  }

  function readCardEvent(base) {
    const team = valueOf("cardTeam");
    const player = readTeamPlayer("cardPlayer", team);
    if (!player.name) return invalid("Select or enter the carded player.");
    return valid({ ...base, team, cardType: valueOf("cardType"), player, reason: valueOf("cardReason") });
  }

  function readSubEvent(base) {
    const team = valueOf("subTeam");
    const playerOff = readTeamPlayer("playerOff", team);
    const playerOn = readTeamPlayer("playerOn", team);
    if (!playerOff.name || !playerOn.name) return invalid("Enter both the player off and player on.");
    if (playerOff.name === playerOn.name) return invalid("Player off and player on must be different.");
    return valid({ ...base, team, playerOff, playerOn, reason: valueOf("subReason") });
  }

  function readTeamStatEvent(base) {
    const amount = Math.max(1, numberValue("statAmount") || 1);
    return valid({ ...base, team: valueOf("statTeam"), stat: valueOf("teamStatType"), amount });
  }

  function readPlayerStatEvent(base) {
    const player = readTeamPlayer("playerStatPlayer", "uwi");
    if (!player.name) return invalid("Select the UWI player for this stat.");
    return valid({ ...base, team: "uwi", player, stat: valueOf("playerStatType"), amount: Math.max(1, numberValue("playerStatAmount") || 1) });
  }

  function readShootoutEvent(base) {
    const team = valueOf("shootoutTeam");
    const taker = readTeamPlayer("shootoutTaker", team);
    if (!taker.name) return invalid("Select or enter the penalty taker.");
    return valid({ ...base, team, taker, outcome: valueOf("shootoutOutcome") });
  }

  // Derived Score Sheet
  /**
   * Rebuilds official score-sheet fields from the event log. This event-first
   * model prevents manual score drift during live entry.
   */
  function buildScoreSheetData() {
    const score = createScore();
    const matchStats = createMatchStats();
    const playerStatsMap = createPlayerStatsMap();
    const goals = [];
    const cards = [];
    const substitutions = [];
    const shootout = [];

    state.events.forEach((event) => {
      if (event.type === "goal") applyGoal(event, score, playerStatsMap, matchStats, goals);
      if (event.type === "card") applyCard(event, playerStatsMap, cards);
      if (event.type === "substitution") substitutions.push(event);
      if (event.type === "team-stat") applyTeamStat(event, matchStats);
      if (event.type === "player-stat") applyPlayerStat(event, playerStatsMap, matchStats);
      if (event.type === "shootout") shootout.push(event);
    });
    finishMatchStats(matchStats);

    const playerStats = Array.from(playerStatsMap.values()).map((row, index) => ({
      athleteId: row.athleteId,
      name: row.name,
      number: index + 1,
      shots: row.shots || null,
      shotsOnTarget: row.shotsOnTarget || null,
      assists: row.assists || null,
      goals: row.goals || null,
      goalsConceded: row.goalsConceded || null,
      saves: row.saves || null,
      fouls: row.fouls || null,
      offside: row.offside || null,
      yellowCards: row.yellowCards || null,
      redCards: row.redCards || null,
      minutes: row.minutes || null
    }));

    return {
      score,
      goals,
      cards,
      substitutions,
      shootout,
      playerStats,
      teamTotals: {
        shots: sumPlayerStats(playerStats, "shots"),
        assists: sumPlayerStats(playerStats, "assists"),
        saves: sumPlayerStats(playerStats, "saves"),
        yellowCards: sumPlayerStats(playerStats, "yellowCards"),
        redCards: sumPlayerStats(playerStats, "redCards")
      },
      matchStats
    };
  }

  function applyGoal(event, score, playerStatsMap, matchStats, goals) {
    score[event.scoringTeam][periodScoreKey(event.period)] += 1;
    score[event.scoringTeam].total += 1;
    const scorer = event.player || blankPlayer();
    const assist = event.assist || blankPlayer();
    goals.push({
      minute: eventMinute(event),
      team: event.scoringTeam,
      scorerAthleteId: scorer.athleteId,
      scorerName: event.goalType === "own-goal" ? `${scorer.name || "Own goal"} (own goal)` : scorer.name,
      assistAthleteId: assist.athleteId,
      assistName: assist.name,
      type: event.goalType
    });
    if (event.team === "uwi" && event.goalType !== "own-goal" && event.goalType !== "unknown") {
      incrementPlayer(playerStatsMap, scorer, "goals", 1);
      incrementPlayer(playerStatsMap, scorer, "shots", 1);
      incrementPlayer(playerStatsMap, scorer, "shotsOnTarget", 1);
    }
    if (assist.athleteId) incrementPlayer(playerStatsMap, assist, "assists", 1);
    matchStats[event.scoringTeam].shots += 1;
    matchStats[event.scoringTeam].shotsOnTarget += 1;
  }

  function applyCard(event, playerStatsMap, cards) {
    cards.push(event);
    if (event.player?.athleteId) {
      if (event.cardType === "yellow") incrementPlayer(playerStatsMap, event.player, "yellowCards", 1);
      if (event.cardType === "second-yellow") {
        incrementPlayer(playerStatsMap, event.player, "yellowCards", 1);
        incrementPlayer(playerStatsMap, event.player, "redCards", 1);
      }
      if (event.cardType === "red") incrementPlayer(playerStatsMap, event.player, "redCards", 1);
    }
  }

  function applyTeamStat(event, matchStats) {
    const bucket = matchStats[event.team] || matchStats.uwi;
    bucket[event.stat] = (bucket[event.stat] || 0) + event.amount;
  }

  function applyPlayerStat(event, playerStatsMap, matchStats) {
    incrementPlayer(playerStatsMap, event.player, event.stat, event.amount);
    const key = event.stat === "offside" ? "offsides" : event.stat;
    if (key in matchStats.uwi) matchStats.uwi[key] = (matchStats.uwi[key] || 0) + event.amount;
  }

  function createScore() {
    return {
      uwi: { firstHalf: 0, secondHalf: 0, overtime: 0, total: 0 },
      opponent: { firstHalf: 0, secondHalf: 0, overtime: 0, total: 0 }
    };
  }

  function createMatchStats() {
    const empty = () => ({ shots: 0, shotsOnTarget: 0, fouls: 0, offsides: 0, corners: 0, freeKicks: 0, passesCompletedPct: null, passesAttempted: 0, passesCompleted: 0, crosses: 0, interceptions: 0, tackles: 0, saves: 0 });
    return { uwi: empty(), opponent: empty() };
  }

  function finishMatchStats(matchStats) {
    ["uwi", "opponent"].forEach((team) => {
      const attempted = matchStats[team].passesAttempted || 0;
      const completed = matchStats[team].passesCompleted || 0;
      matchStats[team].passesCompletedPct = attempted ? Math.round((completed / attempted) * 100) : null;
    });
  }

  function createPlayerStatsMap() {
    const map = new Map();
    selectedSquadAthletes().forEach((athlete) => {
      map.set(String(athlete.id), {
        athleteId: athlete.id,
        name: displayName(athlete),
        shots: 0,
        shotsOnTarget: 0,
        assists: 0,
        goals: 0,
        goalsConceded: 0,
        saves: 0,
        fouls: 0,
        offside: 0,
        yellowCards: 0,
        redCards: 0,
        minutes: null
      });
    });
    return map;
  }

  function incrementPlayer(map, player, field, amount) {
    if (!player?.athleteId) return;
    if (!map.has(String(player.athleteId))) {
      map.set(String(player.athleteId), { athleteId: player.athleteId, name: player.name || "Player" });
    }
    const row = map.get(String(player.athleteId));
    row[field] = (row[field] || 0) + amount;
  }

  // Display
  /**
   * Renders the derived live score, summary tiles, and event timeline from the
   * current event log without persisting provisional data.
   */
  function updateLiveDisplay() {
    const data = buildScoreSheetData();
    els.uwiTeamLabel.textContent = `${getUwiTeamName()} v ${opponentName()}`;
    els.score.textContent = `${data.score.uwi.total}-${data.score.opponent.total}`;
    els.periodText.textContent = `${PERIOD_LABELS[els.period.value] || "Match"} • ${els.status.value}`;
    const recent = state.events[state.events.length - 1];
    els.recentEvent.textContent = recent ? eventSummary(recent) : "No events yet";
    els.eventCount.textContent = `${state.events.length} event${state.events.length === 1 ? "" : "s"} recorded`;
    renderSummary(data);
    renderTimeline();
    saveLiveDraft();
  }

  function renderSummary(data) {
    els.summary.innerHTML = `
      <div class="football-live-summary-grid">
        <div><span>Score</span><strong>${escapeHtml(getUwiTeamName())} ${data.score.uwi.total}-${data.score.opponent.total} ${escapeHtml(opponentName())}</strong></div>
        <div><span>Goals</span><strong>${data.goals.length}</strong></div>
        <div><span>Cards</span><strong>${data.cards.length}</strong></div>
        <div><span>Substitutions</span><strong>${data.substitutions.length}</strong></div>
        <div><span>UWI Shots</span><strong>${data.matchStats.uwi.shots || 0} (${data.matchStats.uwi.shotsOnTarget || 0} OT)</strong></div>
        <div><span>Opponent Shots</span><strong>${data.matchStats.opponent.shots || 0} (${data.matchStats.opponent.shotsOnTarget || 0} OT)</strong></div>
        <div><span>UWI Cards</span><strong>${data.teamTotals.yellowCards || 0}Y / ${data.teamTotals.redCards || 0}R</strong></div>
        <div><span>Shootout</span><strong>${shootoutScore(data.shootout)}</strong></div>
      </div>`;
  }

  function renderTimeline() {
    els.timeline.innerHTML = `<div class="timeline-list">${state.events.slice().reverse().map((event) => `
      <div class="timeline-event"><strong>${escapeHtml(eventTimeLabel(event))}</strong> ${escapeHtml(eventSummary(event))}${event.notes ? `<br><span>${escapeHtml(event.notes)}</span>` : ""}</div>
    `).join("") || `<div class="empty-state">No live events have been recorded yet.</div>`}</div>`;
  }

  // Save Workflow
  /**
   * Creates the existing football score-sheet stat line. Current score cards and
   * reports can read this immediately because the canonical keys are preserved.
   */
  async function saveScoreSheet() {
    clearScoreMessage();
    if (!els.teamSelect.value) {
      showScoreMessage("Select a UWI football team before saving.", "error");
      return;
    }
    const data = buildScoreSheetData();
    if (!state.events.length) {
      showScoreMessage("Record at least one live event before saving.", "error");
      return;
    }
    if (!window.confirm("Complete live scoring and save this as the official USH football score sheet?")) return;

    const payload = {
      competitionId,
      sport: "football",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Football live score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim() || "Football live score sheet",
        location: els.location.value.trim(),
        result: deriveResult(data),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        status: els.status.value,
        score: data.score,
        squad: selectedSquadAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        playerStats: data.playerStats,
        goals: data.goals,
        cards: data.cards,
        substitutions: data.substitutions,
        shootout: data.shootout,
        teamTotals: data.teamTotals,
        matchStats: data.matchStats,
        liveEvents: state.events,
        sourceMode: "live-scoring"
      },
      verified: true,
      source: "football-live-scoring"
    };

    try {
      const saved = await APP.apiPost("/competition-stat-lines", payload);
      const row = saved?.data || saved;
      APP.clearScoringDraft(liveDraftKey());
      showScoreMessage("Football live score sheet saved successfully.", "success");
      if (row?.id) window.location.href = `football-scorecard-view.html?scorecardId=${encodeURIComponent(row.id)}`;
    } catch (error) {
      showScoreMessage(error?.message || "Football live score sheet could not be saved.", "error");
    }
  }

  function undoLastEvent() {
    if (!state.events.length) {
      showScoreMessage("There is no event to undo.", "error");
      return;
    }
    state.events.pop();
    updateLiveDisplay();
  }

  // Helpers
  function teamPlayerControl(prefix, team, label, optional = false) {
    if (team === "uwi") {
      return `<select class="select" id="${prefix}AthleteId"><option value="">${escapeHtml(label)}</option>${selectedSquadAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
    }
    return `<input class="input" id="${prefix}Name" type="text" placeholder="${escapeHtml(optional ? label : `${opponentName()} player`)}"/>`;
  }

  function controlPrefix(id) {
    return String(id || "").replace(/AthleteId$/, "").replace(/Name$/, "");
  }

  function readTeamPlayer(prefix, team) {
    if (team === "uwi") {
      const athleteId = valueOf(`${prefix}AthleteId`);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      return athleteId ? { athleteId, name: displayName(athlete), team: "uwi" } : blankPlayer();
    }
    return { athleteId: null, name: valueOf(`${prefix}Name`), team: "opponent" };
  }

  function blankPlayer() {
    return { athleteId: null, name: "", team: "" };
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "football"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function selectedSquadAthletes() {
    const ids = Array.from(document.querySelectorAll("[data-squad-select]")).map((select) => select.value).filter(Boolean);
    return ids.map((id) => state.athletes.find((athlete) => String(athlete.id) === String(id))).filter(Boolean);
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Team";
  }

  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
  }

  function otherTeam(team) {
    return team === "uwi" ? "opponent" : "uwi";
  }

  function periodScoreKey(period) {
    if (period === "firstHalf") return "firstHalf";
    if (period === "secondHalf") return "secondHalf";
    return "overtime";
  }

  function eventMinute(event) {
    const base = Number.isFinite(event.minute) ? event.minute : 0;
    return event.addedTime ? `${base}+${event.addedTime}` : base;
  }

  function eventTimeLabel(event) {
    return `${PERIOD_LABELS[event.period] || "Match"} ${eventMinute(event)}'`;
  }

  function eventSummary(event) {
    if (event.type === "goal") return `${teamName(event.scoringTeam)} goal - ${event.player?.name || "Unknown scorer"}${event.assist?.name ? `, assist ${event.assist.name}` : ""}`;
    if (event.type === "card") return `${CARD_TYPES.find(([value]) => value === event.cardType)?.[1] || "Card"} - ${event.player?.name || teamName(event.team)}`;
    if (event.type === "substitution") return `${teamName(event.team)} substitution - ${event.playerOn?.name || "Player on"} for ${event.playerOff?.name || "Player off"}`;
    if (event.type === "team-stat") return `${teamName(event.team)} ${statLabel(TEAM_STATS, event.stat)} +${event.amount}`;
    if (event.type === "player-stat") return `${event.player?.name || "Player"} ${statLabel(PLAYER_STATS, event.stat)} +${event.amount}`;
    return `${teamName(event.team)} shootout ${event.outcome} - ${event.taker?.name || "Taker"}`;
  }

  function teamName(team) {
    return team === "uwi" ? getUwiTeamName() : opponentName();
  }

  function statLabel(list, stat) {
    return list.find(([value]) => value === stat)?.[1] || stat;
  }

  function deriveResult(data) {
    const shootout = shootoutScore(data.shootout);
    if (els.status.value === "abandoned") return `Abandoned at ${data.score.uwi.total}-${data.score.opponent.total}`;
    if (data.score.uwi.total > data.score.opponent.total) return `${getUwiTeamName()} won ${data.score.uwi.total}-${data.score.opponent.total}`;
    if (data.score.opponent.total > data.score.uwi.total) return `${opponentName()} won ${data.score.opponent.total}-${data.score.uwi.total}`;
    if (shootout !== "0-0") return `Draw ${data.score.uwi.total}-${data.score.opponent.total}, ${shootout} on penalties`;
    return `Draw ${data.score.uwi.total}-${data.score.opponent.total}`;
  }

  function shootoutScore(events) {
    const uwi = events.filter((event) => event.team === "uwi" && event.outcome === "scored").length;
    const opponent = events.filter((event) => event.team === "opponent" && event.outcome === "scored").length;
    return `${uwi}-${opponent}`;
  }

  function sumPlayerStats(rows, field) {
    return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
  }

  function valid(event) {
    return { valid: true, event };
  }

  function invalid(message) {
    return { valid: false, message };
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

  function formatDateInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.teams)) return payload.teams;
    if (Array.isArray(payload?.athletes)) return payload.athletes;
    if (Array.isArray(payload?.data?.teams)) return payload.data.teams;
    if (Array.isArray(payload?.data?.athletes)) return payload.data.athletes;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    return [];
  }

  function displayName(athlete) {
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function showPageError(text) {
    els.pageMessage.className = "message error is-visible";
    els.pageMessage.textContent = text;
  }

  function showScoreMessage(text, type) {
    els.message.className = `message ${type || "success"} is-visible`;
    els.message.textContent = text;
  }

  function clearScoreMessage() {
    els.message.className = "message";
    els.message.textContent = "";
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
