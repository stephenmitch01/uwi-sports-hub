(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const athleteId = params.get("athleteId") || params.get("id") || "";
  const sportSlug = APP.normalizeSportSlug(params.get("sport") || "");

  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("pageTitle"),
    subtitle: document.getElementById("pageSubtitle"),
    back: document.getElementById("backLink"),
    summary: document.getElementById("summarySection"),
    metrics: document.getElementById("metricsSection"),
    log: document.getElementById("logSection")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Mounts the signed-in shell, loads the athlete/profile context, then narrows the
   * shared athlete stat endpoint to the sport requested by the profile button.
   */
  async function init() {
    const session = await APP.mountSignedInShell({ active: "athletes", contextLabel: "Athlete Stats" });
    if (!session) return;
    if (!athleteId || !sportSlug) {
      show("Open this page from an athlete profile sport button.");
      return;
    }

    try {
      const [athlete, stats] = await Promise.all([
        APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}`),
        APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}/stats`, true)
      ]);
      const rows = normalizeArray(stats)
        .map(normalizeRow)
        .filter((row) => APP.normalizeSportSlug(row.sport || row.sportSlug || row.statData?.sport || row.statData?.sportSlug) === sportSlug);
      render(athlete?.data || athlete || {}, rows);
    } catch (error) {
      show(error?.message || "Athlete sport stats could not be loaded.");
    }
  }

  // Page Rendering
  /**
   * Builds the generic sport-stat view used when a sport does not yet need a fully
   * custom breakdown page. Dedicated pages can still exist for high-volume sports.
   */
  function render(athlete, rows) {
    const sportName = APP.getSportName?.(sportSlug) || formatSportName(sportSlug);
    const athleteName = displayName(athlete);
    const totals = aggregateRows(rows);
    const metrics = metricDefinitions(sportSlug, rows, totals);
    const competitions = unique(rows.map((row) => row.competitionName || row.statData?.competitionName).filter(Boolean));
    const seasons = unique(rows.map((row) => row.season).filter(Boolean));

    els.title.textContent = `${athleteName} ${sportName} Stats`;
    els.subtitle.textContent = `${sportName} records linked from score sheets, result sheets, and direct stat entries.`;
    els.back.href = `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;

    els.summary.innerHTML = `
      <div class="section-title"><div><h2>${escapeHtml(sportName)} Summary</h2><p>High-level context for this athlete in this sport.</p></div></div>
      <div class="summary-cards">
        ${mini("Stat Rows", rows.length, "Linked rows")}
        ${mini("Events / Matches", totals.entries, "Unique sources")}
        ${mini("Competitions", competitions.length, "Competition links")}
        ${mini("Seasons", seasons.length, "Seasons with data")}
      </div>
    `;

    els.metrics.innerHTML = `
      <div class="section-title"><div><h2>Key Metrics</h2><p>Aggregated from the saved rows for ${escapeHtml(sportName)}.</p></div></div>
      <div class="summary-cards">
        ${metrics.map((metric) => mini(metric.label, metric.value, metric.subtext)).join("")}
      </div>
    `;

    els.log.innerHTML = `
      <div class="section-title"><div><h2>Record Log</h2><p>Source rows used for the ${escapeHtml(sportName)} summary.</p></div></div>
      <div class="data-table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Competition</th><th>Metric</th><th>Performance</th><th>Value</th><th>Category</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(renderRow).join("") : `<tr><td colspan="6">No ${escapeHtml(sportName.toLowerCase())} stat rows are linked yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  // Stat Aggregation
  /**
   * Aggregates the normalized stat rows across the sport-specific payload shapes
   * emitted by score sheets, result sheets, and direct stat entries.
   */
  function aggregateRows(rows) {
    return rows.reduce((acc, row) => {
      const d = row.statData || {};
      acc.entriesSet.add(row.sourceId || row.id || `${row.competitionName || ""}:${row.eventName || ""}:${row.date || ""}`);
      acc.points += number(d.points ?? row.statValue);
      acc.goals += number(d.goals);
      acc.attempts += number(d.attempts);
      acc.goalAssists += number(d.goalAssists);
      acc.feeds += number(d.feeds);
      acc.centrePassReceives += number(d.centrePassReceives);
      acc.intercepts += number(d.intercepts);
      acc.deflections += number(d.deflections);
      acc.rebounds += number(d.rebounds);
      acc.gains += number(d.gains);
      acc.turnovers += number(d.turnovers);
      acc.penalties += number(d.penalties);
      acc.penaltyMinutes += row.eventType === "penalty" ? number(d.minutes ?? row.statValue) : 0;
      acc.minutes += number(d.minutes);
      acc.kills += number(d.kills);
      acc.aces += number(d.aces);
      acc.blocks += number(d.blocks);
      acc.assists += number(d.assists);
      acc.digs += number(d.digs);
      acc.serveReceive += number(d.serveReceive);
      acc.errors += number(d.errors);
      acc.gamesWon += number(d.summary?.uwiGamesWon ?? d.rubber?.uwiGames);
      acc.gamesLost += number(d.summary?.opponentGamesWon ?? d.rubber?.opponentGames);
      acc.setsWon += number(d.match?.uwiSets);
      acc.setsLost += number(d.match?.opponentSets);
      acc.pointsFor += number(d.summary?.pointsFor ?? d.rubber?.uwiPoints);
      acc.pointsAgainst += number(d.summary?.pointsAgainst ?? d.rubber?.opponentPoints);
      acc.finalScoreTotal += number(d.summary?.finalScore);
      acc.finalScoreCount += d.summary?.finalScore == null ? 0 : 1;
      acc.bestFinalScore = Math.max(acc.bestFinalScore, number(d.summary?.finalScore));
      acc.bestRank = Math.min(acc.bestRank, positiveNumber(d.summary?.rank) || Infinity);
      acc.chessPoints += number(d.summary?.uwiScore);
      acc.chessWins += /uwi won|win/i.test(String(d.summary?.resultLabel || d.result || row.performance || "")) ? 1 : 0;
      acc.chessDraws += /draw/i.test(String(d.summary?.resultLabel || d.result || row.performance || "")) ? 1 : 0;
      acc.movePairs += number(d.summary?.moveCount);
      acc.bestPlace = Math.min(acc.bestPlace, positiveNumber(d.place) || Infinity);
      const seconds = parseTime(d.finalTime || d.result || row.statValue);
      if (Number.isFinite(seconds)) acc.bestTimeSeconds = Math.min(acc.bestTimeSeconds, seconds);
      return acc;
    }, {
      entriesSet: new Set(),
      points: 0,
      goals: 0,
      attempts: 0,
      goalAssists: 0,
      feeds: 0,
      centrePassReceives: 0,
      intercepts: 0,
      deflections: 0,
      rebounds: 0,
      gains: 0,
      turnovers: 0,
      penalties: 0,
      penaltyMinutes: 0,
      minutes: 0,
      kills: 0,
      aces: 0,
      blocks: 0,
      assists: 0,
      digs: 0,
      serveReceive: 0,
      errors: 0,
      gamesWon: 0,
      gamesLost: 0,
      setsWon: 0,
      setsLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      finalScoreTotal: 0,
      finalScoreCount: 0,
      bestFinalScore: 0,
      bestRank: Infinity,
      chessPoints: 0,
      chessWins: 0,
      chessDraws: 0,
      movePairs: 0,
      bestPlace: Infinity,
      bestTimeSeconds: Infinity,
      get entries() { return this.entriesSet.size; }
    });
  }

  // Sport Metrics
  /**
   * Chooses the best summary metrics for each supported sport while preserving a
   * generic fallback for future sports that only expose simple stat lines.
   */
  function metricDefinitions(slug, rows, totals) {
    if (slug === "volleyball") return [
      metric("Matches", totals.entries, "Score sheets"),
      metric("Kills", totals.kills, "Attacking"),
      metric("Aces", totals.aces, "Serving"),
      metric("Blocks", totals.blocks, "Net defense"),
      metric("Assists", totals.assists, "Setting"),
      metric("Digs", totals.digs, "Defense"),
      metric("Serve Receive", totals.serveReceive, "Reception"),
      metric("Errors", totals.errors, "Recorded errors")
    ];
    if (slug === "netball") return [
      metric("Matches", totals.entries, "Match sheets"),
      metric("Goals", totals.goals, "Scored"),
      metric("Shooting", totals.attempts ? `${round((totals.goals / totals.attempts) * 100, 1)}%` : "-", "Goals / attempts"),
      metric("Goal Assists", totals.goalAssists, "Circle feeds"),
      metric("Feeds", totals.feeds, "Attacking feeds"),
      metric("CP Receives", totals.centrePassReceives, "Centre pass receives"),
      metric("Gains", totals.gains, "Defensive gains"),
      metric("Penalties", totals.penalties, "Whistled")
    ];
    if (slug === "hockey") return [
      metric("Matches", totals.entries, "Score sheets"),
      metric("Goals", rows.filter((row) => row.eventType === "goal").length, "Scoring rows"),
      metric("Assists", rows.filter((row) => row.eventType === "assist").length, "Assist rows"),
      metric("Penalties", rows.filter((row) => row.eventType === "penalty").length, "Penalty rows"),
      metric("Penalty Minutes", totals.penaltyMinutes, "Minutes"),
      metric("Points", rows.filter((row) => row.eventType === "goal").length + rows.filter((row) => row.eventType === "assist").length, "Goals + assists")
    ];
    if (slug === "badminton") return [
      metric("Matches", totals.entries, "Rubbers"),
      metric("Games Won", totals.gamesWon, "UWI side"),
      metric("Games Lost", totals.gamesLost, "Opponent side"),
      metric("Points For", totals.pointsFor, "Scored"),
      metric("Points Against", totals.pointsAgainst, "Allowed"),
      metric("Point Diff", totals.pointsFor - totals.pointsAgainst, "For - against")
    ];
    if (slug === "table-tennis") return [
      metric("Rubbers", rows.length, "Singles/doubles rows"),
      metric("Games Won", totals.gamesWon, "UWI side"),
      metric("Games Lost", totals.gamesLost, "Opponent side"),
      metric("Points For", totals.pointsFor, "Scored"),
      metric("Points Against", totals.pointsAgainst, "Allowed"),
      metric("Point Diff", totals.pointsFor - totals.pointsAgainst, "For - against")
    ];
    if (slug === "lawn-tennis") return [
      metric("Matches", rows.length, "Singles/doubles rows"),
      metric("Sets Won", totals.setsWon, "UWI side"),
      metric("Sets Lost", totals.setsLost, "Opponent side"),
      metric("Games For", rows.reduce((sum, row) => sum + number(row.statData?.match?.uwiGames), 0), "Scored"),
      metric("Games Against", rows.reduce((sum, row) => sum + number(row.statData?.match?.opponentGames), 0), "Allowed")
    ];
    if (slug === "swimming") return [
      metric("Events", totals.entries, "Result sheets"),
      metric("Points", totals.points, "Team points"),
      metric("Best Place", totals.bestPlace === Infinity ? "-" : totals.bestPlace, "Lowest place"),
      metric("Best Time", totals.bestTimeSeconds === Infinity ? "-" : formatTime(totals.bestTimeSeconds), "Fastest result"),
      metric("Completed", rows.filter((row) => !row.statData?.dq && !row.statData?.exhibition).length, "Official results")
    ];
    if (slug === "taekwondo") return [
      metric("Performances", rows.length, "Judge sheets"),
      metric("Avg Score", totals.finalScoreCount ? round(totals.finalScoreTotal / totals.finalScoreCount, 2) : "-", "Final score"),
      metric("Best Score", totals.bestFinalScore || "-", "Highest score"),
      metric("Best Rank", totals.bestRank === Infinity ? "-" : totals.bestRank, "Lowest rank")
    ];
    if (slug === "chess") return [
      metric("Games", totals.entries, "Score sheets"),
      metric("Points", totals.chessPoints, "UWI points"),
      metric("Wins", totals.chessWins, "Result rows"),
      metric("Draws", totals.chessDraws, "Result rows"),
      metric("Avg Move Pairs", rows.length ? round(totals.movePairs / rows.length, 1) : "-", "Recorded moves")
    ];
    return [
      metric("Entries", rows.length, "Linked rows"),
      metric("Events", totals.entries, "Unique sources"),
      metric("Numeric Value", rows.reduce((sum, row) => sum + number(row.statValue), 0), "Sum of numeric values")
    ];
  }

  function renderRow(row) {
    return `
      <tr>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${escapeHtml(row.competitionName || row.statData?.competitionName || "Competition")}</td>
        <td>${escapeHtml(row.statName || row.eventName || "Stat")}</td>
        <td>${escapeHtml(row.performance || "-")}</td>
        <td>${escapeHtml(row.statValue ?? "-")}</td>
        <td>${escapeHtml(cleanCategory(row.category || row.statData?.result || "-"))}</td>
      </tr>
    `;
  }

  // Data Normalization
  /**
   * Keeps current, nested, and older stat payloads readable from one rendering path.
   */
  function normalizeRow(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || row?.data || {};
    return {
      ...row,
      sport: row.sport || data.sport,
      sportSlug: row.sportSlug || data.sportSlug,
      statData: data,
      date: row.date || data.date || row.createdAt,
      competitionName: row.competitionName || data.competitionName || data.title,
      eventName: row.eventName || data.eventName || data.title
    };
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.stats)) return payload.stats;
    return [];
  }

  function metric(label, value, subtext) {
    return { label, value, subtext };
  }

  function mini(label, value, sub) {
    return `<div class="mini-card"><div class="mini-label">${escapeHtml(label)}</div><div class="mini-value">${escapeHtml(value)}</div><div class="mini-sub">${escapeHtml(sub)}</div></div>`;
  }

  function displayName(athlete) {
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || "Athlete";
  }

  function cleanCategory(value) {
    return String(value || "").replace(/\u00e2\u20ac\u00a2/g, "-").replace(/\s+-\s+/g, " - ");
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function positiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function parseTime(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value || "").trim();
    if (!text) return NaN;
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return Number(text.replace(/[^\d.]/g, ""));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  }

  function formatTime(seconds) {
    const value = Number(seconds || 0);
    if (!value) return "-";
    const minutes = Math.floor(value / 60);
    const rest = value - minutes * 60;
    return minutes ? `${minutes}:${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
  }

  function round(value, places) {
    const factor = 10 ** (places || 0);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function formatSportName(slug) {
    return String(slug || "").split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || "Sport";
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
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }
})();
