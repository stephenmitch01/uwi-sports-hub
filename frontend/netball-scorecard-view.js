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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Netball Match Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved netball result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Netball Match Sheet";
      els.meta.textContent = [formatDate(line.date), data.uwiTeamName && data.opponentName ? `${data.uwiTeamName} v ${data.opponentName}` : "", data.venue].filter(Boolean).join(" • ");
      els.score.textContent = formatScore(data);
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Netball match sheet could not be loaded.");
    }
  }

  function render(data) {
    const rows = Array.isArray(data.playerStats) ? data.playerStats : [];
    const starters = Array.isArray(data.startingSeven) ? data.startingSeven : [];
    const subs = Array.isArray(data.substitutions) ? data.substitutions : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Match Sheet</h2><p>${escapeHtml(data.result || "Saved netball result")}</p></div></div>
      <div class="netball-summary-grid">
        <div><strong>Q1</strong><br>${escapeHtml(scorePair(data, "q1"))}</div>
        <div><strong>Q2</strong><br>${escapeHtml(scorePair(data, "q2"))}</div>
        <div><strong>Q3</strong><br>${escapeHtml(scorePair(data, "q3"))}</div>
        <div><strong>Q4 / OT</strong><br>${escapeHtml(scorePair(data, "q4"))} / ${escapeHtml(scorePair(data, "overtime"))}</div>
      </div>
      <div class="section-title section-title-sm"><div><h3>Starting 7</h3><p>Opening UWI court positions.</p></div></div>
      <div class="netball-position-list">${starters.map((row) => `<div><strong>${escapeHtml(row.position)}</strong><br>${playerLink(row.athleteId, row.name)}</div>`).join("") || "No starting lineup saved."}</div>
      <div class="netball-table-wrap">
        <table class="netball-score-table">
          <thead><tr><th>#</th><th>Player</th><th>Position</th><th>G</th><th>GA</th><th>Shot %</th><th>Goal Assists</th><th>Feeds</th><th>CPR</th><th>Intercepts</th><th>Deflections</th><th>Rebounds</th><th>Gains</th><th>Turnovers</th><th>Penalties</th><th>Minutes</th></tr></thead>
          <tbody>${rows.map(renderPlayerRow).join("") || `<tr><td colspan="16">No player stat rows were saved.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="netball-substitutions">
        <div class="section-title section-title-sm"><div><h3>Substitutions</h3><p>Recorded player and position changes.</p></div></div>
        ${subs.map(renderSubstitution).join("") || "No substitutions recorded."}
      </div>
    `;
  }

  function renderPlayerRow(row) {
    return `<tr><td>${escapeHtml(row.number ?? "")}</td><td>${playerLink(row.athleteId, row.name)}</td><td>${escapeHtml(row.position || "")}</td><td>${escapeHtml(row.goals ?? "")}</td><td>${escapeHtml(row.attempts ?? "")}</td><td>${escapeHtml(row.shootingPercentage || "")}</td><td>${escapeHtml(row.goalAssists ?? "")}</td><td>${escapeHtml(row.feeds ?? "")}</td><td>${escapeHtml(row.centrePassReceives ?? "")}</td><td>${escapeHtml(row.intercepts ?? "")}</td><td>${escapeHtml(row.deflections ?? "")}</td><td>${escapeHtml(row.rebounds ?? "")}</td><td>${escapeHtml(row.gains ?? "")}</td><td>${escapeHtml(row.turnovers ?? "")}</td><td>${escapeHtml(row.penalties ?? "")}</td><td>${escapeHtml(row.minutes ?? "")}</td></tr>`;
  }

  function renderSubstitution(row) {
    return `<div class="netball-sub-grid"><div>${escapeHtml(row.period || "")}</div><div>${playerLink(row.playerOffAthleteId, row.playerOffName)}</div><div>${playerLink(row.playerOnAthleteId, row.playerOnName)}</div><div>${escapeHtml(row.position || "")}</div><div>${escapeHtml(row.notes || "")}</div></div>`;
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
