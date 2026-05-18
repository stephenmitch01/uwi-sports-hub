(function () {
  "use strict";

  /**
   * Leaderboard workflow.
   *
   * Leaderboards consume normalized stat lines from scorecards and personal-best
   * entries. Metric filters intentionally narrow visible columns so users can
   * compare selected stats without mixing unrelated sport-specific fields.
   */
  const APP = window.UWISportsHub;
  const params = new URLSearchParams(window.location.search);
  const state = {
    scope: params.get("scope") || "team",
    teamId: params.get("teamId") || "",
    competitionId: params.get("competitionId") || "",
    team: null,
    competition: null,
    athletes: [],
    statLines: [],
    competitionFilter: params.get("competitionFilter") || "",
    eventFilter: params.get("eventFilter") || "",
    formatFilter: params.get("format") || "",
    metric: "",
    order: "desc"
  };

  const CRICKET_FORMATS = [
    { key: "t20", label: "T20" },
    { key: "40-over", label: "40 Over" },
    { key: "50-over", label: "50 Over" },
    { key: "3-day", label: "3 Day" },
    { key: "other", label: "Other Formats" }
  ];

  const els = {
    heading: document.getElementById("leaderboardHeading"),
    subtitle: document.getElementById("leaderboardSubtitle"),
    backLink: document.getElementById("backLink"),
    playerCount: document.getElementById("playerCountStat"),
    recordCount: document.getElementById("recordCountStat"),
    competitionFilter: document.getElementById("competitionFilter"),
    eventFilterWrap: document.getElementById("eventFilterWrap"),
    eventFilter: document.getElementById("eventFilter"),
    formatFilterWrap: document.getElementById("formatFilterWrap"),
    formatFilter: document.getElementById("formatFilter"),
    metricControls: document.getElementById("metricControls"),
    content: document.getElementById("leaderboardContent")
  };

  document.addEventListener("DOMContentLoaded", init);

  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    const active = state.scope === "competition" ? "competitions" : "teams";
    const session = await APP.mountSignedInShell({ active, contextLabel: "Leaderboards" });
    if (!session) return;

    if (state.scope === "competition" && state.competitionId) {
      const [competition, statLines, athletes] = await Promise.all([
        APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}`),
        APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}/stat-lines`, true),
        APP.apiGet("/athletes", true)
      ]);
      state.competition = competition?.data || competition;
      state.statLines = normalizeArray(statLines).map(normalizeStatLine);
      state.athletes = normalizeArray(athletes);
      els.heading.textContent = `${state.competition?.title || state.competition?.name || "Competition"} Leaderboards`;
      els.subtitle.textContent = `${APP.getSportName(getSportSlug()) || "Sport"} rankings from records captured from 2026 onwards.`;
      els.backLink.href = `competition-view.html?id=${encodeURIComponent(state.competitionId)}`;
      els.backLink.textContent = "Back to Competition";
    } else if (state.teamId) {
      const [team, statLines, athletes] = await Promise.all([
        APP.apiGet(`/teams/${encodeURIComponent(state.teamId)}`),
        APP.apiGet(`/competition-stat-lines?teamId=${encodeURIComponent(state.teamId)}`, true),
        APP.apiGet("/athletes", true)
      ]);
      state.team = team?.data || team;
      state.statLines = normalizeArray(statLines).map(normalizeStatLine);
      state.athletes = normalizeArray(athletes);
      els.heading.textContent = `${state.team?.name || state.team?.teamName || "Team"} Leaderboards`;
      els.subtitle.textContent = `${APP.getSportName(getSportSlug()) || "Sport"} rankings from records captured from 2026 onwards.`;
      els.backLink.href = `team-view.html?id=${encodeURIComponent(state.teamId)}`;
      els.backLink.textContent = "Back to Team";
    }

    populateCompetitionFilter();
    populateSportFilters();
    render();
  }

  /**
   * Renders the current state into the page without mutating backend data.
   */
  function render() {
    const metrics = getMetrics();
    if (!state.metric) {
      state.metric = "all";
      state.order = defaultOrderForMetric(state.metric);
    }
    const visibleMetrics = getVisibleMetrics(metrics);
    const sortMetric = state.metric === "all" ? (metrics.find((metric) => metric.key === "entries")?.key || metrics[0]?.key || "entries") : state.metric;
    const rows = buildRows();
    const sorted = rows.slice().sort((a, b) => {
      const delta = sortValue(a, sortMetric) - sortValue(b, sortMetric);
      return state.order === "asc" ? delta : -delta;
    });
    els.playerCount.textContent = String(rows.length);
    els.recordCount.textContent = String(getFilteredStatLines().length);
    els.metricControls.innerHTML = `
      <button class="btn btn-soft ${state.metric === "all" ? "metric-active" : ""}" type="button" data-metric="all">All stats</button>
      ${metrics.map((metric) => `<button class="btn btn-soft ${metric.key === state.metric ? "metric-active" : ""}" type="button" data-metric="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</button>`).join("")}
      <button class="btn leaderboard-order-btn" type="button" data-order="${state.order === "desc" ? "asc" : "desc"}">${state.order === "desc" ? "Highest first" : "Lowest first"}</button>
    `;
    els.content.innerHTML = rows.length ? `
      <div class="leaderboard-table-wrap">
        <table class="table leaderboard-table">
          <thead>
            <tr>
              <th>Player</th>
              ${visibleMetrics.map((metric) => `<th>${escapeHtml(metric.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${sorted.map((row) => `
              <tr>
                <td><a href="${escapeHtml(playerHref(row.id))}">${escapeHtml(row.name)}</a></td>
                ${visibleMetrics.map((metric) => `<td>${escapeHtml(formatMetric(row, metric))}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    ` : `<div class="empty-state">No linked leaderboard data is available yet.</div>`;
    els.metricControls.querySelectorAll("[data-metric]").forEach((button) => {
      button.addEventListener("click", () => {
        state.metric = button.dataset.metric || state.metric;
        state.order = defaultOrderForMetric(state.metric);
        render();
      });
    });
    els.metricControls.querySelectorAll("[data-order]").forEach((button) => {
      button.addEventListener("click", () => {
        state.order = button.dataset.order || "desc";
        render();
      });
    });
    if (els.competitionFilter) {
      els.competitionFilter.onchange = () => {
        state.competitionFilter = els.competitionFilter.value;
        render();
      };
    }
    if (els.eventFilter) {
      els.eventFilter.onchange = () => {
        state.eventFilter = els.eventFilter.value;
        state.metric = "";
        render();
      };
    }
    if (els.formatFilter) {
      els.formatFilter.onchange = () => {
        state.formatFilter = els.formatFilter.value;
        render();
      };
    }
  }

  /**
   * Builds rows from shared state so markup and payload labels stay consistent.
   */
  function buildRows() {
    const metrics = getMetrics();
    const map = new Map();
    getFilteredStatLines().forEach((line) => {
      const sportSlug = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || getSportSlug());
      if (sportSlug === "cricket" && Array.isArray(line.statData?.innings)) {
        addCricketRows(map, metrics, line);
        return;
      }
      if (sportSlug === "football" && Array.isArray(line.statData?.playerStats)) {
        addFootballRows(map, metrics, line);
        return;
      }
      if (sportSlug === "basketball" && Array.isArray(line.statData?.playerStats)) {
        addBasketballRows(map, metrics, line);
        return;
      }
      if (sportSlug === "track-and-field" && Array.isArray(line.statData?.entries)) {
        addTrackFieldRows(map, metrics, line);
        return;
      }
      const data = line.statData || {};
      const id = line.subjectId || line.athleteId || data.athleteId || "";
      if (!id) return;
      addValue(map, metrics, id, line.subjectName || data.playerName || athleteName(id), {
        entries: 1,
        goals: Number(data.goals || 0),
        assists: Number(data.assists || 0),
        saves: Number(data.saves || 0),
        points: Number(data.points || data.score || 0),
        rebounds: Number(data.rebounds || 0),
        kills: Number(data.kills || 0),
        aces: Number(data.aces || 0),
        blocks: Number(data.blocks || 0),
        wins: /win|1st|first/i.test(String(data.result || data.outcome || line.statName || "")) ? 1 : 0
      });
    });
    return Array.from(map.values()).map(finalizeDerivedMetrics);
  }

  function getVisibleMetrics(metrics) {
    if (state.metric === "all") return metrics;
    const selected = metrics.find((metric) => metric.key === state.metric);
    return selected ? [selected] : metrics;
  }

  function addCricketRows(map, metrics, line) {
    const matchKey = line.id || `${line.competitionId || ""}:${line.date || ""}:${line.eventName || ""}`;
    (line.statData?.innings || []).forEach((innings) => {
      (innings.batting || []).forEach((batter) => {
        const runs = Number(batter.runs || 0);
        const balls = Number(batter.balls || batter.ballsFaced || 0);
        const isOut = !/not out|retired not out/i.test(String(batter.dismissalMode || batter.howOut || batter.status || ""));
        addValue(map, metrics, batter.athleteId, batter.name || athleteName(batter.athleteId), {
          entries: 1,
          battingInnings: 1,
          runs,
          ballsFaced: balls,
          battingOuts: isOut ? 1 : 0,
          fours: Number(batter.fours || batter["4s"] || 0),
          sixes: Number(batter.sixes || batter["6s"] || 0),
          highScore: runs,
          notOutHighScore: !isOut ? 1 : 0,
          battingMatches: matchKey
        });
        if (batter.fielderAthleteId && /caught/i.test(String(batter.dismissalMode || batter.howOut || ""))) {
          addValue(map, metrics, batter.fielderAthleteId, batter.fielderName || athleteName(batter.fielderAthleteId), { catches: 1 });
        }
        if (batter.fielderAthleteId && /stumped/i.test(String(batter.dismissalMode || batter.howOut || ""))) {
          addValue(map, metrics, batter.fielderAthleteId, batter.fielderName || athleteName(batter.fielderAthleteId), { stumpings: 1 });
        }
        if (batter.fielderAthleteId && /run out/i.test(String(batter.dismissalMode || batter.howOut || ""))) {
          addValue(map, metrics, batter.fielderAthleteId, batter.fielderName || athleteName(batter.fielderAthleteId), { runOuts: 1 });
        }
      });
      (innings.bowling || []).forEach((bowler) => {
        const wickets = Number(bowler.wickets || 0);
        const runsConceded = Number(bowler.runs || bowler.runsConceded || 0);
        addValue(map, metrics, bowler.athleteId, bowler.name || athleteName(bowler.athleteId), {
          entries: 1,
          bowlingInnings: 1,
          wickets,
          ballsBowled: oversToBalls(bowler.overs || bowler.o || 0),
          runsConceded,
          maidens: Number(bowler.maidens || 0),
          bestBowlingWickets: wickets,
          bestBowlingRuns: runsConceded,
          bowlingMatches: matchKey
        });
      });
    });
  }

  function addFootballRows(map, metrics, line) {
    (line.statData?.playerStats || []).forEach((player) => {
      addValue(map, metrics, player.athleteId, player.name || athleteName(player.athleteId), {
        entries: 1,
        goals: Number(player.goals || 0),
        assists: Number(player.assists || 0),
        shots: Number(player.shots || 0),
        shotsOnTarget: Number(player.shotsOnTarget || 0),
        saves: Number(player.saves || 0),
        goalsConceded: Number(player.goalsConceded || 0),
        fouls: Number(player.fouls || 0),
        offsides: Number((player.offsides ?? player.offside) || 0),
        yellowCards: Number(player.yellowCards || 0),
        redCards: Number(player.redCards || 0),
        minutes: Number(player.minutes || 0),
        tackles: Number(player.tackles || 0),
        interceptions: Number(player.interceptions || 0)
      });
    });
  }

  function addBasketballRows(map, metrics, line) {
    (line.statData?.playerStats || []).forEach((player) => {
      addValue(map, metrics, player.athleteId, player.name || athleteName(player.athleteId), {
        entries: 1,
        points: Number(player.points || 0),
        rebounds: Number(player.rebounds || 0),
        assists: Number(player.assists || 0),
        steals: Number(player.steals || 0),
        blocks: Number(player.blocks || 0),
        turnovers: Number(player.turnovers || 0),
        fouls: Number(player.fouls || 0),
        minutes: Number(player.minutes || 0),
        twoMade: Number(player.twoMade || 0),
        threeMade: Number(player.threeMade || 0),
        freeThrowsMade: Number(player.freeThrowsMade || 0)
      });
    });
  }

  function addTrackFieldRows(map, metrics, line) {
    const isField = line.statData?.resultType === "field";
    (line.statData?.entries || []).forEach((entry) => {
      if (entry.entryType !== "uwi" || !entry.athleteId) return;
      const place = Number(isField ? entry.finalRank : entry.place);
      const points = Number(entry.points || 0);
      const values = {
        entries: 1,
        points,
        wins: place === 1 ? 1 : 0,
        topThree: place > 0 && place <= 3 ? 1 : 0,
        trackEvents: isField ? 0 : 1,
        fieldEvents: isField ? 1 : 0,
        placingTotal: place > 0 ? place : 0,
        placingCount: place > 0 ? 1 : 0
      };
      if (isField) {
        const mark = parseMark(entry.bestNumber ?? entry.best);
        values.bestMark = Number.isFinite(mark) ? mark : 0;
        values.markTotal = Number.isFinite(mark) ? mark : 0;
        values.markCount = Number.isFinite(mark) ? 1 : 0;
        values.fieldAttempts = Array.isArray(entry.attempts) ? entry.attempts.filter(Boolean).length : 0;
        values.legalMarks = Array.isArray(entry.attempts) ? entry.attempts.map(parseMark).filter(Number.isFinite).length : (Number.isFinite(mark) ? 1 : 0);
      } else {
        const seconds = parseTime(entry.timeNumber ?? entry.time);
        values.bestTimeSeconds = Number.isFinite(seconds) ? seconds : 0;
        values.timeTotalSeconds = Number.isFinite(seconds) ? seconds : 0;
        values.timedRaces = Number.isFinite(seconds) ? 1 : 0;
        values.laneStarts = entry.lane ? 1 : 0;
      }
      addValue(map, metrics, entry.athleteId, entry.name || athleteName(entry.athleteId), values);
    });
  }

  function addValue(map, metrics, athleteId, name, values) {
    const id = String(athleteId || "");
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, { id, name: name || "Athlete", entries: 0 });
      metrics.forEach((metric) => { map.get(id)[metric.key] = 0; });
    }
    const row = map.get(id);
    row.entries += values.entries || 0;
    Object.entries(values).forEach(([key, value]) => {
      if (key === "entries") return;
      if (key === "battingMatches" || key === "bowlingMatches") {
        const setKey = `_${key}`;
        row[setKey] = row[setKey] || new Set();
        if (value) row[setKey].add(String(value));
        return;
      }
      if (key === "highScore") {
        if (Number(value || 0) > Number(row.highScore || 0)) {
          row.highScore = Number(value || 0);
          row.highScoreNotOut = values.notOutHighScore ? 1 : 0;
        }
        return;
      }
      if (key === "bestBowlingWickets" || key === "bestBowlingRuns") {
        const wickets = Number(values.bestBowlingWickets || 0);
        const runs = Number(values.bestBowlingRuns || 0);
        if (wickets > Number(row.bestBowlingWickets || 0) || (wickets === Number(row.bestBowlingWickets || 0) && wickets > 0 && runs < Number(row.bestBowlingRuns || Infinity))) {
          row.bestBowlingWickets = wickets;
          row.bestBowlingRuns = runs;
        }
        return;
      }
      if (key === "bestTimeSeconds") {
        const numeric = Number(value || 0);
        if (numeric && (!row.bestTimeSeconds || numeric < row.bestTimeSeconds)) row.bestTimeSeconds = numeric;
        return;
      }
      if (key === "bestMark") {
        const numeric = Number(value || 0);
        if (numeric && numeric > Number(row.bestMark || 0)) row.bestMark = numeric;
        return;
      }
      row[key] = Number(row[key] || 0) + Number(value || 0);
    });
  }

  function getMetrics() {
    const sportSlug = getSportSlug();
    if (sportSlug === "cricket") return [
      { key: "battingMatches", label: "Bat M" },
      { key: "battingInnings", label: "Bat Inns" },
      { key: "runs", label: "Runs" },
      { key: "highScoreDisplay", label: "HS" },
      { key: "battingAverage", label: "Bat Avg" },
      { key: "battingStrikeRate", label: "Bat SR" },
      { key: "ballsFaced", label: "Balls" },
      { key: "fours", label: "4s" },
      { key: "sixes", label: "6s" },
      { key: "bowlingMatches", label: "Bowl M" },
      { key: "bowlingInnings", label: "Bowl Inns" },
      { key: "wickets", label: "Wickets" },
      { key: "bestBowlingDisplay", label: "BB" },
      { key: "maidens", label: "Maidens" },
      { key: "economyRate", label: "Econ" },
      { key: "bowlingAverage", label: "Bowl Avg" },
      { key: "bowlingStrikeRate", label: "Bowl SR" },
      { key: "catches", label: "Ct" },
      { key: "stumpings", label: "St" },
      { key: "runOuts", label: "RO" }
    ];
    if (sportSlug === "football") return [
      { key: "goals", label: "Goals" },
      { key: "assists", label: "Assists" },
      { key: "goalContributions", label: "G+A" },
      { key: "shots", label: "Shots" },
      { key: "shotsOnTarget", label: "Shots OT" },
      { key: "shotAccuracy", label: "Shot %" },
      { key: "saves", label: "Saves" },
      { key: "fouls", label: "Fouls" },
      { key: "offsides", label: "Offsides" },
      { key: "yellowCards", label: "Yellows" },
      { key: "redCards", label: "Reds" }
    ];
    if (["hockey", "netball"].includes(sportSlug)) return [{ key: "goals", label: "Goals" }, { key: "assists", label: "Assists" }, { key: "saves", label: "Saves" }];
    if (sportSlug === "basketball") return [
      { key: "points", label: "Points" },
      { key: "pointsPerGame", label: "PPG" },
      { key: "rebounds", label: "Rebounds" },
      { key: "reboundsPerGame", label: "RPG" },
      { key: "assists", label: "Assists" },
      { key: "assistsPerGame", label: "APG" },
      { key: "steals", label: "Steals" },
      { key: "blocks", label: "Blocks" },
      { key: "turnovers", label: "Turnovers" },
      { key: "assistTurnoverRatio", label: "AST/TO" },
      { key: "threeMade", label: "3PM" }
    ];
    if (sportSlug === "volleyball") return [{ key: "kills", label: "Kills" }, { key: "aces", label: "Aces" }, { key: "blocks", label: "Blocks" }];
    if (sportSlug === "track-and-field") {
      const eventKind = getSelectedTrackFieldKind();
      const common = [{ key: "points", label: "Points" }, { key: "wins", label: "Wins" }, { key: "topThree", label: "Top 3" }, { key: "averagePlace", label: "Avg Place" }, { key: "entries", label: "Entries" }];
      if (eventKind === "track") return [{ key: "bestTimeSeconds", label: "Best Time" }, { key: "averageTimeSeconds", label: "Avg Time" }, ...common, { key: "laneStarts", label: "Lane Starts" }];
      if (eventKind === "field") return [{ key: "bestMark", label: "Best Mark" }, { key: "averageBestMark", label: "Avg Mark" }, ...common, { key: "legalMarks", label: "Legal Marks" }, { key: "fieldAttempts", label: "Attempts" }];
      return [{ key: "bestTimeSeconds", label: "Best Time" }, { key: "bestMark", label: "Best Mark" }, ...common, { key: "trackEvents", label: "Track Events" }, { key: "fieldEvents", label: "Field Events" }];
    }
    return [{ key: "wins", label: "Wins" }, { key: "points", label: "Points" }, { key: "entries", label: "Entries" }];
  }

  function getSportSlug() {
    return APP.normalizeSportSlug(state.team?.sportSlug || state.team?.sport || state.competition?.sportSlug || state.competition?.sport || state.statLines[0]?.sportSlug || state.statLines[0]?.sport);
  }

  /**
   * Accepts current and nested API response shapes so pages remain compatible during backend evolution.
   */
  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.athletes)) return payload.athletes;
    if (Array.isArray(payload?.statLines)) return payload.statLines;
    return [];
  }

  /**
   * Normalizes stat line data across current API and legacy nested shapes.
   */
  function normalizeStatLine(line) {
    const data = line?.statData && typeof line.statData === "object" ? line.statData : line?.data?.statData || line?.data || {};
    return { ...line, statData: data };
  }

  function finalizeDerivedMetrics(row) {
    if (getSportSlug() === "football") {
      return {
        ...row,
        goalContributions: Number(row.goals || 0) + Number(row.assists || 0),
        shotAccuracy: Number(row.shots || 0) ? round((Number(row.shotsOnTarget || 0) / Number(row.shots || 0)) * 100, 2) : 0
      };
    }
    if (getSportSlug() === "basketball") {
      const entries = Number(row.entries || 0);
      const turnovers = Number(row.turnovers || 0);
      return {
        ...row,
        pointsPerGame: entries ? round(Number(row.points || 0) / entries, 2) : 0,
        reboundsPerGame: entries ? round(Number(row.rebounds || 0) / entries, 2) : 0,
        assistsPerGame: entries ? round(Number(row.assists || 0) / entries, 2) : 0,
        assistTurnoverRatio: turnovers ? round(Number(row.assists || 0) / turnovers, 2) : Number(row.assists || 0) ? Number(row.assists || 0) : 0
      };
    }
    if (getSportSlug() === "track-and-field") {
      return {
        ...row,
        averageTimeSeconds: Number(row.timedRaces || 0) ? Number(row.timeTotalSeconds || 0) / Number(row.timedRaces || 0) : 0,
        averageBestMark: Number(row.markCount || 0) ? round(Number(row.markTotal || 0) / Number(row.markCount || 0), 2) : 0,
        averagePlace: Number(row.placingCount || 0) ? round(Number(row.placingTotal || 0) / Number(row.placingCount || 0), 2) : 0
      };
    }
    if (getSportSlug() !== "cricket") return row;
    const battingOuts = Number(row.battingOuts || 0);
    const ballsFaced = Number(row.ballsFaced || 0);
    const wickets = Number(row.wickets || 0);
    const ballsBowled = Number(row.ballsBowled || 0);
    const runsConceded = Number(row.runsConceded || 0);
    return {
      ...row,
      battingAverage: battingOuts ? round(row.runs / battingOuts, 2) : round(row.runs || 0, 2),
      battingStrikeRate: ballsFaced ? round((row.runs / ballsFaced) * 100, 2) : 0,
      battingMatches: row._battingMatches?.size || 0,
      bowlingMatches: row._bowlingMatches?.size || 0,
      bowlingAverage: wickets ? round(runsConceded / wickets, 2) : 0,
      bowlingStrikeRate: wickets ? round(ballsBowled / wickets, 2) : 0,
      economyRate: ballsBowled ? round((runsConceded / ballsBowled) * 6, 2) : 0,
      highScoreDisplay: row.highScore || 0,
      bestBowlingDisplay: row.bestBowlingWickets || 0
    };
  }

  function getFilteredStatLines() {
    return state.statLines.filter((line) => {
      if (state.competitionFilter && getLineCompetitionKey(line) !== state.competitionFilter) return false;
      const sportSlug = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || getSportSlug());
      if (sportSlug === "track-and-field" && state.eventFilter && getTrackFieldEventKey(line) !== state.eventFilter) return false;
      if (sportSlug === "cricket" && state.formatFilter && inferCricketFormat(line) !== state.formatFilter) return false;
      return true;
    });
  }

  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateSportFilters() {
    const sportSlug = getSportSlug();
    if (els.eventFilterWrap) els.eventFilterWrap.classList.toggle("hidden", sportSlug !== "track-and-field");
    if (els.formatFilterWrap) els.formatFilterWrap.classList.toggle("hidden", sportSlug !== "cricket");
    if (sportSlug === "track-and-field" && els.eventFilter) {
      const options = getTrackFieldEventOptions();
      els.eventFilter.innerHTML = `<option value="">All events</option>${options.map((option) => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`).join("")}`;
      els.eventFilter.value = state.eventFilter;
    }
    if (sportSlug === "cricket" && els.formatFilter) {
      els.formatFilter.innerHTML = `<option value="">All formats</option>${CRICKET_FORMATS.map((format) => `<option value="${escapeHtml(format.key)}">${escapeHtml(format.label)}</option>`).join("")}`;
      els.formatFilter.value = state.formatFilter;
    }
  }

  function getTrackFieldEventOptions() {
    const map = new Map();
    state.statLines.forEach((line) => {
      const key = getTrackFieldEventKey(line);
      if (!key) return;
      const kind = line.statData?.resultType === "field" ? "Field" : "Track";
      const eventName = line.statData?.eventName || line.eventName || "Event";
      map.set(key, `${eventName} (${kind})`);
    });
    return Array.from(map, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  function getTrackFieldEventKey(line) {
    const data = line.statData || {};
    return [data.resultType || "", data.disciplineType || "", data.eventName || line.eventName || ""].join("|").toLowerCase();
  }

  function getSelectedTrackFieldKind() {
    if (!state.eventFilter) return "";
    const [kind] = state.eventFilter.split("|");
    return kind === "field" ? "field" : kind === "track" ? "track" : "";
  }

  function inferCricketFormat(line) {
    const data = line.statData || {};
    const innings = Array.isArray(data.innings) ? data.innings : [];
    const inningsCount = Number(data.inningsCount || innings.length || 0);
    const days = Number(data.matchDays || data.days || 0);
    const oversLimit = getCricketOversLimit(data, innings);
    if (days >= 3 || inningsCount > 2) return "3-day";
    if (oversLimit > 0 && oversLimit <= 20) return "t20";
    if (oversLimit > 20 && oversLimit <= 40) return "40-over";
    if (oversLimit > 40 && oversLimit <= 50) return "50-over";
    const text = [data.format, data.matchFormat, data.oversLimit, data.matchOvers, data.scheduledOvers, line.category, line.eventName, line.competitionName, data.title].filter(Boolean).join(" ").toLowerCase();
    if (/\bt20\b|20[-\s]?over|twenty20/.test(text)) return "t20";
    if (/40[-\s]?over/.test(text)) return "40-over";
    if (/50[-\s]?over|odi|one[-\s]?day/.test(text)) return "50-over";
    if (/3[-\s]?day|three[-\s]?day|4[-\s]?day|four[-\s]?day|multi[-\s]?day/.test(text)) return "3-day";
    return "other";
  }

  function getCricketOversLimit(data, innings) {
    const explicit = Number(data.oversLimit || data.matchOvers || data.scheduledOvers || 0);
    if (explicit) return explicit;
    const inningOvers = innings.map((inning) => oversToBalls(inning.overs || inning.maxOvers || inning.scheduledOvers) / 6).filter((value) => value > 0);
    return inningOvers.length ? Math.max(...inningOvers) : 0;
  }

  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateCompetitionFilter() {
    if (!els.competitionFilter) return;
    const options = getCompetitionOptions();
    els.competitionFilter.innerHTML = `<option value="">All competitions</option>${options.map((option) => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`).join("")}`;
    els.competitionFilter.value = state.competitionFilter;
    els.competitionFilter.disabled = state.scope === "competition";
  }

  function getCompetitionOptions() {
    const map = new Map();
    state.statLines.forEach((line) => {
      const key = getLineCompetitionKey(line);
      if (!key) return;
      map.set(key, line.competitionName || line.statData?.competitionName || line.statData?.title || key);
    });
    return Array.from(map, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  function getLineCompetitionKey(line) {
    return String(line.competitionId || line.linkedCompetitionId || line.statData?.competitionId || line.statData?.linkedCompetitionId || line.competitionName || line.statData?.competitionName || line.statData?.title || "").trim();
  }

  function oversToBalls(value) {
    const text = String(value ?? "0");
    if (!text.includes(".")) return Math.round(Number(text || 0) * 6);
    const [overs, balls] = text.split(".");
    return (Number(overs) || 0) * 6 + (Number(balls) || 0);
  }

  function parseTime(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value || "").trim();
    if (!text) return NaN;
    const clean = text.replace(/[^\d:.]/g, "");
    const parts = clean.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return Number(clean);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  }

  function parseMark(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function formatTime(seconds) {
    const value = Number(seconds || 0);
    if (!value) return "—";
    const minutes = Math.floor(value / 60);
    const rest = value - minutes * 60;
    return minutes ? `${minutes}:${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
  }

  function formatMetric(row, metric) {
    const key = metric.key;
    if (key === "bestTimeSeconds" || key === "averageTimeSeconds") return formatTime(row[key]);
    if (key === "bestMark" || key === "averageBestMark") return row[key] ? `${round(row[key], 2)}m` : "—";
    if (key === "highScoreDisplay") return row.highScore ? `${row.highScore}${row.highScoreNotOut ? "*" : ""}` : "0";
    if (key === "bestBowlingDisplay") return row.bestBowlingWickets ? `${row.bestBowlingWickets}/${row.bestBowlingRuns || 0}` : "0";
    return row[key] ?? 0;
  }

  function sortValue(row, key) {
    if (key === "highScoreDisplay") return Number(row.highScore || 0);
    if (key === "bestBowlingDisplay") return Number(row.bestBowlingWickets || 0) * 1000 - Number(row.bestBowlingRuns || 0);
    return Number(row[key] || 0);
  }

  function defaultOrderForMetric(key) {
    if (key === "all") return "desc";
    return ["bestTimeSeconds", "averageTimeSeconds", "averagePlace", "bowlingAverage", "bowlingStrikeRate", "economyRate"].includes(key) ? "asc" : "desc";
  }

  function round(value, places) {
    const factor = 10 ** (places || 0);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function athleteName(id) {
    const athlete = state.athletes.find((item) => String(item.id) === String(id));
    return [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || athlete?.fullName || athlete?.name || "Athlete";
  }

  function playerHref(id) {
    if (getSportSlug() === "cricket") return `athlete-cricket-stats.html?athleteId=${encodeURIComponent(id)}`;
    if (getSportSlug() === "football") return `athlete-football-stats.html?athleteId=${encodeURIComponent(id)}`;
    if (getSportSlug() === "basketball") return `athlete-basketball-stats.html?athleteId=${encodeURIComponent(id)}`;
    if (getSportSlug() === "track-and-field") return `athlete-track-field-stats.html?athleteId=${encodeURIComponent(id)}`;
    return `athlete-view.html?athleteId=${encodeURIComponent(id)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
  }
})();
