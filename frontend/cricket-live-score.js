(function () {
  "use strict";

  // Shared App Access
  /**
   * Cricket live-scoring engine.
   *
   * This page records ball-by-ball match state, then serializes the completed
   * innings into the same `competitionStatLine.statData.innings` structure used
   * by the normal cricket scorecard page. Keeping the final payload identical is
   * what lets live-scored matches propagate into competition views, team views,
   * athlete reports, leaderboards, and aggregate reports without a separate API.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";

  // Cricket Rules
  const DISMISSAL_LABELS = {
    bowled: "Bowled",
    caught: "Caught",
    "caught-and-bowled": "Caught and bowled",
    lbw: "LBW",
    "run-out": "Run out",
    stumped: "Stumped",
    "hit-wicket": "Hit wicket",
    "obstructing-the-field": "Obstructing the field",
    "hit-the-ball-twice": "Hit the ball twice",
    "timed-out": "Timed out",
    "retired-out": "Retired out",
    "retired-hurt": "Retired hurt"
  };
  const WICKET_DISMISSALS = new Set(["bowled", "caught", "caught-and-bowled", "lbw", "run-out", "stumped", "hit-wicket", "obstructing-the-field", "hit-the-ball-twice", "timed-out", "retired-out"]);
  const BATTER_LEAVES_EVENTS = new Set([...WICKET_DISMISSALS, "retired-hurt"]);
  const BOWLER_CREDIT_DISMISSALS = new Set(["bowled", "caught", "caught-and-bowled", "lbw", "stumped", "hit-wicket"]);
  const FIELDING_DISMISSALS = new Set(["caught", "caught-and-bowled", "run-out", "stumped"]);
  const NON_LEGAL_EXTRAS = new Set(["wide", "no-ball", "penalty"]);
  const NON_DELIVERY_EVENTS = new Set(["timed-out", "retired-out", "retired-hurt"]);
  const BOWLER_CHARGED_EXTRAS = new Set(["wide", "no-ball"]);
  const EXTRA_LABELS = { wide: "wd", "no-ball": "nb", bye: "b", "leg-bye": "lb", penalty: "pen" };
  const EXTRA_WICKET_RULES = {
    wide: new Set(["", "run-out", "stumped", "hit-wicket", "obstructing-the-field", "hit-the-ball-twice", "retired-out", "retired-hurt"]),
    "no-ball": new Set(["", "run-out", "obstructing-the-field", "hit-the-ball-twice", "retired-out", "retired-hurt"]),
    bye: new Set(["", "run-out", "stumped", "hit-wicket", "obstructing-the-field", "hit-the-ball-twice", "retired-out", "retired-hurt"]),
    "leg-bye": new Set(["", "run-out", "stumped", "hit-wicket", "obstructing-the-field", "hit-the-ball-twice", "retired-out", "retired-hurt"]),
    penalty: new Set(["", "timed-out", "retired-out", "retired-hurt"])
  };

  // Page State
  const state = {
    session: null,
    competition: null,
    athletes: [],
    teams: [],
    innings: [],
    activeInningsIndex: 0,
    draftControl: null
  };

  // Page Fields
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("liveHeading"),
    subtitle: document.getElementById("liveSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    manualLink: document.getElementById("manualScorecardLink"),
    setupForm: document.getElementById("liveSetupForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("matchTitle"),
    date: document.getElementById("matchDate"),
    venue: document.getElementById("matchVenue"),
    format: document.getElementById("matchFormat"),
    inningsSide: document.getElementById("inningsSide"),
    inningsNumber: document.getElementById("inningsNumber"),
    xiGrid: document.getElementById("startingXiGrid"),
    ballForm: document.getElementById("ballForm"),
    striker: document.getElementById("strikerSelect"),
    nonStriker: document.getElementById("nonStrikerSelect"),
    bowler: document.getElementById("bowlerSelect"),
    runs: document.getElementById("runsInput"),
    extraType: document.getElementById("extraType"),
    extraRuns: document.getElementById("extraRuns"),
    wicketMode: document.getElementById("wicketMode"),
    outBatter: document.getElementById("outBatterSelect"),
    fielder: document.getElementById("fielderSelect"),
    notes: document.getElementById("ballNotes"),
    scoreSide: document.getElementById("scoreSideLabel"),
    scoreTotal: document.getElementById("scoreTotal"),
    scoreOvers: document.getElementById("scoreOvers"),
    runRate: document.getElementById("runRate"),
    target: document.getElementById("targetText"),
    currentOver: document.getElementById("currentOver"),
    recentBalls: document.getElementById("recentBalls"),
    preview: document.getElementById("scorecardPreview"),
    undo: document.getElementById("undoBallButton"),
    endInnings: document.getElementById("endInningsButton"),
    save: document.getElementById("saveScorecardButton"),
    message: document.getElementById("scoreMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Mounts the signed-in shell, loads campus-scoped competition context, and
   * renders the scorer only for cricket competitions.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Cricket Live Scoring" });
    if (!session) return;
    state.session = session;

    if (!competitionId) {
      showPageError("Open live scoring from a cricket competition.");
      return;
    }

    try {
      const [competition, athletes, teams] = await Promise.all([
        APP.apiGet(`/competitions/${encodeURIComponent(competitionId)}`),
        APP.apiGet("/athletes", true),
        APP.apiGet("/teams", true)
      ]);
      state.competition = competition?.data || competition;
      state.athletes = normalizeArray(athletes);
      state.teams = normalizeArray(teams);

      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "cricket") {
        showPageError("Live scoring is currently available for cricket competitions only.");
        return;
      }

      renderPage();
      state.draftControl = APP.registerScoringDraft(liveDraftKey(), document.body, {
        prompt: "Restore the unsaved cricket live scoring draft for this competition?",
        serialize: serializeLiveDraft,
        onRestore: restoreLiveDraft
      });
      bindEvents();
      ensureActiveInnings();
      updateLiveDisplay();
    } catch (error) {
      console.error("Cricket live scoring load error:", error);
      showPageError(error?.message || "Cricket live scoring could not be loaded.");
    }
  }

  // Page Layout
  /**
   * Builds initial controls from backend data. The UWI team controls determine
   * which athlete IDs can be written into scorecard rows later.
   */
  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Cricket Competition";
    els.heading.textContent = `${title} Live Scoring`;
    els.subtitle.textContent = "Record each ball, review the live scorecard, then save the final result into USH.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.manualLink.href = `cricket-scorecard.html?competitionId=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.venue.value = state.competition?.venue || "";
    setFormatFromCompetition();

    const cricketTeams = state.teams.filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "cricket");
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${cricketTeams
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Cricket Team")}</option>`)
      .join("")}`;
    const preferredTeamId = state.competition?.teamId || state.competition?.uwiTeamId || state.competition?.data?.teamId || "";
    els.teamSelect.value = preferredTeamId && cricketTeams.some((team) => String(team.id) === String(preferredTeamId))
      ? String(preferredTeamId)
      : String(cricketTeams[0]?.id || "");
    renderStartingXi();
  }

  // Draft Recovery
  /**
   * Captures both DOM control values and ball-by-ball innings state so live
   * scoring survives page refreshes, browser restarts, and network outages.
   */
  function liveDraftKey() {
    return `cricket-live:${state.session?.id || "session"}:${competitionId}`;
  }

  function serializeLiveDraft() {
    return {
      controls: APP.snapshotFormControls(document.body),
      innings: state.innings,
      activeInningsIndex: state.activeInningsIndex
    };
  }

  function restoreLiveDraft(draft) {
    APP.restoreFormControls(document.body, draft.controls);
    renderStartingXi();
    APP.restoreFormControls(document.body, draft.controls);
    state.innings = Array.isArray(draft.innings) ? draft.innings : [];
    state.activeInningsIndex = Number(draft.activeInningsIndex || 0);
  }

  function saveLiveDraft() {
    if (state.draftControl) state.draftControl.save();
  }

  // Event Wiring
  /**
   * Keeps setup controls, player dropdowns, live calculations, and save actions
   * synchronized without persisting anything until the user completes the match.
   */
  function bindEvents() {
    APP.trackUnsavedChanges(document.body);
    els.teamSelect.addEventListener("change", () => {
      renderStartingXi();
      ensureActiveInnings();
      updateLiveDisplay();
    });
    [els.opponentName, els.inningsSide, els.inningsNumber].forEach((control) => {
      control.addEventListener("change", () => {
        ensureActiveInnings();
        updatePlayerControls();
        updateLiveDisplay();
      });
    });
    els.ballForm.addEventListener("submit", handleBallSubmit);
    els.extraType.addEventListener("change", syncExtraDefault);
    els.wicketMode.addEventListener("change", updateWicketControls);
    els.xiGrid.addEventListener("change", () => {
      ensureActiveInnings();
      updatePlayerControls();
      updateLiveDisplay();
    });
    document.querySelectorAll("[data-quick-run]").forEach((button) => {
      button.addEventListener("click", () => {
        els.runs.value = button.dataset.quickRun || "0";
        els.extraType.value = "";
        els.extraRuns.value = "0";
        updateWicketControls();
      });
    });
    document.querySelectorAll("[data-quick-extra]").forEach((button) => {
      button.addEventListener("click", () => {
        els.extraType.value = button.dataset.quickExtra || "";
        els.runs.value = "0";
        els.extraRuns.value = button.dataset.extraRuns || "1";
        syncExtraDefault();
      });
    });
    document.querySelectorAll("[data-quick-wicket]").forEach((button) => {
      button.addEventListener("click", () => {
        const requested = button.dataset.quickWicket || "run-out";
        els.wicketMode.value = allowedDismissalsForExtra(els.extraType.value).has(requested) ? requested : "run-out";
        updateWicketControls();
      });
    });
    els.undo.addEventListener("click", undoLastBall);
    els.endInnings.addEventListener("click", endCurrentInnings);
    els.save.addEventListener("click", saveScorecard);
  }

  // Starting XI
  /**
   * Renders the UWI player pool used by live batting, bowling, and fielding
   * controls. Opponent players stay manual/generated because USH only owns UWI
   * athlete records.
   */
  function renderStartingXi() {
    const roster = getRosterAthletes();
    els.xiGrid.innerHTML = Array.from({ length: 11 }, (_, index) => {
      const number = index + 1;
      const selected = roster[index]?.id || "";
      return `<div>
        <label for="xi${number}">Player ${number}</label>
        <select class="select" id="xi${number}" data-xi-select>
          <option value="">Select player ${number}</option>
          ${roster.map((athlete) => `<option value="${escapeHtml(athlete.id)}" ${String(athlete.id) === String(selected) ? "selected" : ""}>${escapeHtml(displayName(athlete))}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
  }

  // Innings State
  /**
   * Creates or switches the active innings while preserving already-entered ball
   * events. One saved scorecard can contain up to four innings, matching the
   * manual cricket scorecard workflow.
   */
  function ensureActiveInnings() {
    const inningsNumber = clamp(Number(els.inningsNumber.value) || 1, 1, 4);
    state.activeInningsIndex = inningsNumber - 1;
    if (!state.innings[state.activeInningsIndex]) {
      state.innings[state.activeInningsIndex] = createInnings(inningsNumber, els.inningsSide.value || defaultBattingSide(inningsNumber));
    }
    const innings = getActiveInnings();
    innings.battingSide = els.inningsSide.value || innings.battingSide;
    innings.team = innings.battingSide === "uwi" ? getUwiTeamName() : opponentName();
    updatePlayerControls();
  }

  function createInnings(number, battingSide) {
    return {
      innings: number,
      battingSide,
      team: battingSide === "uwi" ? getUwiTeamName() : opponentName(),
      declared: false,
      balls: [],
      batting: [],
      bowling: [],
      fallOfWickets: []
    };
  }

  function getActiveInnings() {
    return state.innings[state.activeInningsIndex];
  }

  // Player Controls
  /**
   * Rebuilds player selectors when the innings side changes. UWI-side selections
   * carry athlete IDs; opponent-side selections use stable generated labels so
   * scorecards remain readable even when opponent rosters are not stored.
   */
  function updatePlayerControls() {
    const innings = getActiveInnings();
    if (!innings) return;
    const uwiBatting = innings.battingSide === "uwi";
    const battingOptions = uwiBatting ? selectedXiPlayers() : opponentPlayers("Batter");
    const bowlingOptions = uwiBatting ? opponentPlayers("Bowler", 6) : selectedXiPlayers();
    const fieldingOptions = uwiBatting ? opponentPlayers("Fielder") : selectedXiPlayers();

    setSelectOptions(els.striker, battingOptions, innings.currentStrikerId || battingOptions[0]?.value || "");
    setSelectOptions(els.nonStriker, battingOptions, innings.currentNonStrikerId || battingOptions[1]?.value || battingOptions[0]?.value || "");
    setSelectOptions(els.bowler, bowlingOptions, innings.currentBowlerId || bowlingOptions[0]?.value || "");
    setSelectOptions(els.outBatter, [
      { value: "", label: "Select only if wicket falls" },
      ...battingOptions
    ], "");
    setSelectOptions(els.fielder, [
      { value: "", label: "Select fielder / keeper if needed" },
      ...fieldingOptions
    ], "");
    updateWicketControls();
  }

  function setSelectOptions(select, options, selectedValue) {
    const unique = dedupeOptions(options);
    select.innerHTML = unique.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
    if (selectedValue && unique.some((option) => String(option.value) === String(selectedValue))) {
      select.value = selectedValue;
    }
  }

  // Ball Entry
  /**
   * Validates and records one ball. The event is kept granular so undo, innings
   * totals, batting rows, bowling figures, extras, and fall-of-wickets can all
   * be recomputed from the same source.
   */
  function handleBallSubmit(event) {
    event.preventDefault();
    ensureActiveInnings();
    const innings = getActiveInnings();
    if (!innings) return;

    const striker = readSelectedPlayer(els.striker);
    const nonStriker = readSelectedPlayer(els.nonStriker);
    const bowler = readSelectedPlayer(els.bowler);
    const wicketMode = els.wicketMode.value;
    const extraType = els.extraType.value;
    const legalBall = !NON_LEGAL_EXTRAS.has(extraType) && !NON_DELIVERY_EVENTS.has(wicketMode);
    const batRuns = clamp(Number(els.runs.value) || 0, 0, 7);
    let extraRuns = Math.max(0, Number(els.extraRuns.value) || 0);

    if (!striker.value || !bowler.value) {
      showScoreMessage("Select the striker and bowler before recording a ball.", "error");
      return;
    }
    if (nonStriker.value && nonStriker.value === striker.value) {
      showScoreMessage("Striker and non-striker must be different players.", "error");
      return;
    }
    if ((extraType === "wide" || extraType === "bye" || extraType === "leg-bye" || extraType === "penalty") && batRuns > 0) {
      showScoreMessage("Bat runs cannot be recorded with wides, byes, leg byes, or penalty runs. Use Extra Runs for those.", "error");
      return;
    }
    if (!extraType && extraRuns > 0) {
      showScoreMessage("Choose the extra type before entering extra runs.", "error");
      return;
    }
    if (NON_DELIVERY_EVENTS.has(wicketMode) && (batRuns > 0 || extraRuns > 0)) {
      showScoreMessage("Timed out and retirement events are recorded between deliveries, so they cannot include ball runs or extras.", "error");
      return;
    }
    if ((extraType === "wide" || extraType === "no-ball") && extraRuns < 1) extraRuns = 1;
    if (extraType === "penalty" && extraRuns < 1) {
      showScoreMessage("Enter the penalty runs before recording the event.", "error");
      return;
    }
    if (wicketMode && !allowedDismissalsForExtra(extraType).has(wicketMode)) {
      showScoreMessage(invalidWicketMessage(extraType, wicketMode), "error");
      return;
    }
    if (wicketMode && BATTER_LEAVES_EVENTS.has(wicketMode) && !els.outBatter.value) {
      showScoreMessage("Select the batter involved in the wicket or retirement event.", "error");
      return;
    }

    const ball = {
      striker,
      nonStriker,
      bowler,
      fielder: readSelectedPlayer(els.fielder),
      batRuns,
      extraType,
      extraRuns,
      legalBall,
      wicketMode,
      outBatter: readSelectedPlayer(els.outBatter),
      notes: els.notes.value.trim(),
      overBall: nextBallLabel(innings)
    };
    innings.balls.push(ball);
    applyStrikeForNextBall(innings, ball);
    resetBallForm();
    recomputeInnings(innings);
    updateLiveDisplay();
  }

  function applyStrikeForNextBall(innings, ball) {
    let strikerId = ball.striker.value;
    let nonStrikerId = ball.nonStriker.value;
    if (BATTER_LEAVES_EVENTS.has(ball.wicketMode) && ball.outBatter?.value === strikerId) {
      strikerId = nextAvailableBatter(innings, [nonStrikerId]);
    }
    if (BATTER_LEAVES_EVENTS.has(ball.wicketMode) && ball.outBatter?.value === nonStrikerId) {
      nonStrikerId = nextAvailableBatter(innings, [strikerId]);
    }

    const completedOver = ball.legalBall && legalBallsInCurrentOver(innings) === 6;
    const rotateForRuns = runsForStrikeRotation(ball) % 2 === 1;
    if (rotateForRuns || completedOver) {
      [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
    }
    innings.currentStrikerId = strikerId;
    innings.currentNonStrikerId = nonStrikerId;
    innings.currentBowlerId = completedOver ? "" : ball.bowler.value;
  }

  // Score Calculations
  /**
   * Rebuilds scorecard rows from ball events. This keeps the live preview and
   * saved payload consistent after undo, wicket correction, or innings changes.
   */
  function recomputeInnings(innings) {
    const batting = new Map();
    const bowling = new Map();
    const extras = { wide: 0, "no-ball": 0, bye: 0, "leg-bye": 0, penalty: 0 };
    let total = 0;
    let wickets = 0;
    let legalBalls = 0;
    innings.fallOfWickets = [];

    innings.balls.forEach((ball) => {
      const batter = ensureBattingRow(batting, ball.striker);
      const bowler = ensureBowlingRow(bowling, ball.bowler);
      const extraRuns = ball.extraRuns || 0;
      const teamRuns = ball.batRuns + extraRuns;
      const bowlerRuns = ball.batRuns + (BOWLER_CHARGED_EXTRAS.has(ball.extraType) ? extraRuns : 0);
      total += teamRuns;
      batter.runs += ball.batRuns;
      batter.fours += ball.batRuns === 4 ? 1 : 0;
      batter.sixes += ball.batRuns === 6 ? 1 : 0;
      if (ball.legalBall) {
        batter.balls += 1;
        bowler.balls += 1;
        legalBalls += 1;
      }
      if (ball.extraType) extras[ball.extraType] += extraRuns;
      bowler.runs += bowlerRuns;

      if (ball.wicketMode && BATTER_LEAVES_EVENTS.has(ball.wicketMode)) {
        if (WICKET_DISMISSALS.has(ball.wicketMode)) wickets += 1;
        const out = ball.outBatter?.value ? ensureBattingRow(batting, ball.outBatter) : batter;
        out.dismissalMode = ball.wicketMode;
        out.dismissalLabel = DISMISSAL_LABELS[ball.wicketMode] || "";
        out.bowlerAthleteId = bowlerGetsWicketCredit(ball) ? ball.bowler.athleteId : null;
        out.bowlerName = bowlerGetsWicketCredit(ball) ? ball.bowler.label : "";
        out.fielderAthleteId = FIELDING_DISMISSALS.has(ball.wicketMode) ? ball.fielder.athleteId : null;
        out.fielderName = FIELDING_DISMISSALS.has(ball.wicketMode) ? ball.fielder.label : "";
        if (bowlerGetsWicketCredit(ball)) bowler.wickets += 1;
        if (WICKET_DISMISSALS.has(ball.wicketMode)) innings.fallOfWickets.push(`${wickets}-${total} (${out.name})`);
      }
    });

    innings.total = total;
    innings.wickets = wickets;
    innings.overs = ballsToOvers(legalBalls);
    innings.runRate = legalBalls ? (total / (legalBalls / 6)).toFixed(2) : "";
    innings.extrasRuns = Object.values(extras).reduce((sum, value) => sum + value, 0);
    innings.extras = formatExtras(extras);
    innings.target = deriveTarget(innings.innings);
    innings.batting = Array.from(batting.values()).map(finalizeBattingRow);
    innings.bowling = Array.from(bowling.values()).map(finalizeBowlingRow);
    innings.didNotBat = innings.battingSide === "uwi" ? deriveDidNotBat(innings) : [];
  }

  function ensureBattingRow(map, player) {
    const key = player.value || player.label;
    if (!map.has(key)) {
      map.set(key, {
        athleteId: player.athleteId,
        name: player.label,
        side: player.side,
        role: "batter",
        dismissalMode: "",
        dismissalLabel: "",
        bowlerAthleteId: null,
        bowlerName: "",
        fielderAthleteId: null,
        fielderName: "",
        runs: 0,
        minutes: null,
        balls: 0,
        fours: 0,
        sixes: 0
      });
    }
    return map.get(key);
  }

  function ensureBowlingRow(map, player) {
    const key = player.value || player.label;
    if (!map.has(key)) {
      map.set(key, {
        athleteId: player.athleteId,
        name: player.label,
        side: player.side,
        role: "bowler",
        balls: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        notes: ""
      });
    }
    return map.get(key);
  }

  function finalizeBattingRow(row) {
    const notOut = !row.dismissalMode;
    return {
      ...row,
      dismissalLabel: notOut ? "not out" : row.dismissalLabel,
      strikeRate: row.balls ? ((row.runs / row.balls) * 100).toFixed(2) : ""
    };
  }

  function finalizeBowlingRow(row) {
    return {
      ...row,
      overs: ballsToOvers(row.balls),
      economy: row.balls ? (row.runs / (row.balls / 6)).toFixed(2) : ""
    };
  }

  // Live Display
  /**
   * Renders scoreboard and preview from recomputed innings state without saving
   * partial records to the backend.
   */
  function updateLiveDisplay() {
    state.innings.filter(Boolean).forEach(recomputeInnings);
    const innings = getActiveInnings();
    if (!innings) return;
    els.scoreSide.textContent = `${innings.team || "Batting"} innings`;
    els.scoreTotal.textContent = `${innings.total || 0}/${innings.wickets || 0}`;
    els.scoreOvers.textContent = `${innings.overs || "0.0"} overs`;
    els.runRate.textContent = innings.runRate || "0.00";
    els.target.textContent = innings.target ? `Target ${innings.target}` : "No target";
    const overBalls = currentOverEvents(innings).map(ballDisplay);
    els.currentOver.innerHTML = overBalls.length ? `<span class="live-ball-list">${overBalls.map((value) => `<span class="live-ball-pill">${escapeHtml(value)}</span>`).join("")}</span>` : "-";
    els.recentBalls.textContent = innings.balls.length ? `${innings.balls.length} balls recorded` : "No balls yet";
    renderPreview();
    updatePlayerControls();
    saveLiveDraft();
  }

  function renderPreview() {
    const inningsList = state.innings.filter(Boolean);
    els.preview.innerHTML = inningsList.map((innings) => `
      <section class="cricket-entry-section">
        <div class="cricket-entry-head">
          <div><h2>${escapeHtml(innings.team || `Innings ${innings.innings}`)}</h2><p>${escapeHtml(formatScore(innings))}${innings.runRate ? ` • RR ${escapeHtml(innings.runRate)}` : ""}${innings.target ? ` • Target ${escapeHtml(innings.target)}` : ""}</p></div>
        </div>
        <div class="live-innings-summary">
          <div><span>Extras</span><strong>${escapeHtml(innings.extras || "0")}</strong></div>
          <div><span>Total</span><strong>${escapeHtml(innings.total ?? 0)}</strong></div>
          <div><span>Wickets</span><strong>${escapeHtml(innings.wickets ?? 0)}</strong></div>
          <div><span>Overs</span><strong>${escapeHtml(innings.overs || "0.0")}</strong></div>
        </div>
        <div class="scorecard-table-wrap">
          <table class="scorecard-table batting-table">
            <thead><tr><th>Batter</th><th>Dismissal</th><th>Bowler</th><th>Fielder / Keeper</th><th>R</th><th>M</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
            <tbody>${(innings.batting || []).map(renderBattingRow).join("") || `<tr><td colspan="10">No batting recorded yet.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="scorecard-table-wrap">
          <table class="scorecard-table">
            <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Notes</th></tr></thead>
            <tbody>${(innings.bowling || []).map(renderBowlingRow).join("") || `<tr><td colspan="7">No bowling recorded yet.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `).join("") || `<div class="empty-state">Start scoring to build the live scorecard preview.</div>`;
  }

  function renderBattingRow(row) {
    return `<tr><td>${escapeHtml(row.name || "")}</td><td>${escapeHtml(row.dismissalLabel || "")}</td><td>${escapeHtml(row.bowlerName || "")}</td><td>${escapeHtml(row.fielderName || "")}</td><td>${escapeHtml(row.runs ?? "")}</td><td>${escapeHtml(row.minutes ?? "")}</td><td>${escapeHtml(row.balls ?? "")}</td><td>${escapeHtml(row.fours ?? "")}</td><td>${escapeHtml(row.sixes ?? "")}</td><td>${escapeHtml(row.strikeRate || "")}</td></tr>`;
  }

  function renderBowlingRow(row) {
    return `<tr><td>${escapeHtml(row.name || "")}</td><td>${escapeHtml(row.overs || "")}</td><td>${escapeHtml(row.maidens ?? "")}</td><td>${escapeHtml(row.runs ?? "")}</td><td>${escapeHtml(row.wickets ?? "")}</td><td>${escapeHtml(row.economy || "")}</td><td>${escapeHtml(row.notes || "")}</td></tr>`;
  }

  // Completion Workflow
  /**
   * Serializes live innings into the existing cricket scorecard payload and
   * creates a verified competition stat line when the user confirms the match is
   * complete.
   */
  async function saveScorecard() {
    clearScoreMessage();
    state.innings.filter(Boolean).forEach(recomputeInnings);
    const innings = state.innings.filter((item) => item && item.balls.length);
    if (!innings.length) {
      showScoreMessage("Record at least one ball before saving the live scorecard.", "error");
      return;
    }
    if (!els.teamSelect.value) {
      showScoreMessage("Select the UWI team before saving.", "error");
      return;
    }
    if (!window.confirm("Complete live scoring and save this as the official USH cricket scorecard?")) return;

    const result = deriveResult();
    const payload = {
      competitionId,
      sport: "cricket",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Cricket live scorecard",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim() || "Cricket live scorecard",
        venue: els.venue.value.trim(),
        result,
        inningsCount: innings.length,
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        format: els.format.value,
        sourceMode: "live-scoring",
        startingXi: selectedXiPlayers().map((player) => ({ athleteId: player.athleteId, name: player.label })),
        innings: innings.map((item) => ({
          innings: item.innings,
          battingSide: item.battingSide,
          team: item.team,
          overs: item.overs,
          declared: item.declared,
          target: item.target,
          runRate: item.runRate,
          extras: item.extras,
          extrasRuns: item.extrasRuns,
          total: item.total,
          wickets: item.wickets,
          didNotBat: item.didNotBat,
          fallOfWickets: item.fallOfWickets,
          batting: item.batting,
          bowling: item.bowling
        }))
      },
      verified: true,
      source: "cricket-live-scoring"
    };

    try {
      const saved = await APP.apiPost("/competition-stat-lines", payload);
      const row = saved?.data || saved;
      APP.clearScoringDraft(liveDraftKey());
      showScoreMessage("Live scorecard saved successfully.", "success");
      if (row?.id) {
        window.location.href = `cricket-scorecard-view.html?scorecardId=${encodeURIComponent(row.id)}`;
      }
    } catch (error) {
      showScoreMessage(error?.message || "Live scorecard could not be saved.", "error");
    }
  }

  function endCurrentInnings() {
    const innings = getActiveInnings();
    if (!innings) return;
    innings.declared = innings.wickets < 10;
    recomputeInnings(innings);
    const next = Math.min(4, innings.innings + 1);
    els.inningsNumber.value = String(next);
    els.inningsSide.value = innings.battingSide === "uwi" ? "opponent" : "uwi";
    ensureActiveInnings();
    updateLiveDisplay();
    showScoreMessage("Innings ended. The next innings is ready to score.", "success");
  }

  function undoLastBall() {
    const innings = getActiveInnings();
    if (!innings || !innings.balls.length) {
      showScoreMessage("There is no ball to undo in this innings.", "error");
      return;
    }
    innings.balls.pop();
    recomputeInnings(innings);
    const last = innings.balls[innings.balls.length - 1];
    innings.currentStrikerId = last?.striker?.value || "";
    innings.currentNonStrikerId = last?.nonStriker?.value || "";
    innings.currentBowlerId = last?.bowler?.value || "";
    updateLiveDisplay();
  }

  // Helpers
  function selectedXiPlayers() {
    return Array.from(document.querySelectorAll("[data-xi-select]"))
      .map((select) => state.athletes.find((athlete) => String(athlete.id) === String(select.value)))
      .filter(Boolean)
      .map((athlete) => ({ value: `uwi:${athlete.id}`, athleteId: athlete.id, label: displayName(athlete), side: "uwi" }));
  }

  function opponentPlayers(role, count = 11) {
    const team = opponentName();
    return Array.from({ length: count }, (_, index) => ({
      value: `opponent:${role.toLowerCase()}:${index + 1}`,
      athleteId: null,
      label: `${team} ${role} ${index + 1}`,
      side: "opponent"
    }));
  }

  function readSelectedPlayer(select) {
    const option = select.selectedOptions[0];
    const value = select.value || "";
    const athleteId = value.startsWith("uwi:") ? value.replace("uwi:", "") : null;
    return {
      value,
      athleteId,
      label: option?.textContent || "",
      side: athleteId ? "uwi" : "opponent"
    };
  }

  function dedupeOptions(options) {
    const seen = new Set();
    return options.filter((option) => {
      if (!option?.value && seen.has("")) return false;
      const key = String(option?.value || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function syncExtraDefault() {
    if ((els.extraType.value === "wide" || els.extraType.value === "no-ball") && Number(els.extraRuns.value || 0) < 1) {
      els.extraRuns.value = "1";
    }
    if ((els.extraType.value === "bye" || els.extraType.value === "leg-bye") && Number(els.extraRuns.value || 0) < 1) {
      els.extraRuns.value = "1";
    }
    if (els.extraType.value === "penalty" && Number(els.extraRuns.value || 0) < 1) {
      els.extraRuns.value = "5";
    }
    if (!els.extraType.value) els.extraRuns.value = "0";
    updateWicketControls();
  }

  function updateWicketControls() {
    const allowed = allowedDismissalsForExtra(els.extraType.value);
    Array.from(els.wicketMode.options).forEach((option) => {
      option.disabled = !allowed.has(option.value);
    });
    if (!allowed.has(els.wicketMode.value)) els.wicketMode.value = "";
    const needsWicket = Boolean(els.wicketMode.value);
    const needsFielder = FIELDING_DISMISSALS.has(els.wicketMode.value);
    els.outBatter.disabled = !needsWicket;
    els.fielder.disabled = !needsFielder;
  }

  function resetBallForm() {
    els.runs.value = "0";
    els.extraType.value = "";
    els.extraRuns.value = "0";
    els.wicketMode.value = "";
    els.outBatter.value = "";
    els.fielder.value = "";
    els.notes.value = "";
    updateWicketControls();
  }

  function legalBallsInCurrentOver(innings) {
    const legal = innings.balls.filter((ball) => ball.legalBall).length;
    return legal % 6 || 6;
  }

  function nextBallLabel(innings) {
    const legal = innings.balls.filter((ball) => ball.legalBall).length;
    return `${Math.floor(legal / 6)}.${legal % 6 + 1}`;
  }

  function ballDisplay(ball) {
    const base = ball.extraType
      ? `${ball.batRuns ? `${ball.batRuns}+` : ""}${ball.extraRuns}${EXTRA_LABELS[ball.extraType] || "ex"}`
      : String(ball.batRuns);
    return ball.wicketMode && WICKET_DISMISSALS.has(ball.wicketMode) ? `${base}+W` : base;
  }

  function currentOverEvents(innings) {
    const events = [];
    let legalBalls = 0;
    for (let index = innings.balls.length - 1; index >= 0; index -= 1) {
      const ball = innings.balls[index];
      events.unshift(ball);
      if (ball.legalBall) legalBalls += 1;
      if (legalBalls === 6) break;
    }
    return events;
  }

  function allowedDismissalsForExtra(extraType) {
    return EXTRA_WICKET_RULES[extraType] || new Set(["", ...Object.keys(DISMISSAL_LABELS)]);
  }

  function invalidWicketMessage(extraType, wicketMode) {
    const extraLabel = extraType ? extraType.replace(/-/g, " ") : "this delivery";
    const wicketLabel = DISMISSAL_LABELS[wicketMode] || "that wicket";
    return `${wicketLabel} is not a valid wicket event with ${extraLabel}. Use run out, stumped where legal, retirement, or another valid dismissal.`;
  }

  function bowlerGetsWicketCredit(ball) {
    if (!BOWLER_CREDIT_DISMISSALS.has(ball.wicketMode)) return false;
    if (ball.extraType === "no-ball") return false;
    if (ball.extraType === "wide") return ball.wicketMode === "stumped" || ball.wicketMode === "hit-wicket";
    return true;
  }

  function runsForStrikeRotation(ball) {
    if (ball.extraType === "wide" || ball.extraType === "no-ball") {
      return ball.batRuns + Math.max(0, (ball.extraRuns || 0) - 1);
    }
    if (ball.extraType === "bye" || ball.extraType === "leg-bye") return ball.extraRuns || 0;
    if (ball.extraType === "penalty") return 0;
    return ball.batRuns || 0;
  }

  function nextAvailableBatter(innings, excludedValues) {
    const excluded = new Set((excludedValues || []).filter(Boolean).map(String));
    const dismissed = new Set(innings.balls
      .filter((ball) => BATTER_LEAVES_EVENTS.has(ball.wicketMode) && ball.outBatter?.value)
      .map((ball) => String(ball.outBatter.value)));
    const appeared = new Set();
    innings.balls.forEach((ball) => {
      if (ball.striker?.value) appeared.add(String(ball.striker.value));
      if (ball.nonStriker?.value) appeared.add(String(ball.nonStriker.value));
    });
    const options = innings.battingSide === "uwi" ? selectedXiPlayers() : opponentPlayers("Batter");
    return options.find((player) => !excluded.has(String(player.value)) && !dismissed.has(String(player.value)) && !appeared.has(String(player.value)))?.value
      || options.find((player) => !excluded.has(String(player.value)) && !dismissed.has(String(player.value)))?.value
      || "";
  }

  function deriveTarget(inningsNumber) {
    if (inningsNumber <= 1) return "";
    const current = state.innings[inningsNumber - 1];
    if (!current) return "";
    const opponentSide = current.battingSide === "uwi" ? "opponent" : "uwi";
    const margin = state.innings.slice(0, inningsNumber - 1).reduce((sum, innings) => {
      if (!innings) return sum;
      return innings.battingSide === opponentSide ? sum + (innings.total || 0) : sum - (innings.total || 0);
    }, 0);
    return margin >= 0 ? String(margin + 1) : "";
  }

  function deriveResult() {
    const uwiTotal = state.innings.filter((innings) => innings?.battingSide === "uwi").reduce((sum, innings) => sum + (innings.total || 0), 0);
    const opponentTotal = state.innings.filter((innings) => innings?.battingSide === "opponent").reduce((sum, innings) => sum + (innings.total || 0), 0);
    const sidesScored = new Set(state.innings.filter((innings) => innings?.balls?.length).map((innings) => innings.battingSide));
    if (!sidesScored.has("uwi") || !sidesScored.has("opponent")) return "Result pending";
    if (uwiTotal === opponentTotal) return "Match tied";
    const winner = uwiTotal > opponentTotal ? getUwiTeamName() : opponentName();
    const margin = Math.abs(uwiTotal - opponentTotal);
    const finalInnings = state.innings.filter(Boolean).at(-1);
    if (finalInnings?.target && (finalInnings.total || 0) >= Number(finalInnings.target)) {
      const wicketsLeft = Math.max(0, 10 - (finalInnings.wickets || 0));
      return `${winner} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    }
    return `${winner} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }

  function deriveDidNotBat(innings) {
    const battedIds = new Set((innings.batting || []).map((row) => row.athleteId).filter(Boolean).map(String));
    return selectedXiPlayers()
      .filter((player) => !battedIds.has(String(player.athleteId)))
      .map((player) => player.label);
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "cricket"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Team";
  }

  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
  }

  function setFormatFromCompetition() {
    const raw = String(state.competition?.format || state.competition?.competitionFormat || "").toLowerCase();
    if (raw.includes("50") || raw.includes("odi")) els.format.value = "ODI";
    else if (raw.includes("10")) els.format.value = "T10";
    else if (raw.includes("two") || raw.includes("3-day") || raw.includes("test")) els.format.value = "Two innings";
    else els.format.value = "T20";
  }

  function defaultBattingSide(index) {
    return index % 2 === 1 ? "uwi" : "opponent";
  }

  function formatExtras(extras) {
    const labels = [
      ["bye", "b"],
      ["leg-bye", "lb"],
      ["wide", "w"],
      ["no-ball", "nb"]
    ];
    return labels.map(([key, label]) => extras[key] ? `${label} ${extras[key]}` : "").filter(Boolean).join(", ") || "0";
  }

  function formatScore(innings) {
    if (!innings) return "";
    return `${innings.total || 0}/${innings.wickets || 0} (${innings.overs || "0.0"} ov)`;
  }

  function ballsToOvers(balls) {
    return `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;
  }

  function formatDateInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function displayName(athlete) {
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
