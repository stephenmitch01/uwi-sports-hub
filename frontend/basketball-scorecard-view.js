(function () {
  "use strict";
  // Shared App Access
  /**
   * Read-only basketball score sheet renderer.
   *
   * Displays the saved stat line used by team, athlete, and competition pages;
   * edit actions route back to the score sheet engine.
   */
  const APP = window.UWISportsHub;
  const scorecardId = new URLSearchParams(window.location.search).get("scorecardId") || new URLSearchParams(window.location.search).get("id") || "";
  // Scorecard Fields
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

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Basketball Score Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved basketball result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Basketball Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.uwiTeamName && data.opponentName ? `${data.uwiTeamName} v ${data.opponentName}` : "", data.playedAt].filter(Boolean).join(" • ");
      els.score.textContent = formatScore(data);
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Basketball score sheet could not be loaded.");
    }
  }

  // Page Display
  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(data) {
    const rows = Array.isArray(data.playerStats) ? data.playerStats : [];
    const admin = data.gameAdmin || {};
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Score Sheet</h2><p>${escapeHtml(data.result || "Saved basketball result")}</p></div></div>
      <div class="basketball-summary-grid">
        <div><strong>1st Quarter</strong><br>${escapeHtml(scorePair(data, "q1"))}</div>
        <div><strong>2nd Quarter</strong><br>${escapeHtml(scorePair(data, "q2"))}</div>
        <div><strong>3rd Quarter</strong><br>${escapeHtml(scorePair(data, "q3"))}</div>
        <div><strong>4th Quarter</strong><br>${escapeHtml(scorePair(data, "q4"))}</div>
        <div><strong>Overtime</strong><br>${escapeHtml(scorePair(data, "overtime"))}</div>
        <div><strong>Total</strong><br>${escapeHtml(formatScore(data))}</div>
      </div>
      <div class="basketball-table-wrap">
        <table class="basketball-score-table">
          <thead><tr><th>No.</th><th>Player</th><th>Fouls</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Total Pts</th><th>2PM</th><th>3PM</th><th>FTM</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>MIN</th></tr></thead>
          <tbody>${rows.map(renderPlayerRow).join("") || `<tr><td colspan="17">No player stat rows were saved.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="basketball-admin-grid">
        <div><strong>Team Fouls</strong><br>${escapeHtml(admin.teamFouls ?? "")}</div>
        <div><strong>Full Time-outs</strong><br>${escapeHtml(admin.fullTimeouts ?? "")}</div>
        <div><strong>20 Sec Time-outs</strong><br>${escapeHtml(admin.shortTimeouts ?? "")}</div>
        <div><strong>O.T. Time-outs</strong><br>${escapeHtml(admin.otTimeouts ?? "")}</div>
        <div><strong>Warnings</strong><br>${escapeHtml(admin.warnings ?? "")}</div>
        <div><strong>Possession</strong><br>${escapeHtml(admin.possessionSequence || "")}</div>
      </div>
    `;
  }

  // Player Row
  /**
   * Renders the player row section from normalized page state without mutating backend data.
   */
  function renderPlayerRow(row) {
    return `<tr>
      <td>${escapeHtml(row.number ?? "")}</td>
      <td>${playerLink(row.athleteId, row.name)}</td>
      <td>${escapeHtml(row.fouls ?? "")}</td>
      <td>${escapeHtml(row.q1 ?? "")}</td>
      <td>${escapeHtml(row.q2 ?? "")}</td>
      <td>${escapeHtml(row.q3 ?? "")}</td>
      <td>${escapeHtml(row.q4 ?? "")}</td>
      <td>${escapeHtml(row.points ?? "")}</td>
      <td>${escapeHtml(row.twoMade ?? "")}</td>
      <td>${escapeHtml(row.threeMade ?? "")}</td>
      <td>${escapeHtml(row.freeThrowsMade ?? "")}</td>
      <td>${escapeHtml(row.rebounds ?? "")}</td>
      <td>${escapeHtml(row.assists ?? "")}</td>
      <td>${escapeHtml(row.steals ?? "")}</td>
      <td>${escapeHtml(row.blocks ?? "")}</td>
      <td>${escapeHtml(row.turnovers ?? "")}</td>
      <td>${escapeHtml(row.minutes ?? "")}</td>
    </tr>`;
  }

  function playerLink(id, name) {
    const safeName = escapeHtml(name || "Player");
    return id ? `<a href="athlete-basketball-stats.html?athleteId=${encodeURIComponent(id)}">${safeName}</a>` : safeName;
  }

  // Normalize Line
  /**
   * Flattens current and legacy stat-line shapes into one structure for filters and renderers.
   */
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
