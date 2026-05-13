(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";

  const state = { session: null, competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    subtitle: document.getElementById("scorecardSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("volleyballScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    opponentName: document.getElementById("opponentName"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    site: document.getElementById("scorecardSite"),
    level: document.getElementById("scorecardLevel"),
    homeClubLabel: document.getElementById("homeClubLabel"),
    firstServe: document.getElementById("firstServe"),
    rosterGrid: document.getElementById("rosterGrid"),
    playerRows: document.getElementById("playerRows"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Volleyball Scoresheet" });
    if (!session) return;
    state.session = session;
    if (!competitionId) {
      showPageError("Open this page from a volleyball competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "volleyball") {
        showPageError("This scoresheet workflow is available for volleyball competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      console.error("Volleyball scoresheet load error:", error);
      showPageError(error?.message || "Volleyball scoresheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Volleyball Competition";
    els.heading.textContent = `${title} Scoresheet`;
    els.subtitle.textContent = "Select the UWI roster first. Serve order and score rows then connect to athlete records.";
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "volleyball")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Volleyball Team")}</option>`)
      .join("")}`;
    renderRoster();
    renderPlayerRows();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", () => {
      els.homeClubLabel.value = getUwiTeamName();
      renderRoster();
      renderPlayerRows();
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

  function renderRoster() {
    const roster = getRosterAthletes();
    els.rosterGrid.innerHTML = Array.from({ length: 14 }, (_, index) => {
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
    els.playerRows.innerHTML = Array.from({ length: 14 }, (_, index) => playerRow(index + 1)).join("");
  }

  function playerRow(row) {
    const id = `p${row}`;
    return `<tr>
      <td><input class="input derived" id="${id}ServeOrder" type="text" value="${toRoman(row)}" readonly/></td>
      <td>${playerControl(`${id}Player`)}</td>
      <td><input class="input" id="${id}Number" type="number" min="0"/></td>
      ${["Kills", "Aces", "Blocks", "Assists", "Digs", "ServeReceive", "Errors", "Subs", "Timeouts"].map((name) => `<td><input class="input" id="${id}${name}" type="number" min="0"/></td>`).join("")}
      <td><select class="select" id="${id}Captain"><option value="false">No</option><option value="true">Captain</option></select></td>
      <td><select class="select" id="${id}Libero"><option value="false">No</option><option value="true">Libero</option></select></td>
    </tr>`;
  }

  function playerControl(prefix) {
    return `<select class="select" id="${prefix}AthleteId" data-uwi-player-control><option value="">Select roster player</option>${selectedRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}</select>`;
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
    setValue("homeSetLabel", getUwiTeamName(), false);
    setValue("awaySetLabel", opponentName(), false);
    const score = deriveSetScore();
    setValue("uwiSetsWon", score.uwiSets);
    setValue("oppSetsWon", score.oppSets);
    setValue("setCount", score.setsPlayed);
    setValue("matchResult", deriveResult(score), false);
    setValue("teamKills", sumPlayerField("Kills"));
    setValue("teamAces", sumPlayerField("Aces"));
    setValue("teamBlocks", sumPlayerField("Blocks"));
    setValue("teamAssists", sumPlayerField("Assists"));
    setValue("teamDigs", sumPlayerField("Digs"));
  }

  function deriveSetScore() {
    let uwiSets = 0;
    let oppSets = 0;
    let setsPlayed = 0;
    for (let index = 1; index <= 5; index += 1) {
      const uwi = numberValue(`uwiSet${index}`);
      const opp = numberValue(`oppSet${index}`);
      if (uwi === null && opp === null) continue;
      setsPlayed += 1;
      if ((uwi || 0) > (opp || 0)) uwiSets += 1;
      if ((opp || 0) > (uwi || 0)) oppSets += 1;
    }
    return { uwiSets, oppSets, setsPlayed };
  }

  function deriveResult(score) {
    if (!score.setsPlayed) return "";
    if (score.uwiSets > score.oppSets) return `${getUwiTeamName()} won ${score.uwiSets}-${score.oppSets}`;
    if (score.oppSets > score.uwiSets) return `${opponentName()} won ${score.oppSets}-${score.uwiSets}`;
    return `Match tied ${score.uwiSets}-${score.oppSets}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "volleyball")) return;
    if (!els.teamSelect.value) {
      showError("Select a UWI volleyball team.");
      return;
    }
    const payload = {
      competitionId,
      sport: "volleyball",
      subjectType: "match",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Volleyball scoresheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        site: els.site.value.trim(),
        level: els.level.value.trim(),
        startTime: valueOf("startTime"),
        endTime: valueOf("endTime"),
        firstServe: els.firstServe.value,
        result: valueOf("matchResult"),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentName: opponentName(),
        sets: Array.from({ length: 5 }, (_, index) => readSet(index + 1)).filter((set) => set.uwiScore !== null || set.opponentScore !== null),
        finalSets: { uwi: numberValue("uwiSetsWon"), opponent: numberValue("oppSetsWon") },
        roster: selectedRosterAthletes().map((athlete) => ({ athleteId: athlete.id, name: displayName(athlete) })),
        playerStats: Array.from({ length: 14 }, (_, index) => readPlayerStat(index + 1)).filter(hasPlayerStat),
        matchAdmin: {
          uwiTimeouts: numberValue("uwiTimeouts"),
          opponentTimeouts: numberValue("oppTimeouts"),
          uwiSubs: numberValue("uwiSubs"),
          opponentSubs: numberValue("oppSubs"),
          penaltyPoints: numberValue("penaltyPoints"),
          replays: numberValue("replays")
        },
        teamTotals: {
          kills: numberValue("teamKills"),
          aces: numberValue("teamAces"),
          blocks: numberValue("teamBlocks"),
          assists: numberValue("teamAssists"),
          digs: numberValue("teamDigs")
        },
        comments: valueOf("comments"),
        officialNotes: valueOf("officialNotes")
      },
      verified: true,
      source: "volleyball-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Volleyball scoresheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Volleyball scoresheet could not be saved.");
    }
  }

  function readSet(index) {
    return { set: index, uwiScore: numberValue(`uwiSet${index}`), opponentScore: numberValue(`oppSet${index}`) };
  }

  function readPlayerStat(row) {
    const id = `p${row}`;
    const athleteId = valueOf(`${id}PlayerAthleteId`);
    const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
    return {
      athleteId,
      name: athleteId ? displayName(athlete) : "",
      serveOrder: toRoman(row),
      number: numberValue(`${id}Number`),
      kills: numberValue(`${id}Kills`),
      aces: numberValue(`${id}Aces`),
      blocks: numberValue(`${id}Blocks`),
      assists: numberValue(`${id}Assists`),
      digs: numberValue(`${id}Digs`),
      serveReceive: numberValue(`${id}ServeReceive`),
      errors: numberValue(`${id}Errors`),
      substitutions: numberValue(`${id}Subs`),
      timeouts: numberValue(`${id}Timeouts`),
      captain: valueOf(`${id}Captain`) === "true",
      libero: valueOf(`${id}Libero`) === "true"
    };
  }

  function hasPlayerStat(row) {
    return Boolean(row.athleteId || row.kills !== null || row.aces !== null || row.blocks !== null || row.assists !== null || row.digs !== null);
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.normalizeSportSlug(athlete.sportSlug || athlete.sport || athlete.profile?.sportSlug) === "volleyball");
    return state.athletes.filter((athlete) => String(athlete.teamId || athlete.activeRosterAssignment?.teamId || "") === String(teamId));
  }

  function selectedRosterAthletes() {
    const ids = Array.from(document.querySelectorAll("[data-roster-select]")).map((select) => select.value).filter((value) => value && value !== "__quick_add__");
    return ids.map((id) => state.athletes.find((athlete) => String(athlete.id) === String(id))).filter(Boolean);
  }

  async function handleRosterSelectChange(select) {
    if (select.value !== "__quick_add__") {
      refreshRosterPlayerOptions();
      return;
    }
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "volleyball" });
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

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return els.homeClubLabel.value.trim() || team?.name || team?.teamName || "UWI Team";
  }

  function opponentName() {
    return els.opponentName.value.trim() || "Opponent";
  }

  function sumPlayerField(field) {
    let total = 0;
    for (let row = 1; row <= 14; row += 1) total += numberValue(`p${row}${field}`) || 0;
    return total;
  }

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

  function toRoman(value) {
    return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"][value] || String(value);
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
