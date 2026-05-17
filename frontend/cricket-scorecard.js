(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";
  const scorecardId = params.get("scorecardId") || "";

  const DISMISSALS = [
    ["", "Not out / not dismissed"],
    ["bowled", "Bowled"],
    ["caught", "Caught"],
    ["caught-and-bowled", "Caught and bowled"],
    ["lbw", "LBW"],
    ["run-out", "Run out"],
    ["stumped", "Stumped"],
    ["hit-wicket", "Hit wicket"],
    ["retired-hurt", "Retired hurt"],
    ["retired-out", "Retired out"],
    ["obstructing-the-field", "Obstructing the field"],
    ["hit-the-ball-twice", "Hit the ball twice"],
    ["timed-out", "Timed out"],
    ["handled-the-ball", "Handled the ball"]
  ];
  const FIELDING_DISMISSALS = new Set(["caught", "caught-and-bowled", "run-out", "stumped"]);
  const BOWLER_CREDIT_DISMISSALS = new Set(["bowled", "caught", "caught-and-bowled", "lbw", "stumped", "hit-wicket"]);
  const OTHER_PARTY_LABELS = {
    caught: "Fielder",
    "caught-and-bowled": "Bowler / fielder",
    "run-out": "Fielder",
    stumped: "Wicketkeeper"
  };
  const WICKET_DISMISSALS = new Set(["bowled", "caught", "caught-and-bowled", "lbw", "run-out", "stumped", "hit-wicket", "retired-out", "obstructing-the-field", "hit-the-ball-twice", "timed-out", "handled-the-ball"]);
  const INNINGS_END_NOT_OUT = new Set(["", "retired-hurt"]);

  const state = {
    session: null,
    competition: null,
    scorecard: null,
    athletes: [],
    teams: [],
    inningsCount: 2
  };

  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    subtitle: document.getElementById("scorecardSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("cricketScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    inningsCount: document.getElementById("inningsCount"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    venue: document.getElementById("scorecardVenue"),
    result: document.getElementById("scorecardResult"),
    xiGrid: document.getElementById("startingXiGrid"),
    inningsWrap: document.getElementById("inningsWrap"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Cricket Scorecard" });
    if (!session) return;
    state.session = session;

    if (!competitionId) {
      showPageError("Open this page from a cricket competition.");
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
        showPageError("This scorecard workflow is available for cricket competitions.");
        return;
      }

      renderPage();
      if (scorecardId) {
        const scorecard = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
        state.scorecard = scorecard?.data || scorecard;
        applyExistingScorecard();
      }
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      console.error("Cricket scorecard load error:", error);
      showPageError(error?.message || "Cricket scorecard could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Cricket Competition";
    els.heading.textContent = `${title} Scorecard`;
    els.subtitle.textContent = scorecardId
      ? "Editing a saved cricket scorecard. Update missing information, then save changes."
      : "Select the UWI starting XI first. UWI scorecard rows then link directly to those athlete records.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());

    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "cricket")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Cricket Team")}</option>`)
      .join("")}`;

    renderStartingXi();
    renderInningsSet();
  }

  function applyExistingScorecard() {
    const row = state.scorecard || {};
    const data = row.statData || row.data?.statData || {};
    els.teamSelect.value = data.uwiTeamId || row.teamId || "";
    els.opponentName.value = data.opponentName || "";
    els.title.value = data.title || row.eventName || els.title.value;
    els.date.value = formatDateInput(row.date || data.date || els.date.value);
    els.venue.value = data.venue || "";
    state.inningsCount = clamp(Number(data.inningsCount || data.innings?.length || state.inningsCount) || 2, 1, 4);
    els.inningsCount.value = String(state.inningsCount);
    renderStartingXi();
    (data.startingXi || []).slice(0, 11).forEach((player, index) => {
      setValue(`xi${index + 1}`, player.athleteId || "");
    });
    renderInningsSet();
    refreshUwiPlayerOptions();
    (data.innings || []).slice(0, state.inningsCount).forEach((innings, index) => {
      writeInnings(index + 1, innings || {});
    });
    els.result.value = data.result || "";
    updateDerivedFields();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", () => {
      renderStartingXi();
      renderInningsSet();
      updateDerivedFields();
    });
    els.inningsCount.addEventListener("change", () => {
      state.inningsCount = clamp(Number(els.inningsCount.value) || 2, 1, 4);
      renderInningsSet();
      updateDerivedFields();
    });
    els.opponentName.addEventListener("input", updateOpponentLabels);
    els.form.addEventListener("submit", handleSubmit);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-innings-side]")) renderInnings(Number(event.target.dataset.inningsSide));
      if (event.target.matches("[data-xi-select]")) handleXiSelectChange(event.target);
      updateDerivedFields();
    });
  }

  function renderStartingXi() {
    const roster = getRosterAthletes();
    els.xiGrid.innerHTML = Array.from({ length: 11 }, (_, index) => {
      const number = index + 1;
      return `<div>
        <label for="xi${number}">Player ${number}</label>
        <select class="select" id="xi${number}" data-xi-select>
          <option value="">Select player ${number}</option>
          ${roster.map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}
          <option value="__quick_add__">Quick Add New Athlete</option>
        </select>
      </div>`;
    }).join("");
  }

  function renderInningsSet() {
    els.inningsWrap.innerHTML = Array.from({ length: state.inningsCount }, (_, index) => `<section id="innings${index + 1}"></section>`).join("");
    for (let index = 1; index <= state.inningsCount; index += 1) renderInnings(index);
  }

  function renderInnings(index) {
    const container = document.getElementById(`innings${index}`);
    if (!container) return;
    const sideValue = document.getElementById(`innings${index}Side`)?.value || defaultBattingSide(index);
    const uwiBatting = sideValue === "uwi";
    const inningsLabel = `${uwiBatting ? getUwiTeamName() : opponentName()} innings`;

    container.innerHTML = `
      <section class="cricket-entry-section" data-innings="${index}">
        <div class="cricket-entry-head">
          <div><h2>Innings ${index}</h2><p>${inningsLabel}</p></div>
          <div class="cricket-entry-controls">
            <div><label for="innings${index}Side">Batting Side</label><select class="select" id="innings${index}Side" data-innings-side="${index}"><option value="uwi" ${uwiBatting ? "selected" : ""}>UWI Team</option><option value="opponent" ${!uwiBatting ? "selected" : ""}>Opponent</option></select></div>
            <div><label for="innings${index}Overs">Overs</label><input class="input" id="innings${index}Overs" type="text" placeholder="20 / 19.3" data-derived-source/></div>
            <div><label for="innings${index}Target">Target</label><input class="input derived" id="innings${index}Target" type="text" readonly/></div>
            <div><label for="innings${index}RunRate">Run Rate</label><input class="input derived" id="innings${index}RunRate" type="text" readonly/></div>
          </div>
        </div>
        <div class="scorecard-table-wrap">
          <table class="scorecard-table batting-table">
            <thead><tr><th>Batter</th><th>Dismissal</th><th>Bowler</th><th>Fielder / Keeper</th><th>R</th><th>M</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
            <tbody>${Array.from({ length: 11 }, (_, i) => battingRow(index, i + 1, uwiBatting)).join("")}</tbody>
          </table>
        </div>
        <div class="scorecard-totals">
          <div><label for="innings${index}Extras">Extras Detail</label><input class="input" id="innings${index}Extras" type="text" placeholder="lb 4, w 3, nb 1"/></div>
          <div><label for="innings${index}ExtrasRuns">Extras Runs</label><input class="input" id="innings${index}ExtrasRuns" type="number" min="0"/></div>
          <div><label for="innings${index}Total">Total</label><input class="input derived" id="innings${index}Total" type="number" min="0" readonly/></div>
          <div><label for="innings${index}Wickets">Wickets</label><input class="input derived" id="innings${index}Wickets" type="number" min="0" max="10" readonly/></div>
          <div><label for="innings${index}TeamLabel">Team Label</label><input class="input" id="innings${index}TeamLabel" type="text" value="${escapeHtml(uwiBatting ? getUwiTeamName() : opponentName())}"/></div>
        </div>
        <div class="filter-grid scorecard-notes">
          <div><label for="innings${index}DidNotBat">Did Not Bat</label><textarea class="textarea derived" id="innings${index}DidNotBat" readonly></textarea></div>
          <div><label for="innings${index}FallOfWickets">Fall Of Wickets</label><textarea class="textarea" id="innings${index}FallOfWickets" placeholder="e.g. 1-23, 2-30, 3-159"></textarea></div>
        </div>
        <div class="declare-row">
          <label><input id="innings${index}Declared" type="checkbox"/> Innings declared</label>
        </div>
        <div class="scorecard-table-wrap">
          <table class="scorecard-table">
            <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Notes</th></tr></thead>
            <tbody>${Array.from({ length: 11 }, (_, i) => bowlingRow(index, i + 1, !uwiBatting)).join("")}</tbody>
          </table>
        </div>
      </section>`;
  }

  function battingRow(innings, row, uwiPlayer) {
    const id = `i${innings}bat${row}`;
    return `<tr data-batting-row="${id}">
      <td>${playerControl(`${id}Player`, uwiPlayer, opponentPlayerName(row))}</td>
      <td><select class="select" id="${id}Dismissal" data-dismissal-control="${id}">${DISMISSALS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></td>
      <td>${dismissalPartyControl(`${id}Bowler`, !uwiPlayer, opponentBowlerName(row), "Bowler")}</td>
      <td>${fielderControl(`${id}Fielder`, !uwiPlayer, `Opp fielder ${row}`)}</td>
      ${["Runs", "Minutes", "Balls", "Fours", "Sixes"].map((name) => `<td><input class="input" id="${id}${name}" type="number" min="0"/></td>`).join("")}
      <td><input class="input derived" id="${id}StrikeRate" type="text" readonly/></td>
    </tr>`;
  }

  function bowlingRow(innings, row, uwiPlayer) {
    const id = `i${innings}bowl${row}`;
    return `<tr>
      <td>${playerControl(`${id}Player`, uwiPlayer, opponentBowlerName(row))}</td>
      <td><input class="input" id="${id}Overs" type="text"/></td>
      ${["Maidens", "Runs"].map((name) => `<td><input class="input" id="${id}${name}" type="number" min="0"/></td>`).join("")}
      <td><input class="input derived" id="${id}Wickets" type="number" min="0" readonly/></td>
      <td><input class="input derived" id="${id}Economy" type="text" readonly/></td>
      <td><input class="input" id="${id}Notes" type="text"/></td>
    </tr>`;
  }

  function playerControl(id, uwiPlayer, fallback) {
    if (!uwiPlayer) return `<input class="input opponent-name" id="${id}Name" type="text" value="${escapeHtml(fallback)}"/>`;
    return `<select class="select" id="${id}AthleteId" data-uwi-player-control><option value="">Select XI player</option>${selectedXiAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
  }

  function fielderControl(id, uwiFielding, fallback) {
    if (!uwiFielding) return `<input class="input opponent-name" id="${id}Name" type="text" value="${escapeHtml(fallback)}"/>`;
    return `<select class="select" id="${id}AthleteId" data-uwi-player-control><option value="">Select fielder</option>${selectedXiAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
  }

  function dismissalPartyControl(id, uwiFielding, fallback, label) {
    if (!uwiFielding) return `<input class="input opponent-name" id="${id}Name" type="text" value="${escapeHtml(fallback)}"/>`;
    return `<select class="select" id="${id}AthleteId" data-uwi-player-control><option value="">Select ${escapeHtml(label.toLowerCase())}</option>${selectedXiAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
  }

  function updateDerivedFields() {
    for (let index = 1; index <= state.inningsCount; index += 1) {
      updateInningsDerived(index);
    }
    els.result.value = deriveResult();
  }

  function updateInningsDerived(index) {
    const side = valueOf(`innings${index}Side`);
    let battingRuns = 0;
    let wickets = 0;

    for (let row = 1; row <= 11; row += 1) {
      const id = `i${index}bat${row}`;
      const runs = numberValue(`${id}Runs`) || 0;
      const balls = numberValue(`${id}Balls`) || 0;
      const dismissal = valueOf(`${id}Dismissal`);
      battingRuns += runs;
      setValue(`${id}StrikeRate`, balls ? ((runs / balls) * 100).toFixed(2) : "");
      updateDismissalPartyState(id, dismissal);
      if (WICKET_DISMISSALS.has(dismissal)) {
        wickets += 1;
      }
    }

    const extras = numberValue(`innings${index}ExtrasRuns`) || 0;
    const total = battingRuns + extras;
    setValue(`innings${index}Total`, total || "");
    setValue(`innings${index}Wickets`, wickets || "");
    setValue(`innings${index}RunRate`, oversToBalls(valueOf(`innings${index}Overs`)) ? (total / (oversToBalls(valueOf(`innings${index}Overs`)) / 6)).toFixed(2) : "");
    setValue(`innings${index}Target`, deriveTarget(index));
    setValue(`innings${index}DidNotBat`, deriveDidNotBat(index));
    updateBowlingWickets(index);

    for (let row = 1; row <= 11; row += 1) {
      const id = `i${index}bowl${row}`;
      const runs = numberValue(`${id}Runs`) || 0;
      const balls = oversToBalls(valueOf(`${id}Overs`));
      setValue(`${id}Economy`, balls ? (runs / (balls / 6)).toFixed(2) : "");
    }

    setValue(`innings${index}TeamLabel`, side === "uwi" ? getUwiTeamName() : opponentName(), false);
  }

  function deriveTarget(index) {
    if (index <= 1) return "";
    if (state.inningsCount > 2) {
      const currentSide = valueOf(`innings${index}Side`);
      const opponentSide = currentSide === "uwi" ? "opponent" : "uwi";
      const opponentPreviousInnings = Array.from({ length: index - 1 }, (_, i) => valueOf(`innings${i + 1}Side`)).filter((side) => side === opponentSide).length;
      if (opponentPreviousInnings < 2) return "";
    }
    const previousTotals = Array.from({ length: index - 1 }, (_, i) => numberValue(`innings${i + 1}Total`) || 0);
    const currentSide = valueOf(`innings${index}Side`);
    const opponentSide = currentSide === "uwi" ? "opponent" : "uwi";
    const targetBase = previousTotals.reduce((sum, total, i) => {
      const side = valueOf(`innings${i + 1}Side`);
      return side === opponentSide ? sum + total : sum - total;
    }, 0);
    return targetBase >= 0 ? String(targetBase + 1) : "";
  }

  function deriveDidNotBat(index) {
    if (valueOf(`innings${index}Side`) !== "uwi") return "";
    const selected = new Set();
    for (let row = 1; row <= 11; row += 1) {
      const athleteId = valueOf(`i${index}bat${row}PlayerAthleteId`);
      if (athleteId) selected.add(String(athleteId));
    }
    return selectedXiAthletes()
      .filter((athlete) => !selected.has(String(athlete.id)))
      .map(displayName)
      .join(", ");
  }

  function updateBowlingWickets(index) {
    const credits = new Map();
    for (let row = 1; row <= 11; row += 1) {
      const id = `i${index}bat${row}`;
      const mode = valueOf(`${id}Dismissal`);
      if (!BOWLER_CREDIT_DISMISSALS.has(mode)) continue;
      const bowlerAthleteId = valueOf(`${id}BowlerAthleteId`);
      const bowlerName = valueOf(`${id}BowlerName`);
      const key = bowlerAthleteId ? `id:${bowlerAthleteId}` : bowlerName ? `name:${bowlerName.toLowerCase()}` : "";
      if (!key) continue;
      credits.set(key, (credits.get(key) || 0) + 1);
    }
    for (let row = 1; row <= 11; row += 1) {
      const id = `i${index}bowl${row}`;
      const athleteId = valueOf(`${id}PlayerAthleteId`);
      const name = valueOf(`${id}PlayerName`);
      const key = athleteId ? `id:${athleteId}` : name ? `name:${name.toLowerCase()}` : "";
      setValue(`${id}Wickets`, key ? (credits.get(key) || "") : "");
    }
  }

  function deriveResult() {
    const sides = { uwi: 0, opponent: 0 };
    const scoredSides = new Set();
    for (let index = 1; index <= state.inningsCount; index += 1) {
      const side = valueOf(`innings${index}Side`);
      if (!side) continue;
      const total = numberValue(`innings${index}Total`);
      sides[side] += total || 0;
      if (total !== null || oversToBalls(valueOf(`innings${index}Overs`)) > 0) scoredSides.add(side);
    }
    if (!sides.uwi && !sides.opponent) return "";
    if (!scoredSides.has("uwi") || !scoredSides.has("opponent")) return "";
    const uwiInnings = countCompletedInnings("uwi");
    const opponentInnings = countCompletedInnings("opponent");
    if (uwiInnings === 1 && opponentInnings >= 2 && sides.uwi > sides.opponent) {
      const margin = sides.uwi - sides.opponent;
      return `${getUwiTeamName()} won by an innings and ${margin} run${margin === 1 ? "" : "s"}`;
    }
    if (opponentInnings === 1 && uwiInnings >= 2 && sides.opponent > sides.uwi) {
      const margin = sides.opponent - sides.uwi;
      return `${opponentName()} won by an innings and ${margin} run${margin === 1 ? "" : "s"}`;
    }
    const finalSide = valueOf(`innings${state.inningsCount}Side`);
    const finalTarget = numberValue(`innings${state.inningsCount}Target`);
    const finalTotal = numberValue(`innings${state.inningsCount}Total`) || 0;
    if (finalTarget && finalTotal >= finalTarget) {
      const wicketsLeft = Math.max(0, 10 - (numberValue(`innings${state.inningsCount}Wickets`) || 0));
      const winner = finalSide === "uwi" ? getUwiTeamName() : opponentName();
      return `${winner} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    }
    if (sides.uwi === sides.opponent) return "Match tied";
    const winner = sides.uwi > sides.opponent ? getUwiTeamName() : opponentName();
    const margin = Math.abs(sides.uwi - sides.opponent);
    return `${winner} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }

  function countCompletedInnings(side) {
    let count = 0;
    for (let index = 1; index <= state.inningsCount; index += 1) {
      if (valueOf(`innings${index}Side`) !== side) continue;
      const hasScore = numberValue(`innings${index}Total`) !== null || oversToBalls(valueOf(`innings${index}Overs`)) > 0;
      if (hasScore) count += 1;
    }
    return count;
  }

  function updateOpponentLabels() {
    document.querySelectorAll(".opponent-name").forEach((input) => {
      if (input.dataset.edited === "true") return;
      const match = input.id.match(/(?:bat|bowl)(\d+)(?:Player|Bowler|Fielder)Name/);
      const row = match ? Number(match[1]) : 1;
      input.value = input.id.includes("bowl") || input.id.includes("Bowler") ? opponentBowlerName(row) : opponentPlayerName(row);
    });
    updateDerivedFields();
  }

  function refreshUwiPlayerOptions() {
    const options = selectedXiAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("");
    document.querySelectorAll("[data-uwi-player-control]").forEach((select) => {
      const previous = select.value;
      select.innerHTML = `<option value="">Select XI player</option>${options}`;
      select.value = previous;
    });
  }

  function updateDismissalPartyState(id, dismissal) {
    const bowlerSelect = document.getElementById(`${id}BowlerAthleteId`);
    const bowlerInput = document.getElementById(`${id}BowlerName`);
    const fielderSelect = document.getElementById(`${id}FielderAthleteId`);
    const fielderInput = document.getElementById(`${id}FielderName`);
    const needsBowler = BOWLER_CREDIT_DISMISSALS.has(dismissal);
    const needsFielder = FIELDING_DISMISSALS.has(dismissal);
    const fielderLabel = OTHER_PARTY_LABELS[dismissal] || "Fielder";

    [bowlerSelect, bowlerInput].forEach((control) => {
      if (!control) return;
      control.disabled = !needsBowler;
      control.closest("td")?.classList.toggle("muted-control", !needsBowler);
    });
    [fielderSelect, fielderInput].forEach((control) => {
      if (!control) return;
      control.disabled = !needsFielder;
      control.closest("td")?.classList.toggle("muted-control", !needsFielder);
      if (control.tagName === "SELECT") {
        const first = control.querySelector("option");
        if (first) first.textContent = `Select ${fielderLabel.toLowerCase()}`;
      }
    });
    if (dismissal === "caught-and-bowled" && bowlerSelect && fielderSelect && bowlerSelect.value && !fielderSelect.value) {
      fielderSelect.value = bowlerSelect.value;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "cricket")) return;

    const payload = {
      competitionId,
      sport: "cricket",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Cricket scorecard",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        venue: els.venue.value.trim(),
        result: els.result.value.trim(),
        inningsCount: state.inningsCount,
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        startingXi: selectedXiAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        innings: Array.from({ length: state.inningsCount }, (_, index) => readInnings(index + 1))
      },
      verified: true,
      source: "cricket-scorecard"
    };

    try {
      if (scorecardId) {
        await APP.apiPatch(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`, payload);
      } else {
        await APP.apiPost("/competition-stat-lines", payload);
      }
      showSuccess(scorecardId ? "Cricket scorecard updated successfully." : "Cricket scorecard saved successfully.");
    } catch (error) {
      showError(error?.message || "Cricket scorecard could not be saved.");
    }
  }

  function writeInnings(index, innings) {
    const batting = Array.isArray(innings.batting) ? innings.batting : [];
    const bowling = Array.isArray(innings.bowling) ? innings.bowling : [];
    setValue(`innings${index}Side`, innings.battingSide || defaultBattingSide(index));
    renderInnings(index);
    setValue(`innings${index}Overs`, innings.overs);
    setValue(`innings${index}Extras`, innings.extras);
    setValue(`innings${index}ExtrasRuns`, innings.extrasRuns);
    setValue(`innings${index}TeamLabel`, innings.team);
    setValue(`innings${index}FallOfWickets`, Array.isArray(innings.fallOfWickets) ? innings.fallOfWickets.join(", ") : innings.fallOfWickets);
    const declared = document.getElementById(`innings${index}Declared`);
    if (declared) declared.checked = Boolean(innings.declared);
    batting.slice(0, 11).forEach((player, rowIndex) => {
      const id = `i${index}bat${rowIndex + 1}`;
      setPlayerValue(`${id}Player`, player);
      setValue(`${id}Dismissal`, player.dismissalMode || "");
      setPlayerValue(`${id}Bowler`, { athleteId: player.bowlerAthleteId, name: player.bowlerName });
      setPlayerValue(`${id}Fielder`, { athleteId: player.fielderAthleteId, name: player.fielderName });
      setValue(`${id}Runs`, player.runs);
      setValue(`${id}Minutes`, player.minutes);
      setValue(`${id}Balls`, player.balls);
      setValue(`${id}Fours`, player.fours);
      setValue(`${id}Sixes`, player.sixes);
    });
    bowling.slice(0, 11).forEach((player, rowIndex) => {
      const id = `i${index}bowl${rowIndex + 1}`;
      setPlayerValue(`${id}Player`, player);
      setValue(`${id}Overs`, player.overs);
      setValue(`${id}Maidens`, player.maidens);
      setValue(`${id}Runs`, player.runs);
      setValue(`${id}Notes`, player.notes);
    });
  }

  function setPlayerValue(prefix, player) {
    if (document.getElementById(`${prefix}AthleteId`)) {
      setValue(`${prefix}AthleteId`, player?.athleteId || "");
    }
    if (document.getElementById(`${prefix}Name`)) {
      setValue(`${prefix}Name`, player?.name || "");
    }
  }

  function readInnings(index) {
    const side = valueOf(`innings${index}Side`);
    const uwiBatting = side === "uwi";
    return {
      innings: index,
      battingSide: side,
      team: valueOf(`innings${index}TeamLabel`),
      overs: valueOf(`innings${index}Overs`),
      declared: document.getElementById(`innings${index}Declared`)?.checked || false,
      target: valueOf(`innings${index}Target`),
      runRate: valueOf(`innings${index}RunRate`),
      extras: valueOf(`innings${index}Extras`),
      extrasRuns: numberValue(`innings${index}ExtrasRuns`),
      total: numberValue(`innings${index}Total`),
      wickets: numberValue(`innings${index}Wickets`),
      didNotBat: splitList(valueOf(`innings${index}DidNotBat`)),
      fallOfWickets: splitList(valueOf(`innings${index}FallOfWickets`)),
      batting: Array.from({ length: 11 }, (_, i) => readBatting(index, i + 1, uwiBatting)).filter(hasPlayerRow),
      bowling: Array.from({ length: 11 }, (_, i) => readBowling(index, i + 1, !uwiBatting)).filter(hasPlayerRow)
    };
  }

  function readBatting(innings, row, uwiPlayer) {
    const id = `i${innings}bat${row}`;
    const dismissalMode = valueOf(`${id}Dismissal`);
    const fielder = readPlayer(`${id}Fielder`, !uwiPlayer, "fielder");
    const bowler = readPlayer(`${id}Bowler`, !uwiPlayer, "bowler");
    const creditedBowler = BOWLER_CREDIT_DISMISSALS.has(dismissalMode) ? bowler : { athleteId: null, name: "" };
    const creditedFielder = FIELDING_DISMISSALS.has(dismissalMode) ? fielder : { athleteId: null, name: "" };
    return {
      ...readPlayer(`${id}Player`, uwiPlayer, "batter"),
      dismissalMode,
      dismissalLabel: DISMISSALS.find(([value]) => value === dismissalMode)?.[1] || "",
      bowlerAthleteId: creditedBowler.athleteId,
      bowlerName: creditedBowler.name,
      fielderAthleteId: creditedFielder.athleteId,
      fielderName: creditedFielder.name,
      runs: numberValue(`${id}Runs`),
      minutes: numberValue(`${id}Minutes`),
      balls: numberValue(`${id}Balls`),
      fours: numberValue(`${id}Fours`),
      sixes: numberValue(`${id}Sixes`),
      strikeRate: valueOf(`${id}StrikeRate`)
    };
  }

  function readBowling(innings, row, uwiPlayer) {
    const id = `i${innings}bowl${row}`;
    return {
      ...readPlayer(`${id}Player`, uwiPlayer, "bowler"),
      overs: valueOf(`${id}Overs`),
      maidens: numberValue(`${id}Maidens`),
      runs: numberValue(`${id}Runs`),
      wickets: numberValue(`${id}Wickets`),
      economy: valueOf(`${id}Economy`),
      notes: valueOf(`${id}Notes`)
    };
  }

  function readPlayer(prefix, uwiPlayer, role) {
    if (!uwiPlayer) return { athleteId: null, name: valueOf(`${prefix}Name`), side: "opponent", role };
    const athleteId = valueOf(`${prefix}AthleteId`);
    const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
    return { athleteId, name: athleteId ? displayName(athlete) : "", side: "uwi", role };
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "cricket"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function selectedXiAthletes() {
    const ids = Array.from(document.querySelectorAll("[data-xi-select]")).map((select) => select.value).filter((value) => value && value !== "__quick_add__");
    return ids.map((id) => state.athletes.find((athlete) => String(athlete.id) === String(id))).filter(Boolean);
  }

  async function handleXiSelectChange(select) {
    if (select.value !== "__quick_add__") {
      refreshUwiPlayerOptions();
      return;
    }
    const athlete = await APP.quickAddAthleteForTeam({
      teamId: els.teamSelect.value,
      teamName: getUwiTeamName(),
      sportSlug: "cricket"
    });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    renderStartingXi();
    const target = document.getElementById(select.id);
    if (target) target.value = athlete.id;
    refreshUwiPlayerOptions();
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Team";
  }

  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
  }

  function opponentPlayerName(row) {
    return els.opponentName.value.trim() ? `${els.opponentName.value.trim()} ${row}` : `Opp ${row}`;
  }

  function opponentBowlerName(row) {
    return els.opponentName.value.trim() ? `${els.opponentName.value.trim()} Bowler ${row}` : `Opp Bowler ${row}`;
  }

  function defaultBattingSide(index) {
    return index % 2 === 1 ? "uwi" : "opponent";
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function displayName(athlete) {
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function hasPlayerRow(row) {
    return Boolean(row.athleteId || row.runs !== null || row.balls !== null || row.wickets !== null || row.overs || row.dismissalMode);
  }

  function splitList(value) {
    return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  function valueOf(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function setValue(id, value, overwrite = true) {
    const el = document.getElementById(id);
    if (!el) return;
    if (overwrite || !el.value) el.value = value;
  }

  function numberValue(id) {
    const raw = valueOf(id);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function oversToBalls(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    const [oversRaw, ballsRaw = "0"] = raw.split(".");
    const overs = Number(oversRaw) || 0;
    const balls = Number(ballsRaw) || 0;
    return overs * 6 + Math.min(balls, 5);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatDateInput(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  function showPageError(text) {
    els.pageMessage.className = "message error is-visible";
    els.pageMessage.textContent = text;
  }

  function showError(text) {
    els.message.className = "message error is-visible";
    els.message.textContent = text;
  }

  function showSuccess(text) {
    els.message.className = "message success is-visible";
    els.message.textContent = text;
  }

  function clearMessage() {
    els.message.className = "message";
    els.message.textContent = "";
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
