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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Volleyball Scoresheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved volleyball result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Volleyball Scoresheet";
      els.meta.textContent = [formatDate(line.date), data.uwiTeamName && data.opponentName ? `${data.uwiTeamName} v ${data.opponentName}` : "", data.site].filter(Boolean).join(" • ");
      els.score.textContent = formatFinalSets(data);
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Volleyball scoresheet could not be loaded.");
    }
  }

  function render(data) {
    const rows = Array.isArray(data.playerStats) ? data.playerStats : [];
    const sets = Array.isArray(data.sets) ? data.sets : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Scoresheet</h2><p>${escapeHtml(data.result || "Saved volleyball result")}</p></div></div>
      <div class="volleyball-summary-grid">
        ${sets.map((set) => `<div><strong>Set ${escapeHtml(set.set)}</strong><br>${escapeHtml(set.uwiScore ?? 0)}-${escapeHtml(set.opponentScore ?? 0)}</div>`).join("") || "<div>No set scores saved.</div>"}
      </div>
      <div class="volleyball-table-wrap">
        <table class="volleyball-score-table">
          <thead><tr><th>Serve Order</th><th>Player</th><th>Player No.</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Assists</th><th>Digs</th><th>Serve Rec.</th><th>Errors</th><th>Subs</th><th>Time-outs</th><th>Captain</th><th>Libero</th></tr></thead>
          <tbody>${rows.map(renderPlayerRow).join("") || `<tr><td colspan="14">No player stat rows were saved.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="volleyball-notes-grid">
        <div><strong>Comments</strong><p>${escapeHtml(data.comments || "-")}</p></div>
        <div><strong>Official Notes</strong><p>${escapeHtml(data.officialNotes || "-")}</p></div>
      </div>
    `;
  }

  function renderPlayerRow(row) {
    return `<tr><td>${escapeHtml(row.serveOrder || "")}</td><td>${playerLink(row.athleteId, row.name)}</td><td>${escapeHtml(row.number ?? "")}</td><td>${escapeHtml(row.kills ?? "")}</td><td>${escapeHtml(row.aces ?? "")}</td><td>${escapeHtml(row.blocks ?? "")}</td><td>${escapeHtml(row.assists ?? "")}</td><td>${escapeHtml(row.digs ?? "")}</td><td>${escapeHtml(row.serveReceive ?? "")}</td><td>${escapeHtml(row.errors ?? "")}</td><td>${escapeHtml(row.substitutions ?? "")}</td><td>${escapeHtml(row.timeouts ?? "")}</td><td>${row.captain ? "Yes" : ""}</td><td>${row.libero ? "Yes" : ""}</td></tr>`;
  }

  function playerLink(id, name) {
    const safeName = escapeHtml(name || "Player");
    return id ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(id)}">${safeName}</a>` : safeName;
  }

  function normalizeLine(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : row?.data && typeof row.data === "object" ? row.data : {};
    return { ...row, ...data, id: row.id, competitionId: row.competitionId || data.competitionId, eventName: row.eventName || data.eventName || data.title, date: row.date || data.date || row.createdAt, statData: data };
  }

  function formatFinalSets(data) {
    return `${data.finalSets?.uwi ?? 0}-${data.finalSets?.opponent ?? 0}`;
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
