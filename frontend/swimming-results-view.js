(function () {
  "use strict";
  /**
   * Read-only swimming result sheet renderer.
   *
   * Displays saved lane results, linked UWI athletes, and manual opponent rows
   * from the same statData consumed by reports and athlete summaries.
   */
  const APP = window.UWISportsHub;
  const resultId = new URLSearchParams(window.location.search).get("scorecardId") || new URLSearchParams(window.location.search).get("id") || "";
  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("resultsTitle"),
    meta: document.getElementById("resultsMeta"),
    back: document.getElementById("backLink"),
    winning: document.getElementById("winningTimeText"),
    summary: document.getElementById("summaryText"),
    body: document.getElementById("resultsBody")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Swimming Results" });
    if (!session) return;
    if (!resultId) {
      show("Open this page from a saved swimming result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(resultId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.eventName || "Swimming Results Sheet";
      els.meta.textContent = [formatDate(line.date), data.title, data.session].filter(Boolean).join(" • ");
      els.winning.textContent = data.summary?.winningTime || "-";
      els.summary.textContent = `${data.summary?.uwiEntries ?? 0} UWI entries`;
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Swimming results sheet could not be loaded.");
    }
  }

  function render(data) {
    const lanes = Array.isArray(data.lanes) ? data.lanes : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>${escapeHtml(data.eventName || "Swimming Event")}</h2><p>${escapeHtml([data.round, data.course, data.ageGroup].filter(Boolean).join(" • ") || "Saved lane results")}</p></div></div>
      <div class="swim-sheet">
        <div class="swim-toolbar"><div>Session : ${escapeHtml(data.session || "—")}</div><div>SCR Sheet : F9</div><div>Awards : Ctrl-A</div></div>
        <div class="swim-event-bar">${escapeHtml(data.eventName || "Swimming Event Results")}</div>
        <div class="swim-table-wrap">
          <table class="swim-results-table">
            <thead><tr><th>Lane</th><th>Entry Type</th><th>Athlete Name</th><th>Yr</th><th>School</th><th>Seed Time</th><th>Finals Time</th><th>Place</th><th>Points</th><th>DQ</th><th>Exh</th></tr></thead>
            <tbody>${lanes.map(renderLane).join("") || `<tr><td colspan="11">No lane results were saved.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="swim-summary-grid">
          <div><strong>Winning Time</strong><br>${escapeHtml(data.summary?.winningTime || "—")}</div>
          <div><strong>UWI Entries</strong><br>${escapeHtml(data.summary?.uwiEntries ?? 0)}</div>
          <div><strong>Completed Times</strong><br>${escapeHtml(data.summary?.completedEntries ?? 0)}</div>
          <div><strong>DQ / Exh</strong><br>${escapeHtml(`${data.summary?.dqCount ?? 0} / ${data.summary?.exhibitionCount ?? 0}`)}</div>
        </div>
      </div>
    `;
  }

  function renderLane(row) {
    return `<tr>
      <td>${escapeHtml(row.lane ?? "")}</td>
      <td>${escapeHtml(row.entryType === "opponent" ? "Opponent" : "UWI")}</td>
      <td>${playerLink(row.athleteId, row.name)}</td>
      <td>${escapeHtml(row.year || "")}</td>
      <td>${escapeHtml(row.school || "")}</td>
      <td>${escapeHtml(row.seedTime || "")}</td>
      <td>${escapeHtml(row.finalTime || "")}</td>
      <td>${escapeHtml(row.place ?? "")}</td>
      <td>${escapeHtml(row.points ?? "")}</td>
      <td>${row.dq ? "Yes" : ""}</td>
      <td>${row.exhibition ? "Yes" : ""}</td>
    </tr>`;
  }

  function playerLink(id, name) {
    const safeName = escapeHtml(name || "Swimmer");
    return id ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(id)}">${safeName}</a>` : safeName;
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
