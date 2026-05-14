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
    allTeams: [],
    records: [],
    filteredSeason: "all",
    searchTerm: "",
    editBound: false
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
    downloadSummaryBtn: document.getElementById("downloadSummaryBtn"),
    editAthleteBtn: document.getElementById("editAthleteBtn"),
    editAthletePanel: document.getElementById("editAthletePanel"),
    athleteEditForm: document.getElementById("athleteEditForm"),
    athleteEditMessage: document.getElementById("athleteEditMessage")
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

    const [payload, teamsPayload] = await Promise.all([
      getAthletePerformanceBundle(state.athleteId),
      APP.apiGet("/teams", true)
    ]);
    state.stats = Array.isArray(payload.stats) ? payload.stats.map(normalizeStatLine) : [];
    state.personalBests = Array.isArray(payload.personalBests) ? payload.personalBests.map(normalizePB) : [];
    state.history = Array.isArray(payload.history) ? payload.history : [];
    state.teams = Array.isArray(payload.teams) ? payload.teams : [];
    state.allTeams = normalizeArray(teamsPayload, ["teams", "data", "items"]);
    state.records = Array.isArray(payload.records) ? payload.records : [];
    enrichAthleteTeamContext();

    bindEditWorkflow();
    renderAll();
  }

  function normalizeArray(payload, keys) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
      if (payload.data && Array.isArray(payload.data[key])) return payload.data[key];
    }
    if (Array.isArray(payload.data)) return payload.data;
    return [];
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
    const profile = athlete.profile && typeof athlete.profile === "object" ? athlete.profile : {};
    const roster = athlete.activeRosterAssignment && typeof athlete.activeRosterAssignment === "object"
      ? athlete.activeRosterAssignment
      : {};
    const heightValue = athlete.height || athlete.heightCm || profile.heightCm || "";
    const weightValue = athlete.weight || athlete.weightKg || profile.weightKg || "";
    const facultyProgramParts = String(athlete.facultyProgram || "").split("/").map((item) => item.trim()).filter(Boolean);

    return {
      id: athlete.id || state.athleteId || "",
      firstName: athlete.firstName || "",
      lastName: athlete.lastName || "",
      fullName:
        athlete.fullName ||
        [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") ||
        "Unknown Athlete",
      sport: athlete.sport || athlete.primarySport || profile.sportSlug || "Sport not assigned",
      athleteType: athlete.athleteType || "Athlete",
      campus: athlete.campus || state.session?.campus || "",
      activeRosterAssignment: roster,
      teamId: athlete.teamId || roster.teamId || "",
      teamName: athlete.teamName || athlete.team || roster.teamName || "",
      squadName: athlete.squadName || athlete.squad || roster.squadName || roster.squad || roster.division || roster.teamName || athlete.teamName || "",
      status: athlete.status || "Active",
      schoolOrClub: athlete.schoolOrClub || athlete.school || athlete.club || "",
      dateOfBirth: athlete.dateOfBirth || athlete.dob || profile.dateOfBirth || "",
      gender: normalizeGender(athlete.gender || profile.gender || ""),
      age: athlete.age || calculateAge(athlete.dateOfBirth || athlete.dob || profile.dateOfBirth || ""),
      phone: athlete.phone || "",
      email: athlete.email || "",
      handedness: athlete.handedness || athlete.dominantHand || profile.dominantHand || "",
      dominantFoot: athlete.dominantFoot || athlete.dominantLeg || profile.dominantLeg || "",
      height: heightValue ? `${heightValue}${String(heightValue).includes("cm") ? "" : " cm"}` : "",
      weight: weightValue ? `${weightValue}${String(weightValue).includes("kg") ? "" : " kg"}` : "",
      position: athlete.position || profile.position || "",
      events: Array.isArray(athlete.events)
        ? athlete.events
        : String(profile.eventsSpecialties || "").split(",").map((item) => item.trim()).filter(Boolean),
      yearOfStudy: athlete.yearOfStudy || "",
      faculty: athlete.faculty || profile.faculty || facultyProgramParts[0] || "",
      program: athlete.program || profile.program || facultyProgramParts[1] || "",
      studentId: athlete.studentId || "",
      nationality: athlete.nationality || profile.nationality || "",
      hometown: athlete.hometown || profile.hometown || "",
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
      notes: raw.notes || "",
      sport: raw.sport || raw.sportSlug || "",
      eventType: raw.eventType || "",
      statData: raw.statData || raw.data || {}
    };
  }

  function enrichAthleteTeamContext() {
    if (!state.athlete) return;
    const roster = state.athlete.activeRosterAssignment || {};
    const association = state.teams.find((item) => {
      const teamId = item.teamId || item.team?.id || item.activeRosterAssignment?.teamId || item.id || "";
      return String(teamId || "") === String(state.athlete.teamId || roster.teamId || "");
    });
    const teamId = state.athlete.teamId || roster.teamId || association?.teamId || association?.team?.id || association?.id || "";
    const team = state.allTeams.find((entry) => String(entry.id || "") === String(teamId || ""));
    state.athlete.teamId = teamId || state.athlete.teamId || "";
    state.athlete.teamName = state.athlete.teamName || association?.teamName || association?.team?.name || team?.name || team?.teamName || "";
    state.athlete.squadName = state.athlete.squadName || association?.squadName || association?.squad || association?.division || team?.division || team?.squadName || state.athlete.teamName || team?.name || team?.teamName || "";
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
    populateEditForm();
  }

  function bindEditWorkflow() {
    if (state.editBound) return;
    state.editBound = true;
    if (els.editAthleteBtn && els.editAthletePanel) {
      els.editAthleteBtn.addEventListener("click", function () {
        els.editAthletePanel.classList.remove("hidden");
        els.editAthletePanel.open = true;
        els.editAthletePanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (els.athleteEditForm) {
      APP.trackUnsavedChanges(els.athleteEditForm);
      els.athleteEditForm.addEventListener("submit", handleEditAthleteSubmit);
    }
    mountArchiveButton("athlete", els.editAthleteBtn, state.athleteId, () => state.athlete, "athletes.html");
  }

  function populateEditForm() {
    if (!els.athleteEditForm || !state.athlete) return;
    const athlete = state.athlete;
    const sportSelect = document.getElementById("editAthletePrimarySport");
    const teamSelect = document.getElementById("editAthleteTeam");
    if (sportSelect) {
      sportSelect.innerHTML = `<option value="">Not set</option>${APP.SPORT_REGISTRY.map((sport) => `<option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>`).join("")}`;
    }
    if (teamSelect) {
      teamSelect.innerHTML = `<option value="">No squad selected</option>${state.allTeams.map((team) => `<option value="${escapeHtml(team.id || "")}">${escapeHtml(team.name || team.teamName || "Team")}</option>`).join("")}`;
    }

    setField("editAthleteFirstName", athlete.firstName);
    setField("editAthleteLastName", athlete.lastName);
    setField("editAthleteType", athlete.athleteType);
    setField("editAthleteDateOfBirth", toDateInputValue(athlete.dateOfBirth));
    setField("editAthleteGender", normalizeGender(athlete.gender));
    setField("editAthleteEmail", athlete.email);
    setField("editAthletePhone", athlete.phone);
    setField("editAthleteStudentId", athlete.studentId);
    setField("editAthleteYear", athlete.yearOfStudy);
    setField("editAthleteFaculty", athlete.faculty);
    setField("editAthleteProgram", athlete.program);
    setField("editAthleteNationality", athlete.nationality);
    setField("editAthleteHometown", athlete.hometown);
    setField("editAthleteStatus", String(athlete.status || "active").toLowerCase());
    setField("editAthletePrimarySport", APP.normalizeSportSlug(athlete.sport || ""));
    setField("editAthletePosition", athlete.position);
    setField("editAthleteEvents", athlete.events.join(", "));
    setField("editAthleteHeight", String(athlete.height || "").replace(/[^\d.]/g, ""));
    setField("editAthleteWeight", String(athlete.weight || "").replace(/[^\d.]/g, ""));
    setField("editAthleteHand", athlete.handedness);
    setField("editAthleteLeg", athlete.dominantFoot);
    const currentTeam = state.allTeams.find((team) => String(team.id || "") === String(athlete.teamId || ""))
      || state.allTeams.find((team) => String(team.name || team.teamName || "") === String(athlete.teamName || ""));
    setField("editAthleteTeam", currentTeam?.id || athlete.teamId || "");
    setField("editAthleteRole", "");
    setField("editAthleteJersey", "");
    setField("editAthleteCaptain", "false");
  }

  async function handleEditAthleteSubmit(event) {
    event.preventDefault();
    const message = els.athleteEditMessage;
    if (message) {
      message.className = "message";
      message.textContent = "";
    }

    const payload = {
      firstName: getField("editAthleteFirstName"),
      lastName: getField("editAthleteLastName"),
      fullName: `${getField("editAthleteFirstName")} ${getField("editAthleteLastName")}`.trim(),
      athleteType: getField("editAthleteType") || "student-athlete",
      dateOfBirth: getField("editAthleteDateOfBirth"),
      gender: normalizeGender(getField("editAthleteGender")),
      age: calculateAge(getField("editAthleteDateOfBirth")),
      email: getField("editAthleteEmail"),
      phone: getField("editAthletePhone"),
      studentId: getField("editAthleteStudentId"),
      yearOfStudy: getField("editAthleteYear"),
      faculty: getField("editAthleteFaculty"),
      program: getField("editAthleteProgram"),
      facultyProgram: [getField("editAthleteFaculty"), getField("editAthleteProgram")].filter(Boolean).join(" / "),
      nationality: getField("editAthleteNationality"),
      hometown: getField("editAthleteHometown"),
      status: getField("editAthleteStatus") || "active",
      campus: state.session?.campus,
      profile: {
        sportSlug: getField("editAthletePrimarySport"),
        position: getField("editAthletePosition"),
        eventsSpecialties: getField("editAthleteEvents"),
        heightCm: toNullableNumber(getField("editAthleteHeight")),
        weightKg: toNullableNumber(getField("editAthleteWeight")),
        dominantHand: getField("editAthleteHand"),
        dominantLeg: getField("editAthleteLeg"),
        dateOfBirth: getField("editAthleteDateOfBirth"),
        gender: normalizeGender(getField("editAthleteGender")),
        faculty: getField("editAthleteFaculty"),
        program: getField("editAthleteProgram"),
        nationality: getField("editAthleteNationality"),
        hometown: getField("editAthleteHometown")
      },
      activeRosterAssignment: getField("editAthleteTeam")
        ? {
            teamId: getField("editAthleteTeam"),
            roleLabel: getField("editAthleteRole"),
            jerseyNumber: getField("editAthleteJersey"),
            isCaptain: getField("editAthleteCaptain") === "true",
            status: "active"
          }
        : null,
      updatedAt: state.athlete?.updatedAt
    };

    if (!payload.firstName || !payload.lastName) {
      showEditMessage(message, "Enter first and last name.", "error");
      return;
    }

    try {
      if (!APP.confirmReportImpact((state.stats || []).length || (state.records || []).length)) return;
      await APP.apiPatch(`/athletes/${encodeURIComponent(state.athleteId)}`, payload);
      showEditMessage(message, "Athlete updated successfully.", "success");
      await loadAthleteView();
    } catch (error) {
      showEditMessage(message, error?.message || "Failed to update athlete.", "error");
    }
  }

  function mountArchiveButton(recordType, anchor, id, getRecord, returnUrl) {
    if (!anchor || !id || document.getElementById(`${recordType}ArchiveBtn`)) return;
    const button = document.createElement("button");
    button.id = `${recordType}ArchiveBtn`;
    button.className = "btn btn-soft";
    button.type = "button";
    button.textContent = "Archive";
    button.addEventListener("click", async () => {
      const record = getRecord();
      if (!APP.confirmArchive(recordType, record)) return;
      await APP.apiPatch(`/${recordType}s/${encodeURIComponent(id)}/archive`, { updatedAt: record?.updatedAt });
      window.location.href = returnUrl;
    });
    anchor.insertAdjacentElement("afterend", button);
  }

  function renderHero() {
    if (!state.athlete) return;

    const athlete = state.athlete;
    const profileScore = getAthleteCompleteness(athlete);

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
          <div class="mini-label">Profile Completeness</div>
          ${completenessMarkup(profileScore, true)}
          <div class="mini-sub">Profile completeness</div>
        </div>

        <div class="mini-card">
          <div class="mini-label">Sport</div>
          <div class="mini-value">${escapeHtml(athlete.sport || "Not recorded")}</div>
          <div class="mini-sub">Primary sport assignment</div>
        </div>

        <div class="mini-card">
          <div class="mini-label">Team</div>
          <div class="mini-value">${escapeHtml(athlete.teamName || "Not assigned")}</div>
          <div class="mini-sub">${escapeHtml(athlete.squadName || athlete.teamName || "Squad not assigned")}</div>
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
        if (els.athleteHeadshotFallback) {
          els.athleteHeadshotFallback.textContent = getInitials(athlete.fullName);
          els.athleteHeadshotFallback.hidden = false;
        }
      }
    }
  }

  function renderBodyInfo() {
    if (!state.athlete || !els.athleteBodyInfo) return;

    const athlete = state.athlete;

    const eventsDisplay = athlete.events.length ? athlete.events.join(", ") : "Not recorded";

    els.athleteBodyInfo.innerHTML = `
      <div class="section-title">
        <div>
          <h2 id="athleteBodyInfoHeading">Body & Athlete Information</h2>
          <p>Physical profile, roster assignment, academic details, and contact information for this athlete.</p>
        </div>
      </div>

      <div class="details-grid">
        ${detailCard("Height", athlete.height || "Not recorded")}
        ${detailCard("Weight", athlete.weight || "Not recorded")}
        ${detailCard("Handedness", athlete.handedness || "Not recorded")}
        ${detailCard("Dominant Foot", athlete.dominantFoot || "Not recorded")}
        ${detailCard("Sex", formatGender(athlete.gender))}
        ${detailCard("Date of Birth", formatDate(athlete.dateOfBirth) || "Not recorded")}
        ${detailCard("Age", athlete.age || calculateAge(athlete.dateOfBirth) || "Not recorded")}
      </div>

      <div class="section-title compact-section-title">
        <div>
          <h3>Athlete Information</h3>
        </div>
      </div>

      <div class="details-grid">
        ${detailCard("Full Name", athlete.fullName)}
        ${detailCard("Sport", athlete.sport || "Not recorded")}
        ${detailCard("Team", athlete.teamName || "Not assigned")}
        ${detailCard("Squad", athlete.squadName || athlete.teamName || "Not assigned")}
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

  function getAthleteCompleteness(athlete) {
    const checks = [
      athlete.firstName,
      athlete.lastName,
      athlete.email || athlete.phone,
      athlete.athleteType,
      athlete.sport && athlete.sport !== "Sport not assigned",
      athlete.teamName,
      athlete.position || athlete.events.length,
      athlete.dateOfBirth,
      athlete.gender,
      athlete.height,
      athlete.weight,
      athlete.status
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function completenessMarkup(score, large) {
    const normalized = Math.max(0, Math.min(100, Number(score) || 0));
    const wrapperClass = large ? "completeness-large" : "completeness-cell";
    return `<div class="${wrapperClass}"><span class="completeness-ring" style="--score:${normalized}"></span><span class="completeness-text">${normalized}%</span></div>`;
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

      <div class="note-box" style="margin:14px 0;">
        Athlete statistics shown in this platform reflect records from 2026 onwards.
      </div>

      ${state.stats.some((item) => APP.normalizeSportSlug(item.sport || item.sportSlug) === "cricket")
        ? `<div class="quick-actions" style="margin:14px 0;"><a class="btn btn-campus" href="athlete-cricket-stats.html?athleteId=${encodeURIComponent(state.athleteId)}">Open Detailed Cricket Stats</a></div>`
        : ""}
      ${state.stats.some((item) => APP.normalizeSportSlug(item.sport || item.sportSlug) === "football")
        ? `<div class="quick-actions" style="margin:14px 0;"><a class="btn btn-campus" href="athlete-football-stats.html?athleteId=${encodeURIComponent(state.athleteId)}">Open Detailed Football Stats</a></div>`
        : ""}
      ${state.stats.some((item) => APP.normalizeSportSlug(item.sport || item.sportSlug) === "basketball")
        ? `<div class="quick-actions" style="margin:14px 0;"><a class="btn btn-campus" href="athlete-basketball-stats.html?athleteId=${encodeURIComponent(state.athleteId)}">Open Detailed Basketball Stats</a></div>`
        : ""}
      ${state.stats.some((item) => APP.normalizeSportSlug(item.sport || item.sportSlug) === "track-and-field")
        ? `<div class="quick-actions" style="margin:14px 0;"><a class="btn btn-campus" href="athlete-track-field-stats.html?athleteId=${encodeURIComponent(state.athleteId)}">Open Detailed Track and Field Stats</a></div>`
        : ""}

      ${
        filteredStats.length
          ? `
            <details class="nested-detail" style="margin-top:16px;">
              <summary>View Raw Stat Log (${filteredStats.length})</summary>
              <p class="muted" style="margin:8px 0 12px;">Use this log for audit-level review. Aggregated sport pages are the cleaner default view for repeated match data.</p>
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
            </details>
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
            <input class="input" id="entryCompetitionId" name="entryCompetitionId" type="text" placeholder="Optional competition ID" />
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

    const normalizedTeams = getResolvedTeamAssociations();
    const items = normalizedTeams.length
      ? normalizedTeams.map((item) => `
          <div class="stack-item">
            <div class="stack-item-title">${escapeHtml(item.name || item.teamName || "Unnamed Team")}</div>
            <div class="stack-item-sub">
              ${escapeHtml(item.role || item.roleLabel || item.status || "Athlete")} •
              ${escapeHtml(item.season || item.seasonLabel || state.athlete?.season || "Season not recorded")} •
              ${escapeHtml(item.squadName || item.squad || item.division || state.athlete?.squadName || item.teamName || item.name || state.athlete?.teamName || "No squad specified")}
            </div>
          </div>
        `).join("")
      : `
        <div class="stack-item">
          <div class="stack-item-title">${escapeHtml(state.athlete?.teamName || "No team assigned")}</div>
          <div class="stack-item-sub">
            ${escapeHtml(state.athlete?.squadName || state.athlete?.teamName || "No squad specified")}
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

  function getResolvedTeamAssociations() {
    const raw = state.teams.length ? state.teams : [];
    const associations = raw.map((item) => {
      const teamId = item.teamId || item.id || item.team?.id || item.activeRosterAssignment?.teamId || "";
      const team = state.allTeams.find((entry) => String(entry.id || "") === String(teamId || ""));
      return {
        ...item,
        ...team,
        name: item.name || item.teamName || item.team?.name || team?.name || team?.teamName || state.athlete?.teamName || "",
        teamName: item.teamName || item.name || item.team?.teamName || team?.teamName || team?.name || state.athlete?.teamName || "",
        season: item.season || item.seasonLabel || team?.seasonLabel || team?.season || "",
        squadName: item.squadName || item.squad || item.division || team?.division || team?.name || team?.teamName || state.athlete?.squadName || state.athlete?.teamName || ""
      };
    });
    if (associations.length) return associations;
    if (state.athlete?.teamName || state.athlete?.teamId) {
      const team = state.allTeams.find((entry) => String(entry.id || "") === String(state.athlete.teamId || ""))
        || state.allTeams.find((entry) => String(entry.name || entry.teamName || "") === String(state.athlete.teamName || ""));
      return [{
        id: team?.id || state.athlete.teamId || "",
        name: state.athlete.teamName || team?.name || team?.teamName || "Unnamed Team",
        season: team?.seasonLabel || team?.season || "",
        squadName: state.athlete.squadName || team?.division || state.athlete.teamName || team?.name || team?.teamName || "",
        role: state.athlete.position || "Athlete"
      }];
    }
    return [];
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
    let items = mergeDerivedPersonalBests();

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

  function mergeDerivedPersonalBests() {
    const isCricket = APP.normalizeSportSlug(state.athlete?.sport || state.athlete?.primarySport || "") === "cricket";
    const combined = isCricket
      ? state.personalBests.filter((item) => /bat|bowl|score|wicket|run/i.test(`${item.eventName || ""} ${item.notes || ""}`))
      : [...state.personalBests];
    const seen = new Set(combined.map((item) => `${item.eventName}:${item.performance}:${item.competitionName}`));
    derivePersonalBestsFromStats().forEach((item) => {
      const key = `${item.eventName}:${item.performance}:${item.competitionName}`;
      if (seen.has(key)) return;
      seen.add(key);
      combined.push(item);
    });
    return combined;
  }

  function derivePersonalBestsFromStats() {
    const sportSlug = APP.normalizeSportSlug(state.athlete?.sport || state.athlete?.primarySport || "");
    if (sportSlug === "cricket") {
      return deriveCricketPersonalBests();
    }
    if (sportSlug === "football") {
      return deriveFootballPersonalBests();
    }
    if (sportSlug === "track-and-field") {
      return deriveTrackFieldPersonalBests();
    }
    const bestByMetric = new Map();
    state.stats.forEach((line) => {
      const metric = line.statName || line.eventName || line.category || "Best Performance";
      const value = Number(line.statValue);
      if (!Number.isFinite(value)) return;
      const existing = bestByMetric.get(metric);
      if (existing && Number(existing.statValue) >= value) return;
      bestByMetric.set(metric, line);
    });
    return Array.from(bestByMetric.values()).map((line) => ({
      id: `derived-${line.id}`,
      eventName: line.statName || line.eventName || line.category || "Best Performance",
      performance: formatValueWithUnit(line.statValue, line.unit),
      unit: "",
      season: line.season || "Unknown",
      competitionName: line.competitionName || "Recorded stat line",
      date: line.date || "",
      notes: line.notes || "Derived from linked performance data."
    }));
  }

  function deriveCricketPersonalBests() {
    const batting = state.stats.filter((line) => line.sport === "cricket" || line.sportSlug === "cricket").filter((line) => line.eventType === "batting");
    const bowling = state.stats.filter((line) => line.sport === "cricket" || line.sportSlug === "cricket").filter((line) => line.eventType === "bowling" || line.eventType === "dismissal-bowling");
    const rows = [];
    const highestScore = batting.slice().sort((a, b) => Number(b.statValue || 0) - Number(a.statValue || 0))[0];
    if (highestScore && Number(highestScore.statValue || 0) > 0) {
      rows.push(toDerivedCricketPb("Highest Score", `${highestScore.statValue} runs`, highestScore));
    }
    const bestBowling = bowling
      .filter((line) => line.eventType === "bowling")
      .slice()
      .sort((a, b) => {
        const wicketsDelta = Number(b.statData?.wickets || b.statValue || 0) - Number(a.statData?.wickets || a.statValue || 0);
        if (wicketsDelta) return wicketsDelta;
        return Number(a.statData?.runs || a.statData?.runsConceded || 999) - Number(b.statData?.runs || b.statData?.runsConceded || 999);
      })[0];
    if (bestBowling && Number(bestBowling.statData?.wickets || bestBowling.statValue || 0) > 0) {
      rows.push(toDerivedCricketPb("Best Bowling Figures", `${bestBowling.statData?.wickets || bestBowling.statValue}/${bestBowling.statData?.runs || bestBowling.statData?.runsConceded || 0}`, bestBowling));
    }
    const runsBySeason = aggregateBySeason(batting, (line) => Number(line.statValue || 0));
    const topRunSeason = runsBySeason[0];
    if (topRunSeason) rows.push(toDerivedCricketPb("Highest Scoring Season", `${topRunSeason.value} runs`, topRunSeason.source, topRunSeason.season));
    const wicketsBySeason = aggregateBySeason(bowling, (line) => Number(line.statData?.wickets || line.statValue || 0));
    const topWicketSeason = wicketsBySeason[0];
    if (topWicketSeason) rows.push(toDerivedCricketPb("Most Wickets in a Season", `${topWicketSeason.value} wickets`, topWicketSeason.source, topWicketSeason.season));
    return rows;
  }

  function deriveFootballPersonalBests() {
    const matches = state.stats
      .filter((line) => APP.normalizeSportSlug(line.sport || line.sportSlug) === "football")
      .filter((line) => line.eventType === "match");
    const rows = [];
    const bestGoals = bestFootballMatch(matches, "goals");
    if (bestGoals) rows.push(toDerivedFootballPb("Most Goals in a Match", `${bestGoals.value} goals`, bestGoals.source));
    const bestAssists = bestFootballMatch(matches, "assists");
    if (bestAssists) rows.push(toDerivedFootballPb("Most Assists in a Match", `${bestAssists.value} assists`, bestAssists.source));
    const bestSaves = bestFootballMatch(matches, "saves");
    if (bestSaves) rows.push(toDerivedFootballPb("Most Saves in a Match", `${bestSaves.value} saves`, bestSaves.source));

    const goalsBySeason = aggregateBySeason(matches, (line) => Number(line.statData?.goals || 0));
    if (goalsBySeason[0]) rows.push(toDerivedFootballPb("Highest Scoring Season", `${goalsBySeason[0].value} goals`, goalsBySeason[0].source, goalsBySeason[0].season));
    const assistsBySeason = aggregateBySeason(matches, (line) => Number(line.statData?.assists || 0));
    if (assistsBySeason[0]) rows.push(toDerivedFootballPb("Highest Assisting Season", `${assistsBySeason[0].value} assists`, assistsBySeason[0].source, assistsBySeason[0].season));
    const savesBySeason = aggregateBySeason(matches, (line) => Number(line.statData?.saves || 0));
    if (savesBySeason[0]) rows.push(toDerivedFootballPb("Highest Saves Season", `${savesBySeason[0].value} saves`, savesBySeason[0].source, savesBySeason[0].season));
    return rows;
  }

  function bestFootballMatch(matches, key) {
    return matches
      .map((line) => ({ source: line, value: Number(line.statData?.[key] || 0) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)[0] || null;
  }

  function aggregateBySeason(lines, valueFn) {
    const map = new Map();
    lines.forEach((line) => {
      const season = String(line.season || "Unknown");
      const current = map.get(season) || { season, value: 0, source: line };
      current.value += valueFn(line);
      current.source = line;
      map.set(season, current);
    });
    return Array.from(map.values()).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  }

  function toDerivedCricketPb(eventName, performance, source, seasonOverride) {
    return {
      id: `derived-cricket-${eventName}-${source?.id || seasonOverride || ""}`,
      eventName,
      performance,
      unit: "",
      season: seasonOverride || source?.season || "Unknown",
      competitionName: source?.competitionName || "Recorded scorecard",
      date: source?.date || "",
      notes: "Derived from linked batting and bowling scorecard data."
    };
  }

  function toDerivedFootballPb(eventName, performance, source, seasonOverride) {
    return {
      id: `derived-football-${eventName}-${source?.id || seasonOverride || ""}`,
      eventName,
      performance,
      unit: "",
      season: seasonOverride || source?.season || "Unknown",
      competitionName: source?.competitionName || "Recorded match",
      date: source?.date || "",
      notes: "Derived from linked football match-sheet data."
    };
  }

  function deriveTrackFieldPersonalBests() {
    const rows = state.stats.filter((line) => APP.normalizeSportSlug(line.sport || line.sportSlug) === "track-and-field");
    const trackRows = rows.filter((line) => {
      const type = line.statData?.resultType || line.eventType;
      return type === "track" || type === "relay";
    });
    const fieldRows = rows.filter((line) => {
      const type = line.statData?.resultType || line.eventType;
      return type === "field" || ["horizontal-jump", "vertical-jump", "throw"].includes(type);
    });
    const output = [];
    const bestTrackByEvent = bestByEvent(trackRows, (line) => Number(line.statData?.timeNumber || 0), "asc");
    bestTrackByEvent.forEach((item) => output.push(toDerivedTrackFieldPb(`Best ${item.eventName}`, item.source.statData?.time || item.source.statValue, item.source)));
    const bestFieldByEvent = bestByEvent(fieldRows, (line) => Number(line.statData?.bestNumber || 0), "desc");
    bestFieldByEvent.forEach((item) => output.push(toDerivedTrackFieldPb(`Best ${item.eventName}`, item.source.statData?.best || item.source.statValue, item.source)));
    const pointsBySeason = aggregateBySeason(rows, (line) => Number(line.statData?.points || 0));
    if (pointsBySeason[0]) output.push(toDerivedTrackFieldPb("Highest Points Season", `${pointsBySeason[0].value} points`, pointsBySeason[0].source, pointsBySeason[0].season));
    return output;
  }

  function bestByEvent(rows, valueFn, direction) {
    const map = new Map();
    rows.forEach((line) => {
      const value = valueFn(line);
      if (!Number.isFinite(value) || value <= 0) return;
      const eventName = line.statData?.eventName || line.statName || line.eventName || "Event";
      const current = map.get(eventName);
      const better = !current || (direction === "asc" ? value < current.value : value > current.value);
      if (better) map.set(eventName, { eventName, value, source: line });
    });
    return Array.from(map.values());
  }

  function toDerivedTrackFieldPb(eventName, performance, source, seasonOverride) {
    return {
      id: `derived-track-field-${eventName}-${source?.id || seasonOverride || ""}`,
      eventName,
      performance: performance || "Recorded mark",
      unit: "",
      season: seasonOverride || source?.season || "Unknown",
      competitionName: source?.competitionName || "Recorded result sheet",
      date: source?.date || "",
      notes: "Derived from linked track and field result-sheet data."
    };
  }

  function getAvailableSeasons() {
    const seasons = new Set();

    state.stats.forEach((item) => {
      if (item.season) seasons.add(String(item.season));
    });

    mergeDerivedPersonalBests().forEach((item) => {
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

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
    return initials || "ATH";
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

  function toDateInputValue(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  }

  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return "";
    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age >= 0 && age < 120 ? String(age) : "";
  }

  function normalizeGender(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "m" || raw === "male") return "male";
    if (raw === "f" || raw === "female") return "female";
    return "";
  }

  function formatGender(value) {
    const normalized = normalizeGender(value);
    if (normalized === "male") return "Male";
    if (normalized === "female") return "Female";
    return "Not recorded";
  }

  function formatValueWithUnit(value, unit) {
    const base = value == null ? "" : String(value);
    return unit ? `${base} ${unit}`.trim() : base;
  }

  function setField(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value == null ? "" : String(value);
  }

  function getField(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function toNullableNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function showEditMessage(node, text, type) {
    if (!node) return;
    node.className = `message ${type || ""}`.trim();
    node.textContent = text || "";
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
