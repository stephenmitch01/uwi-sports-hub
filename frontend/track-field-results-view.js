(function () {
  "use strict";

  /**
   * Read-only track and field result renderer.
   *
   * Presents official event rows without recalculating the saved result sheet,
   * preserving typed opponent entries and linked UWI athlete rows for review.
   */
  const APP = window.UWISportsHub;
  const resultId = new URLSearchParams(window.location.search).get("scorecardId") || new URLSearchParams(window.location.search).get("id") || "";
  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("resultsTitle"),
    meta: document.getElementById("resultsMeta"),
    back: document.getElementById("backLink"),
    topUwi: document.getElementById("topUwiText"),
    summary: document.getElementById("summaryText"),
    body: document.getElementById("resultsBody")
  };

  document.addEventListener("DOMContentLoaded", init);

  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "View Track and Field Results" });
    if (!session) return;
    if (!resultId) {
      show("Open this page from a saved track and field result.");
      return;
    }
    try {
      const row = await APP.apiGet(`/competition-stat-lines/${encodeURIComponent(resultId)}`);
      const line = normalizeLine(row);
      const data = line.statData || {};
      els.title.textContent = line.eventName || data.eventName || "Track and Field Results";
      els.meta.textContent = [formatDate(line.date), data.title, data.division, data.round].filter(Boolean).join(" • ");
      els.topUwi.textContent = data.summary?.topUwiResult || "-";
      els.summary.textContent = `${data.summary?.uwiEntries ?? 0} UWI entries`;
      els.back.href = line.competitionId ? `competition-view.html?id=${encodeURIComponent(line.competitionId)}` : "competitions.html";
      render(data);
    } catch (error) {
      show(error?.message || "Track and field results could not be loaded.");
    }
  }

  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(data) {
    if (data.resultType === "field") {
      renderField(data);
      return;
    }
    renderTrack(data);
  }

  /**
   * Renders the track section from normalized page state without mutating backend data.
   */
  function renderTrack(data) {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>${escapeHtml(data.eventName || "Track Event")}</h2><p>${escapeHtml([data.round, data.division, data.track?.recordNotes].filter(Boolean).join(" • ") || "Official track result")}</p></div></div>
      ${renderMeta(data)}
      <section class="tf-sheet">
        <div class="tf-title-row"><strong>Track Result</strong><span>${escapeHtml(data.eventName || "Track Event")}</span></div>
        <div class="tf-table-wrap">
          <table class="tf-results-table">
            <thead><tr><th>Place</th><th>No.</th><th>Name</th><th>Club</th><th>Lane</th><th>Time</th><th>A/B</th><th>Points</th><th>Status</th></tr></thead>
            <tbody>${entries.map(renderTrackRow).join("") || `<tr><td colspan="9">No track result rows were saved.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  /**
   * Renders the field section from normalized page state without mutating backend data.
   */
  function renderField(data) {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    els.body.innerHTML = `
      <div class="section-title"><div><h2>${escapeHtml(data.eventName || "Field Event")}</h2><p>${escapeHtml([data.round, data.division, data.field?.remarks].filter(Boolean).join(" • ") || "Official field result")}</p></div></div>
      ${renderMeta(data)}
      <section class="tf-sheet">
        <div class="tf-title-row"><strong>Field Event Results</strong><span>${escapeHtml(data.eventName || "Field Event")}</span></div>
        <div class="tf-table-wrap">
          <table class="tf-results-table field-table">
            <thead><tr><th>Rank</th><th>Bib #</th><th>Name</th><th>Club</th><th>1</th><th>2</th><th>3</th><th>Best</th><th>Rank</th><th>4</th><th>5</th><th>6</th><th>Best</th><th>Final Rank</th><th>Points</th></tr></thead>
            <tbody>${entries.map(renderFieldRow).join("") || `<tr><td colspan="15">No field result rows were saved.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  /**
   * Renders the meta section from normalized page state without mutating backend data.
   */
  function renderMeta(data) {
    const wind = data.resultType === "track" ? [data.track?.windDirection, data.track?.wind].filter((value) => value !== null && value !== undefined && value !== "").join(" ") : data.field?.wind;
    return `<div class="tf-result-meta">
      <div><strong>Event No.</strong>${escapeHtml(data.eventNumber || "—")}</div>
      <div><strong>Round</strong>${escapeHtml(data.round || "—")}</div>
      <div><strong>Wind</strong>${escapeHtml(wind || "—")}</div>
      <div><strong>Winning Result</strong>${escapeHtml(data.summary?.winningResult || "—")}</div>
    </div>`;
  }

  /**
   * Renders the track row section from normalized page state without mutating backend data.
   */
  function renderTrackRow(row) {
    return `<tr>
      <td>${escapeHtml(row.place ?? "")}</td>
      <td>${escapeHtml(row.bib || "")}</td>
      <td>${playerLink(row.athleteId, row.name)}</td>
      <td>${escapeHtml(row.club || "")}</td>
      <td>${escapeHtml(row.lane ?? "")}</td>
      <td>${escapeHtml(row.time || "")}</td>
      <td>${escapeHtml(row.ab || "")}</td>
      <td>${escapeHtml(row.points ?? "")}</td>
      <td>${escapeHtml(row.entryType === "uwi" ? "UWI" : "Opponent")}</td>
    </tr>`;
  }

  /**
   * Renders the field row section from normalized page state without mutating backend data.
   */
  function renderFieldRow(row) {
    const attempts = Array.isArray(row.attempts) ? row.attempts : [];
    return `<tr>
      <td>${escapeHtml(row.rank ?? "")}</td>
      <td>${escapeHtml(row.bib || "")}</td>
      <td>${playerLink(row.athleteId, row.name)}</td>
      <td>${escapeHtml(row.club || "")}</td>
      ${[0, 1, 2].map((index) => `<td>${escapeHtml(attempts[index] || "")}</td>`).join("")}
      <td>${escapeHtml(row.best1 || "")}</td>
      <td>${escapeHtml(row.rank1 ?? "")}</td>
      ${[3, 4, 5].map((index) => `<td>${escapeHtml(attempts[index] || "")}</td>`).join("")}
      <td>${escapeHtml(row.best || "")}</td>
      <td>${escapeHtml(row.finalRank ?? "")}</td>
      <td>${escapeHtml(row.points ?? "")}</td>
    </tr>`;
  }

  function playerLink(id, name) {
    const safeName = escapeHtml(name || "Athlete");
    return id ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(id)}">${safeName}</a>` : safeName;
  }

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
