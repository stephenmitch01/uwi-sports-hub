(function () {
  "use strict";

  /**
   * Netball score sheet engine.
   *
   * Captures quarter scoring, roster-linked player rows, and match stats in a
   * backend stat line so athlete reports and team/competition views read from
   * the same official sheet.
   */
  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  const POSITIONS = ["GS", "GA", "WA", "C", "WD", "GD", "GK"];
  const state = { competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    subtitle: document.getElementById("scorecardSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("netballScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    venue: document.getElementById("scorecardVenue"),
    result: document.getElementById("scorecardResult"),
    squadGrid: document.getElementById("squadGrid"),
    startingGrid: document.getElementById("startingGrid"),
    playerRows: document.getElementById("playerRows"),
    subRows: document.getElementById("subRows"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Netball Match Sheet" });
    if (!session) return;
    if (!competitionId) {
      showPageError("Open this page from a netball competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "netball") {
        showPageError("This match sheet workflow is available for netball competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      showPageError(error?.message || "Netball match sheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Netball Competition";
    els.heading.textContent = `${title} Match Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "netball")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Netball Team")}</option>`)
      .join("")}`;
    renderSquad();
    renderStartingSeven();
    renderPlayerRows();
    renderSubRows();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", () => {
      renderSquad();
      renderStartingSeven();
      renderPlayerRows();
      renderSubRows();
      updateDerivedFields();
    });
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-squad-select]")) handleSquadSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  function renderSquad() {
    const roster = getRosterAthletes();
    els.squadGrid.innerHTML = Array.from({ length: 12 }, (_, index) => {
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

  function renderStartingSeven() {
    els.startingGrid.innerHTML = POSITIONS.map((position) => `<div><label for="start${position}">${position}</label>${playerControl(`start${position}`, `Select ${position}`)}</div>`).join("");
  }

  function renderPlayerRows() {
    els.playerRows.innerHTML = Array.from({ length: 12 }, (_, index) => playerRow(index + 1)).join("");
  }

  function playerRow(row) {
    const id = `p${row}`;
    return `<tr>
      <td><input class="input" id="${id}Number" type="number" min="0" placeholder="${row}"/></td>
      <td>${playerControl(`${id}Player`)}</td>
      <td><select class="select" id="${id}Position">${POSITIONS.map((position) => `<option value="${position}">${position}</option>`).join("")}</select></td>
      <td><input class="input" id="${id}Goals" type="number" min="0"/></td>
      <td><input class="input" id="${id}Attempts" type="number" min="0"/></td>
      <td><input class="input derived" id="${id}ShotPct" readonly/></td>
      ${["GoalAssists", "Feeds", "CentrePassReceives", "Intercepts", "Deflections", "Rebounds", "Gains", "Turnovers", "Penalties", "Minutes"].map((name) => `<td><input class="input" id="${id}${name}" type="number" min="0"/></td>`).join("")}
    </tr>`;
  }

  function renderSubRows() {
    els.subRows.innerHTML = Array.from({ length: 8 }, (_, index) => {
      const row = index + 1;
      return `<div class="netball-sub-grid">
        <div><label for="sub${row}Period">Period</label><select class="select" id="sub${row}Period"><option value="">-</option><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option><option>OT</option></select></div>
        <div><label for="sub${row}OffAthleteId">Player Off</label>${playerControl(`sub${row}Off`, "Select player off")}</div>
        <div><label for="sub${row}OnAthleteId">Player On</label>${playerControl(`sub${row}On`, "Select player on")}</div>
        <div><label for="sub${row}Position">Position</label><select class="select" id="sub${row}Position"><option value="">-</option>${POSITIONS.map((position) => `<option value="${position}">${position}</option>`).join("")}</select></div>
        <div><label for="sub${row}Notes">Notes</label><input class="input" id="sub${row}Notes" type="text"/></div>
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
      const label = select.options[0]?.textContent || "Select squad player";
      select.innerHTML = `<option value="">${escapeHtml(label)}</option>${options}`;
      select.value = previous;
    });
  }

  function updateDerivedFields() {
    const uwiTotal = sum(["uwiQ1", "uwiQ2", "uwiQ3", "uwiQ4", "uwiOT"]);
    const opponentTotal = sum(["oppQ1", "oppQ2", "oppQ3", "oppQ4", "oppOT"]);
    setValue("uwiTotal", uwiTotal);
    setValue("oppTotal", opponentTotal);
    setValue("scorecardResult", deriveResult(uwiTotal, opponentTotal), false);
    for (let row = 1; row <= 12; row += 1) {
      const goals = numberValue(`p${row}Goals`) || 0;
      const attempts = numberValue(`p${row}Attempts`) || 0;
      setValue(`p${row}ShotPct`, attempts ? `${Math.round((goals / attempts) * 100)}%` : "");
    }
    const goals = sumPlayerField("Goals");
    const attempts = sumPlayerField("Attempts");
    setValue("shootingPct", attempts ? `${Math.round((goals / attempts) * 100)}%` : "");
    setValue("teamFeeds", sumPlayerField("Feeds"));
    setValue("teamGains", sumPlayerField("Gains"));
    setValue("teamPenalties", sumPlayerField("Penalties"));
  }

  function deriveResult(uwiTotal, opponentTotal) {
    if (uwiTotal === 0 && opponentTotal === 0 && !hasScoreEntered()) return "";
    if (uwiTotal > opponentTotal) return `${getUwiTeamName()} won ${uwiTotal}-${opponentTotal}`;
    if (opponentTotal > uwiTotal) return `${opponentName()} won ${opponentTotal}-${uwiTotal}`;
    return `Draw ${uwiTotal}-${opponentTotal}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "netball")) return;
    if (!els.teamSelect.value) {
      showError("Select a UWI netball team.");
      return;
    }
    const payload = {
      competitionId,
      sport: "netball",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Netball match sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        venue: els.venue.value.trim(),
        result: els.result.value.trim(),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        score: readScore(),
        squad: selectedSquadAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        startingSeven: POSITIONS.map((position) => readStartingPosition(position)).filter((row) => row.athleteId),
        playerStats: Array.from({ length: 12 }, (_, index) => readPlayerStat(index + 1)).filter(hasPlayerStat),
        substitutions: Array.from({ length: 8 }, (_, index) => readSubstitution(index + 1)).filter(hasSubstitution),
        teamTotals: {
          shootingPercentage: valueOf("shootingPct"),
          goals: sumPlayerField("Goals"),
          attempts: sumPlayerField("Attempts"),
          feeds: numberValue("teamFeeds"),
          gains: numberValue("teamGains"),
          penalties: numberValue("teamPenalties")
        }
      },
      verified: true,
      source: "netball-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Netball match sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Netball match sheet could not be saved.");
    }
  }

  function readScore() {
    return {
      uwi: { q1: numberValue("uwiQ1"), q2: numberValue("uwiQ2"), q3: numberValue("uwiQ3"), q4: numberValue("uwiQ4"), overtime: numberValue("uwiOT"), total: numberValue("uwiTotal") },
      opponent: { q1: numberValue("oppQ1"), q2: numberValue("oppQ2"), q3: numberValue("oppQ3"), q4: numberValue("oppQ4"), overtime: numberValue("oppOT"), total: numberValue("oppTotal") }
    };
  }

  function readStartingPosition(position) {
    const athleteId = valueOf(`start${position}AthleteId`);
    return { position, athleteId, name: athleteId ? displayName(state.athletes.find((athlete) => String(athlete.id) === String(athleteId))) : "" };
  }

  function readPlayerStat(row) {
    const id = `p${row}`;
    const athleteId = valueOf(`${id}PlayerAthleteId`);
    const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
    return {
      athleteId,
      name: athleteId ? displayName(athlete) : "",
      number: numberValue(`${id}Number`),
      position: valueOf(`${id}Position`),
      goals: numberValue(`${id}Goals`),
      attempts: numberValue(`${id}Attempts`),
      shootingPercentage: valueOf(`${id}ShotPct`),
      goalAssists: numberValue(`${id}GoalAssists`),
      feeds: numberValue(`${id}Feeds`),
      centrePassReceives: numberValue(`${id}CentrePassReceives`),
      intercepts: numberValue(`${id}Intercepts`),
      deflections: numberValue(`${id}Deflections`),
      rebounds: numberValue(`${id}Rebounds`),
      gains: numberValue(`${id}Gains`),
      turnovers: numberValue(`${id}Turnovers`),
      penalties: numberValue(`${id}Penalties`),
      minutes: numberValue(`${id}Minutes`)
    };
  }

  function readSubstitution(row) {
    const offId = valueOf(`sub${row}OffAthleteId`);
    const onId = valueOf(`sub${row}OnAthleteId`);
    return {
      period: valueOf(`sub${row}Period`),
      playerOffAthleteId: offId,
      playerOffName: offId ? displayName(state.athletes.find((athlete) => String(athlete.id) === String(offId))) : "",
      playerOnAthleteId: onId,
      playerOnName: onId ? displayName(state.athletes.find((athlete) => String(athlete.id) === String(onId))) : "",
      position: valueOf(`sub${row}Position`),
      notes: valueOf(`sub${row}Notes`)
    };
  }

  function hasPlayerStat(row) {
    return Boolean(row.athleteId || row.goals !== null || row.attempts !== null || row.feeds !== null || row.penalties !== null || row.minutes !== null);
  }

  function hasSubstitution(row) {
    return Boolean(row.period || row.playerOffAthleteId || row.playerOnAthleteId || row.position || row.notes);
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "netball"));
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
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "netball" });
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
    return team?.name || team?.teamName || "UWI Netball";
  }

  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
  }

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

  function hasScoreEntered() {
    return ["uwiQ1", "uwiQ2", "uwiQ3", "uwiQ4", "uwiOT", "oppQ1", "oppQ2", "oppQ3", "oppQ4", "oppOT"].some((id) => numberValue(id) !== null);
  }

  function sum(ids) {
    return ids.reduce((total, id) => total + (numberValue(id) || 0), 0);
  }

  function sumPlayerField(field) {
    let total = 0;
    for (let row = 1; row <= 12; row += 1) total += numberValue(`p${row}${field}`) || 0;
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
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
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
