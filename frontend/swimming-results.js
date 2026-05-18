(function () {
  "use strict";

  /**
   * Swimming result sheet engine.
   *
   * Records lane-level results with UWI athlete IDs or manual opponent entries.
   * Times, DQ flags, and splits are preserved for PBs, archives, team summaries,
   * and competition reports.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";
  const state = { session: null, competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("resultsHeading"),
    subtitle: document.getElementById("resultsSubtitle"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("swimmingResultsForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    meetTitle: document.getElementById("meetTitle"),
    sessionCode: document.getElementById("sessionCode"),
    eventName: document.getElementById("eventName"),
    eventNumber: document.getElementById("eventNumber"),
    eventDate: document.getElementById("eventDate"),
    courseType: document.getElementById("courseType"),
    roundType: document.getElementById("roundType"),
    ageGroup: document.getElementById("ageGroup"),
    schoolName: document.getElementById("schoolName"),
    eventBar: document.getElementById("eventBar"),
    laneRows: document.getElementById("laneRows"),
    message: document.getElementById("resultsMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Swimming Results Sheet" });
    if (!session) return;
    state.session = session;
    if (!competitionId) {
      showPageError("Open this page from a swimming competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "swimming") {
        showPageError("This results workflow is available for swimming competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      console.error("Swimming results sheet load error:", error);
      showPageError(error?.message || "Swimming results sheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Swimming Competition";
    els.heading.textContent = `${title} Results Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.meetTitle.value = title;
    els.eventDate.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "swimming")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Swimming Team")}</option>`)
      .join("")}`;
    renderLaneRows();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", renderLaneRows);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-entry-type]")) renderLaneRows();
      if (event.target.matches("[data-swimmer-select]")) handleSwimmerSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  function renderLaneRows() {
    const previous = readLaneResults();
    els.laneRows.innerHTML = Array.from({ length: 10 }, (_, index) => laneRow(index + 1, previous[index] || {})).join("");
    updateDerivedFields();
  }

  function laneRow(lane, existing) {
    const id = `lane${lane}`;
    const entryType = existing.entryType || "uwi";
    return `<tr>
      <td>${lane}</td>
      <td><select class="select" id="${id}EntryType" data-entry-type><option value="uwi" ${entryType === "uwi" ? "selected" : ""}>UWI</option><option value="opponent" ${entryType === "opponent" ? "selected" : ""}>Opponent</option></select></td>
      <td>${entryType === "opponent" ? `<input class="input" id="${id}Name" type="text" value="${escapeHtml(existing.name || "")}" placeholder="Opponent swimmer"/>` : playerControl(`${id}Athlete`, existing.athleteId)}</td>
      <td><input class="input" id="${id}Year" type="text" value="${escapeHtml(existing.year || "")}"/></td>
      <td><input class="input" id="${id}School" type="text" value="${escapeHtml(existing.school || (entryType === "uwi" ? (els.schoolName.value || "UWI") : ""))}"/></td>
      <td><input class="input" id="${id}SeedTime" type="text" value="${escapeHtml(existing.seedTime || "")}" placeholder="NT"/></td>
      <td><input class="input" id="${id}FinalTime" type="text" value="${escapeHtml(existing.finalTime || "")}" placeholder="NS / 55.21"/></td>
      <td><input class="input" id="${id}Place" type="number" min="1" value="${escapeHtml(existing.place ?? "")}"/></td>
      <td><input class="input" id="${id}Points" type="number" min="0" step="0.5" value="${escapeHtml(existing.points ?? "")}"/></td>
      <td class="swim-checkbox-cell"><input id="${id}DQ" type="checkbox" ${existing.dq ? "checked" : ""}/></td>
      <td class="swim-checkbox-cell"><input id="${id}Exh" type="checkbox" ${existing.exhibition ? "checked" : ""}/></td>
    </tr>`;
  }

  function playerControl(prefix, selectedId) {
    return `<select class="select" id="${prefix}Id" data-swimmer-select><option value="">Select swimmer</option>${getRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}" ${String(selectedId || "") === String(athlete.id) ? "selected" : ""}>${escapeHtml(displayName(athlete))}</option>`).join("")}<option value="__quick_add__">Quick Add New Athlete</option></select>`;
  }

  function updateDerivedFields() {
    const eventLabel = [els.eventNumber.value && `Event ${els.eventNumber.value}`, els.roundType.value, els.eventName.value].filter(Boolean).join(" • ");
    els.eventBar.textContent = eventLabel || "Swimming Event Results";
    const rows = readLaneResults().filter(hasLaneData);
    const validTimes = rows.filter((row) => row.entryType === "uwi" && row.finalTime && !row.dq && !row.exhibition && row.finalTime.toUpperCase() !== "NS");
    setValue("winningTime", validTimes.sort((a, b) => compareSwimTimes(a.finalTime, b.finalTime))[0]?.finalTime || "");
    setValue("uwiEntries", rows.filter((row) => row.entryType === "uwi").length);
    setValue("completedEntries", rows.filter((row) => row.finalTime && row.finalTime.toUpperCase() !== "NS").length);
    setValue("dqCount", rows.filter((row) => row.dq).length);
    setValue("exhCount", rows.filter((row) => row.exhibition).length);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "swimming")) return;
    const payload = {
      competitionId,
      sport: "swimming",
      subjectType: "event",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.eventName.value.trim() || "Swimming results sheet",
      date: els.eventDate.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.meetTitle.value.trim(),
        session: els.sessionCode.value.trim(),
        eventName: els.eventName.value.trim(),
        eventNumber: els.eventNumber.value.trim(),
        course: els.courseType.value,
        round: els.roundType.value,
        ageGroup: els.ageGroup.value.trim(),
        schoolName: els.schoolName.value.trim(),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        lanes: readLaneResults().filter(hasLaneData),
        summary: {
          winningTime: valueOf("winningTime"),
          uwiEntries: numberValue("uwiEntries"),
          completedEntries: numberValue("completedEntries"),
          dqCount: numberValue("dqCount"),
          exhibitionCount: numberValue("exhCount")
        }
      },
      verified: true,
      source: "swimming-results-sheet"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Swimming results sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Swimming results sheet could not be saved.");
    }
  }

  function readLaneResults() {
    return Array.from({ length: 10 }, (_, index) => {
      const lane = index + 1;
      const id = `lane${lane}`;
      const entryType = valueOf(`${id}EntryType`) || "uwi";
      const athleteId = valueOf(`${id}AthleteId`);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      return {
        lane,
        entryType,
        athleteId: entryType === "uwi" ? athleteId : "",
        name: entryType === "uwi" ? (athleteId ? displayName(athlete) : "") : valueOf(`${id}Name`),
        year: valueOf(`${id}Year`),
        school: valueOf(`${id}School`),
        seedTime: valueOf(`${id}SeedTime`),
        finalTime: valueOf(`${id}FinalTime`),
        place: numberValue(`${id}Place`),
        points: numberValue(`${id}Points`),
        dq: document.getElementById(`${id}DQ`)?.checked || false,
        exhibition: document.getElementById(`${id}Exh`)?.checked || false
      };
    });
  }

  function hasLaneData(row) {
    return Boolean(row.athleteId || row.name || row.seedTime || row.finalTime || row.place || row.points || row.dq || row.exhibition);
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.normalizeSportSlug(athlete.sportSlug || athlete.sport || athlete.profile?.sportSlug) === "swimming");
    return state.athletes.filter((athlete) => String(athlete.teamId || athlete.activeRosterAssignment?.teamId || "") === String(teamId));
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Swimming";
  }

  async function handleSwimmerSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "swimming" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    const rowId = select.id.replace(/AthleteId$/, "");
    renderLaneRows();
    const target = document.getElementById(`${rowId}AthleteId`);
    if (target) target.value = athlete.id;
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

  function compareSwimTimes(a, b) {
    return parseSwimTime(a) - parseSwimTime(b);
  }

  function parseSwimTime(value) {
    const text = String(value || "").trim();
    if (!text || text.toUpperCase() === "NS") return Number.POSITIVE_INFINITY;
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return Number.POSITIVE_INFINITY;
    return parts.length === 1 ? parts[0] : parts[0] * 60 + parts[1];
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

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? "" : String(value);
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
