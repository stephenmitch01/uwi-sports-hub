(function () {
  "use strict";
  // Shared App Access
  /**
   * Read-only taekwondo score sheet renderer.
   *
   * Keeps bout and scoring detail visible from persisted statData for technical
   * review and report traceability.
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
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Taekwondo Score Sheet" });
    if (!session) return;
    if (!scorecardId) return show("Open this page from a saved taekwondo result.");
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(scorecardId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.title || "Taekwondo Score Sheet";
      els.meta.textContent = [formatDate(line.date), data.division, data.round, data.poomsae].filter(Boolean).join(" - ");
      els.score.textContent = data.summary?.finalScore != null ? Number(data.summary.finalScore).toFixed(2) : "-";
      els.result.textContent = data.summary?.result || data.result || "Result recorded";
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Taekwondo score sheet could not be loaded.");
    }
  }

  // Page Display
  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(data) {
    const judges = Array.isArray(data.judges) ? data.judges : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>Judge Score Sheet</h2><p>${escapeHtml(data.result || "Saved poomsae score")}</p></div></div>
      <div class="tkd-total-strip">
        <div><span>Athlete</span><strong>${athleteLink(data.athlete)}</strong></div>
        <div><span>Final Score</span><strong>${escapeHtml(data.summary?.finalScore != null ? Number(data.summary.finalScore).toFixed(2) : "-")}</strong></div>
        <div><span>Rank</span><strong>${escapeHtml(data.summary?.rank || data.rank || "-")}</strong></div>
        <div><span>Judges</span><strong>${escapeHtml(data.summary?.judgeCount ?? judges.length)}</strong></div>
      </div>
      <table class="tkd-result-table">
        <thead><tr><th>Judge</th><th>Accuracy</th><th>Presentation</th><th>Penalty</th><th>Total</th><th>Comments</th></tr></thead>
        <tbody>
          ${judges.map(renderJudge).join("") || `<tr><td colspan="6">No judge scores recorded.</td></tr>`}
        </tbody>
      </table>
      <div class="tkd-total-strip" style="margin-top:18px;">
        <div><span>Court</span><strong>${escapeHtml(data.court || "-")}</strong></div>
        <div><span>Division</span><strong>${escapeHtml(data.division || "-")}</strong></div>
        <div><span>Poomsae</span><strong>${escapeHtml(data.poomsae || "-")}</strong></div>
        <div><span>Best Judge</span><strong>${escapeHtml(data.summary?.bestJudgeScore != null ? Number(data.summary.bestJudgeScore).toFixed(2) : "-")}</strong></div>
      </div>
    `;
  }

  // Judge
  /**
   * Renders the judge section from normalized page state without mutating backend data.
   */
  function renderJudge(judge) {
    return `
      <tr>
        <td>${escapeHtml(judge.name || `Judge ${judge.number}`)}<br><small>${escapeHtml(judge.position || "")}</small></td>
        <td>${escapeHtml(Number(judge.accuracyScore || 0).toFixed(2))}</td>
        <td>${escapeHtml(Number(judge.presentationScore || 0).toFixed(2))}</td>
        <td>${escapeHtml(Number(judge.penalty || 0).toFixed(2))}</td>
        <td><strong>${escapeHtml(Number(judge.total || 0).toFixed(2))}</strong></td>
        <td>${escapeHtml(judge.comments || "-")}</td>
      </tr>
    `;
  }

  function athleteLink(athlete) {
    if (!athlete?.athleteId) return escapeHtml(athlete?.name || "UWI athlete");
    return `<a href="athlete-view.html?athleteId=${encodeURIComponent(athlete.athleteId)}">${escapeHtml(athlete.name || "UWI athlete")}</a>`;
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
