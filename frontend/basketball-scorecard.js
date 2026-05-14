(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";

  const state = {
    session: null,
    competition: null,
    athletes: [],
    teams: []
  };

  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    subtitle: document.getElementById("scorecardSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("basketballScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    playedAt: document.getElementById("playedAt"),
    gameTime: document.getElementById("gameTime"),
    coachName: document.getElementById("coachName"),
    homeTeamLabel: document.getElementById("homeTeamLabel"),
    visitTeamLabel: document.getElementById("visitTeamLabel"),
    result: document.getElementById("matchResult"),
    possessionStart: document.getElementById("possessionStart"),
    possessionSequence: document.getElementById("possessionSequence"),
    rosterGrid: document.getElementById("rosterGrid"),
    playerRows: document.getElementById("playerRows"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Basketball Score Sheet" });
    if (!session) return;
    state.session = session;
    if (!competitionId) {
      showPageError("Open this page from a basketball competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "basketball") {
        showPageError("This score sheet workflow is available for basketball competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      console.error("Basketball score sheet load error:", error);
      showPageError(error?.message || "Basketball score sheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Basketball Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.subtitle.textContent = "Select the UWI game roster first. Player stat rows then link directly to athlete records.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "basketball")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Basketball Team")}</option>`)
      .join("")}`;
    renderRoster();
    renderPlayerRows();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", () => {
      els.homeTeamLabel.value = getUwiTeamName();
      renderRoster();
      renderPlayerRows();
      updateDerivedFields();
    });
    els.opponentName.addEventListener("input", updateDerivedFields);
    els.possessionStart.addEventListener("change", updateDerivedFields);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-roster-select]")) handleRosterSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  function renderRoster() {
    const roster = getRosterAthletes();
    els.rosterGrid.innerHTML = Array.from({ length: 15 }, (_, index) => {
      const number = index + 1;
      return `<div>
        <label for="roster${number}">Roster Player ${number}</label>
        <select class="select" id="roster${number}" data-roster-select>
          <option value="">Select player ${number}</option>
          ${roster.map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}
          <option value="__quick_add__">Quick Add New Athlete</option>
        </select>
      </div>`;
    }).join("");
  }

  function renderPlayerRows() {
    els.playerRows.innerHTML = Array.from({ length: 15 }, (_, index) => playerRow(index + 1)).join("");
  }

  function playerRow(row) {
    const id = `p${row}`;
    return `<tr>
      <td><input class="input" id="${id}Number" type="number" min="0" placeholder="${row}"/></td>
      <td>${playerControl(`${id}Player`)}</td>
      <td><input class="input" id="${id}Fouls" type="number" min="0" max="5"/></td>
      <td><input class="input" id="${id}Q1" type="number" min="0"/></td>
      <td><input class="input" id="${id}Q2" type="number" min="0"/></td>
      <td><input class="input" id="${id}Q3" type="number" min="0"/></td>
      <td><input class="input" id="${id}Q4" type="number" min="0"/></td>
      <td><input class="input derived" id="${id}TotalPoints" readonly/></td>
      ${["TwoMade", "ThreeMade", "FreeThrowsMade", "Rebounds", "Assists", "Steals", "Blocks", "Turnovers", "Minutes"].map((name) => `<td><input class="input" id="${id}${name}" type="number" min="0"/></td>`).join("")}
    </tr>`;
  }

  function playerControl(prefix, label) {
    return `<select class="select" id="${prefix}AthleteId" data-uwi-player-control><option value="">${escapeHtml(label || "Select roster player")}</option>${selectedRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
  }

  function refreshRosterPlayerOptions() {
    const options = selectedRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("");
    document.querySelectorAll("[data-uwi-player-control]").forEach((select) => {
      const previous = select.value;
      select.innerHTML = `<option value="">Select roster player</option>${options}`;
      select.value = previous;
    });
  }

  function updateDerivedFields() {
    els.visitTeamLabel.value = opponentName();
    setValue("homePeriodLabel", getUwiTeamName(), false);
    setValue("visitPeriodLabel", opponentName(), false);
    const uwiTotal = sum(["homeQ1", "homeQ2", "homeQ3", "homeQ4", "homeOT"]);
    const opponentTotal = sum(["visitQ1", "visitQ2", "visitQ3", "visitQ4", "visitOT"]);
    setValue("homeFinal", uwiTotal);
    setValue("visitFinal", opponentTotal);
    for (let row = 1; row <= 15; row += 1) {
      setValue(`p${row}TotalPoints`, sum([`p${row}Q1`, `p${row}Q2`, `p${row}Q3`, `p${row}Q4`]));
    }
    setValue("teamPoints", sumPlayerField("TotalPoints"));
    setValue("teamRebounds", sumPlayerField("Rebounds"));
    setValue("teamAssists", sumPlayerField("Assists"));
    setValue("teamSteals", sumPlayerField("Steals"));
    setValue("possessionSequence", buildPossessionSequence(), false);
    els.result.value = deriveResult(uwiTotal, opponentTotal);
  }

  function deriveResult(uwiTotal, opponentTotal) {
    if (uwiTotal === 0 && opponentTotal === 0 && !hasScoreEntered()) return "";
    if (uwiTotal > opponentTotal) return `${getUwiTeamName()} won ${uwiTotal}-${opponentTotal}`;
    if (opponentTotal > uwiTotal) return `${opponentName()} won ${opponentTotal}-${uwiTotal}`;
    return `Tie ${uwiTotal}-${opponentTotal}`;
  }

  function buildPossessionSequence() {
    const start = els.possessionStart.value === "opponent" ? opponentName() : getUwiTeamName();
    const other = els.possessionStart.value === "opponent" ? getUwiTeamName() : opponentName();
    return Array.from({ length: 18 }, (_, index) => (index % 2 === 0 ? start : other)).join(" -> ");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "basketball")) return;
    if (!els.teamSelect.value) {
      showError("Select a UWI basketball team.");
      return;
    }
    const payload = {
      competitionId,
      sport: "basketball",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Basketball score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        playedAt: els.playedAt.value.trim(),
        gameTime: els.gameTime.value,
        coachName: els.coachName.value.trim(),
        result: els.result.value.trim(),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        score: {
          uwi: { q1: numberValue("homeQ1"), q2: numberValue("homeQ2"), q3: numberValue("homeQ3"), q4: numberValue("homeQ4"), overtime: numberValue("homeOT"), total: numberValue("homeFinal") },
          opponent: { q1: numberValue("visitQ1"), q2: numberValue("visitQ2"), q3: numberValue("visitQ3"), q4: numberValue("visitQ4"), overtime: numberValue("visitOT"), total: numberValue("visitFinal") }
        },
        roster: selectedRosterAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        playerStats: Array.from({ length: 15 }, (_, index) => readPlayerStat(index + 1)).filter(hasPlayerStat),
        gameAdmin: {
          teamFouls: numberValue("teamFouls"),
          fullTimeouts: numberValue("fullTimeouts"),
          shortTimeouts: numberValue("shortTimeouts"),
          otTimeouts: numberValue("otTimeouts"),
          warnings: numberValue("warningCount"),
          possessionStart: els.possessionStart.value,
          possessionSequence: els.possessionSequence.value
        },
        teamTotals: {
          points: numberValue("teamPoints"),
          rebounds: numberValue("teamRebounds"),
          assists: numberValue("teamAssists"),
          steals: numberValue("teamSteals")
        }
      },
      verified: true,
      source: "basketball-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Basketball score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Basketball score sheet could not be saved.");
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
      fouls: numberValue(`${id}Fouls`),
      q1: numberValue(`${id}Q1`),
      q2: numberValue(`${id}Q2`),
      q3: numberValue(`${id}Q3`),
      q4: numberValue(`${id}Q4`),
      points: numberValue(`${id}TotalPoints`),
      twoMade: numberValue(`${id}TwoMade`),
      threeMade: numberValue(`${id}ThreeMade`),
      freeThrowsMade: numberValue(`${id}FreeThrowsMade`),
      rebounds: numberValue(`${id}Rebounds`),
      assists: numberValue(`${id}Assists`),
      steals: numberValue(`${id}Steals`),
      blocks: numberValue(`${id}Blocks`),
      turnovers: numberValue(`${id}Turnovers`),
      minutes: numberValue(`${id}Minutes`)
    };
  }

  function hasPlayerStat(row) {
    return Boolean(row.athleteId || row.points || row.rebounds || row.assists || row.steals || row.blocks || row.minutes);
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "basketball"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function selectedRosterAthletes() {
    const ids = Array.from(document.querySelectorAll("[data-roster-select]")).map((select) => select.value).filter((value) => value && value !== "__quick_add__");
    return [...new Set(ids)].map((id) => state.athletes.find((athlete) => String(athlete.id) === String(id))).filter(Boolean);
  }

  async function handleRosterSelectChange(select) {
    if (select.value !== "__quick_add__") {
      refreshRosterPlayerOptions();
      return;
    }
    const athlete = await APP.quickAddAthleteForTeam({
      teamId: els.teamSelect.value,
      teamName: getUwiTeamName(),
      sportSlug: "basketball"
    });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    select.insertAdjacentHTML("beforebegin", "");
    renderRoster();
    const target = document.getElementById(select.id);
    if (target) target.value = athlete.id;
    refreshRosterPlayerOptions();
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
    return ["homeQ1", "homeQ2", "homeQ3", "homeQ4", "homeOT", "visitQ1", "visitQ2", "visitQ3", "visitQ4", "visitOT"].some((id) => numberValue(id) !== null);
  }

  function sum(ids) {
    return ids.reduce((total, id) => total + (numberValue(id) || 0), 0);
  }

  function sumPlayerField(field) {
    let total = 0;
    for (let row = 1; row <= 15; row += 1) total += numberValue(`p${row}${field}`) || 0;
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
