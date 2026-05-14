(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const competitionId = new URLSearchParams(window.location.search).get("competitionId") || new URLSearchParams(window.location.search).get("id") || "";
  const MATCHES = [
    ...Array.from({ length: 7 }, (_, index) => ({ label: `Singles ${index + 1}`, type: "singles" })),
    ...Array.from({ length: 7 }, (_, index) => ({ label: `Doubles ${index + 1}`, type: "doubles" }))
  ];
  const state = { competition: null, athletes: [], teams: [] };
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    heading: document.getElementById("scorecardHeading"),
    backLink: document.getElementById("backToCompetitionLink"),
    form: document.getElementById("tennisScorecardForm"),
    teamSelect: document.getElementById("uwiTeamSelect"),
    category: document.getElementById("matchCategory"),
    title: document.getElementById("scorecardTitle"),
    date: document.getElementById("scorecardDate"),
    status: document.getElementById("matchStatus"),
    result: document.getElementById("scorecardResult"),
    matchList: document.getElementById("matchList"),
    message: document.getElementById("scorecardMessage")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Tennis Score Sheet" });
    if (!session) return;
    if (!competitionId) {
      showPageError("Open this page from a tennis competition.");
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
      if (APP.normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport) !== "lawn-tennis") {
        showPageError("This score sheet workflow is available for tennis competitions.");
        return;
      }
      renderPage();
      bindEvents();
      updateDerivedFields();
    } catch (error) {
      showPageError(error?.message || "Tennis score sheet could not be loaded.");
    }
  }

  function renderPage() {
    const title = state.competition?.title || state.competition?.name || "Tennis Competition";
    els.heading.textContent = `${title} Score Sheet`;
    els.backLink.href = `competition-view.html?id=${encodeURIComponent(competitionId)}`;
    els.title.value = title;
    els.date.value = formatDateInput(state.competition?.startDate || new Date().toISOString());
    els.teamSelect.innerHTML = `<option value="">Select UWI team</option>${state.teams
      .filter((team) => APP.normalizeSportSlug(team.sportSlug || team.sport) === "lawn-tennis")
      .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Tennis Team")}</option>`)
      .join("")}`;
    renderMatches();
  }

  function bindEvents() {
    APP.trackUnsavedChanges(els.form);
    els.teamSelect.addEventListener("change", renderMatches);
    els.form.addEventListener("input", updateDerivedFields);
    els.form.addEventListener("change", (event) => {
      if (event.target.matches("[data-match-type]")) togglePair(event.target.closest(".tennis-match"));
      if (event.target.matches("[data-player-select]")) handlePlayerSelectChange(event.target);
      updateDerivedFields();
    });
    els.form.addEventListener("submit", handleSubmit);
  }

  function renderMatches() {
    els.matchList.innerHTML = MATCHES.map((match, index) => renderMatch(index + 1, match)).join("");
    els.matchList.querySelectorAll(".tennis-match").forEach(togglePair);
    updateDerivedFields();
  }

  function renderMatch(number, match) {
    const rosterOptions = getRosterAthletes().map((athlete) => `<option value="${escapeHtml(athlete.id)}">${escapeHtml(displayName(athlete))}</option>`).join("");
    return `
      <article class="tennis-match" data-match="${number}">
        <div class="tennis-match-head">
          <strong>${escapeHtml(match.label)}</strong>
          <div><label for="match${number}Type">Match Type</label><select class="select" id="match${number}Type" data-match-type><option value="singles" ${match.type === "singles" ? "selected" : ""}>Singles</option><option value="doubles" ${match.type === "doubles" ? "selected" : ""}>Doubles</option></select></div>
          <div><label for="match${number}UwiPlayer1">UWI Player 1</label><select class="select" id="match${number}UwiPlayer1" data-player-select><option value="">Select player</option>${rosterOptions}<option value="__quick_add__">Quick Add New Athlete</option></select></div>
          <div data-pair-player><label for="match${number}UwiPlayer2">UWI Player 2</label><select class="select" id="match${number}UwiPlayer2" data-player-select><option value="">Select player</option>${rosterOptions}<option value="__quick_add__">Quick Add New Athlete</option></select></div>
          <div><label for="match${number}UwiSets">UWI Sets</label><input class="input derived" id="match${number}UwiSets" readonly/></div>
          <div><label for="match${number}OppSets">Opp Sets</label><input class="input derived" id="match${number}OppSets" readonly/></div>
          <div><label for="match${number}Winner">Winner</label><input class="input derived" id="match${number}Winner" readonly/></div>
        </div>
        <div class="tennis-match-head">
          <div></div><div></div>
          <div><label for="match${number}OppPlayer1">Opponent Player 1</label><input class="input" id="match${number}OppPlayer1" type="text"/></div>
          <div data-pair-opponent><label for="match${number}OppPlayer2">Opponent Player 2</label><input class="input" id="match${number}OppPlayer2" type="text"/></div>
          <div><label for="match${number}UwiGames">UWI Games</label><input class="input derived" id="match${number}UwiGames" readonly/></div>
          <div><label for="match${number}OppGames">Opp Games</label><input class="input derived" id="match${number}OppGames" readonly/></div>
          <div><label for="match${number}Status">Status</label><select class="select" id="match${number}Status"><option value="played">Played</option><option value="walkover">Walkover</option><option value="retired">Retired</option><option value="defaulted">Defaulted</option></select></div>
        </div>
        <div class="tennis-set-grid">
          <div class="tennis-label">Set Scores</div>
          <input class="input" id="match${number}Set1" type="text" placeholder="6-4"/>
          <input class="input" id="match${number}Set2" type="text" placeholder="4-6"/>
          <input class="input" id="match${number}Set3" type="text" placeholder="7-6(5)"/>
          <input class="input derived" id="match${number}UwiSetsMirror" readonly/>
          <input class="input derived" id="match${number}UwiGamesMirror" readonly/>
          <div class="tennis-label">Totals show UWI sets and games</div>
        </div>
      </article>
    `;
  }

  function togglePair(matchEl) {
    if (!matchEl) return;
    const isDoubles = valueOf(`match${matchEl.dataset.match}Type`) === "doubles";
    matchEl.querySelectorAll("[data-pair-player], [data-pair-opponent]").forEach((el) => { el.style.display = isDoubles ? "" : "none"; });
    if (!isDoubles) {
      setValue(`match${matchEl.dataset.match}UwiPlayer2`, "", false);
      setValue(`match${matchEl.dataset.match}OppPlayer2`, "", false);
    }
  }

  function updateDerivedFields() {
    const matches = readMatches();
    const summary = summarizeMatches(matches);
    matches.forEach((match) => {
      setValue(`match${match.number}UwiSets`, match.uwiSets);
      setValue(`match${match.number}OppSets`, match.opponentSets);
      setValue(`match${match.number}UwiGames`, match.uwiGames);
      setValue(`match${match.number}OppGames`, match.opponentGames);
      setValue(`match${match.number}UwiSetsMirror`, `${match.uwiSets}-${match.opponentSets}`);
      setValue(`match${match.number}UwiGamesMirror`, `${match.uwiGames}-${match.opponentGames}`);
      setValue(`match${match.number}Winner`, match.winner, false);
    });
    document.getElementById("totalMatches").textContent = `${summary.uwiMatches}-${summary.opponentMatches}`;
    document.getElementById("totalSets").textContent = `${summary.uwiSets}-${summary.opponentSets}`;
    document.getElementById("totalGames").textContent = `${summary.gamesFor}-${summary.gamesAgainst}`;
    document.getElementById("winningTeamText").textContent = summary.winner || "-";
    setValue("scorecardResult", summary.winner ? `${summary.winner} won ${Math.max(summary.uwiMatches, summary.opponentMatches)}-${Math.min(summary.uwiMatches, summary.opponentMatches)}` : "", false);
    setValue("durationMinutes", deriveDuration(), false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessage();
    updateDerivedFields();
    if (!els.teamSelect.value) return showError("Select a UWI tennis team.");
    const matches = readMatches().filter((match) => match.uwiPlayers.length || match.opponentPlayers.length || match.setScores.length);
    if (!matches.length) return showError("Enter at least one tennis match.");
    const summary = summarizeMatches(matches);
    const payload = {
      competitionId,
      sport: "lawn-tennis",
      subjectType: "team",
      subjectId: els.teamSelect.value,
      teamId: els.teamSelect.value,
      eventType: "scorecard",
      eventName: els.title.value.trim() || "Tennis score sheet",
      date: els.date.value || new Date().toISOString(),
      statData: {
        eventType: "scorecard",
        title: els.title.value.trim(),
        category: els.category.value,
        status: els.status.value,
        result: els.result.value.trim(),
        matchNumber: valueOf("matchNumber"),
        time: valueOf("matchTime"),
        venue: valueOf("venueName"),
        weather: valueOf("weatherText"),
        courtConditions: valueOf("courtConditions"),
        uwiTeamId: els.teamSelect.value,
        uwiTeamName: getUwiTeamName(),
        opponentTeamName: valueOf("opponentTeamName") || "Opponent",
        matches,
        summary,
        officials: { referee: valueOf("refereeName") },
        timing: { startTime: valueOf("startTime"), finishTime: valueOf("finishTime"), durationMinutes: numberValue("durationMinutes") },
        notes: valueOf("matchNotes")
      },
      verified: true,
      source: "tennis-scorecard"
    };
    try {
      await APP.apiPost("/competition-stat-lines", payload);
      showSuccess("Tennis score sheet saved successfully.");
    } catch (error) {
      showError(error?.message || "Tennis score sheet could not be saved.");
    }
  }

  function readMatches() {
    return MATCHES.map((template, index) => {
      const number = index + 1;
      const type = valueOf(`match${number}Type`) || template.type;
      const setScores = [1, 2, 3].map((set) => parseSetScore(valueOf(`match${number}Set${set}`), set)).filter(Boolean);
      const uwiSets = setScores.filter((set) => set.uwi > set.opponent).length;
      const opponentSets = setScores.filter((set) => set.opponent > set.uwi).length;
      const status = valueOf(`match${number}Status`) || "played";
      const winner = status === "walkover" ? "UWI" : uwiSets > opponentSets ? "UWI" : opponentSets > uwiSets ? "Opponent" : "";
      return {
        number,
        label: template.label,
        type,
        status,
        uwiPlayers: readUwiPlayersForMatch(number, type),
        opponentPlayers: readOpponentPlayersForMatch(number, type),
        setScores,
        uwiSets,
        opponentSets,
        uwiGames: setScores.reduce((sum, set) => sum + set.uwi, 0),
        opponentGames: setScores.reduce((sum, set) => sum + set.opponent, 0),
        winner
      };
    });
  }

  function parseSetScore(raw, setNumber) {
    const value = String(raw || "").trim();
    if (!value) return null;
    const match = value.match(/(\d+)\D+(\d+)/);
    if (!match) return { set: setNumber, raw: value, uwi: 0, opponent: 0 };
    return { set: setNumber, raw: value, uwi: Number(match[1]) || 0, opponent: Number(match[2]) || 0 };
  }

  function summarizeMatches(matches) {
    const summary = matches.reduce((acc, match) => {
      acc.uwiMatches += match.winner === "UWI" ? 1 : 0;
      acc.opponentMatches += match.winner === "Opponent" ? 1 : 0;
      acc.uwiSets += match.uwiSets;
      acc.opponentSets += match.opponentSets;
      acc.gamesFor += match.uwiGames;
      acc.gamesAgainst += match.opponentGames;
      return acc;
    }, { uwiMatches: 0, opponentMatches: 0, uwiSets: 0, opponentSets: 0, gamesFor: 0, gamesAgainst: 0 });
    summary.gameDifferential = summary.gamesFor - summary.gamesAgainst;
    summary.winner = summary.uwiMatches > summary.opponentMatches ? getUwiTeamName() : summary.opponentMatches > summary.uwiMatches ? valueOf("opponentTeamName") || "Opponent" : "";
    return summary;
  }

  function readUwiPlayersForMatch(number, type) {
    return [1, 2].map((slot) => {
      if (slot === 2 && type !== "doubles") return null;
      const athleteId = valueOf(`match${number}UwiPlayer${slot}`);
      const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
      return athleteId ? { athleteId, name: displayName(athlete), slot } : null;
    }).filter(Boolean);
  }

  function readOpponentPlayersForMatch(number, type) {
    return [1, 2].map((slot) => {
      if (slot === 2 && type !== "doubles") return null;
      const name = valueOf(`match${number}OppPlayer${slot}`);
      return name ? { name, slot } : null;
    }).filter(Boolean);
  }

  async function handlePlayerSelectChange(select) {
    if (select.value !== "__quick_add__") return;
    const athlete = await APP.quickAddAthleteForTeam({ teamId: els.teamSelect.value, teamName: getUwiTeamName(), sportSlug: "lawn-tennis" });
    if (!athlete?.id) {
      select.value = "";
      return;
    }
    state.athletes.push(athlete);
    const targetId = select.id;
    renderMatches();
    const target = document.getElementById(targetId);
    if (target) target.value = athlete.id;
  }

  function getRosterAthletes() {
    const teamId = els.teamSelect.value;
    if (!teamId) return state.athletes.filter((athlete) => APP.athleteHasSport(athlete, "lawn-tennis"));
    return state.athletes.filter((athlete) => APP.athleteHasTeam(athlete, teamId));
  }

  function getUwiTeamName() {
    const team = state.teams.find((item) => String(item.id) === String(els.teamSelect.value));
    return team?.name || team?.teamName || "UWI Tennis";
  }

  function deriveDuration() {
    const start = valueOf("startTime");
    const finish = valueOf("finishTime");
    if (!start || !finish) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [fh, fm] = finish.split(":").map(Number);
    if (![sh, sm, fh, fm].every(Number.isFinite)) return "";
    let minutes = (fh * 60 + fm) - (sh * 60 + sm);
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
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
