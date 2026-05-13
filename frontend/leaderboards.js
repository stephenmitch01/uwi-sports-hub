(function () {
  "use strict";

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
    metric: "",
    order: "desc"
  };

  const els = {
    heading: document.getElementById("leaderboardHeading"),
    subtitle: document.getElementById("leaderboardSubtitle"),
    backLink: document.getElementById("backLink"),
    playerCount: document.getElementById("playerCountStat"),
    recordCount: document.getElementById("recordCountStat"),
    competitionFilter: document.getElementById("competitionFilter"),
    metricControls: document.getElementById("metricControls"),
    content: document.getElementById("leaderboardContent")
  };

  document.addEventListener("DOMContentLoaded", init);

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
    render();
  }

  function render() {
    const metrics = getMetrics();
    state.metric = state.metric || metrics[0]?.key || "entries";
    const rows = buildRows();
    const sorted = rows.slice().sort((a, b) => {
      const delta = (a[state.metric] || 0) - (b[state.metric] || 0);
      return state.order === "asc" ? delta : -delta;
    });
    els.playerCount.textContent = String(rows.length);
    els.recordCount.textContent = String(state.statLines.length);
    els.metricControls.innerHTML = `
      ${metrics.map((metric) => `<button class="btn btn-soft ${metric.key === state.metric ? "metric-active" : ""}" type="button" data-metric="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</button>`).join("")}
      <button class="btn leaderboard-order-btn" type="button" data-order="${state.order === "desc" ? "asc" : "desc"}">${state.order === "desc" ? "Highest first" : "Lowest first"}</button>
    `;
    els.content.innerHTML = rows.length ? `
      <div class="leaderboard-table-wrap">
        <table class="table leaderboard-table">
          <thead>
            <tr>
              <th>Player</th>
              ${metrics.map((metric) => `<th>${escapeHtml(metric.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${sorted.map((row) => `
              <tr>
                <td><a href="${escapeHtml(playerHref(row.id))}">${escapeHtml(row.name)}</a></td>
                ${metrics.map((metric) => `<td>${escapeHtml(row[metric.key] || 0)}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    ` : `<div class="empty-state">No linked leaderboard data is available yet.</div>`;
    els.metricControls.querySelectorAll("[data-metric]").forEach((button) => {
      button.addEventListener("click", () => {
        state.metric = button.dataset.metric || state.metric;
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
  }

  function buildRows() {
    const metrics = getMetrics();
    const map = new Map();
    state.statLines.forEach((line) => {
      if (state.competitionFilter && getLineCompetitionKey(line) !== state.competitionFilter) return;
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

  function addCricketRows(map, metrics, line) {
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
          sixes: Number(batter.sixes || batter["6s"] || 0)
        });
        if (batter.fielderAthleteId && /caught/i.test(String(batter.dismissalMode || batter.howOut || ""))) {
          addValue(map, metrics, batter.fielderAthleteId, batter.fielderName || athleteName(batter.fielderAthleteId), { catches: 1 });
        }
      });
      (innings.bowling || []).forEach((bowler) => {
        addValue(map, metrics, bowler.athleteId, bowler.name || athleteName(bowler.athleteId), {
          entries: 1,
          bowlingInnings: 1,
          wickets: Number(bowler.wickets || 0),
          ballsBowled: oversToBalls(bowler.overs || bowler.o || 0),
          runsConceded: Number(bowler.runs || bowler.runsConceded || 0)
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
      addValue(map, metrics, entry.athleteId, entry.name || athleteName(entry.athleteId), {
        entries: 1,
        points,
        wins: place === 1 ? 1 : 0,
        topThree: place > 0 && place <= 3 ? 1 : 0,
        trackEvents: isField ? 0 : 1,
        fieldEvents: isField ? 1 : 0
      });
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
      row[key] = Number(row[key] || 0) + Number(value || 0);
    });
  }

  function getMetrics() {
    const sportSlug = getSportSlug();
    if (sportSlug === "cricket") return [
      { key: "runs", label: "Runs" },
      { key: "battingAverage", label: "Bat Avg" },
      { key: "battingStrikeRate", label: "Bat SR" },
      { key: "fours", label: "4s" },
      { key: "sixes", label: "6s" },
      { key: "wickets", label: "Wickets" },
      { key: "bowlingAverage", label: "Bowl Avg" },
      { key: "bowlingStrikeRate", label: "Bowl SR" }
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
    if (sportSlug === "track-and-field") return [{ key: "points", label: "Points" }, { key: "wins", label: "Wins" }, { key: "topThree", label: "Top 3" }, { key: "trackEvents", label: "Track Events" }, { key: "fieldEvents", label: "Field Events" }, { key: "entries", label: "Entries" }];
    return [{ key: "wins", label: "Wins" }, { key: "points", label: "Points" }, { key: "entries", label: "Entries" }];
  }

  function getSportSlug() {
    return APP.normalizeSportSlug(state.team?.sportSlug || state.team?.sport || state.competition?.sportSlug || state.competition?.sport || state.statLines[0]?.sportSlug || state.statLines[0]?.sport);
  }

  function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.athletes)) return payload.athletes;
    if (Array.isArray(payload?.statLines)) return payload.statLines;
    return [];
  }

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
      bowlingAverage: wickets ? round(runsConceded / wickets, 2) : 0,
      bowlingStrikeRate: wickets ? round(ballsBowled / wickets, 2) : 0
    };
  }

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
