(function () {
  "use strict";

  /**
   * Football score sheet engine.
   *
   * The page links a match squad to athlete IDs, captures team/opponent match
   * stats, and preserves goal events so reports can aggregate both team results
   * and individual contributions.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";
  const scorecardId = params.get("scorecardId") || "";

  const state = {
    session: null,
    competition: null,
    scorecard: null,
    athletes: [],
    teams: []
  };

  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    subtitle: document.getElementById("scorecardSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("footballScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    location: document.getElementById("scorecardLocation"),
    result: document.getElementById("scorecardResult"),
    homeTeamLabel: document.getElementById("homeTeamLabel"),
    squadGrid: document.getElementById("squadGrid"),
    playerRows: document.getElementById("playerRows"),
    goalEvents: document.getElementById("goalEvents"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Football Score Sheet" });
    if (!session) return;
    state.session = session;
    if (!competitionId) {
      showPageError("Open this page from a football competition.");
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
        showPageError("This score sheet workflow is available for football competitions.");
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
      console.error("Football score sheet load error:", error);
      showPageError(error?.message || "Football score sheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Football Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.subtitle.textContent = scorecardId
      ? "Editing a saved football score sheet. Update missing information, then save changes."
      : "Select the UWI match squad first. UWI player stat rows then link directly to athlete records.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "football")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Football Team")}</option>`)
      .join("")}`;
    renderSquad();
    renderPlayerRows();
    renderGoalEvents();
  }

  function applyExistingScorecard() {
    const row = state.scorecard || {};
    const data = row.statData || row.data?.statData || {};
    const score = data.score || {};
    els.teamSelect.value = data.uwiTeamId || row.teamId || "";
    els.opponentName.value = data.opponentName || "";
    els.title.value = data.title || row.eventName || els.title.value;
    els.date.value = formatDateInput(row.date || data.date || els.date.value);
    els.location.value = data.location || "";
    els.homeTeamLabel.value = data.uwiTeamName || getUwiTeamName();
    renderSquad();
    (data.squad || []).slice(0, 18).forEach((player, index) => {
      setValue(`squad${index + 1}`, player.athleteId || "", false);
    });
    renderPlayerRows();
    renderGoalEvents();
    refreshSquadPlayerOptions();
    setValue("homeH1", score.uwi?.firstHalf, false);
    setValue("homeH2", score.uwi?.secondHalf, false);
    setValue("homeOT", score.uwi?.overtime, false);
    setValue("awayH1", score.opponent?.firstHalf, false);
    setValue("awayH2", score.opponent?.secondHalf, false);
    setValue("awayOT", score.opponent?.overtime, false);
    (data.playerStats || []).slice(0, 18).forEach((player, index) => {
      const id = `p${index + 1}`;
      setValue(`${id}Number`, player.number, false);
      setValue(`${id}PlayerAthleteId`, player.athleteId || "", false);
      setValue(`${id}Shots`, player.shots, false);
      setValue(`${id}ShotsOnTarget`, player.shotsOnTarget, false);
      setValue(`${id}Assists`, player.assists, false);
      setValue(`${id}Goals`, player.goals, false);
      setValue(`${id}GoalsConceded`, player.goalsConceded, false);
      setValue(`${id}Saves`, player.saves, false);
      setValue(`${id}Fouls`, player.fouls, false);
      setValue(`${id}Offside`, player.offside, false);
      setValue(`${id}Yellow`, player.yellowCards, false);
      setValue(`${id}Red`, player.redCards, false);
      setValue(`${id}Minutes`, player.minutes, false);
    });
    (data.goals || []).slice(0, 10).forEach((goal, index) => {
      const rowNumber = index + 1;
      setValue(`goal${rowNumber}Minute`, goal.minute, false);
      setValue(`goal${rowNumber}Team`, goal.team || "uwi", false);
      setValue(`goal${rowNumber}ScorerAthleteId`, goal.scorerAthleteId || "", false);
      setValue(`goal${rowNumber}AssistAthleteId`, goal.assistAthleteId || "", false);
      setValue(`goal${rowNumber}Type`, goal.type || "open-play", false);
    });
    writeTeamMatchStats("uwi", data.matchStats?.uwi || {});
    writeTeamMatchStats("opp", data.matchStats?.opponent || {});
    els.result.value = data.result || "";
    updateDerivedFields();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", () => {
      els.homeTeamLabel.value = getUwiTeamName();
      renderSquad();
      renderPlayerRows();
      renderGoalEvents();
      updateDerivedFields();
    });
    els.opponentName.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-squad-select]")) {
        handleSquadSelectChange(event.target);
      }
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  function renderSquad() {
    const roster = getRosterAthletes();
    els.squadGrid.innerHTML = Array.from({ length: 18 }, (_, index) => {
      const number = index + 1;
      return `<div>
        <label for="squad${number}">Squad Player ${number}</label>
        <select class="select" id="squad${number}" data-squad-select>
          <option value="">Select player ${number}</option>
          ${roster.map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}
          <option value="__quick_add__">Quick Add New Athlete</option>
        </select>
      </div>`;
    }).join("");
  }

  function renderPlayerRows() {
    els.playerRows.innerHTML = Array.from({ length: 18 }, (_, index) => playerRow(index + 1)).join("");
  }

  function playerRow(row) {
    const id = `p${row}`;
    return `<tr>
      <td><input class="input" id="${id}Number" type="number" min="0" placeholder="${row}"/></td>
      <td>${playerControl(`${id}Player`)}</td>
      ${["Shots", "ShotsOnTarget", "Assists", "Goals", "GoalsConceded", "Saves", "Fouls", "Offside", "Yellow", "Red", "Minutes"].map((name) => `<td><input class="input" id="${id}${name}" type="number" min="0"/></td>`).join("")}
    </tr>`;
  }

  function renderGoalEvents() {
    els.goalEvents.innerHTML = Array.from({ length: 10 }, (_, index) => {
      const row = index + 1;
      return `<div class="football-events-grid">
        <div><label for="goal${row}Minute">Minute</label><input class="input" id="goal${row}Minute" type="number" min="0"/></div>
        <div><label for="goal${row}Team">Team</label><select class="select" id="goal${row}Team"><option value="uwi">UWI</option><option value="opponent">Opponent</option></select></div>
        <div><label for="goal${row}Scorer">Scorer</label>${playerControl(`goal${row}Scorer`)}</div>
        <div><label for="goal${row}Assist">Assist</label>${playerControl(`goal${row}Assist`, "Select assister")}</div>
        <div><label for="goal${row}Type">Type</label><select class="select" id="goal${row}Type"><option value="open-play">Open play</option><option value="penalty">Penalty</option><option value="free-kick">Free kick</option><option value="own-goal">Own goal</option></select></div>
      </div>`;
    }).join("");
  }

  function playerControl(prefix, label) {
    return `<select class="select" id="${prefix}AthleteId" data-uwi-player-control><option value="">${escapeHtml(label || "Select squad player")}</option>${selectedSquadAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
  }

  function refreshSquadPlayerOptions() {
    const options = selectedSquadAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("");
    document.querySelectorAll("[data-uwi-player-control]").forEach((select) => {
      const previous = select.value;
      const label = select.id.includes("Assist") ? "Select assister" : "Select squad player";
      select.innerHTML = `<option value="">${label}</option>${options}`;
      select.value = previous;
    });
  }

  /**
   * Recomputes final score, team totals, and result text from entered scores and
   * player stats while preserving manually typed opponent names for display.
   */
  function updateDerivedFields() {
    const uwiTotal = sum(["homeH1", "homeH2", "homeOT"]);
    const opponentTotal = sum(["awayH1", "awayH2", "awayOT"]);
    setValue("homeTotal", uwiTotal);
    setValue("awayTotal", opponentTotal);
    setValue("teamShots", sumPlayerField("Shots"));
    setValue("teamAssists", sumPlayerField("Assists"));
    setValue("teamSaves", sumPlayerField("Saves"));
    setValue("uwiSaves", sumPlayerField("Saves"));
    setValue("teamCards", `${sumPlayerField("Yellow")}Y / ${sumPlayerField("Red")}R`);
    if (valueOf("uwiShots") === "") setValue("uwiShots", sumPlayerField("Shots"), false);
    if (valueOf("uwiShotsOnTarget") === "") setValue("uwiShotsOnTarget", sumPlayerField("ShotsOnTarget"), false);
    if (valueOf("uwiFouls") === "") setValue("uwiFouls", sumPlayerField("Fouls"), false);
    if (valueOf("uwiOffsides") === "") setValue("uwiOffsides", sumPlayerField("Offside"), false);
    setValue("scorecardResult", deriveResult(uwiTotal, opponentTotal), false);
  }

  function deriveResult(uwiTotal, opponentTotal) {
    const uwiName = getUwiTeamName();
    const oppName = opponentName();
    if (uwiTotal === 0 && opponentTotal === 0 && !hasScoreEntered()) return "";
    if (uwiTotal > opponentTotal) return `${uwiName} won ${uwiTotal}-${opponentTotal}`;
    if (opponentTotal > uwiTotal) return `${oppName} won ${opponentTotal}-${uwiTotal}`;
    return `Draw ${uwiTotal}-${opponentTotal}`;
  }

  /**
   * Saves or updates the football stat line consumed by archives and reports.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "football")) return;
    if (!els.teamSelect.value) {
      showError("Select a UWI football team.");
      return;
    }
    const payload = {
      competitionId,
      sport: "football",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Football score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        location: els.location.value.trim(),
        result: els.result.value.trim(),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        score: {
          uwi: { firstHalf: numberValue("homeH1"), secondHalf: numberValue("homeH2"), overtime: numberValue("homeOT"), total: numberValue("homeTotal") },
          opponent: { firstHalf: numberValue("awayH1"), secondHalf: numberValue("awayH2"), overtime: numberValue("awayOT"), total: numberValue("awayTotal") }
        },
        squad: selectedSquadAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        playerStats: Array.from({ length: 18 }, (_, index) => readPlayerStat(index + 1)).filter(hasPlayerStat),
        goals: Array.from({ length: 10 }, (_, index) => readGoalEvent(index + 1)).filter(hasGoalEvent),
        teamTotals: {
          shots: numberValue("teamShots"),
          assists: numberValue("teamAssists"),
          saves: numberValue("teamSaves"),
          yellowCards: sumPlayerField("Yellow"),
          redCards: sumPlayerField("Red")
        },
        matchStats: readMatchStats()
      },
      verified: true,
      source: "football-scorecard"
    };
    try {
      if (scorecardId) {
        await APP.apiPatch(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`, payload);
      } else {
        await APP.apiPost("/competition-stat-lines", payload);
      }
      showSuccess(scorecardId ? "Football score sheet updated successfully." : "Football score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Football score sheet could not be saved.");
    }
  }

  function readPlayerStat(row) {
    const id = `p${row}`;
    const athleteId = valueOf(`${id}PlayerAthleteId`);
    const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
    return {
      athleteId,
      name: athleteId ? displayName(athlete) : "",
      number: numberValue(`${id}Number`),
      shots: numberValue(`${id}Shots`),
      shotsOnTarget: numberValue(`${id}ShotsOnTarget`),
      assists: numberValue(`${id}Assists`),
      goals: numberValue(`${id}Goals`),
      goalsConceded: numberValue(`${id}GoalsConceded`),
      saves: numberValue(`${id}Saves`),
      fouls: numberValue(`${id}Fouls`),
      offside: numberValue(`${id}Offside`),
      yellowCards: numberValue(`${id}Yellow`),
      redCards: numberValue(`${id}Red`),
      minutes: numberValue(`${id}Minutes`)
    };
  }

  function readMatchStats() {
    return {
      uwi: readTeamMatchStats("uwi"),
      opponent: readTeamMatchStats("opp")
    };
  }

  function readTeamMatchStats(prefix) {
    const ids = {
      possession: `${prefix}Possession`,
      shots: `${prefix}Shots`,
      shotsOnTarget: `${prefix}ShotsOnTarget`,
      fouls: `${prefix}Fouls`,
      offsides: `${prefix}Offsides`,
      corners: `${prefix}Corners`,
      freeKicks: `${prefix}FreeKicks`,
      passesCompletedPct: `${prefix}PassesCompleted`,
      crosses: `${prefix}Crosses`,
      interceptions: `${prefix}Interceptions`,
      tackles: `${prefix}Tackles`,
      saves: `${prefix}Saves`
    };
    return Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, numberValue(id)]));
  }

  function writeTeamMatchStats(prefix, stats) {
    const ids = {
      possession: `${prefix}Possession`,
      shots: `${prefix}Shots`,
      shotsOnTarget: `${prefix}ShotsOnTarget`,
      fouls: `${prefix}Fouls`,
      offsides: `${prefix}Offsides`,
      corners: `${prefix}Corners`,
      freeKicks: `${prefix}FreeKicks`,
      passesCompletedPct: `${prefix}PassesCompleted`,
      crosses: `${prefix}Crosses`,
      interceptions: `${prefix}Interceptions`,
      tackles: `${prefix}Tackles`,
      saves: `${prefix}Saves`
    };
    Object.entries(ids).forEach(([key, id]) => setValue(id, stats[key], false));
  }

  function readGoalEvent(row) {
    const scorerId = valueOf(`goal${row}ScorerAthleteId`);
    const assistId = valueOf(`goal${row}AssistAthleteId`);
    return {
      minute: numberValue(`goal${row}Minute`),
      team: valueOf(`goal${row}Team`),
      scorerAthleteId: scorerId,
      scorerName: scorerId ? displayName(state.athletes.find((item) => String(item.id) === String(scorerId))) : "",
      assistAthleteId: assistId,
      assistName: assistId ? displayName(state.athletes.find((item) => String(item.id) === String(assistId))) : "",
      type: valueOf(`goal${row}Type`)
    };
  }

  function hasPlayerStat(row) {
    return Boolean(row.athleteId || row.shots !== null || row.assists !== null || row.goals !== null || row.saves !== null || row.minutes !== null);
  }

  function hasGoalEvent(row) {
    return Boolean(row.minute !== null || row.scorerAthleteId || row.assistAthleteId);
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "football"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function selectedSquadAthletes() {
    const ids = Array.from(document.querySelectorAll("[data-squad-select]")).map((select) => select.value).filter((value) => value && value !== "__quick_add__");
    return ids.map((id) => state.athletes.find((athlete) => String(athlete.id) === String(id))).filter(Boolean);
  }

  async function handleSquadSelectChange(select) {
    if (select.value !== "__quick_add__") {
      refreshSquadPlayerOptions();
      return;
    }
    const athlete = await APP.quickAddAthleteForTeam({
      teamId: els.teamSelect.value,
      teamName: getUwiTeamName(),
      sportSlug: "football"
    });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    renderSquad();
    const target = document.getElementById(select.id);
    if (target) target.value = athlete.id;
    refreshSquadPlayerOptions();
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return els.homeTeamLabel.value.trim() || team?.name || team?.teamName || "UWI Team";
  }

  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
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

  function hasScoreEntered() {
    return ["homeH1", "homeH2", "homeOT", "awayH1", "awayH2", "awayOT"].some((id) => numberValue(id) !== null);
  }

  function sum(ids) {
    return ids.reduce((total, id) => total + (numberValue(id) || 0), 0);
  }

  function sumPlayerField(field) {
    let total = 0;
    for (let row = 1; row <= 18; row += 1) total += numberValue(`p${row}${field}`) || 0;
    return total;
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

  function clearMessage() {
    els.message.className = "message";
    els.message.textContent = "";
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

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
