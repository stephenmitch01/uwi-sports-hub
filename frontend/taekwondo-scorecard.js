(function () {
  "use strict";

  /**
   * Taekwondo score sheet engine.
   *
   * Stores athlete-linked bout/division data, round scores, deductions, method,
   * and ranking context for athlete combat-sport summaries and result cards.
   */
  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  const JUDGE_COUNT = 5;
  const state = { competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("taekwondoScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    athleteSelect: document.getElementById("athleteSelect"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    result: document.getElementById("resultText"),
    judgeList: document.getElementById("judgeList"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Taekwondo Score Sheet" });
    if (!session) return;
    if (!competitionId) return showPageError("Open this page from a taekwondo competition.");
    try {
      const [competition, athletes, teams] = await Promise.all([
        APP.apiGet(`/competitions/${encodeURIComponent(competitionId)}`),
        APP.apiGet("/athletes", true),
        APP.apiGet("/teams", true)
      ]);
      state.competition = competition?.competition || competition?.data?.competition || competition?.data || competition;
      state.athletes = normalizeArray(athletes, "athletes");
      state.teams = normalizeArray(teams, "teams");
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "taekwondo") {
        showPageError("This score sheet workflow is available for taekwondo competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      showPageError(error?.message || "Taekwondo score sheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Taekwondo Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "taekwondo")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Taekwondo Team")}</option>`)
      .join("")}`;
    renderAthleteOptions();
    renderJudges();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", renderAthleteOptions);
    els.athleteSelect.addEventListener("change", () => handlePlayerSelectChange(els.athleteSelect));
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("submit", handleSubmit);
  }

  function renderAthleteOptions() {
    const previous = els.athleteSelect.value;
    els.athleteSelect.innerHTML = `<option value="">Select athlete</option>${getRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("")}<option value="__quick_add__">Quick Add New Athlete</option>`;
    els.athleteSelect.value = previous;
  }

  function renderJudges() {
    els.judgeList.innerHTML = Array.from({ length: JUDGE_COUNT }, (_, index) => renderJudge(index + 1)).join("");
  }

  function renderJudge(number) {
    return `
      <article class="tkd-judge" data-judge="${number}">
        <div class="tkd-judge-head">
          <strong>Judge ${number}</strong>
          <div><label for="judge${number}Name">Judge Name</label><input class="input" id="judge${number}Name" type="text"/></div>
          <div><label for="judge${number}Position">Judge No. / Position</label><input class="input" id="judge${number}Position" type="text"/></div>
          <div><label for="judge${number}Total">Judge Total</label><input class="input derived" id="judge${number}Total" readonly/></div>
        </div>
        <div class="tkd-score-section">
          <h3>Accuracy (4.0)</h3>
          <div class="tkd-score-grid">
            <div><label for="judge${number}BasicDeduction">Basic Movement Deductions</label><input class="input" id="judge${number}BasicDeduction" type="number" min="0" max="4" step="0.1"/></div>
            <div><label for="judge${number}IndividualDeduction">Individual Movement Deductions</label><input class="input" id="judge${number}IndividualDeduction" type="number" min="0" max="4" step="0.1"/></div>
            <div><label for="judge${number}BalanceDeduction">Balance Deductions</label><input class="input" id="judge${number}BalanceDeduction" type="number" min="0" max="4" step="0.1"/></div>
            <div><label for="judge${number}AccuracyScore">Accuracy Score</label><input class="input derived" id="judge${number}AccuracyScore" readonly/></div>
            <div><label for="judge${number}Penalty">Penalty</label><input class="input" id="judge${number}Penalty" type="number" min="0" max="10" step="0.1"/></div>
            <div><label for="judge${number}Valid">Use Judge</label><select class="select" id="judge${number}Valid"><option value="yes">Yes</option><option value="no">No</option></select></div>
          </div>
        </div>
        <div class="tkd-score-section">
          <h3>Presentation (6.0)</h3>
          <div class="tkd-score-grid">
            <div><label for="judge${number}PowerSpeed">Power & Speed</label><input class="input" id="judge${number}PowerSpeed" type="number" min="0" max="2" step="0.1"/></div>
            <div><label for="judge${number}RhythmTempo">Rhythm, Tempo, Softness & Power</label><input class="input" id="judge${number}RhythmTempo" type="number" min="0" max="2" step="0.1"/></div>
            <div><label for="judge${number}Energy">Expression of Energy</label><input class="input" id="judge${number}Energy" type="number" min="0" max="2" step="0.1"/></div>
            <div><label for="judge${number}PresentationScore">Presentation Score</label><input class="input derived" id="judge${number}PresentationScore" readonly/></div>
            <div><label for="judge${number}Comments">Comments</label><input class="input" id="judge${number}Comments" type="text"/></div>
          </div>
        </div>
      </article>
    `;
  }

  function updateDerivedFields() {
    const judges = readJudges();
    judges.forEach((judge) => {
      setValue(`judge${judge.number}AccuracyScore`, judge.accuracyScore.toFixed(2));
      setValue(`judge${judge.number}PresentationScore`, judge.presentationScore.toFixed(2));
      setValue(`judge${judge.number}Total`, judge.total.toFixed(2));
    });
    const active = judges.filter((judge) => judge.active && judge.hasScore);
    const average = active.length ? active.reduce((sum, judge) => sum + judge.total, 0) / active.length : 0;
    const best = active.reduce((max, judge) => Math.max(max, judge.total), 0);
    document.getElementById("averageScore").textContent = average.toFixed(2);
    document.getElementById("bestJudgeScore").textContent = best.toFixed(2);
    document.getElementById("judgeCount").textContent = String(active.length);
    document.getElementById("finalScore").textContent = average.toFixed(2);
    const rank = valueOf("rankValue");
    setValue("resultText", rank ? `Rank ${rank} - ${average.toFixed(2)}` : `${average.toFixed(2)} points`, false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!APP.confirmScorecardValues(els.form, "taekwondo")) return;
    if (!els.teamSelect.value) return showError("Select a UWI taekwondo team.");
    if (!els.athleteSelect.value) return showError("Select the UWI athlete.");
    const athlete = state.athletes.find((item) => String(item.id) === String(els.athleteSelect.value));
    const judges = readJudges().filter((judge) => judge.active && judge.hasScore);
    if (!judges.length) return showError("Enter at least one judge score.");
    const summary = summarizeJudges(judges);
    const payload = {
      competitionId,
      sport: "taekwondo",
      subjectType: "athlete",
      subjectId: els.athleteSelect.value,
      teamId: els.teamSelect.value,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Taekwondo judge score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        format: "poomsae",
        court: valueOf("courtNumber"),
        division: valueOf("divisionName"),
        poomsae: valueOf("poomsaeName"),
        round: valueOf("roundName"),
        rank: numberValue("rankValue"),
        result: els.result.value.trim(),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        athlete: { athleteId: els.athleteSelect.value, name: displayName(athlete) },
        judges,
        summary
      },
      verified: true,
      source: "taekwondo-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Taekwondo score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Taekwondo score sheet could not be saved.");
    }
  }

  function readJudges() {
    return Array.from({ length: JUDGE_COUNT }, (_, index) => {
      const number = index + 1;
      const deductions = {
        basic: numberValue(`judge${number}BasicDeduction`) || 0,
        individual: numberValue(`judge${number}IndividualDeduction`) || 0,
        balance: numberValue(`judge${number}BalanceDeduction`) || 0
      };
      const presentation = {
        powerSpeed: numberValue(`judge${number}PowerSpeed`) || 0,
        rhythmTempo: numberValue(`judge${number}RhythmTempo`) || 0,
        energy: numberValue(`judge${number}Energy`) || 0
      };
      const accuracyScore = Math.max(0, 4 - deductions.basic - deductions.individual - deductions.balance);
      const presentationScore = Math.min(6, presentation.powerSpeed + presentation.rhythmTempo + presentation.energy);
      const penalty = numberValue(`judge${number}Penalty`) || 0;
      const total = Math.max(0, Math.min(10, accuracyScore + presentationScore - penalty));
      const hasScore = Object.values(deductions).some(Boolean) || Object.values(presentation).some(Boolean);
      return {
        number,
        name: valueOf(`judge${number}Name`),
        position: valueOf(`judge${number}Position`),
        active: valueOf(`judge${number}Valid`) !== "no",
        deductions,
        presentation,
        accuracyScore,
        presentationScore,
        penalty,
        total,
        hasScore,
        comments: valueOf(`judge${number}Comments`)
      };
    });
  }

  function summarizeJudges(judges) {
    const totals = judges.map((judge) => judge.total);
    const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
    return {
      judgeCount: judges.length,
      finalScore: round2(average),
      averageScore: round2(average),
      bestJudgeScore: round2(Math.max(...totals)),
      lowestJudgeScore: round2(Math.min(...totals)),
      rank: numberValue("rankValue"),
      result: valueOf("resultText")
    };
  }

  async function handlePlayerSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "taekwondo" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    renderAthleteOptions();
    els.athleteSelect.value = athlete.id;
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "taekwondo"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Taekwondo";
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

  function setValue(id, value, allowNullAsZero = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value == null || value === "" ? (allowNullAsZero ? "0" : "") : String(value);
  }

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
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
