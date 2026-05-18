(function () {
  "use strict";
  // Shared App Access
  /**
   * Read-only table tennis score sheet renderer.
   *
   * Displays rubber-level saved data for review while reports aggregate from the
   * same statData structure.
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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Table Tennis Score Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved table tennis result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Table Tennis Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.category, data.venue].filter(Boolean).join(" - ");
      els.score.textContent = `${data.summary?.uwiRubbers ?? 0}-${data.summary?.opponentRubbers ?? 0}`;
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Table tennis score sheet could not be loaded.");
    }
  }

  // Page Display
  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(data) {
    const rubbers = Array.isArray(data.rubbers) ? data.rubbers : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Match Sheet</h2><p>${escapeHtml(data.result || "Saved table tennis result")}</p></div></div>
      <div class="tt-total-strip">
        <div><span>Rubbers</span><strong>${escapeHtml(data.summary?.uwiRubbers ?? 0)}-${escapeHtml(data.summary?.opponentRubbers ?? 0)}</strong></div>
        <div><span>Games</span><strong>${escapeHtml(data.summary?.uwiGames ?? 0)}-${escapeHtml(data.summary?.opponentGames ?? 0)}</strong></div>
        <div><span>Points</span><strong>${escapeHtml(data.summary?.pointsFor ?? 0)}-${escapeHtml(data.summary?.pointsAgainst ?? 0)}</strong></div>
        <div><span>Winner</span><strong>${escapeHtml(data.summary?.winner || "-")}</strong></div>
      </div>
      <table class="tt-result-table">
        <thead><tr><th>Rubber</th><th>Type</th><th>UWI</th><th>Opponent</th><th>Games</th><th>Points</th><th>Winner</th></tr></thead>
        <tbody>
          ${rubbers.map(renderRubber).join("") || `<tr><td colspan="7">No rubbers recorded.</td></tr>`}
        </tbody>
      </table>
      <div class="tt-total-strip" style="margin-top:18px;">
        <div><span>Match No.</span><strong>${escapeHtml(data.matchNumber || "-")}</strong></div>
        <div><span>Referee</span><strong>${escapeHtml(data.officials?.referee || "-")}</strong></div>
        <div><span>Umpire</span><strong>${escapeHtml(data.officials?.umpire || "-")}</strong></div>
        <div><span>Duration</span><strong>${escapeHtml(data.timing?.durationMinutes ? `${data.timing.durationMinutes} mins` : "-")}</strong></div>
      </div>
      ${data.notes ? `<p class="muted" style="margin-top:16px;">${escapeHtml(data.notes)}</p>` : ""}
    `;
  }

  // Rubber
  /**
   * Renders the rubber section from normalized page state without mutating backend data.
   */
  function renderRubber(rubber) {
    const gameScores = (rubber.games || []).map((game) => `${game.uwi || 0}-${game.opponent || 0}`).join(", ");
    return `
      <tr>
        <td>${escapeHtml(rubber.label || `Rubber ${rubber.number}`)}</td>
        <td>${escapeHtml(rubber.type || "singles")}</td>
        <td class="tt-side-link">${playerLinks(rubber.uwiPlayers)}</td>
        <td>${escapeHtml((rubber.opponentPlayers || []).map((player) => player.name).join(" / ") || "Opponent")}</td>
        <td>${escapeHtml(rubber.uwiGames ?? 0)}-${escapeHtml(rubber.opponentGames ?? 0)}</td>
        <td>${escapeHtml(rubber.uwiPoints ?? 0)}-${escapeHtml(rubber.opponentPoints ?? 0)}${gameScores ? `<br><small>${escapeHtml(gameScores)}</small>` : ""}</td>
        <td>${escapeHtml(rubber.winner || "-")}</td>
      </tr>
    `;
  }

  function playerLinks(players) {
    const list = Array.isArray(players) ? players : [];
    return list.map((player) => player.athleteId ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(player.athleteId)}">${escapeHtml(player.name || "Player")}</a>` : escapeHtml(player.name || "Player")).join(" / ") || "UWI";
  }

  // Normalize Line
  /**
   * Flattens current and legacy stat-line shapes into one structure for filters and renderers.
   */
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
