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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Hockey Score Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved hockey result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Hockey Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.uwiTeamName && data.opponentName ? `${data.uwiTeamName} v ${data.opponentName}` : "", data.arena].filter(Boolean).join(" • ");
      els.score.textContent = formatScore(data);
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Hockey score sheet could not be loaded.");
    }
  }

  function render(data) {
    const scoring = Array.isArray(data.scoring) ? data.scoring : [];
    const penalties = Array.isArray(data.penalties) ? data.penalties : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Score Sheet</h2><p>${escapeHtml(data.result || "Saved hockey result")}</p></div></div>
      <div class="hockey-summary-grid">
        <div><strong>1st</strong><br>${escapeHtml(scorePair(data, "p1"))}</div>
        <div><strong>2nd</strong><br>${escapeHtml(scorePair(data, "p2"))}</div>
        <div><strong>3rd</strong><br>${escapeHtml(scorePair(data, "p3"))}</div>
        <div><strong>OT</strong><br>${escapeHtml(scorePair(data, "overtime"))}</div>
        <div><strong>Total</strong><br>${escapeHtml(formatScore(data))}</div>
      </div>
      <div class="hockey-board">
        <section class="hockey-panel"><h3>Scoring</h3><div class="hockey-table-wrap"><table class="hockey-score-table"><thead><tr><th>#</th><th>Player</th><th>Side</th><th>Period</th><th>G</th><th>A1</th><th>A2</th></tr></thead><tbody>${scoring.map(renderGoal).join("") || `<tr><td colspan="7">No scoring rows saved.</td></tr>`}</tbody></table></div></section>
        <section class="hockey-panel"><h3>Penalties</h3><div class="hockey-table-wrap"><table class="hockey-score-table"><thead><tr><th>Side</th><th>Period</th><th>Player</th><th>Min</th><th>Infraction</th><th>Time</th></tr></thead><tbody>${penalties.map(renderPenalty).join("") || `<tr><td colspan="6">No penalty rows saved.</td></tr>`}</tbody></table></div></section>
      </div>
    `;
  }

  function renderGoal(row) {
    return `<tr><td>${escapeHtml(row.number ?? "")}</td><td>${playerLink(row.scorerAthleteId, row.scorerName)}</td><td>${escapeHtml(row.side || "")}</td><td>${escapeHtml(row.period || "")}</td><td>${escapeHtml(row.goal ?? "")}</td><td>${playerLink(row.assist1AthleteId, row.assist1Name)}</td><td>${playerLink(row.assist2AthleteId, row.assist2Name)}</td></tr>`;
  }

  function renderPenalty(row) {
    return `<tr><td>${escapeHtml(row.side || "")}</td><td>${escapeHtml(row.period || "")}</td><td>${playerLink(row.athleteId, row.name)}</td><td>${escapeHtml(row.minutes ?? "")}</td><td>${escapeHtml(row.infraction || "")}</td><td>${escapeHtml(row.time || "")}</td></tr>`;
  }

  function playerLink(id, name) {
    const safeName = escapeHtml(name || "");
    return id ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(id)}">${safeName || "Player"}</a>` : safeName;
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
