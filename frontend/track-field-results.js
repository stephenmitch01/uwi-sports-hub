(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const competitionId = params.get("competitionId") || params.get("id") || "";
  const TRACK_ROW_COUNT = 8;
  const FIELD_ROW_COUNT = 12;
  const state = { competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("resultsHeading"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("trackFieldResultsForm"),
    resultKind: document.getElementById("resultKind"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    meetTitle: document.getElementById("meetTitle"),
    eventDate: document.getElementById("eventDate"),
    eventName: document.getElementById("eventName"),
    eventNumber: document.getElementById("eventNumber"),
    division: document.getElementById("division"),
    roundType: document.getElementById("roundType"),
    trackSheet: document.getElementById("trackSheet"),
    fieldSheet: document.getElementById("fieldSheet"),
    trackRows: document.getElementById("trackRows"),
    fieldRows: document.getElementById("fieldRows"),
    trackEventLabel: document.getElementById("trackEventLabel"),
    fieldEventLabel: document.getElementById("fieldEventLabel"),
    message: document.getElementById("resultsMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Track and Field Results" });
    if (!session) return;
    if (!competitionId) {
      showPageError("Open this page from a track and field competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "track-and-field") {
        showPageError("This results workflow is available for track and field competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateMode();
      updateDerivedFields();
    } catch (error) {
      console.error("Track and field results load error:", error);
      showPageError(error?.message || "Track and field results could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Track and Field Competition";
    els.heading.textContent = `${title} Results Entry`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.meetTitle.value = title;
    els.eventDate.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "track-and-field")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Track and Field Team")}</option>`)
      .join("")}`;
    renderTrackRows();
    renderFieldRows();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.resultKind.addEventListener("change", () => {
      updateMode();
      updateDerivedFields();
    });
    els.teamSelect.addEventListener("change", () => {
      renderTrackRows();
      renderFieldRows();
      updateDerivedFields();
    });
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-entry-type]")) {
        renderTrackRows();
        renderFieldRows();
      }
      if (event.target.matches("[data-athlete-select]")) handleAthleteSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  function updateMode() {
    const kind = getKind();
    els.trackSheet.classList.toggle("is-hidden", kind !== "track");
    els.fieldSheet.classList.toggle("is-hidden", kind !== "field");
    els.trackEventLabel.textContent = buildEventLabel() || "Track Event";
    els.fieldEventLabel.textContent = buildEventLabel() || "Field Event";
  }

  function renderTrackRows() {
    const previous = readTrackResults();
    els.trackRows.innerHTML = Array.from({ length: TRACK_ROW_COUNT }, (_, index) => trackRow(index + 1, previous[index] || {})).join("");
  }

  function renderFieldRows() {
    const previous = readFieldResults();
    els.fieldRows.innerHTML = Array.from({ length: FIELD_ROW_COUNT }, (_, index) => fieldRow(index + 1, previous[index] || {})).join("");
  }

  function trackRow(place, existing) {
    const id = `track${place}`;
    const entryType = existing.entryType || "uwi";
    return `<tr>
      <td>${ordinal(place)}</td>
      <td><input class="input" id="${id}Bib" type="text" value="${escapeHtml(existing.bib || "")}"/></td>
      <td>${entryType === "opponent" ? `<input class="input" id="${id}Name" type="text" value="${escapeHtml(existing.name || "")}" placeholder="Opponent athlete"/>` : athleteControl(`${id}Athlete`, existing.athleteId)}</td>
      <td><input class="input" id="${id}Club" type="text" value="${escapeHtml(existing.club || (entryType === "uwi" ? "UWI" : ""))}"/></td>
      <td><input class="input" id="${id}Lane" type="number" min="1" max="12" value="${escapeHtml(existing.lane ?? "")}"/></td>
      <td><input class="input" id="${id}Time" type="text" value="${escapeHtml(existing.time || "")}" placeholder="10.50 / 1:48.20"/></td>
      <td><input class="input" id="${id}AB" type="text" value="${escapeHtml(existing.ab || "")}"/></td>
      <td><input class="input" id="${id}Points" type="number" min="0" step="0.5" value="${escapeHtml(existing.points ?? "")}"/></td>
      <td><select class="select" id="${id}EntryType" data-entry-type><option value="uwi" ${entryType === "uwi" ? "selected" : ""}>UWI</option><option value="opponent" ${entryType === "opponent" ? "selected" : ""}>Opponent</option></select></td>
    </tr>`;
  }

  function fieldRow(rank, existing) {
    const id = `field${rank}`;
    const entryType = existing.entryType || "uwi";
    return `<tr>
      <td>${ordinal(rank)}</td>
      <td><input class="input" id="${id}Bib" type="text" value="${escapeHtml(existing.bib || "")}"/></td>
      <td>${entryType === "opponent" ? `<input class="input" id="${id}Name" type="text" value="${escapeHtml(existing.name || "")}" placeholder="Opponent athlete"/>` : athleteControl(`${id}Athlete`, existing.athleteId)}</td>
      <td><input class="input" id="${id}Club" type="text" value="${escapeHtml(existing.club || (entryType === "uwi" ? "UWI" : ""))}"/></td>
      ${[1, 2, 3].map((n) => attemptInput(id, n, existing.attempts?.[n - 1])).join("")}
      <td><input class="input" id="${id}Best1" readonly value="${escapeHtml(existing.best1 || "")}"/></td>
      <td><input class="input" id="${id}Rank1" readonly value="${escapeHtml(existing.rank1 || "")}"/></td>
      ${[4, 5, 6].map((n) => attemptInput(id, n, existing.attempts?.[n - 1])).join("")}
      <td><input class="input" id="${id}Best" readonly value="${escapeHtml(existing.best || "")}"/></td>
      <td><input class="input" id="${id}FinalRank" readonly value="${escapeHtml(existing.finalRank || "")}"/></td>
      <td><input class="input" id="${id}Points" type="number" min="0" step="0.5" value="${escapeHtml(existing.points ?? "")}"/><select class="select" id="${id}EntryType" data-entry-type><option value="uwi" ${entryType === "uwi" ? "selected" : ""}>UWI</option><option value="opponent" ${entryType === "opponent" ? "selected" : ""}>Opponent</option></select></td>
    </tr>`;
  }

  function attemptInput(id, attempt, value) {
    return `<td><input class="input" id="${id}Attempt${attempt}" type="text" value="${escapeHtml(value ?? "")}" placeholder="X / - / 6.42"/></td>`;
  }

  function athleteControl(prefix, selectedId) {
    const options = getRosterAthletes()
      .map((athlete) => `<option value="${escapeHtml(athlete.id)}" ${String(selectedId || "") === String(athlete.id) ? "selected" : ""}>${escapeHtml(displayName(athlete))}</option>`)
      .join("");
    return `<select class="select" id="${prefix}Id" data-athlete-select><option value="">Select athlete</option>${options}<option value="__quick_add__">Quick Add New Athlete</option></select>`;
  }

  function updateDerivedFields() {
    updateMode();
    const kind = getKind();
    if (kind === "field") updateFieldDerived();
    const rows = kind === "track" ? readTrackResults().filter(hasTrackData) : readFieldResults().filter(hasFieldData);
    const completed = rows.filter((row) => kind === "track" ? Boolean(row.time) : Number.isFinite(row.bestNumber)).length;
    const uwiRows = rows.filter((row) => row.entryType === "uwi");
    const sorted = sortRowsForResult(rows, kind);
    const topUwi = sortRowsForResult(uwiRows, kind)[0];
    const winner = sorted[0];
    setValue("uwiEntries", uwiRows.length);
    setValue("completedEntries", completed);
    setValue("topUwiResult", topUwi ? `${topUwi.name || "UWI"} - ${kind === "track" ? topUwi.time : topUwi.best}` : "");
    setValue("winnerResult", winner ? `${winner.name || "Winner"} - ${kind === "track" ? winner.time : winner.best}` : "");
  }

  function updateFieldDerived() {
    const rows = readFieldResults();
    const afterThree = rows.filter(hasFieldData).sort((a, b) => (b.best1Number ?? -1) - (a.best1Number ?? -1));
    const finalRanks = rows.filter(hasFieldData).sort((a, b) => (b.bestNumber ?? -1) - (a.bestNumber ?? -1));
    rows.forEach((row, index) => {
      const id = `field${index + 1}`;
      setValue(`${id}Best1`, row.best1 || "");
      setValue(`${id}Best`, row.best || "");
      const rank1 = afterThree.findIndex((item) => item.rowNumber === row.rowNumber) + 1;
      const finalRank = finalRanks.findIndex((item) => item.rowNumber === row.rowNumber) + 1;
      setValue(`${id}Rank1`, rank1 > 0 ? rank1 : "");
      setValue(`${id}FinalRank`, finalRank > 0 ? finalRank : "");
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "track-and-field")) return;
    const kind = getKind();
    const eventType = kind === "track" ? APP.getTrackFieldEventType(els.eventName.value) : valueOf("fieldEventType");
    const entries = kind === "track" ? readTrackResults().filter(hasTrackData) : readFieldResults().filter(hasFieldData);
    if (!entries.length) {
      showError("Enter at least one result row before saving.");
      return;
    }
    const payload = {
      competitionId,
      sport: "track-and-field",
      subjectType: "event",
      subjectId: competitionId,
      teamId: els.teamSelect.value || null,
      eventType: "scorecard",
      eventName: els.eventName.value.trim() || (kind === "track" ? "Track event results" : "Field event results"),
      date: els.eventDate.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        resultType: kind,
        disciplineType: eventType,
        title: els.meetTitle.value.trim(),
        eventName: els.eventName.value.trim(),
        eventNumber: els.eventNumber.value.trim(),
        division: els.division.value.trim(),
        round: els.roundType.value,
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        track: kind === "track" ? readTrackMeta() : null,
        field: kind === "field" ? readFieldMeta() : null,
        entries,
        summary: {
          uwiEntries: numberValue("uwiEntries"),
          completedEntries: numberValue("completedEntries"),
          topUwiResult: valueOf("topUwiResult"),
          winningResult: valueOf("winnerResult")
        }
      },
      verified: true,
      source: "track-field-results-sheet"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Track and field results saved successfully.");
    } catch (error) {
      showError(error?.message || "Track and field results could not be saved.");
    }
  }

  function readTrackMeta() {
    return {
      heatNumber: valueOf("heatNumber"),
      semiFinalNumber: valueOf("semiFinalNumber"),
      recordNotes: valueOf("recordNotes"),
      windDirection: valueOf("windDirection"),
      wind: numberValue("windValue")
    };
  }

  function readFieldMeta() {
    return {
      fieldEventType: valueOf("fieldEventType"),
      fieldStandard: valueOf("fieldStandard"),
      wind: numberValue("fieldWind"),
      remarks: valueOf("fieldNotes")
    };
  }

  function readTrackResults() {
    return Array.from({ length: TRACK_ROW_COUNT }, (_, index) => {
      const place = index + 1;
      const id = `track${place}`;
      const entryType = valueOf(`${id}EntryType`) || "uwi";
      const athleteId = valueOf(`${id}AthleteId`);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      return {
        rowNumber: place,
        place,
        entryType,
        athleteId: entryType === "uwi" ? athleteId : "",
        name: entryType === "uwi" ? (athleteId ? displayName(athlete) : "") : valueOf(`${id}Name`),
        bib: valueOf(`${id}Bib`),
        club: valueOf(`${id}Club`),
        lane: numberValue(`${id}Lane`),
        time: valueOf(`${id}Time`),
        timeNumber: parsePerformanceTime(valueOf(`${id}Time`)),
        ab: valueOf(`${id}AB`),
        points: numberValue(`${id}Points`)
      };
    });
  }

  function readFieldResults() {
    return Array.from({ length: FIELD_ROW_COUNT }, (_, index) => {
      const rank = index + 1;
      const id = `field${rank}`;
      const entryType = valueOf(`${id}EntryType`) || "uwi";
      const athleteId = valueOf(`${id}AthleteId`);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      const attempts = [1, 2, 3, 4, 5, 6].map((n) => valueOf(`${id}Attempt${n}`));
      const firstThreeBest = bestAttempt(attempts.slice(0, 3));
      const finalBest = bestAttempt(attempts);
      return {
        rowNumber: rank,
        rank,
        entryType,
        athleteId: entryType === "uwi" ? athleteId : "",
        name: entryType === "uwi" ? (athleteId ? displayName(athlete) : "") : valueOf(`${id}Name`),
        bib: valueOf(`${id}Bib`),
        club: valueOf(`${id}Club`),
        attempts,
        best1: firstThreeBest.display,
        best1Number: firstThreeBest.number,
        best: finalBest.display,
        bestNumber: finalBest.number,
        rank1: numberValue(`${id}Rank1`),
        finalRank: numberValue(`${id}FinalRank`),
        points: numberValue(`${id}Points`)
      };
    });
  }

  function hasTrackData(row) {
    return Boolean(row.athleteId || row.name || row.bib || row.club || row.lane || row.time || row.ab || row.points);
  }

  function hasFieldData(row) {
    return Boolean(row.athleteId || row.name || row.bib || row.club || row.attempts.some(Boolean) || row.points);
  }

  function sortRowsForResult(rows, kind) {
    return rows.slice().filter((row) => kind === "track" ? Number.isFinite(row.timeNumber) : Number.isFinite(row.bestNumber)).sort((a, b) => kind === "track" ? a.timeNumber - b.timeNumber : b.bestNumber - a.bestNumber);
  }

  function bestAttempt(attempts) {
    const legal = attempts.map((value) => ({ display: value, number: parseMark(value) })).filter((item) => Number.isFinite(item.number));
    if (!legal.length) return { display: "", number: null };
    return legal.reduce((best, item) => item.number > best.number ? item : best, legal[0]);
  }

  async function handleAthleteSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "track-and-field" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    const selectedId = athlete.id;
    renderTrackRows();
    renderFieldRows();
    const target = document.getElementById(select.id);
    if (target) target.value = selectedId;
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.normalizeSportSlug(athlete.sportSlug || athlete.sport || athlete.profile?.sportSlug) === "track-and-field");
    return state.athletes.filter((athlete) => String(athlete.teamId || athlete.activeRosterAssignment?.teamId || "") === String(teamId));
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Track and Field";
  }

  function buildEventLabel() {
    return [els.eventNumber.value && `Event ${els.eventNumber.value}`, els.roundType.value, els.eventName.value].filter(Boolean).join(" • ");
  }

  function getKind() {
    return els.resultKind.value === "field" ? "field" : "track";
  }

  function parsePerformanceTime(value) {
    const text = String(value || "").trim();
    if (!text || ["DNS", "DNF", "DQ", "NT"].includes(text.toUpperCase())) return null;
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return parts.length === 1 ? parts[0] : parts.reduce((total, part) => total * 60 + part, 0);
  }

  function parseMark(value) {
    const text = String(value || "").trim();
    if (!text || ["X", "-", "NM", "DNS", "DQ"].includes(text.toUpperCase())) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function ordinal(number) {
    const suffix = number === 1 ? "st" : number === 2 ? "nd" : number === 3 ? "rd" : "th";
    return `${number}${suffix}`;
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
