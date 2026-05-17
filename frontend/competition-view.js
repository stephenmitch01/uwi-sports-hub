(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const state = {
    session: null,
    competitionId: null,
    competition: null,
    units: [],
    participants: [],
    results: [],
    statLines: [],
    athletes: [],
    teams: [],
    audit: [],
    leaderboardSort: { metric: "", order: "desc" }
  };

  const params = new URLSearchParams(window.location.search);
  state.competitionId = params.get("competitionId") || params.get("id");

  const els = {
    editCompetitionBtn: document.getElementById("editCompetitionBtn"),
    editCompetitionPanel: document.getElementById("editCompetitionPanel"),
    competitionEditForm: document.getElementById("competitionEditForm"),
    competitionEditMessage: document.getElementById("competitionEditMessage"),
    competitionMeta: document.getElementById("competitionMeta"),
    competitionRecentResults: document.getElementById("competitionRecentResults"),
    competitionStructure: document.getElementById("competitionStructure"),
    competitionParticipants: document.getElementById("competitionParticipants"),
    competitionResults: document.getElementById("competitionResults"),
    competitionStats: document.getElementById("competitionStats"),
    competitionAudit: document.getElementById("competitionAudit")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
  const session = await APP.mountSignedInShell({
    active: "competitions",
    contextLabel: "Competition View"
  });
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  state.session = session;
  bindEditWorkflow();

  if (!state.competitionId) {
    renderMissingSelection();
    return;
  }

  await refreshPage();
}

  async function refreshPage() {
  try {
    const [
      competitionData,
      unitsData,
      participantsData,
      resultsData,
      statLinesData,
      athletesData,
      teamsData,
      auditData
    ] = await Promise.all([
      APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}`),
      APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}/units`, true),
      APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}/participants`, true),
      APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}/results`, true),
      APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}/stat-lines`, true),
      APP.apiGet(`/athletes`, true),
      APP.apiGet(`/teams`, true),
      APP.apiGet(`/competitions/${encodeURIComponent(state.competitionId)}/audit`, true)
    ]);

    state.competition =
      competitionData?.competition ||
      competitionData?.data?.competition ||
      competitionData?.data ||
      competitionData ||
      null;

    state.units = normalizeArray(unitsData, ["units", "competitionUnits", "data"]);
    state.participants = normalizeArray(participantsData, ["participants", "competitionParticipants", "data"]);
    state.results = normalizeArray(resultsData, ["results", "competitionResults", "data"]);
    state.statLines = normalizeArray(statLinesData, ["statLines", "competitionStatLines", "data"]).map(normalizeStatLine);
    state.athletes = normalizeArray(athletesData, ["athletes", "data"]);
    state.teams = normalizeArray(teamsData, ["teams", "data"]);
    state.audit = normalizeArray(auditData, ["entries", "audit", "logs", "data"]);

    if (!state.competition || typeof state.competition !== "object") {
      renderNotFound();
      return;
    }

    const sessionCampus = APP.normalizeCampus(state.session?.campus || "");
    const competitionCampus = APP.normalizeCampus(
      state.competition?.campusOwner ||
      state.competition?.campus ||
      ""
    );

    if (sessionCampus && competitionCampus && sessionCampus !== competitionCampus) {
      throw new Error("You do not have access to this competition.");
    }

    renderMeta();
    populateCompetitionEditForm();
    renderRecentResults();
    renderStructure();
    renderStatEngine();
    renderAudit();
    bindDynamicForms();
  } catch (error) {
    console.error("Competition view load error:", error);
    renderLoadFailure(error);
  }
}

  function bindEditWorkflow() {
    if (els.editCompetitionBtn && els.editCompetitionPanel) {
      els.editCompetitionBtn.addEventListener("click", () => {
        els.editCompetitionPanel.classList.remove("hidden");
        els.editCompetitionPanel.open = true;
        els.editCompetitionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (els.competitionEditForm) {
      APP.trackUnsavedChanges(els.competitionEditForm);
      els.competitionEditForm.addEventListener("submit", handleEditCompetition);
    }
    mountArchiveButton();
  }

  function populateCompetitionEditForm() {
    if (!els.competitionEditForm || !state.competition) return;
    const sportSelect = document.getElementById("editCompetitionSport");
    if (sportSelect) {
      sportSelect.innerHTML = `<option value="">Select sport</option>${APP.SPORT_REGISTRY.map((sport) => `<option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>`).join("")}`;
    }
    setField("editCompetitionTitle", state.competition.title || state.competition.name || "");
    setField("editCompetitionSport", state.competition.sportSlug || state.competition.sport || "");
    setField("editCompetitionFormat", state.competition.formatSlug || state.competition.format || "");
    setField("editCompetitionSeason", state.competition.seasonLabel || state.competition.season || "");
    setField("editCompetitionStart", toDateInputValue(state.competition.startDate));
    setField("editCompetitionEnd", toDateInputValue(state.competition.endDate));
    setField("editCompetitionStatus", String(state.competition.status || "DRAFT").toUpperCase());
  }

  async function handleEditCompetition(event) {
    event.preventDefault();
    setEditMessage("", "");
    const payload = {
      title: getField("editCompetitionTitle"),
      sportSlug: getField("editCompetitionSport"),
      formatSlug: getField("editCompetitionFormat") || null,
      seasonLabel: getField("editCompetitionSeason") || null,
      startDate: getField("editCompetitionStart") || null,
      endDate: getField("editCompetitionEnd") || null,
      status: getField("editCompetitionStatus") || "DRAFT",
      campusOwner: APP.normalizeCampus(state.session?.campus || ""),
      updatedAt: state.competition?.updatedAt
    };
    if (!payload.title || !payload.sportSlug) {
      setEditMessage("Competition title and sport are required.", "error");
      return;
    }
    try {
      if (!APP.confirmReportImpact((state.results || []).length || (state.statLines || []).length)) return;
      await APP.apiPatch(`/competitions/${encodeURIComponent(state.competitionId)}`, payload);
      setEditMessage("Competition updated successfully.", "success");
      await refreshPage();
    } catch (error) {
      setEditMessage(error?.message || "Failed to update competition.", "error");
    }
  }

  function mountArchiveButton() {
    if (!els.editCompetitionBtn || document.getElementById("archiveCompetitionBtn")) return;
    const button = document.createElement("button");
    button.id = "archiveCompetitionBtn";
    button.className = "btn btn-soft";
    button.type = "button";
    button.textContent = "Archive";
    button.addEventListener("click", async () => {
      if (!state.competition || !APP.confirmArchive("competition", state.competition)) return;
      await APP.apiPatch(`/competitions/${encodeURIComponent(state.competitionId)}/archive`, { updatedAt: state.competition.updatedAt });
      window.location.href = "competitions.html";
    });
    els.editCompetitionBtn.insertAdjacentElement("afterend", button);
  }

  function renderMissingSelection() {
    setEmpty("competitionMeta", "Competition details will appear here once added.", "Select a competition to view its structure, participants, results, and summaries.");
    setEmpty("competitionRecentResults", "Recent results will appear here once added.", "Saved match results and scorecards will be listed here.");
    setEmpty("competitionStructure", "Competition structure will appear here once added.", "Divisions, rounds, heats, matches, and events will be shown here when available.");
    setEmpty("competitionStats", "Stat summaries will appear here once added.", "Sport-specific stat lines for this competition will be shown here.");
    setEmpty("competitionAudit", "Activity history will appear here once added.", "Changes, approvals, and updates for this competition will be listed here.");
  }

  function renderNotFound() {
    setEmpty("competitionMeta", "Competition details unavailable.", "The selected competition could not be found.");
    setEmpty("competitionRecentResults", "Recent results unavailable.", "Saved match results and scorecards will appear here.");
    setEmpty("competitionStructure", "Structure unavailable.", "Create or select a competition to view details here.");
    setEmpty("competitionStats", "Stat summaries unavailable.", "Competition stat lines will appear here once recorded.");
    setEmpty("competitionAudit", "Activity history unavailable.", "Competition activity will appear here once records exist.");
  }

  function renderLoadFailure(error) {
    const message = error?.message || "Competition data could not be loaded.";
    setEmpty("competitionMeta", "Competition details unavailable.", message);
    setEmpty("competitionRecentResults", "Recent results unavailable.", "The recent results section could not be loaded.");
    setEmpty("competitionStructure", "Structure unavailable.", "The competition structure section could not be loaded.");
    setEmpty("competitionStats", "Stat summaries unavailable.", "The stat summaries section could not be loaded.");
    setEmpty("competitionAudit", "Activity history unavailable.", "The competition audit section could not be loaded.");
  }

  function renderMeta() {
    const competition = state.competition;
    const sportName = getSportName(getCompetitionSportSlug());
    const campusName = getCampusName(competition.campusOwner || competition.campus);
    const unitCount = state.units.length;
    const setupScore = getCompetitionCompleteness(competition);

    els.competitionMeta.innerHTML = `
      <div class="section-title">
        <div>
          <h2>${escapeHtml(competition.title || "Competition")}</h2>
          <p>${escapeHtml(sportName)} • ${escapeHtml(competition.seasonLabel || competition.season || "Season not set")}</p>
        </div>
      </div>

      <div class="competition-meta-row">
        ${metaTile("Sport", sportName)}
        ${metaTile("Status", competition.status || "Not set")}
        ${metaTile("Campus Owner", campusName)}
        ${metaTile("Format", formatCompetitionFormat(competition.formatSlug || competition.format))}
        ${metaTile("Dates", `${competition.startDate || "—"} to ${competition.endDate || "—"}`)}
        ${metaTile("Units", String(unitCount))}
        ${metaTile("Setup Completeness", completenessMarkup(setupScore), true)}
      </div>
    `;
  }

  function renderStructure() {
    if (!state.units.length) {
      setEmpty("competitionStructure", "Competition structure will appear here once added.", "No units, events, rounds, or heats have been recorded for this competition yet.");
      return;
    }

    const rows = state.units
      .map((unit, index) => {
        const title = unit.title || unit.name || unit.eventName || unit.roundName || `${getUnitLabel(unit)} ${index + 1}`;
        return `
          <tr>
            <td>${escapeHtml(title)}</td>
            <td>${escapeHtml(getUnitLabel(unit))}</td>
            <td>${escapeHtml(unit.category || unit.division || unit.groupName || "—")}</td>
            <td>${escapeHtml(unit.startTime || unit.date || unit.scheduledAt || "—")}</td>
          </tr>
        `;
      })
      .join("");

    els.competitionStructure.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Competition Structure</h2>
          <p>Rounds, heats, matches, events, or other competition units for this competition.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Type</th>
              <th>Category</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderParticipants() {
    const items = buildParticipantRows();
    if (!items.length) {
      setEmpty("competitionParticipants", "Participants will appear here once added.", "No participant records are currently attached to this competition.");
      return;
    }

    const rows = items
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.type)}</td>
          <td>${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.category)}</td>
        </tr>
      `)
      .join("");

    els.competitionParticipants.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Participants</h2>
          <p>Athletes, teams, relays, or pairs linked to this competition.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderResults() {
    const inferredResults = state.results.length ? [] : getMatchScorecards(getCompetitionSportSlug()).map((line) => {
      const data = line.statData || {};
      return {
        eventName: line.eventName || data.eventName || data.title || "Match",
        subjectId: line.teamId || data.uwiTeamId,
        subjectType: "team",
        result: data.result || data.summary?.result || "Result recorded",
        date: line.date || data.date || line.createdAt || ""
      };
    });
    const sourceResults = state.results.length ? state.results : inferredResults;
    if (!sourceResults.length) {
      setEmpty("competitionResults", "Results will appear here once added.", "No results have been recorded for this competition yet.");
      return;
    }

    const rows = sourceResults
      .map((result) => {
        const subject = resolveSubjectName(result.subjectId || result.athleteId || result.teamId, result.subjectType || inferResultSubjectType(result));
        const mark = formatResult(result);
        return `
          <tr>
            <td>${escapeHtml(result.eventName || result.unitName || getUnitName(result.unitId) || "—")}</td>
            <td>${escapeHtml(subject)}</td>
            <td>${escapeHtml(mark)}</td>
            <td>${escapeHtml(result.placing || result.place || result.rank || "—")}</td>
          </tr>
        `;
      })
      .join("");

    els.competitionResults.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Results</h2>
          <p>Approved competition outcomes and placings.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Subject</th>
              <th>Result</th>
              <th>Place</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderRecentResults() {
    const sportSlug = getCompetitionSportSlug();
    const scorecards = getMatchScorecards(sportSlug)
      .slice()
      .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    const isFootball = sportSlug === "football";
    const isVolleyball = sportSlug === "volleyball";
    const isHockey = sportSlug === "hockey";
    const isBasketball = sportSlug === "basketball";
    const isSwimming = sportSlug === "swimming";
    const isTrackField = sportSlug === "track-and-field";
    const isNetball = sportSlug === "netball";
    const isBadminton = sportSlug === "badminton";
    const isTableTennis = sportSlug === "table-tennis";
    const isTennis = sportSlug === "lawn-tennis";
    const isTaekwondo = sportSlug === "taekwondo";
    const isChess = sportSlug === "chess";
    const entryHref = isFootball ? "football-scorecard.html" : isVolleyball ? "volleyball-scorecard.html" : isHockey ? "hockey-scorecard.html" : isBasketball ? "basketball-scorecard.html" : isSwimming ? "swimming-results.html" : isTrackField ? "track-field-results.html" : isNetball ? "netball-scorecard.html" : isBadminton ? "badminton-scorecard.html" : isTableTennis ? "table-tennis-scorecard.html" : isTennis ? "tennis-scorecard.html" : isTaekwondo ? "taekwondo-scorecard.html" : isChess ? "chess-scorecard.html" : "cricket-scorecard.html";
    const resultsHref = isFootball ? `football-results.html?competitionId=${encodeURIComponent(state.competitionId)}` : isBasketball ? `basketball-results.html?competitionId=${encodeURIComponent(state.competitionId)}` : isTrackField ? `track-field-results-archive.html?competitionId=${encodeURIComponent(state.competitionId)}` : isVolleyball || isHockey || isSwimming || isNetball || isBadminton || isTableTennis || isTennis || isTaekwondo || isChess ? "" : `cricket-results.html?competitionId=${encodeURIComponent(state.competitionId)}`;
    const sportLabel = isFootball ? "football score sheets" : isVolleyball ? "volleyball scoresheets" : isHockey ? "hockey score sheets" : isBasketball ? "basketball score sheets" : isSwimming ? "swimming results sheets" : isTrackField ? "track and field results sheets" : isNetball ? "netball match sheets" : isBadminton ? "badminton match sheets" : isTableTennis ? "table tennis score sheets" : isTennis ? "tennis score sheets" : isTaekwondo ? "taekwondo judge score sheets" : isChess ? "chess score sheets" : "cricket scorecards";
    const addLabel = isTrackField ? "Add Results Sheet" : "Add Score Sheet";

    if (!scorecards.length) {
      els.competitionRecentResults.innerHTML = `
        <div class="section-title">
          <div>
            <h2>Recent Results</h2>
            <p>Saved ${sportLabel} for this competition will appear here.</p>
          </div>
          ${isFootball || isVolleyball || isHockey || isBasketball || isSwimming || isTrackField || isNetball || isBadminton || isTableTennis || isTennis || isTaekwondo || isChess || sportSlug === "cricket" ? `<a class="btn btn-campus" href="${entryHref}?competitionId=${encodeURIComponent(state.competitionId)}">${addLabel}</a>` : ""}
        </div>
        <div class="empty-state">No match sheets have been saved for this competition yet.</div>
      `;
      return;
    }

    const cards = scorecards.slice(0, 4).map((line) => isFootball ? renderFootballResultCard(line) : isVolleyball ? renderVolleyballResultCard(line) : isHockey ? renderHockeyResultCard(line) : isBasketball ? renderBasketballResultCard(line) : isSwimming ? renderSwimmingResultCard(line) : isTrackField ? renderTrackFieldResultCard(line) : isNetball ? renderNetballResultCard(line) : isBadminton ? renderBadmintonResultCard(line) : isTableTennis ? renderTableTennisResultCard(line) : isTennis ? renderTennisResultCard(line) : isTaekwondo ? renderTaekwondoResultCard(line) : isChess ? renderChessResultCard(line) : renderResultCard(line)).join("");
    els.competitionRecentResults.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Recent Results</h2>
          <p>Latest saved UWI ${sportLabel}.</p>
        </div>
        <div class="quick-actions">
          ${resultsHref ? `<a class="btn btn-soft" href="${resultsHref}">View All Results</a>` : ""}
          <a class="btn btn-campus" href="${entryHref}?competitionId=${encodeURIComponent(state.competitionId)}">${addLabel}</a>
        </div>
      </div>
      <div class="result-strip">${cards}</div>
    `;
  }

  function renderStatEngine() {
    const sportSlug = getCompetitionSportSlug();
    const statRows = state.statLines.filter((line) => String(line.competitionId || "") === String(state.competitionId));
    const summary = buildStatSummary(statRows);

    if (sportSlug === "cricket") {
      renderCricketStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "football") {
      renderFootballStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "volleyball") {
      renderVolleyballStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "hockey") {
      renderHockeyStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "basketball") {
      renderBasketballStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "swimming") {
      renderSwimmingStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "track-and-field") {
      renderTrackFieldStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "netball") {
      renderNetballStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "badminton") {
      renderBadmintonStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "table-tennis") {
      renderTableTennisStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "lawn-tennis") {
      renderTennisStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "taekwondo") {
      renderTaekwondoStatEngine(statRows, summary);
      return;
    }
    if (sportSlug === "chess") {
      renderChessStatEngine(statRows, summary);
      return;
    }

    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Stat Engine</h2>
          <p>Competition-linked stat entry and summaries. This is the primary source of truth for athlete and team performance records.</p>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Add Stat Line</h3>
              <p>${escapeHtml(getStatEntryDescription(sportSlug))}</p>
            </div>
          </div>

          <form id="statLineForm" novalidate>
            <div class="filter-grid">
              <div>
                <label for="statSubjectType">Subject Type</label>
                <select id="statSubjectType" class="select">
                  ${getSubjectTypeOptions(sportSlug)}
                </select>
              </div>

              <div>
                <label for="statSubjectId">Subject</label>
                <select id="statSubjectId" class="select"></select>
              </div>

              <div>
                <label for="statUnitId">Competition Unit</label>
                <select id="statUnitId" class="select">${buildUnitOptions()}</select>
              </div>

              <div>
                <label for="statEventName">Event / Match Name</label>
                <input id="statEventName" class="input" type="text" placeholder="e.g. Men's 100m / Match 1" />
              </div>

              <div>
                <label for="statCategory">Category</label>
                <input id="statCategory" class="input" type="text" placeholder="e.g. Men / Women / Open" />
              </div>

              <div>
                <label for="statDate">Date</label>
                <input id="statDate" class="input" type="date" value="${escapeHtml(formatDateInput(state.competition?.startDate) || formatDateInput(new Date().toISOString()))}" />
              </div>

              ${renderSportSpecificPrimaryControls(sportSlug)}
            </div>

            <div id="statFieldsDynamic" class="filter-grid" style="margin-top:16px;"></div>

            <div class="form-actions" style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
              <button type="submit" class="btn btn-campus">Save Stat Line</button>
              <span id="statFormMessage" class="message" style="flex:1;"></span>
            </div>
          </form>
        </section>

        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>

          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>

    `;

    const eventTypeSelect = document.getElementById("statEventType");
    if (eventTypeSelect) {
      renderDynamicStatFields(sportSlug, eventTypeSelect.value || inferTrackFieldEventType(document.getElementById("statEventName")?.value || ""));
    } else {
      renderDynamicStatFields(sportSlug, "default");
    }
  }

  function renderCricketStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Cricket Scorecards</h2>
          <p>Cricket stat entry uses a full scorecard workflow with roster-linked UWI player rows.</p>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Scorecard Entry</h3>
              <p>Open the dedicated cricket scorecard page to enter innings, batting, bowling, extras, totals, did-not-bat, and fall of wickets.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="cricket-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Cricket Scorecard Entry</a>
        </section>

        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>

          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderFootballStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Football Score Sheets</h2>
          <p>Football stat entry uses a full match sheet workflow with squad-linked UWI player rows.</p>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Score Sheet Entry</h3>
              <p>Open the dedicated football score sheet page to enter periods, score, player stats, cards, saves, and goal events.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="football-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Football Score Sheet Entry</a>
        </section>

        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>

    `;
  }

  function renderVolleyballStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Volleyball Scoresheets</h2>
          <p>Volleyball stat entry uses a full scoresheet workflow with roster-linked UWI player rows.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Scoresheet Entry</h3>
              <p>Open the dedicated volleyball scoresheet page to enter sets, serve order, time-outs, substitutions, and player stat totals.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="volleyball-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Volleyball Scoresheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderHockeyStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Hockey Score Sheets</h2>
          <p>Hockey stat entry uses a full score sheet workflow with roster-linked UWI scoring and penalty rows.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Score Sheet Entry</h3>
              <p>Open the dedicated hockey score sheet page to enter period scores, goal scorers, assists, penalties, and goalie saves.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="hockey-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Hockey Score Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderBasketballStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Basketball Score Sheets</h2>
          <p>Basketball stat entry uses a full score sheet workflow with roster-linked UWI player rows.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Score Sheet Entry</h3>
              <p>Open the dedicated basketball score sheet page to enter quarter scores, fouls, possession, time-outs, and player stat totals.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="basketball-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Basketball Score Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderSwimmingStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Swimming Results Sheets</h2>
          <p>Swimming stat entry uses a lane-based results sheet with UWI swimmer rows linked to athlete records.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Results Sheet Entry</h3>
              <p>Open the dedicated swimming results sheet page to enter lane, swimmer, seed time, finals time, place, points, DQ, and exhibition status.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="swimming-results.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Swimming Results Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderTrackFieldStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Track and Field Results Sheets</h2>
          <p>Track and field result entry uses dedicated track and field sheets with UWI athlete rows linked to athlete records.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Results Sheet Entry</h3>
              <p>Open the dedicated workflow, then choose Track Event Results or Field Event Results before entering official marks.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="track-field-results.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Track and Field Results Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderNetballStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Netball Match Sheets</h2>
          <p>Netball stat entry uses a full match sheet with squad-linked UWI players, starting 7, quarter scores, shooting, gains, and penalties.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Match Sheet Entry</h3>
              <p>Open the dedicated netball match sheet page to enter score by quarter, starting positions, player stats, and substitutions.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="netball-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Netball Match Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderBadmintonStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Badminton Match Sheets</h2>
          <p>Badminton stat entry supports singles and doubles rubbers with best-of-three game scores linked to UWI athlete records.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Match Sheet Entry</h3>
              <p>Open the dedicated badminton match sheet page to enter players, discipline, game scores, officials, duration, and result.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="badminton-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Badminton Match Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="link-row">
            ${summary.tiles.map((tile) => metaTile(tile.label, tile.value)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function renderTableTennisStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Table Tennis Score Sheets</h2>
          <p>Table tennis stat entry records singles and doubles rubbers, games, points, and team-match totals linked to UWI athlete records.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Score Sheet Entry</h3>
              <p>Open the dedicated table tennis score sheet page to enter team-match rubbers and derived totals.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="table-tennis-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Table Tennis Score Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="metric-grid">${summary.tiles.map((tile) => `<div class="metric-card"><span>${escapeHtml(tile.label)}</span><strong>${escapeHtml(tile.value)}</strong></div>`).join("")}</div>
        </section>
      </div>
    `;
  }

  function renderTennisStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Tennis Score Sheets</h2>
          <p>Tennis stat entry records singles and doubles matches, set scores, games, court conditions, and team-match totals linked to UWI athlete records.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Score Sheet Entry</h3>
              <p>Open the dedicated tennis score sheet page to enter match scores and derived totals.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="tennis-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Tennis Score Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="metric-grid">${summary.tiles.map((tile) => `<div class="metric-card"><span>${escapeHtml(tile.label)}</span><strong>${escapeHtml(tile.value)}</strong></div>`).join("")}</div>
        </section>
      </div>
    `;
  }

  function renderTaekwondoStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Taekwondo Judge Score Sheets</h2>
          <p>Taekwondo stat entry records poomsae judge scoring with accuracy deductions, presentation scores, final averages, and rank.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Judge Score Entry</h3>
              <p>Open the dedicated taekwondo score sheet page to enter judge scores for an athlete performance.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="taekwondo-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Taekwondo Score Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="metric-grid">${summary.tiles.map((tile) => `<div class="metric-card"><span>${escapeHtml(tile.label)}</span><strong>${escapeHtml(tile.value)}</strong></div>`).join("")}</div>
        </section>
      </div>
    `;
  }

  function renderChessStatEngine(statRows, summary) {
    els.competitionStats.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Chess Score Sheets</h2>
          <p>Chess stat entry records board details, colors, time control, opening, result, and the full move score.</p>
        </div>
      </div>
      <div class="grid grid-2" style="margin-top:0;">
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Score Sheet Entry</h3>
              <p>Open the dedicated chess score sheet page to enter board and move records.</p>
            </div>
          </div>
          <a class="btn btn-campus" href="chess-scorecard.html?competitionId=${encodeURIComponent(state.competitionId)}">Open Chess Score Sheet Entry</a>
        </section>
        <section class="card" style="margin-top:0;">
          <div class="section-title section-title-sm">
            <div>
              <h3>Summary</h3>
              <p>${escapeHtml(summary.description)}</p>
            </div>
          </div>
          <div class="metric-grid">${summary.tiles.map((tile) => `<div class="metric-card"><span>${escapeHtml(tile.label)}</span><strong>${escapeHtml(tile.value)}</strong></div>`).join("")}</div>
        </section>
      </div>
    `;
  }

  function renderCricketInningsCard(index) {
    return `
      <section class="cricket-innings-card">
        <div class="cricket-scorecard-head">
          <div>
            <h3>Innings ${index}</h3>
            <p>Batting scorecard and bowling figures for this innings.</p>
          </div>
          <div class="cricket-innings-meta">
            <label for="cricketInnings${index}Team">Batting Team</label>
            <input id="cricketInnings${index}Team" class="input" type="text" placeholder="Team name" />
            <label for="cricketInnings${index}Overs">Overs</label>
            <input id="cricketInnings${index}Overs" class="input" type="text" placeholder="e.g. 20 / 19.3" />
            <label for="cricketInnings${index}Target">Target</label>
            <input id="cricketInnings${index}Target" class="input" type="text" placeholder="Optional" />
          </div>
        </div>

        <div class="cricket-scorecard-table-wrap">
          <table class="cricket-scorecard-table cricket-batting-table">
            <thead>
              <tr>
                <th>Batter</th><th>How Out</th><th>R</th><th>M</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
              </tr>
            </thead>
            <tbody>${Array.from({ length: 11 }, (_, rowIndex) => renderCricketBattingRow(index, rowIndex + 1)).join("")}</tbody>
          </table>
        </div>

        <div class="cricket-scorecard-totals">
          <div><label for="cricketInnings${index}Extras">Extras</label><input id="cricketInnings${index}Extras" class="input" type="text" placeholder="e.g. lb 4, w 3, nb 1" /></div>
          <div><label for="cricketInnings${index}ExtrasRuns">Extras Runs</label><input id="cricketInnings${index}ExtrasRuns" class="input" type="number" min="0" step="1" /></div>
          <div><label for="cricketInnings${index}Total">Total</label><input id="cricketInnings${index}Total" class="input" type="number" min="0" step="1" /></div>
          <div><label for="cricketInnings${index}Wickets">Wickets</label><input id="cricketInnings${index}Wickets" class="input" type="number" min="0" max="10" step="1" /></div>
          <div><label for="cricketInnings${index}RunRate">Run Rate</label><input id="cricketInnings${index}RunRate" class="input" type="text" placeholder="e.g. 9.95" /></div>
        </div>

        <div class="filter-grid cricket-notes-grid">
          <div><label for="cricketInnings${index}DidNotBat">Did Not Bat</label><textarea id="cricketInnings${index}DidNotBat" class="textarea" placeholder="Comma-separated player names"></textarea></div>
          <div><label for="cricketInnings${index}FallOfWickets">Fall Of Wickets</label><textarea id="cricketInnings${index}FallOfWickets" class="textarea" placeholder="e.g. 1-23 (Player, 3.4 ov), 2-30 ..."></textarea></div>
        </div>

        <div class="cricket-scorecard-table-wrap">
          <table class="cricket-scorecard-table cricket-bowling-table">
            <thead>
              <tr>
                <th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>${Array.from({ length: 6 }, (_, rowIndex) => renderCricketBowlingRow(index, rowIndex + 1)).join("")}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderCricketBattingRow(inningsIndex, rowIndex) {
    const prefix = `cricketI${inningsIndex}Bat${rowIndex}`;
    return `
      <tr>
        <td><input id="${prefix}Name" class="input" type="text" /></td>
        <td><input id="${prefix}HowOut" class="input" type="text" placeholder="not out / c ... b ..." /></td>
        <td><input id="${prefix}Runs" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Minutes" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Balls" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Fours" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Sixes" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}StrikeRate" class="input" type="text" /></td>
      </tr>
    `;
  }

  function renderCricketBowlingRow(inningsIndex, rowIndex) {
    const prefix = `cricketI${inningsIndex}Bowl${rowIndex}`;
    return `
      <tr>
        <td><input id="${prefix}Name" class="input" type="text" /></td>
        <td><input id="${prefix}Overs" class="input" type="text" /></td>
        <td><input id="${prefix}Maidens" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Runs" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Wickets" class="input" type="number" min="0" step="1" /></td>
        <td><input id="${prefix}Economy" class="input" type="text" /></td>
        <td><input id="${prefix}Notes" class="input" type="text" placeholder="e.g. 1w / 1nb" /></td>
      </tr>
    `;
  }

    function renderAudit() {
    if (!state.audit.length) {
      setEmpty("competitionAudit", "Activity history will appear here once added.", "No activity entries have been recorded for this competition yet.");
      return;
    }

    const rows = state.audit
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((entry) => `
        <tr>
          <td>${escapeHtml(formatDateTime(entry.createdAt || entry.date || ""))}</td>
          <td>${escapeHtml(entry.action || entry.type || "Activity")}</td>
          <td>${escapeHtml(entry.actor || entry.actorName || state.session?.fullName || state.session?.email || "System")}</td>
          <td>${escapeHtml(entry.message || entry.notes || "—")}</td>
        </tr>
      `)
      .join("");

    els.competitionAudit.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Audit</h2>
          <p>Recent activity and stat-entry events for this competition.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function bindDynamicForms() {
    const sportSlug = normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport);
    bindLeaderboardControls();

    const subjectTypeSelect = document.getElementById("statSubjectType");
    const subjectSelect = document.getElementById("statSubjectId");
    const eventTypeSelect = document.getElementById("statEventType");
    const eventNameInput = document.getElementById("statEventName");
    const statLineForm = document.getElementById("statLineForm");

    if (subjectTypeSelect && subjectSelect) {
      populateSubjectOptions(subjectTypeSelect.value || getDefaultSubjectType(sportSlug));
      subjectTypeSelect.addEventListener("change", function () {
        populateSubjectOptions(subjectTypeSelect.value);
      });
    }

    if (eventTypeSelect) {
      eventTypeSelect.addEventListener("change", function () {
        renderDynamicStatFields(sportSlug, eventTypeSelect.value || "default");
      });
    }

    if (eventNameInput && eventTypeSelect && sportSlug === "track-and-field") {
      eventNameInput.addEventListener("input", function () {
        const inferred = inferTrackFieldEventType(eventNameInput.value);
        eventTypeSelect.value = inferred;
        renderDynamicStatFields(sportSlug, inferred);
      });
    }

    if (statLineForm) {
      statLineForm.addEventListener("submit", handleStatLineSubmit);
    }

    function populateSubjectOptions(subjectType) {
      if (!subjectSelect) return;
      const items = getSubjectsForType(subjectType);
      subjectSelect.innerHTML = items.length
        ? items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")
        : `<option value="">No available ${escapeHtml(subjectType || "subjects")}</option>`;
    }
  }

  async function handleStatLineSubmit(event) {
  event.preventDefault();

  const messageEl = document.getElementById("statFormMessage");
  clearMessage(messageEl);

  const sportSlug = normalizeSportSlug(
    state.competition?.sportSlug || state.competition?.sport
  );

  const subjectType = valueOf("statSubjectType");
  const subjectId = valueOf("statSubjectId");
  const unitId = valueOf("statUnitId");

  if (sportSlug === "cricket") {
    const scorecardData = buildCricketScorecardFromForm();
    if (!scorecardData.valid) {
      setError(messageEl, scorecardData.message);
      return;
    }

    const payload = {
      competitionId: state.competitionId,
      sport: sportSlug,
      subjectType: "match",
      subjectId: state.competitionId,
      eventType: "scorecard",
      eventName: valueOf("statEventName") || "Cricket scorecard",
      category: "Scorecard",
      date: valueOf("statDate") || new Date().toISOString(),
      season: state.competition?.season || "",
      statData: scorecardData.payload,
      verified: true,
      source: "competition-view"
    };

    try {
      await APP.apiPost("/competition-stat-lines", payload);
      setSuccess(messageEl, "Cricket scorecard saved successfully.");
      event.target.reset();
      await refreshPage();
    } catch (error) {
      console.error("Cricket scorecard save error:", error);
      setError(messageEl, error?.message || "Failed to save cricket scorecard.");
    }
    return;
  }

  if (!subjectType || !subjectId) {
    setError(messageEl, "Choose a subject before saving a stat line.");
    return;
  }

  const statData = buildStatDataFromForm(sportSlug, valueOf("statEventType") || getDefaultEventType(sportSlug));
  if (!statData.valid) {
    setError(messageEl, statData.message);
    return;
  }

  const payload = {
    competitionId: state.competitionId,
    sport: sportSlug,
    unitId: unitId || null,
    subjectType,
    subjectId,
    eventName: valueOf("statEventName") || "",
    category: valueOf("statCategory") || "",
    date: valueOf("statDate") || new Date().toISOString(),
    season: state.competition?.season || "",
    statData: statData.payload,
    verified: true,
    source: "competition-view"
  };

  try {
    await APP.apiPost("/competition-stat-lines", payload);

    setSuccess(messageEl, "Stat line saved successfully.");

    event.target.reset();

    // 🔥 KEY CHANGE: reload from backend instead of local mutation
    await refreshPage();

  } catch (error) {
    console.error("Stat save error:", error);
    setError(messageEl, error?.message || "Failed to save stat line.");
  }
}

  function renderDynamicStatFields(sportSlug, eventType) {
    const container = document.getElementById("statFieldsDynamic");
    if (!container) return;

    if (sportSlug === "track-and-field") {
      if (eventType === "track" || eventType === "relay") {
        container.innerHTML = `
          <div>
            <label for="statTime">Time / Mark</label>
            <input id="statTime" class="input" type="text" placeholder="e.g. 10.45 / 3:45.22" />
          </div>
          <div>
            <label for="statWind">Wind</label>
            <input id="statWind" class="input" type="text" placeholder="e.g. 1.2" />
          </div>
          <div>
            <label for="statLane">Lane</label>
            <input id="statLane" class="input" type="text" placeholder="e.g. 4" />
          </div>
          <div>
            <label for="statReactionTime">Reaction Time</label>
            <input id="statReactionTime" class="input" type="text" placeholder="e.g. 0.135" />
          </div>
          <div class="field-full" style="grid-column:1/-1;">
            <label for="statSplits">Splits (comma-separated)</label>
            <input id="statSplits" class="input" type="text" placeholder="e.g. 50m:5.80,100m:10.45" />
          </div>
        `;
        return;
      }

      if (eventType === "horizontal-jump" || eventType === "throw") {
        container.innerHTML = `
          <div>
            <label for="statBest">Best Mark</label>
            <input id="statBest" class="input" type="text" placeholder="e.g. 7.85 / 18.45" />
          </div>
          <div>
            <label for="statWind">Wind</label>
            <input id="statWind" class="input" type="text" placeholder="Optional" />
          </div>
          <div class="field-full" style="grid-column:1/-1;">
            <label for="statAttempts">Attempts (comma-separated)</label>
            <input id="statAttempts" class="input" type="text" placeholder="e.g. 7.50,7.70,X,7.85" />
          </div>
        `;
        return;
      }

      if (eventType === "vertical-jump") {
        container.innerHTML = `
          <div>
            <label for="statBest">Best Height</label>
            <input id="statBest" class="input" type="text" placeholder="e.g. 2.10" />
          </div>
          <div class="field-full" style="grid-column:1/-1;">
            <label for="statProgression">Progression</label>
            <textarea id="statProgression" class="input" rows="4" placeholder="e.g. 1.80:O,1.90:O,2.00:XO,2.10:XXO,2.15:XXX"></textarea>
          </div>
        `;
        return;
      }
    }

    if (sportSlug === "football") {
      container.innerHTML = `
        <div><label for="statGoals">Goals</label><input id="statGoals" class="input" type="number" min="0" step="1" /></div>
        <div><label for="statAssists">Assists</label><input id="statAssists" class="input" type="number" min="0" step="1" /></div>
        <div><label for="statMinutes">Minutes Played</label><input id="statMinutes" class="input" type="number" min="0" step="1" /></div>
        <div><label for="statShots">Shots</label><input id="statShots" class="input" type="number" min="0" step="1" /></div>
        <div><label for="statShotsOnTarget">Shots on Target</label><input id="statShotsOnTarget" class="input" type="number" min="0" step="1" /></div>
        <div><label for="statYellowCards">Yellow Cards</label><input id="statYellowCards" class="input" type="number" min="0" step="1" /></div>
        <div><label for="statRedCards">Red Cards</label><input id="statRedCards" class="input" type="number" min="0" step="1" /></div>
      `;
      return;
    }

    const schema = getSchemaForEntry(sportSlug, eventType);
    if (schema?.fields?.length) {
      container.innerHTML = schema.fields.map(renderSchemaFieldInput).join("");
      return;
    }

    container.innerHTML = `
      <div class="field-full" style="grid-column:1/-1;">
        <label for="statGenericValue">Stat Value / Notes</label>
        <input id="statGenericValue" class="input" type="text" placeholder="Enter the primary stat value for this competition item" />
      </div>
    `;
  }

  function buildStatDataFromForm(sportSlug, eventType) {
    if (sportSlug === "track-and-field") {
      if (eventType === "track" || eventType === "relay") {
        const time = valueOf("statTime");
        if (!time) return { valid: false, message: "Enter a time/mark before saving the stat line." };
        return {
          valid: true,
          payload: {
            time,
            wind: valueOf("statWind") || null,
            lane: valueOf("statLane") || null,
            reactionTime: valueOf("statReactionTime") || null,
            splits: parseSplits(valueOf("statSplits"))
          }
        };
      }

      if (eventType === "horizontal-jump" || eventType === "throw") {
        const best = valueOf("statBest");
        if (!best) return { valid: false, message: "Enter the best mark before saving the stat line." };
        return {
          valid: true,
          payload: {
            best,
            wind: valueOf("statWind") || null,
            attempts: parseAttemptList(valueOf("statAttempts"))
          }
        };
      }

      if (eventType === "vertical-jump") {
        const best = valueOf("statBest");
        if (!best) return { valid: false, message: "Enter the best height before saving the stat line." };
        return {
          valid: true,
          payload: {
            best,
            progression: parseProgression(valueOf("statProgression"))
          }
        };
      }
    }

    if (sportSlug === "football") {
      return {
        valid: true,
        payload: {
          goals: toNumberOrNull(valueOf("statGoals")),
          assists: toNumberOrNull(valueOf("statAssists")),
          minutesPlayed: toNumberOrNull(valueOf("statMinutes")),
          shots: toNumberOrNull(valueOf("statShots")),
          shotsOnTarget: toNumberOrNull(valueOf("statShotsOnTarget")),
          yellowCards: toNumberOrNull(valueOf("statYellowCards")),
          redCards: toNumberOrNull(valueOf("statRedCards"))
        }
      };
    }

    const schema = getSchemaForEntry(sportSlug, eventType);
    if (schema?.fields?.length) {
      const payload = {};
      let hasValue = false;
      schema.fields.forEach((fieldName) => {
        const raw = valueOf(getSchemaFieldId(fieldName));
        const value = parseSchemaFieldValue(fieldName, raw);
        payload[fieldName] = value;
        if (value !== null && value !== "") hasValue = true;
      });
      if (!hasValue) return { valid: false, message: "Enter at least one sport-specific stat value before saving the stat line." };
      return { valid: true, payload };
    }

    const genericValue = valueOf("statGenericValue");
    if (!genericValue) return { valid: false, message: "Enter a stat value before saving the stat line." };
    return { valid: true, payload: { value: genericValue } };
  }

  function buildCricketScorecardFromForm() {
    const innings = [1, 2].map(readCricketInnings).filter((entry) => entry.team || entry.total !== null || entry.batting.length || entry.bowling.length);
    if (!innings.length) {
      return { valid: false, message: "Enter at least one innings before saving the cricket scorecard." };
    }

    return {
      valid: true,
      payload: {
        eventType: "scorecard",
        result: valueOf("cricketResult"),
        venue: valueOf("cricketVenue"),
        innings
      }
    };
  }

  function readCricketInnings(index) {
    return {
      innings: index,
      team: valueOf(`cricketInnings${index}Team`),
      overs: valueOf(`cricketInnings${index}Overs`),
      target: valueOf(`cricketInnings${index}Target`),
      extras: valueOf(`cricketInnings${index}Extras`),
      extrasRuns: toNumberOrNull(valueOf(`cricketInnings${index}ExtrasRuns`)),
      total: toNumberOrNull(valueOf(`cricketInnings${index}Total`)),
      wickets: toNumberOrNull(valueOf(`cricketInnings${index}Wickets`)),
      runRate: valueOf(`cricketInnings${index}RunRate`),
      didNotBat: splitList(valueOf(`cricketInnings${index}DidNotBat`)),
      fallOfWickets: splitList(valueOf(`cricketInnings${index}FallOfWickets`)),
      batting: Array.from({ length: 11 }, (_, rowIndex) => readCricketBattingRow(index, rowIndex + 1)).filter((row) => row.name || row.runs !== null || row.balls !== null),
      bowling: Array.from({ length: 6 }, (_, rowIndex) => readCricketBowlingRow(index, rowIndex + 1)).filter((row) => row.name || row.overs || row.wickets !== null)
    };
  }

  function readCricketBattingRow(inningsIndex, rowIndex) {
    const prefix = `cricketI${inningsIndex}Bat${rowIndex}`;
    return {
      name: valueOf(`${prefix}Name`),
      howOut: valueOf(`${prefix}HowOut`),
      runs: toNumberOrNull(valueOf(`${prefix}Runs`)),
      minutes: toNumberOrNull(valueOf(`${prefix}Minutes`)),
      balls: toNumberOrNull(valueOf(`${prefix}Balls`)),
      fours: toNumberOrNull(valueOf(`${prefix}Fours`)),
      sixes: toNumberOrNull(valueOf(`${prefix}Sixes`)),
      strikeRate: valueOf(`${prefix}StrikeRate`)
    };
  }

  function readCricketBowlingRow(inningsIndex, rowIndex) {
    const prefix = `cricketI${inningsIndex}Bowl${rowIndex}`;
    return {
      name: valueOf(`${prefix}Name`),
      overs: valueOf(`${prefix}Overs`),
      maidens: toNumberOrNull(valueOf(`${prefix}Maidens`)),
      runs: toNumberOrNull(valueOf(`${prefix}Runs`)),
      wickets: toNumberOrNull(valueOf(`${prefix}Wickets`)),
      economy: valueOf(`${prefix}Economy`),
      notes: valueOf(`${prefix}Notes`)
    };
  }

  function splitList(value) {
    return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  function getCompetitionSportSlug() {
    return normalizeSportSlug(
      state.competition?.sportSlug ||
      state.competition?.sport ||
      state.competition?.data?.sportSlug ||
      state.competition?.data?.sport ||
      state.statLines.find((line) => line.sport || line.sportSlug || line.statData?.sport || line.statData?.sportSlug)?.sportSlug ||
      state.statLines.find((line) => line.sport || line.sportSlug || line.statData?.sport || line.statData?.sportSlug)?.sport ||
      state.statLines.find((line) => line.statData?.sport || line.statData?.sportSlug)?.statData?.sportSlug ||
      state.statLines.find((line) => line.statData?.sport || line.statData?.sportSlug)?.statData?.sport
    );
  }

  function renderStatTable(statRows) {
    if (!statRows.length) {
      return `<div class="empty-state"><h3>No stat lines yet.</h3><p>Add competition-linked stat lines above to manage athlete and team performance records.</p></div>`;
    }

    const rows = statRows
      .slice()
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")))
      .map((line) => `
        <tr>
          <td>${renderStatLineEventCell(line)}</td>
          <td>${escapeHtml(line.subjectName || resolveSubjectName(line.subjectId, line.subjectType))}</td>
          <td>${escapeHtml(line.eventType || line.subjectType || "—")}</td>
          <td>${escapeHtml(formatStatLine(line))}</td>
          <td>${escapeHtml(line.date || "—")}</td>
        </tr>
      `)
      .join("");

    return `
      ${renderLeaderboards(statRows)}
      <div class="data-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event / Unit</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Stat</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderLeaderboards(statRows) {
    const rows = buildLeaderboardRows(statRows);
    if (!rows.length) return "";
    const metrics = getLeaderboardMetrics();
    const activeMetric = state.leaderboardSort.metric || metrics[0]?.key || "total";
    const order = state.leaderboardSort.order || "desc";
    const sorted = rows
      .slice()
      .sort((a, b) => order === "asc" ? (a[activeMetric] || 0) - (b[activeMetric] || 0) : (b[activeMetric] || 0) - (a[activeMetric] || 0));
    return `
      <details class="leaderboard-drawer">
        <summary>
          <span>
            <strong>Competition Leaderboards</strong>
            <small>Open sortable player rankings for this competition. Stats reflect 2026 onwards.</small>
          </span>
        </summary>
        <div class="section-title" style="margin-top:16px;">
          <div>
            <h2>Competition Leaderboards</h2>
            <p>Sortable player rankings for this competition. Player links open that athlete's competition-specific stat view.</p>
          </div>
        <div class="quick-actions">
          <a class="btn btn-campus" href="leaderboards.html?scope=competition&competitionId=${encodeURIComponent(state.competitionId)}">Open Full Page</a>
          ${metrics.map((metric) => `<button class="btn btn-soft" type="button" data-leaderboard-metric="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</button>`).join("")}
            <button class="btn btn-soft" type="button" data-leaderboard-order="${order === "desc" ? "asc" : "desc"}">${order === "desc" ? "Highest first" : "Lowest first"}</button>
          </div>
        </div>
        <div class="data-table-wrap">
          <table class="table">
            <thead><tr><th>Player</th>${metrics.map((metric) => `<th>${escapeHtml(metric.label)}</th>`).join("")}</tr></thead>
            <tbody>
              ${sorted.map((row) => `
                <tr>
                  <td><a href="${escapeHtml(leaderboardPlayerHref(row.id))}">${escapeHtml(row.name)}</a></td>
                  ${metrics.map((metric) => `<td>${escapeHtml(row[metric.key] || 0)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  function bindLeaderboardControls() {
    document.querySelectorAll("[data-leaderboard-metric]").forEach((button) => {
      button.addEventListener("click", function () {
        state.leaderboardSort.metric = this.dataset.leaderboardMetric || "";
        renderStatEngine();
        bindDynamicForms();
      });
    });
    document.querySelectorAll("[data-leaderboard-order]").forEach((button) => {
      button.addEventListener("click", function () {
        state.leaderboardSort.order = this.dataset.leaderboardOrder || "desc";
        renderStatEngine();
        bindDynamicForms();
      });
    });
  }

  function getLeaderboardMetrics() {
    const sportSlug = getCompetitionSportSlug();
    if (sportSlug === "cricket") return [{ key: "runs", label: "Runs" }, { key: "wickets", label: "Wickets" }, { key: "catches", label: "Catches" }];
    if (["football", "hockey", "netball"].includes(sportSlug)) return [{ key: "goals", label: "Goals" }, { key: "assists", label: "Assists" }, { key: "saves", label: "Saves" }];
    if (sportSlug === "basketball") return [{ key: "points", label: "Points" }, { key: "rebounds", label: "Rebounds" }, { key: "assists", label: "Assists" }, { key: "steals", label: "Steals" }, { key: "blocks", label: "Blocks" }, { key: "turnovers", label: "Turnovers" }, { key: "threeMade", label: "3PM" }];
    if (sportSlug === "volleyball") return [{ key: "kills", label: "Kills" }, { key: "aces", label: "Aces" }, { key: "blocks", label: "Blocks" }];
    if (sportSlug === "swimming" || sportSlug === "track-and-field") return [{ key: "points", label: "Points" }, { key: "wins", label: "Wins" }, { key: "entries", label: "Entries" }];
    return [{ key: "wins", label: "Wins" }, { key: "points", label: "Points" }, { key: "entries", label: "Entries" }];
  }

  function buildLeaderboardRows(statRows) {
    const metrics = getLeaderboardMetrics();
    const map = new Map();
    statRows.forEach((line) => {
      const sportSlug = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || getCompetitionSportSlug());
      if (sportSlug === "cricket" && Array.isArray(line.statData?.innings)) {
        addCricketScorecardLeaderboardRows(map, metrics, line);
        return;
      }
      if (sportSlug === "basketball" && Array.isArray(line.statData?.playerStats)) {
        addBasketballScorecardLeaderboardRows(map, metrics, line);
        return;
      }
      const subjectType = String(line.subjectType || line.statData?.subjectType || "").toLowerCase();
      const id = line.subjectId || line.athleteId || line.statData?.athleteId || "";
      if (!id || (subjectType && subjectType !== "athlete" && subjectType !== "player")) return;
      const name = line.subjectName || line.statData?.playerName || resolveSubjectName(id, "athlete") || "Athlete";
      if (!map.has(String(id))) {
        map.set(String(id), { id, name, entries: 0 });
        metrics.forEach((metric) => { map.get(String(id))[metric.key] = 0; });
      }
      const row = map.get(String(id));
      row.entries += 1;
      metrics.forEach((metric) => {
        row[metric.key] += extractLeaderboardValue(line, metric.key);
      });
    });
    return Array.from(map.values());
  }

  function addLeaderboardValue(map, metrics, athleteId, name, values) {
    const id = String(athleteId || "");
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, { id, name: name || resolveSubjectName(id, "athlete") || "Athlete", entries: 0 });
      metrics.forEach((metric) => { map.get(id)[metric.key] = 0; });
    }
    const row = map.get(id);
    row.entries += values.entries || 0;
    metrics.forEach((metric) => {
      row[metric.key] += Number(values[metric.key] || 0);
    });
  }

  function addCricketScorecardLeaderboardRows(map, metrics, line) {
    const data = line.statData || {};
    (data.innings || []).forEach((innings) => {
      (innings.batting || []).forEach((batter) => {
        addLeaderboardValue(map, metrics, batter.athleteId, batter.name, { entries: 1, runs: Number(batter.runs || 0) });
        if (batter.fielderAthleteId) {
          addLeaderboardValue(map, metrics, batter.fielderAthleteId, batter.fielderName, { catches: /caught/i.test(String(batter.dismissalMode || batter.howOut || "")) ? 1 : 0 });
        }
      });
      (innings.bowling || []).forEach((bowler) => {
        addLeaderboardValue(map, metrics, bowler.athleteId, bowler.name, { entries: 1, wickets: Number(bowler.wickets || 0) });
      });
    });
  }

  function addBasketballScorecardLeaderboardRows(map, metrics, line) {
    (line.statData?.playerStats || []).forEach((player) => {
      addLeaderboardValue(map, metrics, player.athleteId, player.name, {
        entries: 1,
        points: Number(player.points || 0),
        rebounds: Number(player.rebounds || 0),
        assists: Number(player.assists || 0),
        steals: Number(player.steals || 0),
        blocks: Number(player.blocks || 0),
        turnovers: Number(player.turnovers || 0),
        threeMade: Number(player.threeMade || 0)
      });
    });
  }

  function extractLeaderboardValue(line, key) {
    const data = line.statData || {};
    if (key === "entries") return 1;
    const direct = Number(data[key] ?? line[key] ?? line.statValue);
    if (Number.isFinite(direct)) return direct;
    if (key === "wins") return /win|1st|first/i.test(String(data.result || data.outcome || line.statName || "")) ? 1 : 0;
    return 0;
  }

  function leaderboardPlayerHref(athleteId) {
    const sportSlug = getCompetitionSportSlug();
    if (sportSlug === "cricket") {
      return `athlete-cricket-stats.html?athleteId=${encodeURIComponent(athleteId)}&competitionId=${encodeURIComponent(state.competitionId)}`;
    }
    if (sportSlug === "basketball") {
      return `athlete-basketball-stats.html?athleteId=${encodeURIComponent(athleteId)}&competitionId=${encodeURIComponent(state.competitionId)}`;
    }
    return `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;
  }

  function renderStatLineEventCell(line) {
    const label = escapeHtml(line.eventName || getUnitName(line.unitId) || "—");
    const sportSlug = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
    const isScorecard = line.eventType === "scorecard" || line.statData?.eventType === "scorecard";
    if (sportSlug === "football" && isScorecard) {
      return `<a href="football-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "volleyball" && isScorecard) {
      return `<a href="volleyball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "hockey" && isScorecard) {
      return `<a href="hockey-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "basketball" && isScorecard) {
      return `<a href="basketball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "swimming" && isScorecard) {
      return `<a href="swimming-results-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "track-and-field" && isScorecard) {
      return `<a href="track-field-results-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "netball" && isScorecard) {
      return `<a href="netball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "badminton" && isScorecard) {
      return `<a href="badminton-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "table-tennis" && isScorecard) {
      return `<a href="table-tennis-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "lawn-tennis" && isScorecard) {
      return `<a href="tennis-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "taekwondo" && isScorecard) {
      return `<a href="taekwondo-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "chess" && isScorecard) {
      return `<a href="chess-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    if (sportSlug === "cricket" && isScorecard) {
      return `<a href="cricket-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">${label}</a>`;
    }
    return label;
  }

  function scorecardEditHref(line) {
    const sportSlug = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || getCompetitionSportSlug());
    const pages = {
      cricket: "cricket-scorecard.html",
      football: "football-scorecard.html",
      volleyball: "volleyball-scorecard.html",
      hockey: "hockey-scorecard.html",
      basketball: "basketball-scorecard.html",
      swimming: "swimming-results.html",
      "track-and-field": "track-field-results.html",
      netball: "netball-scorecard.html",
      badminton: "badminton-scorecard.html",
      "table-tennis": "table-tennis-scorecard.html",
      "lawn-tennis": "tennis-scorecard.html",
      taekwondo: "taekwondo-scorecard.html",
      chess: "chess-scorecard.html"
    };
    const page = pages[sportSlug] || "cricket-scorecard.html";
    return `${page}?competitionId=${encodeURIComponent(line.competitionId || state.competitionId)}&scorecardId=${encodeURIComponent(line.id)}`;
  }

  function scorecardEditLink(line) {
    return `<a href="${scorecardEditHref(line)}">Edit</a>`;
  }

  function buildParticipantRows() {
    if (!state.participants.length) {
      const inferred = new Map();
      state.statLines.forEach((line) => {
        const data = line.statData || {};
        const teamId = line.teamId || data.teamId || data.uwiTeamId;
        if (teamId) {
          const team = state.teams.find((item) => String(item.id || item.teamId) === String(teamId));
          inferred.set(`team:${teamId}`, {
            name: team?.name || team?.teamName || data.uwiTeamName || "Linked Team",
            type: "Team",
            unit: line.eventName || "Match record",
            category: getSportName(line.sportSlug || line.sport || data.sportSlug || data.sport || getCompetitionSportSlug())
          });
        }
        const athleteIds = collectAthleteIdsFromStatLine(line);
        athleteIds.forEach((athleteId) => {
          inferred.set(`athlete:${athleteId}`, {
            name: resolveSubjectName(athleteId, "athlete"),
            type: "Athlete",
            unit: line.eventName || "Stat record",
            category: getSportName(line.sportSlug || line.sport || data.sportSlug || data.sport || getCompetitionSportSlug())
          });
        });
      });
      return Array.from(inferred.values());
    }
    return state.participants.map((item) => ({
      name: resolveSubjectName(item.subjectId || item.athleteId || item.teamId || item.id, item.subjectType || inferParticipantSubjectType(item)),
      type: formatSubjectType(item.subjectType || inferParticipantSubjectType(item)),
      unit: item.eventName || item.unitName || getUnitName(item.unitId) || "—",
      category: item.category || item.division || "—"
    }));
  }

  function collectAthleteIdsFromStatLine(line) {
    const ids = new Set();
    const data = line.statData || {};
    [line.athleteId, line.subjectType === "athlete" ? line.subjectId : "", data.athleteId].filter(Boolean).forEach((id) => ids.add(String(id)));
    if (Array.isArray(data.innings)) {
      data.innings.forEach((innings) => {
        [...(innings.batting || []), ...(innings.bowling || [])].forEach((item) => {
          if (item.athleteId) ids.add(String(item.athleteId));
          if (item.bowlerAthleteId) ids.add(String(item.bowlerAthleteId));
          if (item.fielderAthleteId) ids.add(String(item.fielderAthleteId));
        });
      });
    }
    return Array.from(ids);
  }
  function buildStatSummary(statRows) {
    const sportSlug = getCompetitionSportSlug();

    if (!statRows.length) {
      return {
        description: "No stat lines are currently linked to this competition.",
        tiles: [
          { label: "Stat Lines", value: "0" },
          { label: "Subjects", value: "0" },
          { label: "Units", value: String(state.units.length) }
        ]
      };
    }

    const uniqueSubjects = new Set(statRows.map((line) => `${line.subjectType}:${line.subjectId}`));

    if (sportSlug === "track-and-field") {
      const timed = statRows.filter((line) => ["track", "relay"].includes(line.eventType) || line.statData?.resultType === "track");
      const field = statRows.filter((line) => ["horizontal-jump", "vertical-jump", "throw"].includes(line.eventType) || line.statData?.resultType === "field");
      return {
        description: "Track and field results split between track sheets and field-event sheets.",
        tiles: [
          { label: "Result Sheets", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "Track Events", value: String(timed.length) },
          { label: "Field Events", value: String(field.length) }
        ]
      };
    }

    if (sportSlug === "football") {
      const goals = statRows.reduce((sum, line) => sum + (Number(line.statData?.goals) || 0), 0);
      const assists = statRows.reduce((sum, line) => sum + (Number(line.statData?.assists) || 0), 0);
      return {
        description: "Football stat lines summarize scoring and contribution across recorded entries.",
        tiles: [
          { label: "Stat Lines", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "Goals", value: String(goals) },
          { label: "Assists", value: String(assists) }
        ]
      };
    }

    if (sportSlug === "netball") {
      const goals = statRows.reduce((sum, line) => sum + (Number(line.statData?.teamTotals?.goals) || 0), 0);
      const gains = statRows.reduce((sum, line) => sum + (Number(line.statData?.teamTotals?.gains) || 0), 0);
      const penalties = statRows.reduce((sum, line) => sum + (Number(line.statData?.teamTotals?.penalties) || 0), 0);
      return {
        description: "Netball match sheets summarize scoring, shooting, gains, feeds, and penalties across recorded matches.",
        tiles: [
          { label: "Match Sheets", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "Goals", value: String(goals) },
          { label: "Gains / Penalties", value: `${gains} / ${penalties}` }
        ]
      };
    }

    if (sportSlug === "badminton") {
      const pointsFor = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.pointsFor) || 0), 0);
      const pointsAgainst = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.pointsAgainst) || 0), 0);
      const wins = statRows.filter((line) => Number(line.statData?.summary?.uwiGamesWon || 0) > Number(line.statData?.summary?.opponentGamesWon || 0)).length;
      return {
        description: "Badminton match sheets summarize singles and doubles rubbers, games won, points for, and points against.",
        tiles: [
          { label: "Match Sheets", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "UWI Wins", value: String(wins) },
          { label: "Points + / -", value: `${pointsFor} / ${pointsAgainst}` }
        ]
      };
    }

    if (sportSlug === "table-tennis") {
      const pointsFor = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.pointsFor) || 0), 0);
      const pointsAgainst = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.pointsAgainst) || 0), 0);
      const rubbersWon = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.uwiRubbers) || 0), 0);
      const wins = statRows.filter((line) => Number(line.statData?.summary?.uwiRubbers || 0) > Number(line.statData?.summary?.opponentRubbers || 0)).length;
      return {
        description: "Table tennis score sheets summarize team-match rubbers, games won, points for, and points against.",
        tiles: [
          { label: "Score Sheets", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "UWI Wins", value: String(wins) },
          { label: "Rubbers Won", value: String(rubbersWon) },
          { label: "Points + / -", value: `${pointsFor} / ${pointsAgainst}` }
        ]
      };
    }

    if (sportSlug === "lawn-tennis") {
      const gamesFor = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.gamesFor) || 0), 0);
      const gamesAgainst = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.gamesAgainst) || 0), 0);
      const matchesWon = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.uwiMatches) || 0), 0);
      const wins = statRows.filter((line) => Number(line.statData?.summary?.uwiMatches || 0) > Number(line.statData?.summary?.opponentMatches || 0)).length;
      return {
        description: "Tennis score sheets summarize singles, doubles, sets won, games for, and games against.",
        tiles: [
          { label: "Score Sheets", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "UWI Wins", value: String(wins) },
          { label: "Matches Won", value: String(matchesWon) },
          { label: "Games + / -", value: `${gamesFor} / ${gamesAgainst}` }
        ]
      };
    }

    if (sportSlug === "taekwondo") {
      const scores = statRows.map((line) => Number(line.statData?.summary?.finalScore)).filter(Number.isFinite);
      const best = scores.length ? Math.max(...scores) : 0;
      const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
      const podiums = statRows.filter((line) => Number(line.statData?.summary?.rank || line.statData?.rank) > 0 && Number(line.statData?.summary?.rank || line.statData?.rank) <= 3).length;
      return {
        description: "Taekwondo judge score sheets summarize poomsae final scores, judge counts, rankings, and podium finishes.",
        tiles: [
          { label: "Score Sheets", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "Best Score", value: best.toFixed(2) },
          { label: "Average Score", value: avg.toFixed(2) },
          { label: "Podiums", value: String(podiums) }
        ]
      };
    }

    if (sportSlug === "chess") {
      const score = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.uwiScore) || 0), 0);
      const wins = statRows.filter((line) => Number(line.statData?.summary?.uwiScore) === 1).length;
      const draws = statRows.filter((line) => Number(line.statData?.summary?.uwiScore) === 0.5).length;
      const moves = statRows.reduce((sum, line) => sum + (Number(line.statData?.summary?.moveCount) || 0), 0);
      return {
        description: "Chess score sheets summarize board results, total points, wins, draws, openings, and move records.",
        tiles: [
          { label: "Games", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "UWI Points", value: String(score) },
          { label: "Wins / Draws", value: `${wins} / ${draws}` },
          { label: "Move Pairs", value: String(moves) }
        ]
      };
    }

    if (sportSlug === "cricket") {
      const innings = statRows.flatMap((line) => Array.isArray(line.statData?.innings) ? line.statData.innings : []);
      const runs = innings.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const wickets = innings.reduce((sum, item) => sum + (Number(item.wickets) || 0), 0);
      return {
        description: "Cricket scorecards summarize innings totals, batting returns, bowling figures, extras, and fall of wickets.",
        tiles: [
          { label: "Scorecards", value: String(statRows.length) },
          { label: "Innings", value: String(innings.length) },
          { label: "Runs", value: String(runs) },
          { label: "Wickets", value: String(wickets) }
        ]
      };
    }

    const schema = getSchemaForEntry(sportSlug, "match");
    const summaryFields = (schema?.fields || []).slice(0, 2);
    const tiles = [
      { label: "Stat Lines", value: String(statRows.length) },
      { label: "Subjects", value: String(uniqueSubjects.size) },
      { label: "Units", value: String(state.units.length) }
    ];

    summaryFields.forEach((fieldName) => {
      const total = statRows.reduce((sum, line) => sum + (Number(line.statData?.[fieldName]) || 0), 0);
      tiles.push({ label: formatFieldLabel(fieldName), value: String(total) });
    });

    return {
      description: `${getSportName(sportSlug)} stat lines use the sport-specific fields defined for this competition context.`,
      tiles
    };
  }

  function renderSportSpecificPrimaryControls(sportSlug) {
    if (sportSlug === "track-and-field") {
      return `
        <div>
          <label for="statEventType">Track & Field Event Type</label>
          <select id="statEventType" class="select">
            <option value="track">Track</option>
            <option value="horizontal-jump">Horizontal Jump</option>
            <option value="vertical-jump">Vertical Jump</option>
            <option value="throw">Throw</option>
            <option value="relay">Relay</option>
          </select>
        </div>
      `;
    }
    if (sportSlug === "swimming") {
      return `
        <div>
          <label for="statEventType">Swimming Event Type</label>
          <select id="statEventType" class="select">
            <option value="track">Individual Swim</option>
            <option value="relay">Relay</option>
          </select>
        </div>
      `;
    }
    return "";
  }

  function getStatEntryDescription(sportSlug) {
    if (sportSlug === "track-and-field") {
      return "Enter timed-event, jump, throw, or relay marks directly from the competition view. These stat lines feed athlete profiles and season summaries.";
    }
    if (sportSlug === "football") {
      return "Enter player or team stat lines linked directly to this match or competition unit.";
    }
    const schema = getSchemaForEntry(sportSlug, "match");
    if (schema?.fields?.length) {
      return `Enter ${getSportName(sportSlug).toLowerCase()} stat lines using sport-specific fields linked directly to this competition unit.`;
    }
    return "Enter sport-linked stat lines directly from this competition page.";
  }

  function getSubjectTypeOptions(sportSlug) {
    if (sportSlug === "football") {
      return `
        <option value="athlete">Athlete</option>
        <option value="team">Team</option>
      `;
    }
    if (sportSlug === "track-and-field") {
      return `
        <option value="athlete">Athlete</option>
        <option value="relay-team">Relay Team</option>
      `;
    }
    const schema = APP.getSportSchema?.(sportSlug);
    if (schema?.subjectTypes?.length) {
      return schema.subjectTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(formatSubjectType(type))}</option>`).join("");
    }
    return `
      <option value="athlete">Athlete</option>
      <option value="team">Team</option>
    `;
  }

  function getDefaultSubjectType(sportSlug) {
    const schema = APP.getSportSchema?.(sportSlug);
    return schema?.subjectTypes?.[0] || (sportSlug === "football" ? "team" : "athlete");
  }

  function getSubjectsForType(subjectType) {
    if (subjectType === "team" || subjectType === "relay-team" || subjectType === "pair") {
      return state.teams.map((team) => ({ id: team.id || team.teamId, name: team.name || team.teamName || "Team" })).filter((x) => x.id);
    }
    return state.athletes
      .map((athlete) => ({
        id: athlete.id || athlete.athleteId,
        name: athlete.fullName || [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || athlete.name || "Athlete"
      }))
      .filter((x) => x.id);
  }

  function buildUnitOptions() {
    if (!state.units.length) return `<option value="">No units available</option>`;
    return [`<option value="">No unit selected</option>`]
      .concat(
        state.units.map((unit, index) => {
          const label = unit.title || unit.name || unit.eventName || `${getUnitLabel(unit)} ${index + 1}`;
          return `<option value="${escapeHtml(unit.id || unit.unitId || String(index + 1))}">${escapeHtml(label)}</option>`;
        })
      )
      .join("");
  }

  
  function normalizeArray(payload, keys) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
      if (payload[key] && Array.isArray(payload[key].items)) return payload[key].items;
    }
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function normalizeStatLine(row) {
    if (!row || typeof row !== "object") return {};
    const data = row.statData && typeof row.statData === "object"
      ? row.statData
      : row.data && typeof row.data === "object" && row.data.statData && typeof row.data.statData === "object"
        ? row.data.statData
        : row.data && typeof row.data === "object"
          ? row.data
          : {};

    return {
      ...row,
      ...data,
      id: row.id,
      competitionId: row.competitionId || data.competitionId || state.competitionId,
      subjectId: row.subjectId || data.subjectId || row.athleteId || row.teamId || "",
      subjectType: row.subjectType || data.subjectType || "",
      unitId: row.unitId || data.unitId || "",
      eventType: row.eventType || data.eventType || "match",
      eventName: row.eventName || data.eventName || row.statName || data.statName || "",
      date: row.date || data.date || row.createdAt || "",
      sport: row.sport || row.sportSlug || data.sport || data.sportSlug || state.competition?.sport || state.competition?.data?.sport || "",
      sportSlug: row.sportSlug || row.sport || data.sportSlug || data.sport || state.competition?.sportSlug || state.competition?.data?.sportSlug || "",
      statData: data
    };
  }

  function getUnitLabel(unit) {
    return unit.unitType || unit.type || unit.stageType || unit.kind || "Unit";
  }

  function getUnitName(unitId) {
    const unit = state.units.find((item) => String(item.id || item.unitId) === String(unitId || ""));
    return unit ? (unit.title || unit.name || unit.eventName || unit.roundName || "Competition Unit") : "Competition Unit";
  }

  function getSportName(slug) {
    const normalized = normalizeSportSlug(slug);
    const registry = APP.SPORT_REGISTRY || [];
    const found = registry.find((item) => normalizeSportSlug(item.slug || item.name) === normalized);
    return found?.name || String(slug || "Sport");
  }

  function getCampusName(slug) {
    if (APP.getCampusMeta) return APP.getCampusMeta(slug).name;
    return String(slug || "Campus");
  }

  function normalizeSportSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-");
  }

  function formatCompetitionFormat(value) {
    return String(value || "Not set")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatSubjectType(value) {
    return String(value || "subject")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function resolveSubjectName(subjectId, subjectType) {
    const type = String(subjectType || "").toLowerCase();
    if (["team", "relay-team", "pair"].includes(type)) {
      const team = state.teams.find((item) => String(item.id || item.teamId) === String(subjectId || ""));
      return team?.name || team?.teamName || `Team ${subjectId || ""}`;
    }
    const athlete = state.athletes.find((item) => String(item.id || item.athleteId) === String(subjectId || ""));
    return athlete?.fullName || [athlete?.firstName, athlete?.lastName].filter(Boolean).join(" ") || athlete?.name || `Athlete ${subjectId || ""}`;
  }

  function inferParticipantSubjectType(item) {
    if (item?.teamId || item?.teamName) return "team";
    return "athlete";
  }

  function inferResultSubjectType(item) {
    if (item?.teamId || item?.teamName) return "team";
    return "athlete";
  }

  function inferTrackFieldEventType(eventName) {
    const value = String(eventName || "").toLowerCase();
    if (value.includes("relay") || /^4x/.test(value)) return "relay";
    if (value.includes("long jump") || value.includes("triple jump")) return "horizontal-jump";
    if (value.includes("high jump") || value.includes("pole vault")) return "vertical-jump";
    if (value.includes("shot put") || value.includes("discus") || value.includes("javelin") || value.includes("hammer")) return "throw";
    return "track";
  }

  function formatResult(result) {
    if (result.mark) return result.mark;
    if (result.time) return result.time;
    if (result.best) return result.best;
    if (result.scoreFor != null && result.scoreAgainst != null) return `${result.scoreFor}-${result.scoreAgainst}`;
    return result.value || "—";
  }

  function formatStatLine(line) {
    const sportSlug = normalizeSportSlug(line.sportSlug || line.sport);
    const data = line.statData || {};

    if (sportSlug === "track-and-field") {
      if (["track", "relay"].includes(line.eventType)) {
        const bits = [data.time || "—"];
        if (data.wind) bits.push(`Wind ${data.wind}`);
        if (data.lane) bits.push(`Lane ${data.lane}`);
        return bits.join(" • ");
      }
      if (["horizontal-jump", "vertical-jump", "throw"].includes(line.eventType)) {
        const bits = [data.best || "—"];
        if (Array.isArray(data.attempts) && data.attempts.length) bits.push(`Attempts ${data.attempts.join(", ")}`);
        if (Array.isArray(data.progression) && data.progression.length) bits.push(`Progression ${data.progression.map((item) => `${item.height}:${item.attempts}`).join(", ")}`);
        return bits.join(" • ");
      }
    }

    if (sportSlug === "football") {
      const bits = [];
      if (data.goals != null) bits.push(`G ${data.goals}`);
      if (data.assists != null) bits.push(`A ${data.assists}`);
      if (data.minutesPlayed != null) bits.push(`Min ${data.minutesPlayed}`);
      return bits.length ? bits.join(" • ") : "—";
    }

    if (sportSlug === "cricket") {
      const innings = Array.isArray(data.innings) ? data.innings : [];
      const result = data.result ? `${data.result} | ` : "";
      const totals = innings
        .map((entry) => {
          const team = entry.team || `Innings ${entry.innings || ""}`;
          const total = entry.total == null ? "—" : entry.total;
          const wickets = entry.wickets == null ? "" : `/${entry.wickets}`;
          const overs = entry.overs ? ` (${entry.overs} ov)` : "";
          return `${team} ${total}${wickets}${overs}`;
        })
        .join(" | ");
      return `${result}${totals || "Scorecard"}`;
    }

    const schema = getSchemaForEntry(sportSlug, line.eventType || "match");
    if (schema?.fields?.length) {
      const bits = schema.fields
        .filter((fieldName) => data[fieldName] !== null && data[fieldName] !== undefined && data[fieldName] !== "")
        .slice(0, 6)
        .map((fieldName) => `${formatFieldLabel(fieldName)} ${data[fieldName]}`);
      return bits.length ? bits.join(" | ") : "-";
    }

    return data.value || JSON.stringify(data);
  }

  function getCricketScorecards() {
    return state.statLines.filter((line) => {
      const sportSlug = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
      return sportSlug === "cricket" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
    });
  }

  function getMatchScorecards(sportSlug) {
    const normalized = normalizeSportSlug(sportSlug);
    if (normalized === "cricket") return getCricketScorecards();
    if (normalized === "football") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "football" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "volleyball") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "volleyball" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "hockey") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "hockey" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "basketball") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "basketball" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "swimming") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "swimming" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "track-and-field") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "track-and-field" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "netball") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "netball" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "badminton") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "badminton" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "table-tennis") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "table-tennis" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "lawn-tennis") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "lawn-tennis" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "taekwondo") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "taekwondo" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    if (normalized === "chess") {
      return state.statLines.filter((line) => {
        const lineSport = normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug);
        return lineSport === "chess" && (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
    }
    return [];
  }

  function compactUwiResultLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text
      .replace(/\bUWI\s+Blackbirds(?:\s+[A-Za-z& -]+?)?\s+Team\b/gi, "Blackbirds")
      .replace(/\bUWI\s+Blackbirds\b/gi, "Blackbirds");
  }

  function compactUwiTeamLabel(value, fallback = "Blackbirds") {
    const text = compactUwiResultLabel(value);
    return text || fallback;
  }

  function renderResultCard(line) {
    const data = line.statData || {};
    const innings = Array.isArray(data.innings) ? data.innings : [];
    const first = innings[0] || {};
    const second = innings[1] || {};
    const title = line.eventName || data.title || state.competition?.title || "Cricket match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.venue].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row">
          <span>${escapeHtml(compactUwiTeamLabel(first.team || data.uwiTeamName))}</span>
          <strong>${formatInningsScore(first)}</strong>
        </div>
        <div class="result-team-row">
          <span>${escapeHtml(compactUwiTeamLabel(second.team || data.opponentName, "Opponent"))}</span>
          <strong>${formatInningsScore(second)}</strong>
        </div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="cricket-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Scorecard</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderFootballResultCard(line) {
    const data = line.statData || {};
    const score = data.score || {};
    const title = line.eventName || data.title || state.competition?.title || "Football match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.location].filter(Boolean).join("  •  ");
    const goals = Array.isArray(data.goals) ? data.goals : [];
    const scorerLine = goals.length
      ? goals.map((goal) => `${escapeHtml(goal.scorerName || (goal.team === "uwi" ? "UWI player" : "Opponent"))} ${escapeHtml(goal.minute ?? "")}'`).join("<br>")
      : "No goalscorers recorded.";
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row">
          <span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span>
          <strong>${escapeHtml(score.uwi?.total ?? 0)}</strong>
        </div>
        <div class="result-team-row">
          <span>${escapeHtml(data.opponentName || "Opponent")}</span>
          <strong>${escapeHtml(score.opponent?.total ?? 0)}</strong>
        </div>
        <p class="result-text">${scorerLine}</p>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="football-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Match Details</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderVolleyballResultCard(line) {
    const data = line.statData || {};
    const sets = Array.isArray(data.sets) ? data.sets : [];
    const title = line.eventName || data.title || state.competition?.title || "Volleyball match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.site].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row">
          <span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span>
          <strong>${escapeHtml(data.finalSets?.uwi ?? 0)}</strong>
        </div>
        <div class="result-team-row">
          <span>${escapeHtml(data.opponentName || "Opponent")}</span>
          <strong>${escapeHtml(data.finalSets?.opponent ?? 0)}</strong>
        </div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || sets.map((set) => `${set.uwiScore}-${set.opponentScore}`).join(", ") || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="volleyball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Scoresheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderHockeyResultCard(line) {
    const data = line.statData || {};
    const score = data.score || {};
    const title = line.eventName || data.title || state.competition?.title || "Hockey match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.arena].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(score.uwi?.total ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(score.opponent?.total ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="hockey-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderBasketballResultCard(line) {
    const data = line.statData || {};
    const score = data.score || {};
    const title = line.eventName || data.title || state.competition?.title || "Basketball match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.playedAt].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(score.uwi?.total ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(score.opponent?.total ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="basketball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderSwimmingResultCard(line) {
    const data = line.statData || {};
    const lanes = Array.isArray(data.lanes) ? data.lanes : [];
    const title = line.eventName || data.eventName || state.competition?.title || "Swimming event";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.session].filter(Boolean).join("  •  ");
    const topUwi = lanes
      .filter((lane) => lane.entryType === "uwi" && lane.finalTime && !lane.dq)
      .sort((a, b) => Number(a.place || 999) - Number(b.place || 999))[0];
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(topUwi?.name || compactUwiTeamLabel(data.uwiTeamName, "UWI"))}</span><strong>${escapeHtml(topUwi?.finalTime || data.summary?.winningTime || "—")}</strong></div>
        <div class="result-team-row"><span>UWI Entries</span><strong>${escapeHtml(data.summary?.uwiEntries ?? lanes.filter((lane) => lane.entryType === "uwi").length)}</strong></div>
        <p class="result-text">${escapeHtml([data.round, data.course, data.ageGroup].filter(Boolean).join(" • ") || "Results recorded")}</p>
        <div class="result-card-actions">
          <a href="swimming-results-view.html?scorecardId=${encodeURIComponent(line.id)}">View Results Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderTrackFieldResultCard(line) {
    const data = line.statData || {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const title = line.eventName || data.eventName || state.competition?.title || "Track and field event";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.resultType === "field" ? "Field" : "Track", data.round].filter(Boolean).join("  •  ");
    const topUwi = entries
      .filter((entry) => entry.entryType === "uwi")
      .sort((a, b) => data.resultType === "field" ? Number(a.finalRank || 999) - Number(b.finalRank || 999) : Number(a.place || 999) - Number(b.place || 999))[0];
    const topMark = data.resultType === "field" ? topUwi?.best : topUwi?.time;
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(topUwi?.name || compactUwiTeamLabel(data.uwiTeamName, "UWI"))}</span><strong>${escapeHtml(topMark || "—")}</strong></div>
        <div class="result-team-row"><span>UWI Entries</span><strong>${escapeHtml(data.summary?.uwiEntries ?? entries.filter((entry) => entry.entryType === "uwi").length)}</strong></div>
        <p class="result-text">${escapeHtml(data.summary?.winningResult || [data.division, data.round].filter(Boolean).join(" • ") || "Results recorded")}</p>
        <div class="result-card-actions">
          <a href="track-field-results-view.html?scorecardId=${encodeURIComponent(line.id)}">View Results Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderNetballResultCard(line) {
    const data = line.statData || {};
    const score = data.score || {};
    const title = line.eventName || data.title || state.competition?.title || "Netball match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.venue].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(score.uwi?.total ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(score.opponent?.total ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="netball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Match Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderBadmintonResultCard(line) {
    const data = line.statData || {};
    const summary = data.summary || {};
    const games = Array.isArray(data.games) ? data.games : [];
    const title = line.eventName || data.title || state.competition?.title || "Badminton match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.discipline, data.court ? `Court ${data.court}` : ""].filter(Boolean).join("  â€¢  ");
    const uwiSide = (data.uwiPlayers || []).map((player) => player.name).filter(Boolean).join(" / ") || compactUwiTeamLabel(data.uwiTeamName);
    const opponentSide = (data.opponentPlayers || []).map((player) => player.name).filter(Boolean).join(" / ") || "Opponent";
    const gameLine = games.length
      ? games.map((game) => `${game.uwi || 0}-${game.opponent || 0}`).join(", ")
      : "Match sheet recorded";
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(uwiSide))}</span><strong>${escapeHtml(summary.uwiGamesWon ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(opponentSide)}</span><strong>${escapeHtml(summary.opponentGamesWon ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || gameLine))}</p>
        <div class="result-card-actions">
          <a href="badminton-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Match Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderTableTennisResultCard(line) {
    const data = line.statData || {};
    const summary = data.summary || {};
    const title = line.eventName || data.title || state.competition?.title || "Table tennis match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.category, data.venue].filter(Boolean).join("  â€¢  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(summary.uwiRubbers ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentTeamName || "Opponent")}</span><strong>${escapeHtml(summary.opponentRubbers ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || `${summary.pointsFor ?? 0}-${summary.pointsAgainst ?? 0} points`))}</p>
        <div class="result-card-actions">
          <a href="table-tennis-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderTennisResultCard(line) {
    const data = line.statData || {};
    const summary = data.summary || {};
    const title = line.eventName || data.title || state.competition?.title || "Tennis match";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.category, data.venue].filter(Boolean).join("  â€¢  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(summary.uwiMatches ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentTeamName || "Opponent")}</span><strong>${escapeHtml(summary.opponentMatches ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || `${summary.gamesFor ?? 0}-${summary.gamesAgainst ?? 0} games`))}</p>
        <div class="result-card-actions">
          <a href="tennis-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderTaekwondoResultCard(line) {
    const data = line.statData || {};
    const summary = data.summary || {};
    const title = line.eventName || data.title || state.competition?.title || "Taekwondo score sheet";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.division, data.round].filter(Boolean).join("  â€¢  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(data.athlete?.name || "UWI athlete")}</span><strong>${escapeHtml(summary.finalScore != null ? Number(summary.finalScore).toFixed(2) : "-")}</strong></div>
        <div class="result-team-row"><span>Rank</span><strong>${escapeHtml(summary.rank || data.rank || "-")}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(summary.result || data.result || "Score recorded"))}</p>
        <div class="result-card-actions">
          <a href="taekwondo-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function renderChessResultCard(line) {
    const data = line.statData || {};
    const summary = data.summary || {};
    const title = line.eventName || data.title || state.competition?.title || "Chess game";
    const meta = [state.competition?.title || state.competition?.name || "Competition", data.round, data.board ? `Board ${data.board}` : ""].filter(Boolean).join("  â€¢  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(title))}</div>
        <div class="result-team-row"><span>${escapeHtml(data.uwiPlayer?.name || "UWI player")}</span><strong>${escapeHtml(summary.uwiScore ?? "-")}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponent?.name || "Opponent")}</span><strong>${escapeHtml(summary.opponentScore ?? "-")}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(summary.resultLabel || data.result || data.opening || "Game recorded"))}</p>
        <div class="result-card-actions">
          <a href="chess-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          ${scorecardEditLink(line)}
        </div>
      </article>
    `;
  }

  function formatInningsScore(innings) {
    if (!innings || (!innings.total && innings.total !== 0)) return "-";
    const wickets = innings.wickets === null || innings.wickets === undefined || innings.wickets === "" ? "" : `/${innings.wickets}`;
    const overs = innings.overs ? ` (${innings.overs} ov)` : "";
    return `${innings.total}${wickets}${overs}`;
  }

  function getSchemaForEntry(sportSlug, eventType) {
    const normalizedSport = normalizeSportSlug(sportSlug);
    const normalizedType = eventType || getDefaultEventType(normalizedSport);
    return APP.getEventSchema?.(normalizedSport, normalizedType, valueOf("statEventName")) || APP.getEventSchema?.(normalizedSport, "match", "");
  }

  function getDefaultEventType(sportSlug) {
    const normalizedSport = normalizeSportSlug(sportSlug);
    if (normalizedSport === "track-and-field" || normalizedSport === "swimming") return "track";
    return "match";
  }

  function renderSchemaFieldInput(fieldName) {
    const id = getSchemaFieldId(fieldName);
    const label = formatFieldLabel(fieldName);
    const type = getSchemaFieldInputType(fieldName);
    const placeholder = getSchemaFieldPlaceholder(fieldName);
    return `
      <div>
        <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
        <input id="${escapeHtml(id)}" class="input" type="${type}" ${type === "number" ? "min=\"0\" step=\"any\"" : ""} placeholder="${escapeHtml(placeholder)}" />
      </div>
    `;
  }

  function getSchemaFieldId(fieldName) {
    return `statSchema_${String(fieldName || "").replace(/[^a-zA-Z0-9]/g, "_")}`;
  }

  function getSchemaFieldInputType(fieldName) {
    const name = String(fieldName || "").toLowerCase();
    if (["result", "stage", "opponent", "color", "opening", "method", "weightclass", "formation", "position"].some((token) => name.includes(token))) return "text";
    return "number";
  }

  function getSchemaFieldPlaceholder(fieldName) {
    const name = String(fieldName || "").toLowerCase();
    if (name.includes("result")) return "e.g. Win, Loss, Draw, Tie";
    if (name.includes("stage")) return "e.g. Final, Semi-final, Round 1";
    if (name.includes("opponent")) return "Opponent name";
    if (name.includes("opening")) return "Opening or variation";
    if (name.includes("method")) return "e.g. Points, KO, referee stoppage";
    if (name.includes("weight")) return "e.g. 68kg";
    return `Enter ${formatFieldLabel(fieldName).toLowerCase()}`;
  }

  function parseSchemaFieldValue(fieldName, raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    return getSchemaFieldInputType(fieldName) === "number" ? toNumberOrNull(value) : value;
  }

  function formatFieldLabel(fieldName) {
    return String(fieldName || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function parseAttemptList(raw) {
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseSplits(raw) {
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(":");
        if (parts.length === 2) return { point: parts[0].trim(), value: parts[1].trim() };
        return { point: "Split", value: item };
      });
  }

  function parseProgression(raw) {
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(":");
        return {
          height: (parts[0] || "").trim(),
          attempts: (parts[1] || "").trim()
        };
      });
  }

  function valueOf(id) {
    const node = document.getElementById(id);
    return node ? String(node.value || "").trim() : "";
  }

  function getField(id) {
    return valueOf(id);
  }

  function setField(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value == null ? "" : String(value);
  }

  function toNumberOrNull(value) {
    const str = String(value || "").trim();
    if (!str) return null;
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatDateInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function toDateInputValue(value) {
    return formatDateInput(value);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function metaTile(label, value, isHtml) {
    return `
      <div class="competition-meta-tile">
        <span>${escapeHtml(label)}</span>
        <strong>${isHtml ? value : escapeHtml(value)}</strong>
      </div>
    `;
  }

  function getCompetitionCompleteness(competition) {
    const checks = [
      competition.title || competition.name,
      getCompetitionSportSlug(),
      competition.formatSlug || competition.format,
      competition.seasonLabel || competition.season,
      competition.startDate || competition.endDate,
      competition.status,
      state.units.length,
      state.participants.length || state.results.length || state.statLines.length
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function completenessMarkup(score) {
    const normalized = Math.max(0, Math.min(100, Number(score) || 0));
    return `<span class="completeness-cell"><span class="completeness-ring" style="--score:${normalized}"></span><span class="completeness-text">${normalized}%</span></span>`;
  }

  function setEmpty(id, title, text) {
    if (APP.setEmptyState) {
      APP.setEmptyState(id, title, text);
      return;
    }
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
  }

  function clearMessage(node) {
    if (!node) return;
    node.textContent = "";
    node.className = "message";
  }

  function setError(node, text) {
    if (!node) return;
    node.textContent = text;
    node.className = "message error";
  }

  function setSuccess(node, text) {
    if (!node) return;
    node.textContent = text;
    node.className = "message success";
  }

  function setEditMessage(text, type) {
    const node = els.competitionEditMessage;
    if (!node) return;
    node.textContent = text || "";
    node.className = `message ${type || ""}`.trim();
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
