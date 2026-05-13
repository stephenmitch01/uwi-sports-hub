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
    moves: document.getElementById("moveText"),
    body: document.getElementById("scorecardBody")
  };
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Chess Score Sheet" });
    if (!session) return;
    if (!scorecardId) return show("Open this page from a saved chess game.");
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Chess Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.round, data.board ? `Board ${data.board}` : "", data.opening].filter(Boolean).join(" - ");
      els.score.textContent = data.summary?.uwiScore != null ? String(data.summary.uwiScore) : "-";
      els.moves.textContent = String(data.summary?.moveCount ?? (data.moves || []).length);
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Chess score sheet could not be loaded.");
    }
  }

  function render(data) {
    const moveText = (data.moves || []).map((move) => `${move.number}. ${move.white || ""}${move.black ? ` ${move.black}` : ""}`).join(" ");
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Game Score</h2><p>${escapeHtml(data.summary?.resultLabel || data.result || "Saved chess game")}</p></div></div>
      <div class="chess-total-strip">
        <div><span>UWI Player</span><strong>${playerLink(data.uwiPlayer)}</strong></div>
        <div><span>Opponent</span><strong>${escapeHtml(data.opponent?.name || "Opponent")}</strong></div>
        <div><span>Color</span><strong>${escapeHtml(data.uwiPlayer?.color || "-")}</strong></div>
        <div><span>Score</span><strong>${escapeHtml(data.summary?.uwiScore ?? "-")}</strong></div>
      </div>
      <table class="chess-result-table">
        <tbody>
          <tr><th>Section</th><td>${escapeHtml(data.section || "-")}</td><th>Opening</th><td>${escapeHtml(data.opening || "-")}</td></tr>
          <tr><th>Time Control</th><td>${escapeHtml(data.timeControl || "-")}</td><th>Duration</th><td>${escapeHtml(data.duration || "-")}</td></tr>
          <tr><th>UWI Rating</th><td>${escapeHtml(data.uwiPlayer?.ranking || "-")}</td><th>Opponent Rating</th><td>${escapeHtml(data.opponent?.ranking || "-")}</td></tr>
          <tr><th>Pairing No.</th><td>${escapeHtml(data.pairingNumber || "-")}</td><th>Arbiter</th><td>${escapeHtml(data.signatures?.arbiter || "-")}</td></tr>
        </tbody>
      </table>
      <div class="chess-move-text">${escapeHtml(moveText || "No moves recorded.")}</div>
      ${data.notes ? `<p class="muted" style="margin-top:16px;">${escapeHtml(data.notes)}</p>` : ""}
    `;
  }

  function playerLink(player) {
    if (!player?.athleteId) return escapeHtml(player?.name || "UWI player");
    return `<a href="athlete-view.html?athleteId=${encodeURIComponent(player.athleteId)}">${escapeHtml(player.name || "UWI player")}</a>`;
  }

  function normalizeLine(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : row?.data && typeof row.data === "object" ? row.data : {};
    return { ...row, ...data, id: row.id, competitionId: row.competitionId || data.competitionId, eventName: row.eventName || data.eventName || data.title, date: row.date || data.date || row.createdAt, statData: data };
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
