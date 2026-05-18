(function () {
  "use strict";

  /**
   * Athlete cricket stats projection.
   *
   * Aggregates cricket scorecard rows for one athlete into batting, bowling, and
   * fielding summaries. The page depends on athlete IDs saved in scorecards.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const athleteId = params.get("athleteId") || params.get("id") || "";
  const selectedFormat = params.get("format") || "";
  const selectedType = params.get("type") || "";
  const selectedSeason = params.get("season") || "all";
  const selectedCompetition = params.get("competitionId") || "all";
  const FORMAT_ORDER = ["t20", "40-over", "50-over", "3-day", "other"];
  const FORMAT_LABELS = {
    "t20": "T20",
    "40-over": "40 Over",
    "50-over": "50 Over",
    "3-day": "3 Day",
    other: "Other Formats"
  };

  const els = {
    msg: document.getElementById("pageMessage"),
    title: document.getElementById("pageTitle"),
    back: document.getElementById("backLink"),
    summary: document.getElementById("summarySection"),
    batting: document.getElementById("battingSection"),
    bowling: document.getElementById("bowlingSection"),
    dismissalBowling: document.getElementById("dismissalBowlingSection"),
    fielding: document.getElementById("fieldingSection")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const session = await APP.mountSignedInShell({ active: "athletes", contextLabel: "Cricket Stats" });
    if (!session) return;
    if (!athleteId) {
      show("Open this page from an athlete profile.");
      return;
    }

    const [athlete, stats] = await Promise.all([
      APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}`),
      APP.apiGet(`/athletes/${encodeURIComponent(athleteId)}/stats`, true)
    ]);
    const rows = normalizeArray(stats)
      .map(normalizeRow)
      .filter((row) => APP.normalizeSportSlug(row.sport || row.sportSlug) === "cricket");

    els.title.textContent = `${displayName(athlete)} Cricket Stats`;
    els.back.href = `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;
    render(rows, athlete);
  }

  function render(rows, athlete) {
    const scopedRows = rows.filter((row) => {
      const seasonOk = selectedSeason === "all" || String(row.season || "") === selectedSeason;
      const competitionOk = selectedCompetition === "all" || String(row.competitionId || row.linkedCompetitionId || "") === selectedCompetition;
      return seasonOk && competitionOk;
    });
    const seasons = ["all"].concat(unique(rows.map((row) => row.season).filter(Boolean)));
    const competitions = uniqueBy(rows.filter((row) => row.competitionId || row.linkedCompetitionId || row.competitionName), (row) => row.competitionId || row.linkedCompetitionId || row.competitionName);

    els.summary.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Cricket Summary</h2>
          <p>Scorecard-linked records from 2026 onwards. Use the filters to view all-time, season, or competition-specific totals.</p>
        </div>
      </div>
      <div class="stats-toolbar compact-filter-row">
        <div>
          <label for="seasonScope">Season</label>
          <select class="select" id="seasonScope">
            ${seasons.map((season) => `<option value="${escapeHtml(season)}" ${season === selectedSeason ? "selected" : ""}>${escapeHtml(season === "all" ? "All-Time" : season)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="competitionScope">Competition</label>
          <select class="select" id="competitionScope">
            <option value="all">All Competitions</option>
            ${competitions.map((row) => {
              const id = row.competitionId || row.linkedCompetitionId || row.competitionName;
              return `<option value="${escapeHtml(id)}" ${String(id) === String(selectedCompetition) ? "selected" : ""}>${escapeHtml(row.competitionName || row.eventName || "Competition")}</option>`;
            }).join("")}
          </select>
        </div>
        <a class="btn btn-soft" href="athlete-view.html?athleteId=${encodeURIComponent(athleteId)}">Back to Profile</a>
      </div>
      <div class="summary-cards">
        <div class="mini-card"><div class="mini-label">Batting Innings</div><div class="mini-value">${rowsOf(scopedRows, "batting").length}</div><div class="mini-sub">Recorded innings</div></div>
        <div class="mini-card"><div class="mini-label">Runs</div><div class="mini-value">${sum(rowsOf(scopedRows, "batting"), "runs")}</div><div class="mini-sub">All formats</div></div>
        <div class="mini-card"><div class="mini-label">Wickets</div><div class="mini-value">${sum(rowsOf(scopedRows, "bowling"), "wickets")}</div><div class="mini-sub">Bowling credits</div></div>
        <div class="mini-card"><div class="mini-label">Catches</div><div class="mini-value">${sum(rowsOf(scopedRows, "fielding"), "catches")}</div><div class="mini-sub">Fielding credits</div></div>
      </div>
    `;

    bindScopeFilters();

    if (selectedFormat && selectedType) {
      renderDrilldown(scopedRows, athlete);
      return;
    }

    els.batting.innerHTML = aggregateTable("Batting", scopedRows, "batting", battingAggregate, battingColumns());
    els.bowling.innerHTML = aggregateTable("Bowling", scopedRows, "bowling", bowlingAggregate, bowlingColumns());
    els.dismissalBowling.innerHTML = aggregateTable("Bowler Dismissal Credits", scopedRows, "dismissal-bowling", dismissalAggregate, [
      ["matches", "Matches"], ["credits", "Credits"], ["caught", "Caught"], ["bowled", "Bowled"], ["lbw", "LBW"], ["stumped", "Stumped"]
    ]);
    els.fielding.innerHTML = aggregateTable("Fielding", scopedRows, "fielding", fieldingAggregate, [
      ["matches", "Matches"], ["innings", "Innings"], ["catches", "Catches"], ["stumpings", "Stumpings"], ["runOuts", "Run Outs"], ["dismissals", "Total Dismissals"]
    ]);
  }

  function renderDrilldown(rows, athlete) {
    const filtered = rowsOf(rows, selectedType).filter((row) => row.format === selectedFormat);
    const title = `${FORMAT_LABELS[selectedFormat] || selectedFormat} ${labelType(selectedType)}`;
    const summary = selectedType === "batting" ? battingAggregate(filtered) :
      selectedType === "bowling" ? bowlingAggregate(filtered) :
      selectedType === "fielding" ? fieldingAggregate(filtered) :
      dismissalAggregate(filtered);

    els.batting.innerHTML = `
      <div class="section-title">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(displayName(athlete))} game-by-game ${labelType(selectedType).toLowerCase()} detail. Stats reflect 2026 onwards.</p>
        </div>
        <a class="btn btn-soft" href="${baseUrl()}">Back to Format Summary</a>
      </div>
      <div class="summary-cards">
        ${Object.entries(summary).slice(0, 8).map(([key, value]) => `<div class="mini-card"><div class="mini-label">${escapeHtml(titleCase(key))}</div><div class="mini-value">${escapeHtml(value)}</div></div>`).join("")}
      </div>
      ${drilldownTable(filtered, selectedType)}
    `;
    els.bowling.innerHTML = "";
    els.dismissalBowling.innerHTML = "";
    els.fielding.innerHTML = "";
  }

  function aggregateTable(title, rows, type, aggregateFn, columns) {
    const groups = FORMAT_ORDER.map((format) => {
      const groupRows = rowsOf(rows, type).filter((row) => row.format === format);
      return { format, label: FORMAT_LABELS[format], stats: aggregateFn(groupRows), count: groupRows.length };
    });
    return `
      <div class="section-title"><div><h2>${escapeHtml(title)}</h2><p>Click a format row to view game-by-game detail.</p></div></div>
      <div class="data-table-wrap">
        <table class="table stat-breakdown-table">
          <thead><tr><th>Format</th>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>
            ${groups.map((group) => `
              <tr class="${group.count ? "clickable-row" : ""}" ${group.count ? `data-href="${escapeHtml(baseUrl({ format: group.format, type }))}"` : ""}>
                <td><strong>${escapeHtml(group.label)}</strong></td>
                ${columns.map(([key]) => `<td>${escapeHtml(group.stats[key] ?? "—")}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function drilldownTable(rows, type) {
    if (!rows.length) return `<div class="empty-state">No ${labelType(type).toLowerCase()} records match this view.</div>`;
    const headers = type === "batting"
      ? ["Date", "Competition", "Innings", "Runs", "Balls", "4s", "6s", "1s", "2s", "3s", "Dots", "Dot %", "SR", "Dismissal"]
      : type === "bowling"
        ? ["Date", "Competition", "Innings", "Overs", "Maidens", "Runs", "Wickets", "Econ", "SR", "Notes"]
        : type === "fielding"
          ? ["Date", "Competition", "Innings", "Type", "Batter", "Catches", "Stumpings", "Run Outs"]
          : ["Date", "Competition", "Innings", "Batter", "Dismissal", "Fielder / Keeper"];
    return `
      <div class="data-table-wrap">
        <table class="table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${drillCells(row, type).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function drillCells(row, type) {
    const d = row.statData || {};
    if (type === "batting") {
      const balls = number(d.balls);
      const dots = number(d.dots ?? d.dotBalls);
      return [formatDate(row.date), row.competitionName, row.category || d.innings, d.runs, d.balls, d.fours, d.sixes, d.ones, d.twos, d.threes, dots || "", balls ? `${round((dots / balls) * 100)}%` : "", d.strikeRate || strikeRate(number(d.runs), balls), d.dismissalLabel || d.howOut];
    }
    if (type === "bowling") {
      const balls = ballsFromOvers(d.overs);
      const wickets = number(d.wickets);
      return [formatDate(row.date), row.competitionName, row.category || d.innings, d.overs, d.maidens, d.runs, d.wickets, d.economy || economy(number(d.runs), balls), wickets ? round(balls / wickets) : "", d.notes];
    }
    if (type === "fielding") {
      return [formatDate(row.date), row.competitionName, row.category || d.innings, d.fieldingType, d.batterName, d.catches, d.stumpings, d.runOuts];
    }
    return [formatDate(row.date), row.competitionName, row.category || d.innings, d.batterName, d.dismissalLabel || d.dismissalMode, d.fielderName];
  }

  function battingColumns() {
    return [["matches", "Matches"], ["innings", "Innings"], ["runs", "Runs"], ["thirties", "30s"], ["fifties", "50s"], ["hundreds", "100s"], ["highest", "HS"], ["average", "Avg"], ["strikeRate", "SR"]];
  }

  function bowlingColumns() {
    return [["matches", "Matches"], ["innings", "Innings"], ["overs", "Overs"], ["runs", "Runs"], ["wickets", "Wickets"], ["best", "Best"], ["average", "Avg"], ["economy", "Econ"], ["strikeRate", "SR"]];
  }

  function battingAggregate(rows) {
    const runs = sum(rows, "runs");
    const balls = sum(rows, "balls");
    const outs = rows.filter((row) => !isNotOut(row.statData)).length;
    const high = rows.reduce((best, row) => number(row.statData?.runs) > number(best?.statData?.runs) ? row : best, null);
    return {
      matches: uniqueMatches(rows),
      innings: rows.length,
      runs,
      thirties: rows.filter((row) => number(row.statData?.runs) >= 30 && number(row.statData?.runs) < 50).length,
      fifties: rows.filter((row) => number(row.statData?.runs) >= 50 && number(row.statData?.runs) < 100).length,
      hundreds: rows.filter((row) => number(row.statData?.runs) >= 100).length,
      highest: high ? `${number(high.statData?.runs)}${isNotOut(high.statData) ? "*" : ""}` : "—",
      average: outs ? round(runs / outs) : rows.length ? "—" : "—",
      strikeRate: strikeRate(runs, balls),
      balls,
      fours: sum(rows, "fours"),
      sixes: sum(rows, "sixes"),
      ones: sum(rows, "ones"),
      twos: sum(rows, "twos"),
      threes: sum(rows, "threes"),
      dots: rows.reduce((total, row) => total + number(row.statData?.dots ?? row.statData?.dotBalls), 0)
    };
  }

  function bowlingAggregate(rows) {
    const balls = rows.reduce((total, row) => total + ballsFromOvers(row.statData?.overs), 0);
    const runs = sum(rows, "runs");
    const wickets = sum(rows, "wickets");
    const best = rows.reduce((current, row) => {
      const wicketsValue = number(row.statData?.wickets);
      const runsValue = number(row.statData?.runs);
      if (!current) return row;
      const currentWickets = number(current.statData?.wickets);
      const currentRuns = number(current.statData?.runs);
      return wicketsValue > currentWickets || (wicketsValue === currentWickets && runsValue < currentRuns) ? row : current;
    }, null);
    return {
      matches: uniqueMatches(rows),
      innings: rows.length,
      overs: oversFromBalls(balls),
      runs,
      wickets,
      best: best && number(best.statData?.wickets) ? `${number(best.statData?.wickets)}/${number(best.statData?.runs)}` : "—",
      average: wickets ? round(runs / wickets) : "—",
      economy: economy(runs, balls),
      strikeRate: wickets ? round(balls / wickets) : "—"
    };
  }

  function fieldingAggregate(rows) {
    const catches = sum(rows, "catches");
    const stumpings = sum(rows, "stumpings");
    const runOuts = sum(rows, "runOuts");
    return { matches: uniqueMatches(rows), innings: rows.length, catches, stumpings, runOuts, dismissals: catches + stumpings + runOuts };
  }

  function dismissalAggregate(rows) {
    return {
      matches: uniqueMatches(rows),
      credits: rows.length,
      caught: countMode(rows, "caught"),
      bowled: countMode(rows, "bowled"),
      lbw: countMode(rows, "lbw"),
      stumped: countMode(rows, "stump")
    };
  }

  function normalizeRow(raw) {
    const data = raw.statData && typeof raw.statData === "object" ? raw.statData : raw.data || {};
    return {
      ...raw,
      statData: data,
      sport: raw.sport || raw.sportSlug || data.sport || data.sportSlug,
      eventType: raw.eventType || data.eventType || "",
      competitionId: raw.competitionId || raw.linkedCompetitionId || data.competitionId || "",
      competitionName: raw.competitionName || data.competitionName || raw.eventName || "",
      season: raw.season || data.season || inferSeason(raw.date || data.date),
      date: raw.date || data.date || raw.createdAt || "",
      format: inferFormat(raw, data)
    };
  }

  function inferFormat(row, data) {
    const source = row?.data?.statData && typeof row.data.statData === "object" ? row.data.statData : {};
    const innings = Array.isArray(source.innings) ? source.innings : Array.isArray(data.innings) ? data.innings : [];
    const inningsCount = number(source.inningsCount || data.inningsCount || innings.length);
    const declaredDays = number(source.matchDays || source.days || data.matchDays || data.days);
    const oversLimit = getOversLimit(source, data, innings);
    if (declaredDays >= 3 || inningsCount > 2) return "3-day";
    if (oversLimit > 0 && oversLimit <= 20) return "t20";
    if (oversLimit > 20 && oversLimit <= 40) return "40-over";
    if (oversLimit > 40 && oversLimit <= 50) return "50-over";

    const text = [
      data.format,
      data.matchFormat,
      source.format,
      source.matchFormat,
      source.oversLimit,
      source.matchOvers,
      row.category,
      row.eventName,
      row.competitionName,
      source.title,
      data.title
    ].filter(Boolean).join(" ").toLowerCase();
    if (/\bt20\b|20[-\s]?over|twenty20/.test(text)) return "t20";
    if (/40[-\s]?over/.test(text)) return "40-over";
    if (/50[-\s]?over|odi|one[-\s]?day/.test(text)) return "50-over";
    if (/3[-\s]?day|three[-\s]?day|4[-\s]?day|four[-\s]?day|multi[-\s]?day/.test(text)) return "3-day";
    return "other";
  }

  function getOversLimit(source, data, innings) {
    const explicit = number(source.oversLimit || source.matchOvers || source.scheduledOvers || data.oversLimit || data.matchOvers || data.scheduledOvers);
    if (explicit) return explicit;
    const inningOvers = innings
      .map((inning) => oversToDecimal(inning.overs || inning.maxOvers || inning.scheduledOvers))
      .filter((value) => value > 0);
    if (!inningOvers.length) return 0;
    return Math.max(...inningOvers);
  }

  function rowsOf(rows, type) { return rows.filter((row) => row.eventType === type); }
  function sum(rows, key) { return rows.reduce((total, row) => total + number(row.statData?.[key]), 0); }
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function round(value) { return Number.isFinite(value) ? Number(value).toFixed(2).replace(/\.00$/, "") : "—"; }
  function strikeRate(runs, balls) { return balls ? round((runs / balls) * 100) : "—"; }
  function economy(runs, balls) { return balls ? round((runs / balls) * 6) : "—"; }
  function ballsFromOvers(overs) {
    const text = String(overs || "").trim();
    if (!text) return 0;
    const [whole, balls = "0"] = text.split(".");
    return number(whole) * 6 + Math.min(5, number(balls));
  }
  function oversToDecimal(overs) {
    const balls = ballsFromOvers(overs);
    return balls ? balls / 6 : 0;
  }
  function oversFromBalls(balls) { return balls ? `${Math.floor(balls / 6)}.${balls % 6}` : "0"; }
  function isNotOut(data) { return /not\s*out/i.test(String(data?.dismissalLabel || data?.howOut || data?.dismissalMode || "")); }
  function uniqueMatches(rows) { return unique(rows.map((row) => row.scorecardId || row.matchId || row.id || `${row.competitionId}:${row.date}`)).length; }
  function countMode(rows, mode) { return rows.filter((row) => String(row.statData?.dismissalLabel || row.statData?.dismissalMode || "").toLowerCase().includes(mode)).length; }
  function labelType(type) { return type === "dismissal-bowling" ? "Bowler Dismissal Credits" : titleCase(type); }
  function titleCase(value) { return String(value || "").replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
  function unique(items) { return Array.from(new Set(items.map(String))).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true })); }
  function uniqueBy(items, keyFn) { const seen = new Set(); return items.filter((item) => { const key = keyFn(item); if (!key || seen.has(String(key))) return false; seen.add(String(key)); return true; }); }
  function inferSeason(date) { return date ? String(date).slice(0, 4) : ""; }
  function baseUrl(overrides) {
    const next = new URLSearchParams({ athleteId });
    if (selectedSeason !== "all") next.set("season", selectedSeason);
    if (selectedCompetition !== "all") next.set("competitionId", selectedCompetition);
    Object.entries(overrides || {}).forEach(([key, value]) => next.set(key, value));
    return `athlete-cricket-stats.html?${next.toString()}`;
  }
  function bindScopeFilters() {
    document.getElementById("seasonScope")?.addEventListener("change", function () {
      window.location.href = baseUrl({ season: this.value });
    });
    document.getElementById("competitionScope")?.addEventListener("change", function () {
      window.location.href = baseUrl({ competitionId: this.value });
    });
    document.querySelectorAll("[data-href]").forEach((row) => row.addEventListener("click", () => { window.location.href = row.dataset.href; }));
  }
  function normalizeArray(payload) { if (Array.isArray(payload)) return payload; if (Array.isArray(payload?.data)) return payload.data; return []; }
  function displayName(a) { return a?.fullName || [a?.firstName, a?.lastName].filter(Boolean).join(" ") || "Athlete"; }
  function formatDate(value) { return value ? String(value).slice(0, 10) : "—"; }
  function show(text) { els.msg.className = "message error is-visible"; els.msg.textContent = text; }
  function escapeHtml(v) { return APP.escapeHtml ? APP.escapeHtml(v) : String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
})();
