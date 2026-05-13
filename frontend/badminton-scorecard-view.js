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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Badminton Match Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved badminton result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Badminton Match Sheet";
      els.meta.textContent = [formatDate(line.date), data.discipline, data.court ? `Court ${data.court}` : ""].filter(Boolean).join(" • ");
      els.score.textContent = formatGames(data);
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Badminton match sheet could not be loaded.");
    }
  }

  function render(data) {
    const games = Array.isArray(data.games) ? data.games : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Match Sheet</h2><p>${escapeHtml(data.result || "Saved badminton result")}</p></div></div>
      <div class="badminton-summary-grid">
        <div><strong>UWI Side</strong><br>${playerLinks(data.uwiPlayers)}</div>
        <div><strong>Opponent</strong><br>${escapeHtml((data.opponentPlayers || []).map((player) => player.name).join(" / ") || "Opponent")}</div>
        <div><strong>Status</strong><br>${escapeHtml(data.status || "completed")}</div>
        <div><strong>Duration</strong><br>${escapeHtml(data.timing?.durationMinutes ? `${data.timing.durationMinutes} mins` : "—")}</div>
      </div>
      <table class="badminton-result-table">
        <thead><tr><th>Side</th><th>Game 1</th><th>Game 2</th><th>Game 3</th><th>Games Won</th><th>Points</th></tr></thead>
        <tbody>
          <tr><td>${playerLinks(data.uwiPlayers)}</td>${[0, 1, 2].map((index) => `<td>${escapeHtml(games[index]?.uwi ?? "")}</td>`).join("")}<td>${escapeHtml(data.summary?.uwiGamesWon ?? "")}</td><td>${escapeHtml(data.summary?.pointsFor ?? "")}</td></tr>
          <tr><td>${escapeHtml((data.opponentPlayers || []).map((player) => player.name).join(" / ") || "Opponent")}</td>${[0, 1, 2].map((index) => `<td>${escapeHtml(games[index]?.opponent ?? "")}</td>`).join("")}<td>${escapeHtml(data.summary?.opponentGamesWon ?? "")}</td><td>${escapeHtml(data.summary?.pointsAgainst ?? "")}</td></tr>
        </tbody>
      </table>
      <div class="badminton-summary-grid">
        <div><strong>Match No.</strong><br>${escapeHtml(data.matchNumber || "—")}</div>
        <div><strong>Umpire</strong><br>${escapeHtml(data.officials?.umpire || "—")}</div>
        <div><strong>Service Judge</strong><br>${escapeHtml(data.officials?.serviceJudge || "—")}</div>
        <div><strong>Notes</strong><br>${escapeHtml(data.notes || "—")}</div>
      </div>
    `;
  }

  function playerLinks(players) {
    const list = Array.isArray(players) ? players : [];
    return list.map((player) => player.athleteId ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(player.athleteId)}">${escapeHtml(player.name || "Player")}</a>` : escapeHtml(player.name || "Player")).join(" / ") || "UWI";
  }

  function normalizeLine(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : row?.data && typeof row.data === "object" ? row.data : {};
    return { ...row, ...data, id: row.id, competitionId: row.competitionId || data.competitionId, eventName: row.eventName || data.eventName || data.title, date: row.date || data.date || row.createdAt, statData: data };
  }

  function formatGames(data) {
    const games = Array.isArray(data.games) ? data.games : [];
    return games.map((game) => `${game.uwi}-${game.opponent}`).join(", ") || "-";
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
