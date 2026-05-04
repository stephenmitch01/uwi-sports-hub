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
    audit: []
  };

  const params = new URLSearchParams(window.location.search);
  state.competitionId = params.get("competitionId") || params.get("id");

  const els = {
    competitionMeta: document.getElementById("competitionMeta"),
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
    renderStructure();
    renderParticipants();
    renderResults();
    renderStatEngine();
    renderAudit();
    bindDynamicForms();
  } catch (error) {
    console.error("Competition view load error:", error);
    renderLoadFailure(error);
  }
}

  function renderMissingSelection() {
    setEmpty("competitionMeta", "Competition details will appear here once added.", "Select a competition to view its structure, participants, results, and summaries.");
    setEmpty("competitionStructure", "Competition structure will appear here once added.", "Divisions, rounds, heats, matches, and events will be shown here when available.");
    setEmpty("competitionParticipants", "Participants will appear here once added.", "Athletes, teams, relays, or pairs linked to this competition will be shown here.");
    setEmpty("competitionResults", "Results will appear here once added.", "Approved outcomes and placings for this competition will be shown here.");
    setEmpty("competitionStats", "Stat summaries will appear here once added.", "Sport-specific stat lines for this competition will be shown here.");
    setEmpty("competitionAudit", "Activity history will appear here once added.", "Changes, approvals, and updates for this competition will be listed here.");
  }

  function renderNotFound() {
    setEmpty("competitionMeta", "Competition details unavailable.", "The selected competition could not be found.");
    setEmpty("competitionStructure", "Structure unavailable.", "Create or select a competition to view details here.");
    setEmpty("competitionParticipants", "Participants unavailable.", "Entries linked to this competition will appear here.");
    setEmpty("competitionResults", "Results unavailable.", "Competition results will appear here once recorded.");
    setEmpty("competitionStats", "Stat summaries unavailable.", "Competition stat lines will appear here once recorded.");
    setEmpty("competitionAudit", "Activity history unavailable.", "Competition activity will appear here once records exist.");
  }

  function renderLoadFailure(error) {
    const message = error?.message || "Competition data could not be loaded.";
    setEmpty("competitionMeta", "Competition details unavailable.", message);
    setEmpty("competitionStructure", "Structure unavailable.", "The competition structure section could not be loaded.");
    setEmpty("competitionParticipants", "Participants unavailable.", "The participant section could not be loaded.");
    setEmpty("competitionResults", "Results unavailable.", "The results section could not be loaded.");
    setEmpty("competitionStats", "Stat summaries unavailable.", "The stat summaries section could not be loaded.");
    setEmpty("competitionAudit", "Activity history unavailable.", "The competition audit section could not be loaded.");
  }

  function renderMeta() {
    const competition = state.competition;
    const sportName = getSportName(competition.sportSlug || competition.sport);
    const campusName = getCampusName(competition.campusOwner || competition.campus);
    const unitCount = state.units.length;

    els.competitionMeta.innerHTML = `
      <div class="section-title">
        <div>
          <h2>${escapeHtml(competition.title || "Competition")}</h2>
          <p>${escapeHtml(sportName)} • ${escapeHtml(competition.seasonLabel || competition.season || "Season not set")}</p>
        </div>
      </div>

      <div class="link-row">
        ${metaTile("Sport", sportName)}
        ${metaTile("Status", competition.status || "Not set")}
        ${metaTile("Campus Owner", campusName)}
        ${metaTile("Format", formatCompetitionFormat(competition.formatSlug || competition.format))}
        ${metaTile("Dates", `${competition.startDate || "—"} to ${competition.endDate || "—"}`)}
        ${metaTile("Units", String(unitCount))}
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
    if (!state.results.length) {
      setEmpty("competitionResults", "Results will appear here once added.", "No results have been recorded for this competition yet.");
      return;
    }

    const rows = state.results
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

  function renderStatEngine() {
    const sportSlug = normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport);
    const statRows = state.statLines.filter((line) => String(line.competitionId || "") === String(state.competitionId));
    const summary = buildStatSummary(statRows);

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

      <div class="section-title" style="margin-top:16px;">
        <div>
          <h2>Recorded Stat Lines</h2>
          <p>Stat lines linked directly to this competition.</p>
        </div>
      </div>

      ${renderStatTable(statRows)}
    `;

    const eventTypeSelect = document.getElementById("statEventType");
    if (eventTypeSelect) {
      renderDynamicStatFields(sportSlug, eventTypeSelect.value || inferTrackFieldEventType(document.getElementById("statEventName")?.value || ""));
    } else {
      renderDynamicStatFields(sportSlug, "default");
    }
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

  function renderStatTable(statRows) {
    if (!statRows.length) {
      return `<div class="empty-state"><h3>No stat lines yet.</h3><p>Add competition-linked stat lines above to begin building athlete and team performance records.</p></div>`;
    }

    const rows = statRows
      .slice()
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")))
      .map((line) => `
        <tr>
          <td>${escapeHtml(line.eventName || getUnitName(line.unitId) || "—")}</td>
          <td>${escapeHtml(line.subjectName || resolveSubjectName(line.subjectId, line.subjectType))}</td>
          <td>${escapeHtml(line.eventType || line.subjectType || "—")}</td>
          <td>${escapeHtml(formatStatLine(line))}</td>
          <td>${escapeHtml(line.date || "—")}</td>
        </tr>
      `)
      .join("");

    return `
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

  function buildParticipantRows() {
    if (!state.participants.length) return [];
    return state.participants.map((item) => ({
      name: resolveSubjectName(item.subjectId || item.athleteId || item.teamId || item.id, item.subjectType || inferParticipantSubjectType(item)),
      type: formatSubjectType(item.subjectType || inferParticipantSubjectType(item)),
      unit: item.eventName || item.unitName || getUnitName(item.unitId) || "—",
      category: item.category || item.division || "—"
  }));
}})
  function buildStatSummary(statRows) {
    const sportSlug = normalizeSportSlug(state.competition?.sportSlug || state.competition?.sport);

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
      const timed = statRows.filter((line) => ["track", "relay"].includes(line.eventType));
      const field = statRows.filter((line) => ["horizontal-jump", "vertical-jump", "throw"].includes(line.eventType));
      return {
        description: "Track & field stat lines split between timed and field-event performance.",
        tiles: [
          { label: "Stat Lines", value: String(statRows.length) },
          { label: "Subjects", value: String(uniqueSubjects.size) },
          { label: "Timed Events", value: String(timed.length) },
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
    return [];
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

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function metaTile(label, value) {
    return `
      <div class="nav-tile">
        <div>
          <h3>${escapeHtml(label)}</h3>
          <p>${escapeHtml(value)}</p>
        </div>
      </div>
    `;
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

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
