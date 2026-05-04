(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const state = {
    session: null,
    athleteId: null,
    athlete: null,
    stats: [],
    personalBests: [],
    history: [],
    teams: [],
    records: [],
    filteredSeason: "all",
    searchTerm: ""
  };

  const params = new URLSearchParams(window.location.search);
  state.athleteId = params.get("athleteId") || params.get("id");

  const els = {
    topBar: document.getElementById("topBar"),
    shellNav: document.getElementById("shellNav"),
    heroName: document.getElementById("heroName"),
    heroSummary: document.getElementById("heroSummary"),
    heroPills: document.getElementById("heroPills"),
    heroMeta: document.getElementById("heroMeta"),
    heroSideCards: document.getElementById("heroSideCards"),
    athleteHeadshot: document.getElementById("athleteHeadshot"),
    athleteHeadshotFallback: document.getElementById("athleteHeadshotFallback"),
    athleteBodyInfo: document.getElementById("athleteBodyInfo"),
    athleteInfo: document.getElementById("athleteInfo"),
    athleteStatsSection: document.getElementById("athleteStatsSection"),
    athletePersonalBests: document.getElementById("athletePersonalBests"),
    athleteStatEntry: document.getElementById("athleteStatEntry"),
    athleteHistory: document.getElementById("athleteHistory"),
    athleteTeams: document.getElementById("athleteTeams"),
    athleteRecords: document.getElementById("athleteRecords"),
    downloadSummaryBtn: document.getElementById("downloadSummaryBtn")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      const session = await APP.mountSignedInShell({
        active: "athletes",
        contextLabel: "Athlete View"
      });
      if (!session) {
        window.location.href = "index.html";
        return;
      }

      state.session = session;

      if (!state.athleteId) {
        renderMissingSelection();
        bindSummaryButton();
        return;
      }

      await loadAthleteView();
      bindSummaryButton();
    } catch (error) {
      console.error("Athlete view init error:", error);
      renderLoadFailure(error);
      bindSummaryButton();
    }
  }

  async function loadAthleteView() {
    const athlete = await getAthlete(state.athleteId);
    state.athlete = normalizeAthlete(athlete);

    const payload = await getAthletePerformanceBundle(state.athleteId);
    state.stats = Array.isArray(payload.stats) ? payload.stats.map(normalizeStatLine) : [];
    state.personalBests = Array.isArray(payload.personalBests) ? payload.personalBests.map(normalizePB) : [];
    state.history = Array.isArray(payload.history) ? payload.history : [];
    state.teams = Array.isArray(payload.teams) ? payload.teams : [];
    state.records = Array.isArray(payload.records) ? payload.records : [];

    renderAll();
  }

  async function getAthlete(id) {
    return APP.apiGet(`/athletes/${encodeURIComponent(id)}`);
  }

  async function getAthletePerformanceBundle(id) {
    const endpointMap = {
      stats: `/athletes/${encodeURIComponent(id)}/stats`,
      personalBests: `/athletes/${encodeURIComponent(id)}/personal-bests`,
      history: `/athletes/${encodeURIComponent(id)}/history`,
      teams: `/athletes/${encodeURIComponent(id)}/teams`,
      records: `/athletes/${encodeURIComponent(id)}/records`
    };

    const keys = Object.keys(endpointMap);
    const output = {
      stats: [],
      personalBests: [],
      history: [],
      teams: [],
      records: []
    };

    const results = await Promise.allSettled(
      keys.map((key) => APP.apiGet(endpointMap[key], true))
    );

    for (let i = 0; i < results.length; i += 1) {
      const item = results[i];
      const key = keys[i];
      if (item.status === "fulfilled" && item.value) {
        output[key] = item.value;
      }
    }

    return output;
  }

  function normalizeAthlete(raw) {
    const athlete = raw?.athlete || raw || {};

    return {
      id: athlete.id || state.athleteId || "",
      firstName: athlete.firstName || "",
      lastName: athlete.lastName || "",
      fullName:
        athlete.fullName ||
        [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") ||
        "Unknown Athlete",
      sport: athlete.sport || athlete.primarySport || "Sport not assigned",
      athleteType: athlete.athleteType || "Athlete",
      campus: athlete.campus || state.session?.campus || "",
      teamName: athlete.teamName || athlete.team || "",
      squadName: athlete.squadName || athlete.squad || "",
      status: athlete.status || "Active",
      schoolOrClub: athlete.schoolOrClub || athlete.school || athlete.club || "",
      age: athlete.age || "",
      dateOfBirth: athlete.dateOfBirth || athlete.dob || "",
      gender: athlete.gender || "",
      phone: athlete.phone || "",
      email: athlete.email || "",
      handedness: athlete.handedness || athlete.dominantHand || "",
      dominantFoot: athlete.dominantFoot || "",
      height: athlete.height || "",
      weight: athlete.weight || "",
      position: athlete.position || "",
      events: Array.isArray(athlete.events) ? athlete.events : [],
      yearOfStudy: athlete.yearOfStudy || "",
      faculty: athlete.faculty || "",
      program: athlete.program || "",
      studentId: athlete.studentId || "",
      nationality: athlete.nationality || "",
      hometown: athlete.hometown || "",
      bio: athlete.bio || "",
      imageUrl: athlete.imageUrl || athlete.headshotUrl || athlete.photoUrl || "",
      createdAt: athlete.createdAt || "",
      updatedAt: athlete.updatedAt || ""
    };
  }

  function normalizeStatLine(raw) {
    return {
      id: raw.id || cryptoRandomId(),
      season: raw.season || "Unknown",
      statName: raw.statName || raw.metric || "",
      statValue: raw.statValue ?? raw.value ?? "",
      unit: raw.unit || "",
      competitionName: raw.competitionName || raw.competition || "",
      eventName: raw.eventName || raw.event || "",
      category: raw.category || "",
      date: raw.date || raw.achievedDate || "",
      verified: Boolean(raw.verified),
      linkedCompetitionId: raw.linkedCompetitionId || raw.competitionId || "",
      notes: raw.notes || ""
    };
  }

  function normalizePB(raw) {
    return {
      id: raw.id || cryptoRandomId(),
      eventName: raw.eventName || raw.event || "",
      performance: raw.performance || raw.value || "",
      unit: raw.unit || "",
      season: raw.season || "Unknown",
      competitionName: raw.competitionName || raw.competition || "",
      date: raw.date || "",
      notes: raw.notes || ""
    };
  }

  function renderAll() {
    renderHero();
    renderBodyInfo();
    renderAthleteInfo();
    renderStatsSection();
    renderPersonalBests();
    renderStatEntry();
    renderHistory();
    renderTeams();
    renderRecords();
  }

  function renderHero() {
    if (!state.athlete) return;

    const athlete = state.athlete;
    const seasonStats = getFilteredStats();
    const pbCount = getFilteredPBs().length;
    const currentSeason = getCurrentSeasonValue();
    const totalCompetitions = countUniqueValues(seasonStats.map((item) => item.competitionName).filter(Boolean));

    if (els.heroName) {
      els.heroName.textContent = athlete.fullName;
    }

    if (els.heroSummary) {
      const eventText = athlete.events.length ? athlete.events.join(", ") : athlete.position || athlete.sport;
      els.heroSummary.textContent =
        `${athlete.athleteType} in ${athlete.sport}. ${eventText ? `Primary focus: ${eventText}. ` : ""}` +
        `This profile includes body information, athlete details, all-time and season-specific stats, personal bests, team history, and summary generation.`;
    }

    if (els.heroPills) {
      els.heroPills.innerHTML = `
        <span class="status-pill ok">Internal Profile</span>
        <span class="status-pill success">${escapeHtml(athlete.status || "Active")}</span>
        <span class="status-pill subtle">${escapeHtml(athlete.sport || "Sport")}</span>
        <span class="status-pill subtle">${escapeHtml(athlete.campus ? formatCampus(athlete.campus) : "Campus")}</span>
      `;
    }

    if (els.heroMeta) {
      const chips = [
        athlete.teamName ? `Team: ${athlete.teamName}` : "",
        athlete.squadName ? `Squad: ${athlete.squadName}` : "",
        athlete.schoolOrClub ? `School/Club: ${athlete.schoolOrClub}` : "",
        athlete.athleteType ? `Type: ${athlete.athleteType}` : ""
      ].filter(Boolean);

      els.heroMeta.innerHTML = chips.map((chip) => `<span class="meta-chip">${escapeHtml(chip)}</span>`).join("");
    }

    if (els.heroSideCards) {
      els.heroSideCards.innerHTML = `
        <div class="mini-card">
          <div class="mini-label">Season Filter</div>
          <div class="mini-value">${escapeHtml(state.filteredSeason === "all" ? "All-Time" : state.filteredSeason)}</div>
          <div class="mini-sub">Current data view</div>
        </div>

        <div class="mini-card">
          <div class="mini-label">Stat Lines</div>
          <div class="mini-value">${seasonStats.length}</div>
          <div class="mini-sub">Visible records in this view</div>
        </div>

        <div class="mini-card">
          <div class="mini-label">Personal Bests</div>
          <div class="mini-value">${pbCount}</div>
          <div class="mini-sub">Visible best performances</div>
        </div>

        <div class="mini-card">
          <div class="mini-label">Competitions</div>
          <div class="mini-value">${totalCompetitions}</div>
          <div class="mini-sub">${escapeHtml(currentSeason || "Current season")} and all-time history</div>
        </div>
      `;
    }

    if (els.athleteHeadshot) {
      if (athlete.imageUrl) {
        els.athleteHeadshot.src = athlete.imageUrl;
        els.athleteHeadshot.hidden = false;
        if (els.athleteHeadshotFallback) els.athleteHeadshotFallback.hidden = true;
      } else {
        els.athleteHeadshot.hidden = true;
        if (els.athleteHeadshotFallback) els.athleteHeadshotFallback.hidden = false;
      }
    }
  }

  function renderBodyInfo() {
    if (!state.athlete || !els.athleteBodyInfo) return;

    const athlete = state.athlete;

    els.athleteBodyInfo.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteBodyInfoHeading">Body Information</h2>
          <p>Physical details and athlete body profile.</p>
        </div>
      </div>

      <div class="details-grid">
        ${detailCard("Height", athlete.height || "Not recorded")}
        ${detailCard("Weight", athlete.weight || "Not recorded")}
        ${detailCard("Handedness", athlete.handedness || "Not recorded")}
        ${detailCard("Dominant Foot", athlete.dominantFoot || "Not recorded")}
        ${detailCard("Gender", athlete.gender || "Not recorded")}
        ${detailCard("Date of Birth", formatDate(athlete.dateOfBirth) || "Not recorded")}
      </div>
    `;
  }

  function renderAthleteInfo() {
    if (!state.athlete || !els.athleteInfo) return;

    const athlete = state.athlete;
    const eventsDisplay = athlete.events.length ? athlete.events.join(", ") : "Not recorded";

    els.athleteInfo.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteInfoHeading">Athlete Information</h2>
          <p>Identity, roster, academic, and competition-related profile details.</p>
        </div>
      </div>

      <div class="details-grid">
        ${detailCard("Full Name", athlete.fullName)}
        ${detailCard("Sport", athlete.sport || "Not recorded")}
        ${detailCard("Team", athlete.teamName || "Not assigned")}
        ${detailCard("Squad", athlete.squadName || "Not assigned")}
        ${detailCard("Athlete Type", athlete.athleteType || "Not recorded")}
        ${detailCard("Status", athlete.status || "Not recorded")}
        ${detailCard("School / Club", athlete.schoolOrClub || "Not recorded")}
        ${detailCard("Position / Event Focus", athlete.position || eventsDisplay)}
        ${detailCard("Email", athlete.email || "Not recorded")}
        ${detailCard("Phone", athlete.phone || "Not recorded")}
        ${detailCard("Student ID", athlete.studentId || "Optional / not recorded")}
        ${detailCard("Year of Study", athlete.yearOfStudy || "Not recorded")}
        ${detailCard("Faculty", athlete.faculty || "Not recorded")}
        ${detailCard("Program", athlete.program || "Not recorded")}
        ${detailCard("Nationality", athlete.nationality || "Not recorded")}
        ${detailCard("Hometown", athlete.hometown || "Not recorded")}
      </div>

      <div class="note-box">
        <strong>Bio / Notes:</strong><br />
        ${escapeHtml(athlete.bio || "No additional athlete notes have been added yet.")}
      </div>
    `;
  }

  function renderStatsSection() {
    if (!els.athleteStatsSection) return;

    const seasons = getAvailableSeasons();
    const filteredStats = getFilteredStats();
    const searchValue = state.searchTerm || "";

    const totalStats = filteredStats.length;
    const verifiedCount = filteredStats.filter((item) => item.verified).length;
    const linkedCount = filteredStats.filter((item) => item.linkedCompetitionId || item.competitionName).length;
    const categoriesCount = countUniqueValues(filteredStats.map((item) => item.category || item.statName).filter(Boolean));

    els.athleteStatsSection.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteStatsHeading">Detailed Stats</h2>
          <p>
            View all-time or season-specific athlete stats. Search stat records, inspect linked competitions,
            and review sport-specific accumulated performance data.
          </p>
        </div>
      </div>

      <div class="stats-toolbar">
        <div>
          <label for="seasonFilter">Season</label>
          <select class="select" id="seasonFilter">
            <option value="all">All-Time</option>
            ${seasons.map((season) => `
              <option value="${escapeHtml(season)}" ${season === state.filteredSeason ? "selected" : ""}>
                ${escapeHtml(season)}
              </option>
            `).join("")}
          </select>
        </div>

        <div>
          <label for="statsSearch">Search Stat / Event / Competition</label>
          <input
            class="input"
            id="statsSearch"
            type="text"
            placeholder="Search stats..."
            value="${escapeHtml(searchValue)}"
          />
        </div>

        <div>
          <label>Current View</label>
          <input class="input" type="text" value="${escapeHtml(state.filteredSeason === "all" ? "All-Time" : state.filteredSeason)}" disabled />
        </div>

        <div>
          <label>Sport</label>
          <input class="input" type="text" value="${escapeHtml(state.athlete?.sport || "Not recorded")}" disabled />
        </div>
      </div>

      <div class="summary-cards">
        <div class="mini-card">
          <div class="mini-label">Visible Stat Lines</div>
          <div class="mini-value">${totalStats}</div>
          <div class="mini-sub">All records after filters are applied</div>
        </div>
        <div class="mini-card">
          <div class="mini-label">Verified</div>
          <div class="mini-value">${verifiedCount}</div>
          <div class="mini-sub">Records currently marked verified</div>
        </div>
        <div class="mini-card">
          <div class="mini-label">Competition Linked</div>
          <div class="mini-value">${linkedCount}</div>
          <div class="mini-sub">Records linked to a competition entry</div>
        </div>
        <div class="mini-card">
          <div class="mini-label">Stat Categories</div>
          <div class="mini-value">${categoriesCount}</div>
          <div class="mini-sub">Unique stat or event groupings</div>
        </div>
      </div>

      ${
        filteredStats.length
          ? `
            <div class="data-table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>Stat / Metric</th>
                    <th>Value</th>
                    <th>Category</th>
                    <th>Event</th>
                    <th>Competition</th>
                    <th>Date</th>
                    <th>Linked</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredStats.map((item) => `
                    <tr>
                      <td>${escapeHtml(item.season || "—")}</td>
                      <td>${escapeHtml(item.statName || "—")}</td>
                      <td>${escapeHtml(formatValueWithUnit(item.statValue, item.unit) || "—")}</td>
                      <td>${escapeHtml(item.category || "—")}</td>
                      <td>${escapeHtml(item.eventName || "—")}</td>
                      <td>${escapeHtml(item.competitionName || "Unlinked")}</td>
                      <td>${escapeHtml(formatDate(item.date) || "—")}</td>
                      <td>${item.linkedCompetitionId || item.competitionName ? "Yes" : "No"}</td>
                      <td>${item.verified ? "Yes" : "No"}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<div class="empty-state">No stat lines match the current filter. Stats entered on this page or from competitions will appear here.</div>`
      }
    `;

    const seasonFilter = document.getElementById("seasonFilter");
    const statsSearch = document.getElementById("statsSearch");

    if (seasonFilter) {
      seasonFilter.addEventListener("change", function () {
        state.filteredSeason = this.value;
        renderHero();
        renderStatsSection();
        renderPersonalBests();
      });
    }

    if (statsSearch) {
      statsSearch.addEventListener("input", function () {
        state.searchTerm = this.value.trim();
        renderStatsSection();
        renderPersonalBests();
      });
    }
  }

  function renderPersonalBests() {
    if (!els.athletePersonalBests) return;

    const pbs = getFilteredPBs();

    els.athletePersonalBests.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athletePBHeading">Personal Bests / Best Performances</h2>
          <p>
            Best performances by event, including the value, the competition where achieved, and the date achieved.
          </p>
        </div>
      </div>

      ${
        pbs.length
          ? `
            <div class="data-table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Performance</th>
                    <th>Season</th>
                    <th>Competition</th>
                    <th>Date Achieved</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${pbs.map((item) => `
                    <tr>
                      <td>${escapeHtml(item.eventName || "—")}</td>
                      <td>${escapeHtml(formatValueWithUnit(item.performance, item.unit) || "—")}</td>
                      <td>${escapeHtml(item.season || "—")}</td>
                      <td>${escapeHtml(item.competitionName || "Unlinked")}</td>
                      <td>${escapeHtml(formatDate(item.date) || "—")}</td>
                      <td>${escapeHtml(item.notes || "—")}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<div class="empty-state">No personal bests match the current view yet.</div>`
      }
    `;
  }

  function renderStatEntry() {
    if (!els.athleteStatEntry) return;

    const currentSeason = getCurrentSeasonValue();

    els.athleteStatEntry.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteStatEntryHeading">Add Stat / Add Personal Best</h2>
          <p>
            Enter athlete stats directly from this page. You can link the entry to a competition now,
            or leave it unlinked and attach it later.
          </p>
        </div>
      </div>

      <form id="statEntryForm">
        <div class="stats-toolbar">
          <div>
            <label for="entrySeason">Season</label>
            <input class="input" id="entrySeason" name="entrySeason" type="text" value="${escapeHtml(currentSeason)}" required />
          </div>

          <div>
            <label for="entryType">Entry Type</label>
            <select class="select" id="entryType" name="entryType" required>
              <option value="stat">Stat Line</option>
              <option value="pb">Personal Best / Best Performance</option>
            </select>
          </div>

          <div>
            <label for="entryMetric">Stat / Event Name</label>
            <input class="input" id="entryMetric" name="entryMetric" type="text" placeholder="e.g. 100m, Goals, Assists" required />
          </div>

          <div>
            <label for="entryValue">Value</label>
            <input class="input" id="entryValue" name="entryValue" type="text" placeholder="e.g. 10.98, 14, 6" required />
          </div>

          <div>
            <label for="entryUnit">Unit</label>
            <input class="input" id="entryUnit" name="entryUnit" type="text" placeholder="e.g. s, goals, m" />
          </div>

          <div>
            <label for="entryCategory">Category</label>
            <input class="input" id="entryCategory" name="entryCategory" type="text" placeholder="e.g. Sprint, Attacking, Bowling" />
          </div>

          <div>
            <label for="entryCompetition">Competition Name</label>
            <input class="input" id="entryCompetition" name="entryCompetition" type="text" placeholder="Leave blank if linking later" />
          </div>

          <div>
            <label for="entryDate">Date Achieved</label>
            <input class="input" id="entryDate" name="entryDate" type="date" />
          </div>

          <div>
            <label for="entryLinkedNow">Competition Link Status</label>
            <select class="select" id="entryLinkedNow" name="entryLinkedNow">
              <option value="yes">Link now</option>
              <option value="no">Link later</option>
            </select>
          </div>

          <div>
            <label for="entryCompetitionId">Competition ID (optional)</label>
            <input class="input" id="entryCompetitionId" name="entryCompetitionId" type="text" placeholder="Optional backend competition id" />
          </div>
        </div>

        <div>
          <label for="entryNotes">Notes</label>
          <textarea class="textarea" id="entryNotes" name="entryNotes" placeholder="Add notes about the performance, context, conditions, opponent, etc."></textarea>
        </div>

        <div class="form-actions">
          <button class="btn btn-campus" type="submit">Add Entry</button>
          <button class="btn btn-soft" type="button" id="clearEntryFormBtn">Clear</button>
        </div>

        <div id="entryFeedback"></div>
      </form>
    `;

    const statEntryForm = document.getElementById("statEntryForm");
    if (statEntryForm) {
      statEntryForm.addEventListener("submit", handleStatEntrySubmit);
    }

    const clearEntryFormBtn = document.getElementById("clearEntryFormBtn");
    if (clearEntryFormBtn) {
      clearEntryFormBtn.addEventListener("click", function () {
        statEntryForm?.reset();
        const seasonInput = document.getElementById("entrySeason");
        if (seasonInput) seasonInput.value = getCurrentSeasonValue();
        const feedback = document.getElementById("entryFeedback");
        if (feedback) feedback.innerHTML = "";
      });
    }
  }

  function renderHistory() {
    if (!els.athleteHistory) return;

    const items = state.history.length
      ? state.history.map((item) => `
          <div class="stack-item">
            <div class="stack-item-title">${escapeHtml(item.title || item.type || "Athlete history item")}</div>
            <div class="stack-item-sub">
              ${escapeHtml(item.description || item.summary || "No additional history details recorded.")}
            </div>
          </div>
        `).join("")
      : `<div class="empty-state">No athlete history entries have been added yet.</div>`;

    els.athleteHistory.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteHistoryHeading">Athlete History</h2>
          <p>Timeline notes, roster progression, and athlete development history.</p>
        </div>
      </div>

      <div class="stack-list">
        ${items}
      </div>
    `;
  }

  function renderTeams() {
    if (!els.athleteTeams) return;

    const items = state.teams.length
      ? state.teams.map((item) => `
          <div class="stack-item">
            <div class="stack-item-title">${escapeHtml(item.name || item.teamName || "Unnamed Team")}</div>
            <div class="stack-item-sub">
              ${escapeHtml(item.role || item.status || "Athlete")} •
              ${escapeHtml(item.season || "Season not recorded")} •
              ${escapeHtml(item.squadName || item.squad || "No squad specified")}
            </div>
          </div>
        `).join("")
      : `
        <div class="stack-item">
          <div class="stack-item-title">${escapeHtml(state.athlete?.teamName || "No team assigned")}</div>
          <div class="stack-item-sub">
            ${escapeHtml(state.athlete?.squadName || "No squad specified")}
          </div>
        </div>
      `;

    els.athleteTeams.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteTeamsHeading">Team / Squad Associations</h2>
          <p>Current and historical team or squad connections for this athlete.</p>
        </div>
      </div>

      <div class="stack-list">
        ${items}
      </div>
    `;
  }

  function renderRecords() {
    if (!els.athleteRecords) return;

    const rows = state.records.length
      ? `
        <div class="data-table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Record / Award</th>
                <th>Type</th>
                <th>Competition</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${state.records.map((item) => `
                <tr>
                  <td>${escapeHtml(item.title || item.name || "—")}</td>
                  <td>${escapeHtml(item.type || "—")}</td>
                  <td>${escapeHtml(item.competitionName || item.competition || "—")}</td>
                  <td>${escapeHtml(formatDate(item.date) || "—")}</td>
                  <td>${escapeHtml(item.notes || "—")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state">No records, awards, or notable performance tags have been added yet.</div>`;

    els.athleteRecords.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteRecordsHeading">Records / Awards / Notable Marks</h2>
          <p>Track athlete records, achievements, awards, and other notable tags connected to the athlete profile.</p>
        </div>
      </div>

      ${rows}
    `;
  }

  function renderMissingSelection() {
    const message = `
      <div class="empty-state">
        No athlete was selected. Open this page from the Athletes page and pass an athlete id in the URL.
      </div>
    `;

    if (els.heroName) els.heroName.textContent = "Athlete View";
    if (els.heroSummary) {
      els.heroSummary.textContent = "Select an athlete from the Athletes page to view their full profile.";
    }

    if (els.athleteBodyInfo) els.athleteBodyInfo.innerHTML = message;
    if (els.athleteInfo) els.athleteInfo.innerHTML = message;
    if (els.athleteStatsSection) els.athleteStatsSection.innerHTML = message;
    if (els.athletePersonalBests) els.athletePersonalBests.innerHTML = message;
    if (els.athleteStatEntry) els.athleteStatEntry.innerHTML = message;
    if (els.athleteHistory) els.athleteHistory.innerHTML = message;
    if (els.athleteTeams) els.athleteTeams.innerHTML = message;
    if (els.athleteRecords) els.athleteRecords.innerHTML = message;
  }

  function renderLoadFailure(error) {
    const text = escapeHtml(error?.message || "Failed to load athlete view.");
    const block = `<div class="message error">${text}</div>`;

    if (els.athleteBodyInfo) els.athleteBodyInfo.innerHTML = block;
    if (els.athleteInfo) els.athleteInfo.innerHTML = block;
    if (els.athleteStatsSection) els.athleteStatsSection.innerHTML = block;
    if (els.athletePersonalBests) els.athletePersonalBests.innerHTML = block;
    if (els.athleteStatEntry) els.athleteStatEntry.innerHTML = block;
    if (els.athleteHistory) els.athleteHistory.innerHTML = block;
    if (els.athleteTeams) els.athleteTeams.innerHTML = block;
    if (els.athleteRecords) els.athleteRecords.innerHTML = block;
  }

  async function handleStatEntrySubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const feedback = document.getElementById("entryFeedback");

    const formData = new FormData(form);

    const entryType = String(formData.get("entryType") || "stat");
    const linkedNow = String(formData.get("entryLinkedNow") || "yes") === "yes";

    const entry = {
      id: cryptoRandomId(),
      season: String(formData.get("entrySeason") || "").trim(),
      statName: String(formData.get("entryMetric") || "").trim(),
      eventName: String(formData.get("entryMetric") || "").trim(),
      performance: String(formData.get("entryValue") || "").trim(),
      statValue: String(formData.get("entryValue") || "").trim(),
      unit: String(formData.get("entryUnit") || "").trim(),
      category: String(formData.get("entryCategory") || "").trim(),
      competitionName: linkedNow ? String(formData.get("entryCompetition") || "").trim() : "",
      competitionId: linkedNow ? String(formData.get("entryCompetitionId") || "").trim() : "",
      linkedCompetitionId: linkedNow ? String(formData.get("entryCompetitionId") || "").trim() : "",
      date: String(formData.get("entryDate") || "").trim(),
      notes: String(formData.get("entryNotes") || "").trim(),
      verified: false
    };

    if (!entry.season || !entry.statName || !entry.statValue) {
      if (feedback) {
        feedback.innerHTML = `<div class="message error">Season, entry name, and value are required.</div>`;
      }
      return;
    }

    try {
      if (entryType === "pb") {
        await APP.apiPost(`/athletes/${encodeURIComponent(state.athleteId)}/personal-bests`, {
          eventName: entry.eventName,
          performance: entry.performance,
          unit: entry.unit,
          season: entry.season,
          competitionName: entry.competitionName,
          competitionId: entry.competitionId || null,
          date: entry.date,
          notes: entry.notes
        });
      } else {
        await APP.apiPost(`/athletes/${encodeURIComponent(state.athleteId)}/stats`, {
          athleteId: state.athleteId,
          sport: state.athlete?.primarySport || state.athlete?.sport || "",
          season: entry.season,
          statName: entry.statName,
          statValue: entry.statValue,
          unit: entry.unit,
          competitionName: entry.competitionName,
          eventName: entry.eventName,
          category: entry.category,
          date: entry.date,
          verified: false,
          competitionId: entry.competitionId || null,
          linkedCompetitionId: entry.linkedCompetitionId,
          notes: entry.notes
        });
      }

      if (feedback) {
        feedback.innerHTML = `<div class="message success">Entry saved. Refreshing athlete performance data...</div>`;
      }

      form.reset();
      const seasonInput = document.getElementById("entrySeason");
      if (seasonInput) seasonInput.value = getCurrentSeasonValue();

      const payload = await getAthletePerformanceBundle(state.athleteId);
      state.stats = Array.isArray(payload.stats) ? payload.stats.map(normalizeStatLine) : [];
      state.personalBests = Array.isArray(payload.personalBests) ? payload.personalBests.map(normalizePB) : [];
      state.history = Array.isArray(payload.history) ? payload.history : [];
      state.teams = Array.isArray(payload.teams) ? payload.teams : [];
      state.records = Array.isArray(payload.records) ? payload.records : [];

      renderAll();
    } catch (error) {
      if (feedback) {
        feedback.innerHTML = `<div class="message error">${escapeHtml(error?.message || "Failed to add entry.")}</div>`;
      }
    }
  }

  function getFilteredStats() {
    let items = state.stats.slice();

    if (state.filteredSeason !== "all") {
      items = items.filter((item) => String(item.season || "").trim() === state.filteredSeason);
    }

    if (state.searchTerm) {
      const needle = state.searchTerm.toLowerCase();
      items = items.filter((item) =>
        [
          item.statName,
          item.eventName,
          item.category,
          item.competitionName,
          item.notes
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }

    return items.sort((a, b) => {
      const aTime = new Date(a.date || 0).getTime();
      const bTime = new Date(b.date || 0).getTime();
      return bTime - aTime;
    });
  }

  function getFilteredPBs() {
    let items = state.personalBests.slice();

    if (state.filteredSeason !== "all") {
      items = items.filter((item) => String(item.season || "").trim() === state.filteredSeason);
    }

    if (state.searchTerm) {
      const needle = state.searchTerm.toLowerCase();
      items = items.filter((item) =>
        [
          item.eventName,
          item.competitionName,
          item.notes
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }

    return items.sort((a, b) => {
      const aTime = new Date(a.date || 0).getTime();
      const bTime = new Date(b.date || 0).getTime();
      return bTime - aTime;
    });
  }

  function getAvailableSeasons() {
    const seasons = new Set();

    state.stats.forEach((item) => {
      if (item.season) seasons.add(String(item.season));
    });

    state.personalBests.forEach((item) => {
      if (item.season) seasons.add(String(item.season));
    });

    return Array.from(seasons).sort().reverse();
  }

  function getCurrentSeasonValue() {
    const currentYear = new Date().getFullYear();
    return String(currentYear);
  }

  function countUniqueValues(values) {
    return new Set(values).size;
  }

  function detailCard(label, value) {
    return `
      <div class="detail-item">
        <span class="detail-label">${escapeHtml(label)}</span>
        <div>${escapeHtml(value || "—")}</div>
      </div>
    `;
  }

  function formatCampus(value) {
    return String(value || "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString();
  }

  function formatValueWithUnit(value, unit) {
    const base = value == null ? "" : String(value);
    return unit ? `${base} ${unit}`.trim() : base;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cryptoRandomId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `ath-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function bindSummaryButton() {
    if (!els.downloadSummaryBtn) return;

    els.downloadSummaryBtn.addEventListener("click", function () {
      if (!state.athlete) return;

      const payload = `
ATHLETE SUMMARY
Name: ${state.athlete.fullName}
Sport: ${state.athlete.sport}
Team: ${state.athlete.teamName || "Not assigned"}
Campus: ${formatCampus(state.athlete.campus || "")}
Status: ${state.athlete.status}
Email: ${state.athlete.email || "Not recorded"}
Phone: ${state.athlete.phone || "Not recorded"}

Body Information
Height: ${state.athlete.height || "Not recorded"}
Weight: ${state.athlete.weight || "Not recorded"}
Handedness: ${state.athlete.handedness || "Not recorded"}
Dominant Foot: ${state.athlete.dominantFoot || "Not recorded"}

Visible Stat Lines: ${getFilteredStats().length}
Visible Personal Bests: ${getFilteredPBs().length}
      `.trim();

      const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${state.athlete.fullName || "athlete-summary"}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  }
})();
