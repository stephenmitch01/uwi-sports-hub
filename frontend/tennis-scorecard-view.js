(function () {
  "use strict";
  // Shared App Access
  /**
   * Read-only lawn tennis score sheet renderer.
   *
   * Shows saved match rows and scores without recalculating or editing the
   * source stat line.
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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Tennis Score Sheet" });
    if (!session) return;
    if (!scorecardId) {
      show("Open this page from a saved tennis result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Tennis Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.category, data.venue, data.weather].filter(Boolean).join(" - ");
      els.score.textContent = `${data.summary?.uwiMatches ?? 0}-${data.summary?.opponentMatches ?? 0}`;
      els.result.textContent = data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Tennis score sheet could not be loaded.");
    }
  }

  // Page Display
  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(data) {
    const matches = Array.isArray(data.matches) ? data.matches : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Score Sheet</h2><p>${escapeHtml(data.result || "Saved tennis result")}</p></div></div>
      <div class="tennis-total-strip">
        <div><span>Matches</span><strong>${escapeHtml(data.summary?.uwiMatches ?? 0)}-${escapeHtml(data.summary?.opponentMatches ?? 0)}</strong></div>
        <div><span>Sets</span><strong>${escapeHtml(data.summary?.uwiSets ?? 0)}-${escapeHtml(data.summary?.opponentSets ?? 0)}</strong></div>
        <div><span>Games</span><strong>${escapeHtml(data.summary?.gamesFor ?? 0)}-${escapeHtml(data.summary?.gamesAgainst ?? 0)}</strong></div>
        <div><span>Winner</span><strong>${escapeHtml(data.summary?.winner || "-")}</strong></div>
      </div>
      <table class="tennis-result-table">
        <thead><tr><th>Match</th><th>Type</th><th>UWI</th><th>Opponent</th><th>Sets</th><th>Score</th><th>Winner</th></tr></thead>
        <tbody>
          ${matches.map(renderMatch).join("") || `<tr><td colspan="7">No matches recorded.</td></tr>`}
        </tbody>
      </table>
      <div class="tennis-total-strip" style="margin-top:18px;">
        <div><span>Place</span><strong>${escapeHtml(data.venue || "-")}</strong></div>
        <div><span>Weather</span><strong>${escapeHtml(data.weather || "-")}</strong></div>
        <div><span>Court</span><strong>${escapeHtml(data.courtConditions || "-")}</strong></div>
        <div><span>Duration</span><strong>${escapeHtml(data.timing?.durationMinutes ? `${data.timing.durationMinutes} mins` : "-")}</strong></div>
      </div>
      ${data.notes ? `<p class="muted" style="margin-top:16px;">${escapeHtml(data.notes)}</p>` : ""}
    `;
  }

  // Match
  /**
   * Renders the match section from normalized page state without mutating backend data.
   */
  function renderMatch(match) {
    const score = (match.setScores || []).map((set) => set.raw || `${set.uwi}-${set.opponent}`).join(", ");
    return `
      <tr>
        <td>${escapeHtml(match.label || `Match ${match.number}`)}</td>
        <td>${escapeHtml(match.type || "singles")}</td>
        <td class="tennis-side-link">${playerLinks(match.uwiPlayers)}</td>
        <td>${escapeHtml((match.opponentPlayers || []).map((player) => player.name).join(" / ") || "Opponent")}</td>
        <td>${escapeHtml(match.uwiSets ?? 0)}-${escapeHtml(match.opponentSets ?? 0)}</td>
        <td>${escapeHtml(score || "-")}</td>
        <td>${escapeHtml(match.winner || "-")}</td>
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
