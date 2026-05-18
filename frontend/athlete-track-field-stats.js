(function () {
  "use strict";

  /**
   * Athlete track and field stats projection.
   *
   * Aggregates saved event result sheets into track/field appearances, marks,
   * event breakdowns, and personal-best style summaries for one athlete.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const athleteId = params.get("athleteId") || params.get("id") || "";
  const selectedSeason = params.get("season") || "all";
  const selectedCompetition = params.get("competitionId") || "all";

  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("pageTitle"),
    back: document.getElementById("backLink"),
    summary: document.getElementById("summarySection"),
    track: document.getElementById("trackSection"),
    field: document.getElementById("fieldSection"),
    log: document.getElementById("eventLogSection")
  };

  document.addEventListener("DOMContentLoaded", init);

  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "athletes", contextLabel: "Track and Field Stats" });
    if (!session) return;
    if (!athleteId) {
      show("Open this page from an athlete profile.");
      return;
    }
    try {
      const [athlete, stats] = await Promise.all([
        APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}`),
        APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}/stats`, true)
      ]);
      const rows = normalizeArray(stats).map(normalizeRow).filter((row) => APP.normalizeSportSlug(row.sport || row.sportSlug) === "track-and-field");
      els.title.textContent = `${displayName(athlete)} Track and Field Stats`;
      els.back.href = `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;
      render(rows);
    } catch (error) {
      show(error?.message || "Detailed track and field stats could not be loaded.");
    }
  }

  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render(rows) {
    const scoped = rows.filter((row) => {
      const seasonOk = selectedSeason === "all" || String(row.season || "") === selectedSeason;
      const competitionOk = selectedCompetition === "all" || String(row.competitionId || row.linkedCompetitionId || "") === selectedCompetition;
      return seasonOk && competitionOk;
    });
    const trackRows = scoped.filter(isTrackRow);
    const fieldRows = scoped.filter(isFieldRow);
    const seasons = ["all"].concat(unique(rows.map((row) => row.season).filter(Boolean)));
    const competitions = uniqueBy(rows.filter((row) => row.competitionId || row.linkedCompetitionId || row.competitionName), (row) => row.competitionId || row.linkedCompetitionId || row.competitionName);
    const totals = summarize(scoped);

    els.summary.innerHTML = `
      <div class="section-title"><div><h2>Track and Field Summary</h2><p>Result-sheet records from 2026 onwards. Filter by season or competition.</p></div></div>
      <div class="stats-toolbar compact-filter-row">
        <div><label for="seasonScope">Season</label><select class="select" id="seasonScope">${seasons.map((season) => `<option value="${escapeHtml(season)}" ${season === selectedSeason ? "selected" : ""}>${escapeHtml(season === "all" ? "All-Time" : season)}</option>`).join("")}</select></div>
        <div><label for="competitionScope">Competition</label><select class="select" id="competitionScope"><option value="all">All Competitions</option>${competitions.map((row) => {
          const id = row.competitionId || row.linkedCompetitionId || row.competitionName;
          return `<option value="${escapeHtml(id)}" ${String(id) === String(selectedCompetition) ? "selected" : ""}>${escapeHtml(row.competitionName || row.eventName || "Competition")}</option>`;
        }).join("")}</select></div>
        <a class="btn btn-soft" href="athlete-view.html?athleteId=${encodeURIComponent(athleteId)}">Back to Profile</a>
      </div>
      <div class="summary-cards">
        ${mini("Events", totals.events, "Result rows")}
        ${mini("Track Events", trackRows.length, "Timed results")}
        ${mini("Field Events", fieldRows.length, "Measured marks")}
        ${mini("Points", totals.points, "Team points")}
      </div>`;
    bindScopeFilters();
    els.track.innerHTML = aggregateTable("Track Events", trackRows, trackAggregate, [["events", "Events"], ["bestTime", "Best Time"], ["avgPlace", "Avg Place"], ["wins", "Wins"], ["topThree", "Top 3"], ["points", "Points"]]);
    els.field.innerHTML = aggregateTable("Field Events", fieldRows, fieldAggregate, [["events", "Events"], ["bestMark", "Best Mark"], ["avgPlace", "Avg Place"], ["wins", "Wins"], ["topThree", "Top 3"], ["points", "Points"]]);
    els.log.innerHTML = collapsibleLog(scoped);
  }

  function aggregateTable(title, rows, aggregateFn, columns) {
    const groups = unique(rows.map((row) => row.statData?.eventName || row.statName || row.eventName || "Event")).map((name) => {
      const eventRows = rows.filter((row) => (row.statData?.eventName || row.statName || row.eventName || "Event") === name);
      return { name, stats: aggregateFn(eventRows) };
    });
    return `<div class="section-title"><div><h2>${escapeHtml(title)}</h2><p>Aggregated by event discipline.</p></div></div>
      <div class="data-table-wrap"><table class="table"><thead><tr><th>Event</th>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>
      ${groups.length ? groups.map((group) => `<tr><td><strong>${escapeHtml(group.name)}</strong></td>${columns.map(([key]) => `<td>${escapeHtml(group.stats[key] ?? "—")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length + 1}">No ${escapeHtml(title.toLowerCase())} are linked yet.</td></tr>`}
      </tbody></table></div>`;
  }

  function collapsibleLog(rows) {
    return `<details class="nested-detail"><summary>Event Log (${rows.length})</summary><p class="muted" style="margin:8px 0 12px;">Open this section for event-by-event track and field records.</p>
      <div class="data-table-wrap"><table class="table"><thead><tr><th>Date</th><th>Competition</th><th>Type</th><th>Event</th><th>Result</th><th>Place</th><th>Points</th><th>Round</th></tr></thead><tbody>
      ${rows.length ? rows.map((row) => {
        const d = row.statData || {};
        return `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(row.competitionName || "Competition")}</td><td>${escapeHtml(d.resultType === "field" ? "Field" : "Track")}</td><td>${escapeHtml(d.eventName || row.statName || row.eventName || "Event")}</td><td>${escapeHtml(d.best || d.time || row.statValue || "")}</td><td>${escapeHtml(d.finalRank || d.place || "")}</td><td>${escapeHtml(d.points ?? "")}</td><td>${escapeHtml(d.round || row.category || "")}</td></tr>`;
      }).join("") : `<tr><td colspan="8">No event rows are linked yet.</td></tr>`}
      </tbody></table></div></details>`;
  }

  function trackAggregate(rows) {
    const best = rows.slice().filter((row) => finiteNumber(row.statData?.timeNumber) !== null).sort((a, b) => finiteNumber(a.statData?.timeNumber) - finiteNumber(b.statData?.timeNumber))[0];
    return commonAggregate(rows, { bestTime: best?.statData?.time || best?.statValue || "—" });
  }

  function fieldAggregate(rows) {
    const best = rows.slice().filter((row) => finiteNumber(row.statData?.bestNumber) !== null).sort((a, b) => finiteNumber(b.statData?.bestNumber) - finiteNumber(a.statData?.bestNumber))[0];
    return commonAggregate(rows, { bestMark: best?.statData?.best || best?.statValue || "—" });
  }

  function commonAggregate(rows, extra) {
    const places = rows.map((row) => finiteNumber(row.statData?.finalRank || row.statData?.place)).filter((value) => value !== null && value > 0);
    return {
      events: rows.length,
      avgPlace: places.length ? round(places.reduce((a, b) => a + b, 0) / places.length) : "—",
      wins: places.filter((value) => value === 1).length,
      topThree: places.filter((value) => value <= 3).length,
      points: rows.reduce((total, row) => total + number(row.statData?.points), 0),
      ...extra
    };
  }

  function summarize(rows) {
    return { events: rows.length, points: rows.reduce((total, row) => total + number(row.statData?.points), 0) };
  }

  function isTrackRow(row) {
    const type = row.statData?.resultType || row.eventType;
    return type === "track" || type === "relay";
  }

  function isFieldRow(row) {
    const type = row.statData?.resultType || row.eventType;
    return type === "field" || ["horizontal-jump", "vertical-jump", "throw"].includes(type);
  }

  /**
   * Binds the scope filters interactions once so rerenders do not duplicate listeners.
   */
  function bindScopeFilters() {
    document.getElementById("seasonScope")?.addEventListener("change", updateScope);
    document.getElementById("competitionScope")?.addEventListener("change", updateScope);
  }

  /**
   * Updates derived UI state from the current form/model values without persisting changes directly.
   */
  function updateScope() {
    const url = new URL(window.location.href);
    url.searchParams.set("athleteId", athleteId);
    url.searchParams.set("season", document.getElementById("seasonScope")?.value || "all");
    url.searchParams.set("competitionId", document.getElementById("competitionScope")?.value || "all");
    window.location.href = url.toString();
  }

  /**
   * Normalizes row data across current API and legacy nested shapes.
   */
  function normalizeRow(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || row?.data || {};
    return { ...row, statData: data, date: row.date || data.date || row.createdAt };
  }
  function mini(label, value, sub) { return `<div class="mini-card"><div class="mini-label">${escapeHtml(label)}</div><div class="mini-value">${escapeHtml(value)}</div><div class="mini-sub">${escapeHtml(sub)}</div></div>`; }
  /**
   * Accepts current and nested API response shapes so pages remain compatible during backend evolution.
   */
  function normalizeArray(payload) { if (Array.isArray(payload)) return payload; if (Array.isArray(payload?.data)) return payload.data; if (Array.isArray(payload?.stats)) return payload.stats; return []; }
  function unique(values) { return [...new Set(values)]; }
  function uniqueBy(rows, getKey) { const map = new Map(); rows.forEach((row) => { const key = getKey(row); if (key && !map.has(key)) map.set(key, row); }); return Array.from(map.values()); }
  function displayName(athlete) { const data = athlete?.data || athlete; return data?.fullName || [data?.firstName, data?.lastName].filter(Boolean).join(" ") || "Athlete"; }
  function finiteNumber(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }
  function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(); }
  function show(text) { els.msg.className = "message error is-visible"; els.msg.textContent = text; }
  function escapeHtml(value) { return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
})();
