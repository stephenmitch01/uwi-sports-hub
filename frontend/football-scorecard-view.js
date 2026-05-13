(function () {
  "use strict";
  const APP = window.UWISportsHub;
  const scorecardId = new URLSearchParams(window.location.search).get("scorecardId") || new URLSearchParams(window.location.search).get("id") || "";
  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("scorecardTitle"),
    meta: document.getElementById("scorecardMeta"),
    back: document.getElementById("backLink"),
    score: document.getElementById("scoreText"),
    result: document.getElementById("resultText"),
    body: document.getElementById("scorecardBody")
  };
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Football Score Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved football result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Football Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.uwiTeamName && data.opponentName ? `${data.uwiTeamName} v ${data.opponentName}` : "", data.location].filter(Boolean).join(" • ");
      els.score.textContent = formatScore(data);
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Football score sheet could not be loaded.");
    }
  }

  function render(data) {
    const rows = Array.isArray(data.playerStats) ? data.playerStats : [];
    const goals = Array.isArray(data.goals) ? data.goals : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Match Details</h2><p>${escapeHtml(data.result || "Saved football result")}</p></div></div>
      <div class="football-match-panel">
        <div class="football-match-header">
          <div class="football-match-team"><span>UWI</span><strong>${escapeHtml(data.uwiTeamName || "UWI")}</strong></div>
          <div class="football-match-score">${escapeHtml(formatScore(data))}</div>
          <div class="football-match-team"><span>Opponent</span><strong>${escapeHtml(data.opponentName || "Opponent")}</strong></div>
        </div>
        <div class="football-scorers">
          <div><strong>${escapeHtml(data.uwiTeamName || "UWI")} goals</strong>${goalList(goals, "uwi")}</div>
          <div><strong>${escapeHtml(data.opponentName || "Opponent")} goals</strong>${goalList(goals, "opponent")}</div>
        </div>
        <div class="football-stat-compare">
          ${matchStatRows(data).map((item) => `<div class="football-stat-row"><span>${escapeHtml(item.uwi)}</span><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.opponent)}</span></div>`).join("")}
        </div>
      </div>
      <div class="football-table-wrap">
        <table class="football-score-table">
          <thead><tr><th>#</th><th>Player</th><th>Shots</th><th>Shots OT</th><th>Assists</th><th>Goals Scored</th><th>Goals Conceded</th><th>Saves</th><th>Fouls</th><th>Offside</th><th>Yellow</th><th>Red</th><th>Minutes</th></tr></thead>
          <tbody>${rows.map(renderPlayerRow).join("") || `<tr><td colspan="13">No player stat rows were saved.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="football-events">
        <div class="section-title section-title-sm"><div><h3>Goal Events</h3><p>Recorded scoring actions and linked assists.</p></div></div>
        <div class="football-goal-list">${goals.map(renderGoal).join("") || "No goal events recorded."}</div>
      </div>
    `;
  }

  function renderPlayerRow(row) {
    return `<tr><td>${escapeHtml(row.number ?? "")}</td><td>${playerLink(row.athleteId, row.name)}</td><td>${escapeHtml(row.shots ?? "")}</td><td>${escapeHtml(row.shotsOnTarget ?? "")}</td><td>${escapeHtml(row.assists ?? "")}</td><td>${escapeHtml(row.goals ?? "")}</td><td>${escapeHtml(row.goalsConceded ?? "")}</td><td>${escapeHtml(row.saves ?? "")}</td><td>${escapeHtml(row.fouls ?? "")}</td><td>${escapeHtml(row.offsides ?? row.offside ?? "")}</td><td>${escapeHtml(row.yellowCards ?? "")}</td><td>${escapeHtml(row.redCards ?? "")}</td><td>${escapeHtml(row.minutes ?? "")}</td></tr>`;
  }

  function renderGoal(goal) {
    const scorer = goal.scorerAthleteId ? playerLink(goal.scorerAthleteId, goal.scorerName) : escapeHtml(goal.scorerName || "Opponent");
    const assist = goal.assistAthleteId ? `, assist ${playerLink(goal.assistAthleteId, goal.assistName)}` : "";
    return `<div><strong>${escapeHtml(goal.minute ?? "")}'</strong> ${scorer}${assist} <span class="muted">(${escapeHtml(goal.type || "goal")})</span></div>`;
  }

  function goalList(goals, team) {
    const list = goals.filter((goal) => String(goal.team || "") === team);
    if (!list.length) return `<p class="muted">No scorers recorded.</p>`;
    return `<p>${list.map((goal) => `${escapeHtml(goal.scorerName || (team === "uwi" ? "UWI player" : "Opponent"))} ${escapeHtml(goal.minute ?? "")}'`).join("<br>")}</p>`;
  }

  function matchStatRows(data) {
    const stats = data.matchStats || {};
    const uwi = stats.uwi || {};
    const opponent = stats.opponent || {};
    const fallbackUwi = data.teamTotals || {};
    const pairs = [
      ["Goals Scored", data.score?.uwi?.total, data.score?.opponent?.total],
      ["Possession", pct(uwi.possession), pct(opponent.possession)],
      ["Shots (On Target)", shotPair(uwi, fallbackUwi), shotPair(opponent)],
      ["Fouls (Offside)", foulPair(uwi, fallbackUwi), foulPair(opponent)],
      ["Corner Kicks", value(uwi.corners), value(opponent.corners)],
      ["Free Kicks", value(uwi.freeKicks), value(opponent.freeKicks)],
      ["Passes Completed (%)", pct(uwi.passesCompletedPct), pct(opponent.passesCompletedPct)],
      ["Crosses", value(uwi.crosses), value(opponent.crosses)],
      ["Interceptions", value(uwi.interceptions), value(opponent.interceptions)],
      ["Tackles", value(uwi.tackles), value(opponent.tackles)],
      ["Saves", value(uwi.saves ?? fallbackUwi.saves), value(opponent.saves)]
    ];
    return pairs.map(([label, left, right]) => ({ label, uwi: value(left), opponent: value(right) }));
  }

  function shotPair(stats, fallback = {}) {
    const shots = stats.shots ?? fallback.shots;
    const on = stats.shotsOnTarget ?? fallback.shotsOnTarget;
    return on == null || on === "" ? value(shots) : `${value(shots)} (${value(on)})`;
  }

  function foulPair(stats, fallback = {}) {
    const fouls = stats.fouls ?? fallback.fouls;
    const offsides = stats.offsides ?? fallback.offsides;
    return offsides == null || offsides === "" ? value(fouls) : `${value(fouls)} (${value(offsides)})`;
  }

  function pct(input) {
    return input == null || input === "" ? "—" : `${input}%`;
  }

  function value(input) {
    return input == null || input === "" ? "—" : input;
  }

  function playerLink(id, name) {
    const safeName = escapeHtml(name || "Player");
    return id ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(id)}">${safeName}</a>` : safeName;
  }

  function normalizeLine(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : row?.data && typeof row.data === "object" ? row.data : {};
    return { ...row, ...data, id: row.id, competitionId: row.competitionId || data.competitionId, eventName: row.eventName || data.eventName || data.title, date: row.date || data.date || row.createdAt, statData: data };
  }

  function formatScore(data) {
    const score = data.score || {};
    return `${score.uwi?.total ?? 0}-${score.opponent?.total ?? 0}`;
  }

  function scorePair(data, period) {
    const score = data.score || {};
    return `${score.uwi?.[period] ?? 0}-${score.opponent?.[period] ?? 0}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  }

  function show(text) {
    els.msg.className = "message error is-visible";
    els.msg.textContent = text;
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
