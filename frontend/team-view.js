(function () {
  "use strict";

  /**
   * Team detail workflow.
   *
   * The team page aggregates roster, staff, competition activity, and saved
   * scorecards. Relationship data may arrive from direct fields or nested
   * assignment arrays, so renderers normalize before display.
   */
  const APP = window.UWISportsHub;
  const SPORT_REGISTRY = APP.SPORT_REGISTRY || [];
  const apiGet = APP.apiGet.bind(APP);
  const apiPost = APP.apiPost.bind(APP);
  const apiPatch = APP.apiPatch.bind(APP);

  const state = {
    session: null,
    teamId: null,
    team: null,
    roster: [],
    staff: [],
    competitions: [],
    results: [],
    statLines: [],
    allAthletes: [],
    allCoaches: [],
    leaderboardSort: { metric: "", order: "desc" }
  };

  const params = new URLSearchParams(window.location.search);
  state.teamId = params.get("id") || params.get("teamId");

  const els = {
    pageMessage: document.getElementById("pageMessage"),

    teamNameHeading: document.getElementById("teamNameHeading"),
    teamSubtitle: document.getElementById("teamSubtitle"),
    teamStatusPill: document.getElementById("teamStatusPill"),
    teamCampusPill: document.getElementById("teamCampusPill"),
    teamSportPill: document.getElementById("teamSportPill"),
    teamHeadNote: document.getElementById("teamHeadNote"),
    editTeamBtn: document.getElementById("editTeamBtn"),
    archiveTeamBtn: document.getElementById("archiveTeamBtn"),
    editTeamPanel: document.getElementById("editTeamPanel"),
    teamSectionButtons: Array.from(document.querySelectorAll("[data-team-section]")),
    teamActionPanels: Array.from(document.querySelectorAll("[data-team-section-panel]")),
    closeTeamPanelButtons: Array.from(document.querySelectorAll("[data-close-team-panel]")),
    teamEditForm: document.getElementById("teamEditForm"),
    teamEditMessage: document.getElementById("teamEditMessage"),

    rosterCountStat: document.getElementById("rosterCountStat"),
    staffCountStat: document.getElementById("staffCountStat"),
    competitionCountStat: document.getElementById("competitionCountStat"),
    resultCountStat: document.getElementById("resultCountStat"),
    primarySportStat: document.getElementById("primarySportStat"),
    seasonStat: document.getElementById("seasonStat"),
    divisionStat: document.getElementById("divisionStat"),
    teamStatusStat: document.getElementById("teamStatusStat"),
    teamCompletenessStat: document.getElementById("teamCompletenessStat"),

    teamIdentity: document.getElementById("teamIdentity"),
    teamStaff: document.getElementById("teamStaff"),
    teamRoster: document.getElementById("teamRoster"),
    teamCompetitions: document.getElementById("teamCompetitions"),
    teamRecentResults: document.getElementById("teamRecentResults"),
    teamPerformance: document.getElementById("teamPerformance"),
    squadMessage: document.getElementById("teamSquadMessage"),

    addAthleteForm: document.getElementById("addAthleteForm"),
    athleteSelect: document.getElementById("athleteSelect"),
    athleteRole: document.getElementById("athleteRole"),
    athleteJersey: document.getElementById("athleteJersey"),

    addCoachForm: document.getElementById("addCoachForm"),
    coachSelect: document.getElementById("coachSelect"),
    coachRole: document.getElementById("coachRole"),
    coachPrimary: document.getElementById("coachPrimary")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    clearMessage(els.pageMessage);
    setSquadMessage("", "");

    try {
      if (!state.teamId) {
        renderMissingTeamSelection();
        return;
      }

      const session = await APP.mountSignedInShell({
        active: "teams",
        contextLabel: "Team View"
      });
      if (!session) return;

      state.session = session;

      await refreshPage();
    } catch (error) {
      console.error("Team view init error:", error);

      if (error && error.status === 401) {
        window.location.href = "index.html";
        return;
      }

      setError(els.pageMessage, error.message || "Failed to load team view.");
      renderLoadFailure(error);
    }
  }

  function bindEvents() {
    if (els.addAthleteForm) {
      els.addAthleteForm.addEventListener("submit", handleAddAthleteToTeam);
    }

    if (els.addCoachForm) {
      els.addCoachForm.addEventListener("submit", handleAddCoachToTeam);
    }

    if (els.editTeamBtn && els.editTeamPanel) {
      els.editTeamBtn.addEventListener("click", function () {
        openTeamPanel("edit");
      });
    }

    els.teamSectionButtons.forEach((button) => {
      button.addEventListener("click", function () {
        openTeamPanel(button.dataset.teamSection || "");
      });
    });

    els.closeTeamPanelButtons.forEach((button) => {
      button.addEventListener("click", closeTeamPanels);
    });

    if (els.teamEditForm) {
      APP.trackUnsavedChanges(els.teamEditForm);
      els.teamEditForm.addEventListener("submit", handleEditTeam);
    }
    mountArchiveButton();
  }

  function openTeamPanel(panelName) {
    if (!panelName) return;
    const panel = els.teamActionPanels.find((item) => item.dataset.teamSectionPanel === panelName);
    if (!panel) return;
    els.teamActionPanels.forEach((item) => {
      const isActive = item === panel;
      item.classList.toggle("hidden", !isActive);
      item.toggleAttribute("aria-hidden", !isActive);
    });
    els.teamSectionButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.teamSection === panelName);
    });
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeTeamPanels() {
    els.teamActionPanels.forEach((panel) => {
      panel.classList.add("hidden");
      panel.setAttribute("aria-hidden", "true");
    });
    els.teamSectionButtons.forEach((button) => button.classList.remove("is-active"));
  }

  async function refreshPage() {
    setSquadMessage("", "");

    const [
      teamData,
      rosterData,
      staffData,
      competitionsData,
      resultsData,
      statLinesData,
      athletesData,
      coachesData
    ] = await Promise.all([
      apiGet(`/teams/${encodeURIComponent(state.teamId)}`),
      apiGet(`/team-roster-assignments?teamId=${encodeURIComponent(state.teamId)}`, true),
      apiGet(`/team-staff-assignments?teamId=${encodeURIComponent(state.teamId)}`, true),
      apiGet(`/competitions?teamId=${encodeURIComponent(state.teamId)}`, true),
      apiGet(`/competition-results?teamId=${encodeURIComponent(state.teamId)}`, true),
      apiGet(`/competition-stat-lines?teamId=${encodeURIComponent(state.teamId)}`, true),
      apiGet(`/athletes`, true),
      apiGet(`/coaches`, true)
    ]);

    state.team =
      teamData ||
      teamData?.team ||
      teamData?.data?.team ||
      teamData?.data ||
      null;

    state.roster = dedupeBy(normalizeRosterArray(rosterData), (item) => `${item.teamId || state.teamId}:${item.athleteId || item.athlete?.id || ""}`);
    state.staff = collapseStaffAssignments(normalizeStaffArray(staffData));
    state.competitions = normalizeCompetitionsArray(competitionsData);
    state.results = normalizeResultsArray(resultsData);

   state.statLines = normalizeStatLinesArray(statLinesData);

    state.allAthletes = normalizeAthletesArray(athletesData);
    state.allCoaches = normalizeCoachesArray(coachesData);

    if (!state.team) {
      renderNotFound();
      return;
    }

    validateTeamCampus();
    renderAllSections();
  }

  function renderAllSections() {
    renderHead();
    renderTeamIdentity();
    renderTeamStaff();
    renderTeamRoster();
    renderTeamCompetitions();
    renderTeamRecentResults();
    renderTeamPerformance();
    populateSquadSelectors();
    populateTeamEditForm();
  }

  function populateTeamEditForm() {
    if (!els.teamEditForm || !state.team) return;
    const sportSelect = document.getElementById("editTeamSport");
    if (sportSelect) {
      sportSelect.innerHTML = `<option value="">Select sport</option>${SPORT_REGISTRY.map((sport) => `<option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>`).join("")}`;
    }
    setField("editTeamName", state.team.name || state.team.teamName || "");
    setField("editTeamSport", state.team.sport || state.team.sportSlug || "");
    setField("editTeamDivision", state.team.division || "");
    setField("editTeamSeason", state.team.seasonLabel || state.team.season || "");
    setField("editTeamStatus", normalizeStatus(state.team.status));
    setField("editTeamNotes", state.team.notes || "");
  }

  async function handleEditTeam(event) {
    event.preventDefault();
    setEditMessage("", "");
    const payload = {
      name: getField("editTeamName"),
      sport: getField("editTeamSport"),
      division: getField("editTeamDivision") || null,
      seasonLabel: getField("editTeamSeason") || null,
      status: getField("editTeamStatus") === "inactive" ? "INACTIVE" : "ACTIVE",
      notes: getField("editTeamNotes") || null,
      campus: state.session?.campus,
      updatedAt: state.team?.updatedAt
    };
    if (!payload.name || !payload.sport) {
      setEditMessage("Team name and sport are required.", "error");
      return;
    }
    try {
      if (!APP.confirmReportImpact((state.results || []).length || (state.statLines || []).length)) return;
      await apiPatch(`/teams/${encodeURIComponent(state.teamId)}`, payload);
      setEditMessage("Team updated successfully.", "success");
      await refreshPage();
    } catch (error) {
      setEditMessage(error?.message || "Failed to update team.", "error");
    }
  }

  function mountArchiveButton() {
    const button = els.archiveTeamBtn;
    if (!button || button.dataset.archiveBound === "true") return;
    button.dataset.archiveBound = "true";
    button.addEventListener("click", async function () {
      if (!state.team || !APP.confirmArchive("team", state.team)) return;
      await apiPatch(`/teams/${encodeURIComponent(state.teamId)}/archive`, { updatedAt: state.team.updatedAt });
      window.location.href = "teams.html";
    });
  }

  async function handleAddAthleteToTeam(event) {
    event.preventDefault();
    setSquadMessage("", "");

    const athleteId = (els.athleteSelect?.value || "").trim();
    const roleLabel = (els.athleteRole?.value || "").trim();
    const jerseyNumber = (els.athleteJersey?.value || "").trim();

    if (!athleteId) {
      setSquadMessage("Select an athlete before adding to the team.", "error");
      return;
    }

    const alreadyAssigned = state.roster.some(function (item) {
      return String(item.athleteId || item.athlete?.id || "") === String(athleteId);
    });

    if (alreadyAssigned) {
      setSquadMessage("That athlete is already assigned to this team.", "error");
      return;
    }

    try {
      await apiPost(`/team-roster-assignments`, {
        teamId: state.teamId,
        athleteId: athleteId,
        roleLabel: roleLabel || null,
        jerseyNumber: jerseyNumber || null,
        isCaptain: false,
        status: "ACTIVE"
      });

      els.addAthleteForm.reset();
      await refreshPage();
      setSquadMessage("Athlete added successfully.", "success");
    } catch (error) {
      console.error("Add athlete to team error:", error);
      setSquadMessage(error.message || "Failed to add athlete to the team.", "error");
    }
  }

  async function handleAddCoachToTeam(event) {
    event.preventDefault();
    setSquadMessage("", "");

    const coachId = (els.coachSelect?.value || "").trim();
    const role = (els.coachRole?.value || "").trim();
    const isPrimary = String(els.coachPrimary?.value || "false") === "true";

    if (!coachId) {
      setSquadMessage("Select a coach or staff member before saving.", "error");
      return;
    }

    const duplicate = state.staff.some(function (item) {
      return String(item.coachId || item.staffId || item.coach?.id || "") === String(coachId);
    });

    if (duplicate) {
      setSquadMessage("That coach or staff member is already assigned to this team.", "error");
      return;
    }

    try {
      await apiPost(`/team-staff-assignments`, {
        teamId: state.teamId,
        coachId,
        role: role || "team_staff",
        isPrimary
      });

      els.addCoachForm.reset();
      await refreshPage();
      setSquadMessage("Coach/staff assignment saved successfully.", "success");
    } catch (error) {
      console.error("Add coach to team error:", error);
      setSquadMessage(error.message || "Failed to save coach/staff assignment.", "error");
    }
  }

  function renderMissingTeamSelection() {
    if (els.teamIdentity) {
      els.teamIdentity.innerHTML = emptyStateMarkup(
        "Team details will appear here once added.",
        "Select a team from the registry to open this view."
      );
    }
    if (els.teamStaff) {
      els.teamStaff.innerHTML = emptyStateMarkup(
        "Staff assignments will appear here once added.",
        "Coaches and support staff linked to this team will be shown here."
      );
    }
    if (els.teamRoster) {
      els.teamRoster.innerHTML = emptyStateMarkup(
        "Roster details will appear here once added.",
        "Athletes linked to this team will be shown here."
      );
    }
    if (els.teamCompetitions) {
      els.teamCompetitions.innerHTML = emptyStateMarkup(
        "Competition links will appear here once added.",
        "Competitions involving this team will be listed here."
      );
    }
    if (els.teamPerformance) {
      els.teamPerformance.innerHTML = emptyStateMarkup(
        "Performance summaries will appear here once added.",
        "Results and stat totals for this team will be shown here."
      );
    }
    if (els.teamRecentResults) {
      els.teamRecentResults.innerHTML = emptyStateMarkup(
        "Recent results will appear here once added.",
        "Saved team scorecards and result cards will be shown here."
      );
    }

    if (els.teamNameHeading) els.teamNameHeading.textContent = "No Team Selected";
    if (els.teamSubtitle) {
      els.teamSubtitle.textContent = "Open this page from the Teams registry to view a specific team.";
    }
    if (els.teamStatusPill) els.teamStatusPill.textContent = "Awaiting Team";
    if (els.teamCampusPill) els.teamCampusPill.textContent = "Campus";
    if (els.teamSportPill) els.teamSportPill.textContent = "Sport";
  }

  function renderNotFound() {
    if (els.teamIdentity) {
      els.teamIdentity.innerHTML = emptyStateMarkup(
        "Team details unavailable.",
        "The selected team could not be found."
      );
    }
    if (els.teamStaff) {
      els.teamStaff.innerHTML = emptyStateMarkup(
        "Staff assignments unavailable.",
        "Staff linked to this team will be shown here once records exist."
      );
    }
    if (els.teamRoster) {
      els.teamRoster.innerHTML = emptyStateMarkup(
        "Roster details unavailable.",
        "Athletes linked to this team will be shown here once records exist."
      );
    }
    if (els.teamCompetitions) {
      els.teamCompetitions.innerHTML = emptyStateMarkup(
        "Competition activity unavailable.",
        "Competitions involving this team will be listed here once linked."
      );
    }
    if (els.teamPerformance) {
      els.teamPerformance.innerHTML = emptyStateMarkup(
        "Performance summaries unavailable.",
        "Results and stat totals for this team will be shown here once entered."
      );
    }
    if (els.teamRecentResults) {
      els.teamRecentResults.innerHTML = emptyStateMarkup(
        "Recent results unavailable.",
        "Saved team result cards will appear here once records exist."
      );
    }

    if (els.teamNameHeading) els.teamNameHeading.textContent = "Team Not Found";
    if (els.teamSubtitle) els.teamSubtitle.textContent = "The selected team could not be loaded.";
    if (els.teamStatusPill) els.teamStatusPill.textContent = "Unavailable";
  }

  function renderLoadFailure(error) {
    const message = error?.message || "Team data could not be loaded.";

    if (els.teamIdentity) {
      els.teamIdentity.innerHTML = emptyStateMarkup("Team details unavailable.", message);
    }
    if (els.teamStaff) {
      els.teamStaff.innerHTML = emptyStateMarkup("Staff section unavailable.", "The staff section could not be loaded.");
    }
    if (els.teamRoster) {
      els.teamRoster.innerHTML = emptyStateMarkup("Roster section unavailable.", "The roster section could not be loaded.");
    }
    if (els.teamCompetitions) {
      els.teamCompetitions.innerHTML = emptyStateMarkup("Competition section unavailable.", "The competition section could not be loaded.");
    }
    if (els.teamPerformance) {
      els.teamPerformance.innerHTML = emptyStateMarkup("Performance section unavailable.", "The performance section could not be loaded.");
    }
    if (els.teamRecentResults) {
      els.teamRecentResults.innerHTML = emptyStateMarkup("Recent results unavailable.", "The recent results section could not be loaded.");
    }

    setSquadMessage("Team details could not be loaded right now.", "error");
  }

  function renderHead() {
    const team = state.team;
    const sportLabel = getSportName(team.sport || team.sportSlug || team.sportName);
    const campusLabel = formatCampusLabel(normalizeCampus(team.campus || state.session.campus));
    const statusLabel = formatStatus(team.status);
    const seasonLabel = team.seasonLabel || team.season || "Open";

    if (els.teamNameHeading) {
      els.teamNameHeading.textContent = team.name || team.teamName || "Team";
    }
    if (els.teamSubtitle) {
      els.teamSubtitle.textContent = `${sportLabel} • ${campusLabel}`;
    }
    if (els.teamStatusPill) els.teamStatusPill.textContent = statusLabel;
    if (els.teamCampusPill) els.teamCampusPill.textContent = campusLabel;
    if (els.teamSportPill) els.teamSportPill.textContent = sportLabel;
    if (els.teamHeadNote) {
      els.teamHeadNote.textContent =
        "This page shows the current team identity, roster, staff assignments, competition activity, and performance summary for the selected team.";
    }

    if (els.rosterCountStat) els.rosterCountStat.textContent = String(state.roster.length);
    if (els.staffCountStat) els.staffCountStat.textContent = String(state.staff.length);
    if (els.competitionCountStat) els.competitionCountStat.textContent = String(state.competitions.length);
    if (els.resultCountStat) els.resultCountStat.textContent = String(state.results.length);
    if (els.primarySportStat) els.primarySportStat.textContent = sportLabel;
    if (els.seasonStat) els.seasonStat.textContent = seasonLabel;
    if (els.divisionStat) els.divisionStat.textContent = team.division || team.category || "Not set";
    if (els.teamStatusStat) els.teamStatusStat.textContent = statusLabel;
    if (els.teamCompletenessStat) els.teamCompletenessStat.innerHTML = completenessMarkup(getTeamCompleteness(team), true);
  }

  function renderTeamIdentity() {
    const team = state.team;
    const sportLabel = getSportName(team.sport || team.sportSlug || team.sportName);
    const campusLabel = formatCampusLabel(normalizeCampus(team.campus || state.session.campus));
    const statusLabel = formatStatus(team.status);

    if (!els.teamIdentity) return;

    els.teamIdentity.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Team Metadata</h2>
          <p>Core identity, classification, and season details for this team.</p>
        </div>
      </div>

      <div class="details-grid">
        ${detailCard("Team Name", team.name || team.teamName || "—")}
        ${detailCard("Sport", sportLabel)}
        ${detailCard("Campus", campusLabel)}
        ${detailCard("Division / Category", team.division || team.category || "—")}
        ${detailCard("Season", team.seasonLabel || team.season || "—")}
        ${detailCard("Status", statusLabel)}
        ${detailCard("Team ID", team.id || state.teamId || "—")}
        ${detailCard("Notes", team.notes || "No notes recorded")}
      </div>
    `;
  }

  function getTeamCompleteness(team) {
    const checks = [
      team.name || team.teamName,
      team.sport || team.sportSlug || team.sportName,
      team.division || team.category,
      team.seasonLabel || team.season,
      team.status,
      state.roster.length,
      state.staff.length,
      state.competitions.length || state.results.length
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function completenessMarkup(score, large) {
    const normalized = Math.max(0, Math.min(100, Number(score) || 0));
    const wrapperClass = large ? "completeness-large" : "completeness-cell";
    return `<div class="${wrapperClass}"><span class="completeness-ring" style="--score:${normalized}"></span><span class="completeness-text">${normalized}%</span></div>`;
  }

  function renderTeamStaff() {
    if (!els.teamStaff) return;

    if (!state.staff.length) {
      els.teamStaff.innerHTML = emptyStateMarkup(
        "No staff assignments yet.",
        "Add coaches, managers, physios, or other support staff to this team using the assignment form."
      );
      return;
    }

    const rows = state.staff.map(function (assignment) {
      const coachId = assignment.coachId || assignment.staffId || assignment.coach?.id || "";
      const coach = resolveCoach(coachId) || assignment.coach || null;
      const coachName = buildCoachName(coach) || "Unknown Staff";
      const roles = Array.isArray(assignment.roles) && assignment.roles.length
        ? assignment.roles.map((role) => formatRole(role, assignment.otherRoleTitle)).join(", ")
        : formatRole(assignment.role || assignment.roleLabel || assignment.assignmentRole, assignment.otherRoleTitle);

      return `
        <tr>
          <td>${coachId ? `<a class="roster-name-link" href="coach-view.html?id=${encodeURIComponent(String(coachId))}">${escapeHtml(coachName)}</a>` : escapeHtml(coachName)}</td>
          <td>${escapeHtml(roles)}</td>
          <td>${assignment.isPrimary ? "Yes" : "No"}</td>
          <td>${escapeHtml(formatGenericStatus(assignment.status || "active"))}</td>
        </tr>
      `;
    }).join("");

    els.teamStaff.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Staff Assignments</h2>
          <p>Coaches and support staff currently linked to this team.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Primary</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderTeamRoster() {
    if (!els.teamRoster) return;

    if (!state.roster.length) {
      els.teamRoster.innerHTML = emptyStateMarkup(
        "No roster assignments yet.",
        "Add athletes to this team using the team assignment form."
      );
      return;
    }

    const rows = state.roster.map(function (assignment) {
      const athleteId = assignment.athleteId || assignment.athlete?.id || "";
      const athlete = resolveAthlete(athleteId) || assignment.athlete || null;
      const athleteName = buildAthleteName(athlete) || assignment.athleteName || "Unknown Athlete";

      return `
        <tr>
          <td>${athleteId ? `<a class="roster-name-link" href="athlete-view.html?athleteId=${encodeURIComponent(String(athleteId))}">${escapeHtml(athleteName)}</a>` : escapeHtml(athleteName)}</td>
          <td>${escapeHtml(assignment.roleLabel || assignment.role || "Athlete")}</td>
          <td>${escapeHtml(assignment.jerseyNumber || "—")}</td>
          <td>${assignment.isCaptain ? "Yes" : "No"}</td>
          <td>${escapeHtml(formatGenericStatus(assignment.status || "active"))}</td>
        </tr>
      `;
    }).join("");

    els.teamRoster.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Roster</h2>
          <p>Athletes currently linked to this team.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Role</th>
              <th>Jersey / Bib</th>
              <th>Captain</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderTeamCompetitions() {
    if (!els.teamCompetitions) return;

    if (!state.competitions.length) {
      els.teamCompetitions.innerHTML = emptyStateMarkup(
        "No competition links yet.",
        "Competitions involving this team will appear here once linked."
      );
      return;
    }

    const rows = state.competitions.map(function (competition) {
      const id = competition.id || competition.competitionId || "";
      return `
        <tr>
          <td>${id ? `<a href="competition-view.html?id=${encodeURIComponent(String(id))}">${escapeHtml(competition.title || competition.name || "Competition")}</a>` : escapeHtml(competition.title || competition.name || "Competition")}</td>
          <td>${escapeHtml(getSportName(competition.sport || competition.sportSlug || state.team?.sport))}</td>
          <td>${escapeHtml(competition.seasonLabel || competition.season || "—")}</td>
          <td>${escapeHtml(formatGenericStatus(competition.status || "active"))}</td>
        </tr>
      `;
    }).join("");

    els.teamCompetitions.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Competition Activity</h2>
          <p>Competitions currently associated with this team.</p>
        </div>
      </div>

      <div class="data-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Competition</th>
              <th>Sport</th>
              <th>Season</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderTeamRecentResults() {
    if (!els.teamRecentResults) return;
    const sportSlug = APP.normalizeSportSlug(state.team?.sportSlug || state.team?.sport);
    const scorecards = getTeamMatchScorecards(sportSlug)
      .slice()
      .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
    const isFootball = sportSlug === "football";
    const isVolleyball = sportSlug === "volleyball";
    const isHockey = sportSlug === "hockey";
    const isBasketball = sportSlug === "basketball";
    const isSwimming = sportSlug === "swimming";
    const isTrackField = sportSlug === "track-and-field";
    const sportLabel = isFootball ? "football results" : isVolleyball ? "volleyball results" : isHockey ? "hockey results" : isBasketball ? "basketball results" : isSwimming ? "swimming results" : isTrackField ? "track and field results" : "cricket results";

    if (!scorecards.length) {
      els.teamRecentResults.innerHTML = emptyStateMarkup(
        "No recent match sheets yet.",
        `Saved ${sportLabel} involving this team will appear here.`
      );
      return;
    }

    const competitions = state.competitions.filter((competition) => {
      return scorecards.some((line) => String(line.competitionId) === String(competition.id || competition.competitionId));
    });

    els.teamRecentResults.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Recent Results</h2>
          <p>Latest saved ${sportLabel} involving this team.</p>
        </div>
        ${isFootball ? `<a class="btn btn-soft" href="football-results.html?teamId=${encodeURIComponent(state.teamId)}">View All Results</a>` : isBasketball ? `<a class="btn btn-soft" href="basketball-results.html?teamId=${encodeURIComponent(state.teamId)}">View All Results</a>` : isTrackField ? `<a class="btn btn-soft" href="track-field-results-archive.html?teamId=${encodeURIComponent(state.teamId)}">View All Results</a>` : isVolleyball || isHockey || isSwimming ? "" : `<a class="btn btn-soft" href="cricket-results.html?teamId=${encodeURIComponent(state.teamId)}">View All Results</a>`}
      </div>
      <div class="result-tabs">
        <button class="result-tab active" type="button" data-team-result-filter="">Matches (${scorecards.length})</button>
        ${competitions.map((competition) => {
          const id = competition.id || competition.competitionId;
          const count = scorecards.filter((line) => String(line.competitionId) === String(id)).length;
          return `<button class="result-tab" type="button" data-team-result-filter="${escapeHtml(id)}">${escapeHtml(competition.title || competition.name || "Competition")} (${count})</button>`;
        }).join("")}
      </div>
      <div class="result-strip" id="teamResultStrip"></div>
    `;

    const strip = document.getElementById("teamResultStrip");
    const renderStrip = (competitionId) => {
      const rows = scorecards.filter((line) => !competitionId || String(line.competitionId) === String(competitionId)).slice(0, 4);
      strip.innerHTML = rows.map((line) => isFootball ? renderTeamFootballResultCard(line) : isVolleyball ? renderTeamVolleyballResultCard(line) : isHockey ? renderTeamHockeyResultCard(line) : isBasketball ? renderTeamBasketballResultCard(line) : isSwimming ? renderTeamSwimmingResultCard(line) : isTrackField ? renderTeamTrackFieldResultCard(line) : renderTeamResultCard(line)).join("");
    };
    els.teamRecentResults.querySelectorAll("[data-team-result-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        els.teamRecentResults.querySelectorAll("[data-team-result-filter]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        renderStrip(button.dataset.teamResultFilter);
      });
    });
    renderStrip("");
  }

  function renderTeamPerformance() {
    if (!els.teamPerformance) return;

    const wins = countResultsByOutcome("win");
    const losses = countResultsByOutcome("loss");
    const draws = countResultsByOutcome("draw");
    const statLineCount = state.statLines.length;
    const subjectCount = countUniqueValues(
      state.statLines.map(function (item) {
        return item.subjectId || item.teamId || item.athleteId || "";
      }).filter(Boolean)
    );

    const resultRows = state.results.length
      ? `
        <div class="data-table-wrap" style="margin-top:16px;">
          <table class="table">
            <thead>
              <tr>
                <th>Competition</th>
                <th>Outcome</th>
                <th>Result</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${state.results.map(function (result) {
                return `
                  <tr>
                    <td>${escapeHtml(result.competitionName || result.competition || "—")}</td>
                    <td>${escapeHtml(formatGenericStatus(result.outcome || result.resultType || "—"))}</td>
                    <td>${escapeHtml(formatResult(result))}</td>
                    <td>${escapeHtml(result.date || result.resultDate || "—")}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state" style="margin-top:16px;">No result records are linked to this team yet.</div>`;

    els.teamPerformance.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Performance Summary</h2>
          <p>Result totals and stat activity linked to this team.</p>
        </div>
      </div>

      <div class="details-grid">
        ${detailCard("Wins", String(wins))}
        ${detailCard("Losses", String(losses))}
        ${detailCard("Draws", String(draws))}
        ${detailCard("Recorded Results", String(state.results.length))}
        ${detailCard("Stat Lines", String(statLineCount))}
        ${detailCard("Unique Subjects", String(subjectCount))}
      </div>

      ${renderTeamLeaderboardAccess()}
      ${renderTeamAchievements()}
      ${resultRows}
    `;
  }

  function renderTeamLeaderboardAccess() {
    const rows = buildTeamLeaderboardRows();
    const href = `leaderboards.html?scope=team&teamId=${encodeURIComponent(state.teamId)}`;
    return `
      <div class="leaderboard-access">
        <div>
          <h3>Team Leaderboards</h3>
          <p>${rows.length ? `${rows.length} players have linked stat totals from 2026 onwards.` : "No player leaderboard data is linked to this team yet."}</p>
        </div>
        <a class="btn btn-campus" href="${href}">Open Leaderboards</a>
      </div>
    `;
  }

  function renderTeamLeaderboards() {
    const rows = buildTeamLeaderboardRows();
    if (!rows.length) return `<div class="empty-state" style="margin-top:16px;">No player leaderboard data is linked to this team yet. Stats reflect 2026 onwards.</div>`;
    const metrics = getTeamLeaderboardMetrics();
    const activeMetric = state.leaderboardSort.metric || metrics[0]?.key || "entries";
    const order = state.leaderboardSort.order || "desc";
    const sortedRows = rows.slice().sort((a, b) => order === "asc" ? (a[activeMetric] || 0) - (b[activeMetric] || 0) : (b[activeMetric] || 0) - (a[activeMetric] || 0));
    return `
      <div class="section-title" style="margin-top:16px;">
        <div>
          <h2>Team Leaderboards</h2>
          <p>Top performers for this team from stat records captured from 2026 onwards.</p>
        </div>
        <div class="quick-actions">
          ${metrics.map((metric) => `<button class="btn btn-soft" type="button" data-team-leaderboard-metric="${escapeHtml(metric.key)}">${escapeHtml(metric.label)}</button>`).join("")}
          <button class="btn btn-soft" type="button" data-team-leaderboard-order="${order === "desc" ? "asc" : "desc"}">${order === "desc" ? "Highest first" : "Lowest first"}</button>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="table">
          <thead><tr><th>Player</th>${metrics.map((metric) => `<th>${escapeHtml(metric.label)}</th>`).join("")}</tr></thead>
          <tbody>
            ${sortedRows.slice(0, 12).map((row) => `
              <tr>
                <td><a href="${escapeHtml(teamLeaderboardPlayerHref(row.id))}">${escapeHtml(row.name)}</a></td>
                ${metrics.map((metric) => `<td>${escapeHtml(row[metric.key] || 0)}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function bindTeamLeaderboardControls() {
    document.querySelectorAll("[data-team-leaderboard-metric]").forEach((button) => {
      button.addEventListener("click", function () {
        state.leaderboardSort.metric = this.dataset.teamLeaderboardMetric || "";
        renderTeamPerformance();
      });
    });
    document.querySelectorAll("[data-team-leaderboard-order]").forEach((button) => {
      button.addEventListener("click", function () {
        state.leaderboardSort.order = this.dataset.teamLeaderboardOrder || "desc";
        renderTeamPerformance();
      });
    });
  }

  function renderTeamAchievements() {
    const achievements = [];
    state.results.forEach((result) => {
      const outcome = String(result.outcome || result.resultType || result.placing || result.position || "").toLowerCase();
      if (/champion|winner|1st|first|final|placed|runner/.test(outcome)) {
        achievements.push({
          title: result.title || result.competitionName || result.competition || "Competition achievement",
          detail: formatResult(result),
          date: result.date || result.resultDate || ""
        });
      }
    });
    if (Array.isArray(state.team?.achievements)) {
      state.team.achievements.forEach((item) => achievements.push({
        title: item.title || item.name || "Team achievement",
        detail: item.detail || item.description || item.result || "",
        date: item.date || item.season || ""
      }));
    }
    const uniqueAchievements = dedupeBy(achievements, (item) => `${item.title}:${item.detail}:${item.date}`).slice(0, 6);
    return `
      <div class="section-title" style="margin-top:16px;">
        <div>
          <h2>Team Achievements</h2>
          <p>Championships, place finishes, and notable tournament outcomes.</p>
        </div>
      </div>
      ${uniqueAchievements.length
        ? `<div class="stack-list">${uniqueAchievements.map((item) => `<div class="stack-item"><div class="stack-item-title">${escapeHtml(item.title)}</div><div class="stack-item-sub">${escapeHtml([item.detail, item.date].filter(Boolean).join(" • "))}</div></div>`).join("")}</div>`
        : `<div class="empty-state">No team achievements have been recorded yet.</div>`}
    `;
  }

  function buildTeamLeaderboardRows() {
    const metrics = getTeamLeaderboardMetrics();
    const map = new Map();
    state.statLines.map(normalizeTeamStatLine).forEach((line) => {
      const sportSlug = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
      if (sportSlug === "cricket" && Array.isArray(line.statData?.innings)) {
        addCricketTeamLeaderboardRows(map, metrics, line);
        return;
      }
      if (sportSlug === "football" && Array.isArray(line.statData?.playerStats)) {
        addFootballTeamLeaderboardRows(map, metrics, line);
        return;
      }
      if (sportSlug === "basketball" && Array.isArray(line.statData?.playerStats)) {
        addBasketballTeamLeaderboardRows(map, metrics, line);
        return;
      }
      if (sportSlug === "track-and-field" && Array.isArray(line.statData?.entries)) {
        addTrackFieldTeamLeaderboardRows(map, metrics, line);
        return;
      }
      const data = line.statData || {};
      const id = line.subjectId || line.athleteId || data.athleteId || "";
      if (!id) return;
      const name = line.subjectName || data.playerName || buildAthleteName(resolveAthlete(id)) || "Athlete";
      if (!map.has(String(id))) {
        map.set(String(id), { id, name, entries: 0 });
        metrics.forEach((metric) => { map.get(String(id))[metric.key] = 0; });
      }
      const row = map.get(String(id));
      row.entries += 1;
      metrics.forEach((metric) => { row[metric.key] += extractTeamLeaderboardValue(line, metric.key); });
    });
    const sortKey = metrics[0]?.key || "entries";
    return Array.from(map.values()).sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  }

  function addTeamLeaderboardValue(map, metrics, athleteId, name, values) {
    const id = String(athleteId || "");
    if (!id) return;
    if (!map.has(id)) {
      map.set(id, { id, name: name || buildAthleteName(resolveAthlete(id)) || "Athlete", entries: 0 });
      metrics.forEach((metric) => { map.get(id)[metric.key] = 0; });
    }
    const row = map.get(id);
    row.entries += values.entries || 0;
    metrics.forEach((metric) => {
      row[metric.key] += Number(values[metric.key] || 0);
    });
  }

  function addCricketTeamLeaderboardRows(map, metrics, line) {
    const data = line.statData || {};
    (data.innings || []).forEach((innings) => {
      (innings.batting || []).forEach((batter) => {
        addTeamLeaderboardValue(map, metrics, batter.athleteId, batter.name, { entries: 1, runs: Number(batter.runs || 0) });
        if (batter.fielderAthleteId) {
          addTeamLeaderboardValue(map, metrics, batter.fielderAthleteId, batter.fielderName, { catches: /caught/i.test(String(batter.dismissalMode || batter.howOut || "")) ? 1 : 0 });
        }
      });
      (innings.bowling || []).forEach((bowler) => {
        addTeamLeaderboardValue(map, metrics, bowler.athleteId, bowler.name, { entries: 1, wickets: Number(bowler.wickets || 0) });
      });
    });
  }

  function addFootballTeamLeaderboardRows(map, metrics, line) {
    (line.statData?.playerStats || []).forEach((player) => {
      addTeamLeaderboardValue(map, metrics, player.athleteId, player.name, {
        entries: 1,
        goals: Number(player.goals || 0),
        assists: Number(player.assists || 0),
        goalContributions: Number(player.goals || 0) + Number(player.assists || 0),
        shots: Number(player.shots || 0),
        saves: Number(player.saves || 0),
        yellowCards: Number(player.yellowCards || 0),
        redCards: Number(player.redCards || 0)
      });
    });
  }

  function addBasketballTeamLeaderboardRows(map, metrics, line) {
    (line.statData?.playerStats || []).forEach((player) => {
      addTeamLeaderboardValue(map, metrics, player.athleteId, player.name, {
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

  function addTrackFieldTeamLeaderboardRows(map, metrics, line) {
    const isField = line.statData?.resultType === "field";
    (line.statData?.entries || []).forEach((entry) => {
      if (entry.entryType !== "uwi" || !entry.athleteId) return;
      const place = Number(isField ? entry.finalRank : entry.place);
      addTeamLeaderboardValue(map, metrics, entry.athleteId, entry.name, {
        entries: 1,
        points: Number(entry.points || 0),
        wins: place === 1 ? 1 : 0,
        topThree: place > 0 && place <= 3 ? 1 : 0,
        trackEvents: isField ? 0 : 1,
        fieldEvents: isField ? 1 : 0
      });
    });
  }

  function getTeamLeaderboardMetrics() {
    const sportSlug = APP.normalizeSportSlug(state.team?.sportSlug || state.team?.sport);
    if (sportSlug === "cricket") return [{ key: "runs", label: "Runs" }, { key: "wickets", label: "Wickets" }, { key: "catches", label: "Catches" }];
    if (sportSlug === "football") return [{ key: "goals", label: "Goals" }, { key: "assists", label: "Assists" }, { key: "goalContributions", label: "G+A" }, { key: "shots", label: "Shots" }, { key: "saves", label: "Saves" }, { key: "yellowCards", label: "Yellows" }, { key: "redCards", label: "Reds" }];
    if (sportSlug === "track-and-field") return [{ key: "points", label: "Points" }, { key: "wins", label: "Wins" }, { key: "topThree", label: "Top 3" }, { key: "trackEvents", label: "Track Events" }, { key: "fieldEvents", label: "Field Events" }];
    if (["hockey", "netball"].includes(sportSlug)) return [{ key: "goals", label: "Goals" }, { key: "assists", label: "Assists" }, { key: "saves", label: "Saves" }];
    if (sportSlug === "basketball") return [{ key: "points", label: "Points" }, { key: "rebounds", label: "Rebounds" }, { key: "assists", label: "Assists" }, { key: "steals", label: "Steals" }, { key: "blocks", label: "Blocks" }, { key: "turnovers", label: "Turnovers" }, { key: "threeMade", label: "3PM" }];
    if (sportSlug === "volleyball") return [{ key: "kills", label: "Kills" }, { key: "aces", label: "Aces" }, { key: "blocks", label: "Blocks" }];
    return [{ key: "wins", label: "Wins" }, { key: "points", label: "Points" }, { key: "entries", label: "Entries" }];
  }

  function extractTeamLeaderboardValue(line, key) {
    const data = line.statData || {};
    if (key === "entries") return 1;
    const direct = Number(data[key] ?? line[key] ?? line.statValue);
    if (Number.isFinite(direct)) return direct;
    if (key === "wins") return /win|1st|first/i.test(String(data.result || data.outcome || line.statName || "")) ? 1 : 0;
    return 0;
  }

  function teamLeaderboardPlayerHref(athleteId) {
    const sportSlug = APP.normalizeSportSlug(state.team?.sportSlug || state.team?.sport);
    if (sportSlug === "cricket") return `athlete-cricket-stats.html?athleteId=${encodeURIComponent(athleteId)}`;
    if (sportSlug === "football") return `athlete-football-stats.html?athleteId=${encodeURIComponent(athleteId)}`;
    if (sportSlug === "basketball") return `athlete-basketball-stats.html?athleteId=${encodeURIComponent(athleteId)}`;
    if (sportSlug === "track-and-field") return `athlete-track-field-stats.html?athleteId=${encodeURIComponent(athleteId)}`;
    return `athlete-view.html?athleteId=${encodeURIComponent(athleteId)}`;
  }

  function getTeamCricketScorecards() {
    return state.statLines
      .map(normalizeTeamStatLine)
      .filter((line) => {
        const sportSlug = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
        const teamId = line.teamId || line.statData?.uwiTeamId;
        return sportSlug === "cricket" &&
          String(teamId || "") === String(state.teamId) &&
          (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
      });
  }

  function getTeamMatchScorecards(sportSlug) {
    const normalized = APP.normalizeSportSlug(sportSlug);
    if (normalized === "cricket") return getTeamCricketScorecards();
    if (normalized === "football") {
      return state.statLines
        .map(normalizeTeamStatLine)
        .filter((line) => {
          const lineSport = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
          const teamId = line.teamId || line.statData?.uwiTeamId;
          return lineSport === "football" &&
            String(teamId || "") === String(state.teamId) &&
            (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
        });
    }
    if (normalized === "volleyball") {
      return state.statLines
        .map(normalizeTeamStatLine)
        .filter((line) => {
          const lineSport = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
          const teamId = line.teamId || line.statData?.uwiTeamId;
          return lineSport === "volleyball" &&
            String(teamId || "") === String(state.teamId) &&
            (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
        });
    }
    if (normalized === "hockey") {
      return state.statLines
        .map(normalizeTeamStatLine)
        .filter((line) => {
          const lineSport = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
          const teamId = line.teamId || line.statData?.uwiTeamId;
          return lineSport === "hockey" &&
            String(teamId || "") === String(state.teamId) &&
            (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
        });
    }
    if (normalized === "basketball") {
      return state.statLines
        .map(normalizeTeamStatLine)
        .filter((line) => {
          const lineSport = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
          const teamId = line.teamId || line.statData?.uwiTeamId;
          return lineSport === "basketball" &&
            String(teamId || "") === String(state.teamId) &&
            (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
        });
    }
    if (normalized === "swimming") {
      return state.statLines
        .map(normalizeTeamStatLine)
        .filter((line) => {
          const lineSport = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
          const teamId = line.teamId || line.statData?.uwiTeamId;
          return lineSport === "swimming" &&
            String(teamId || "") === String(state.teamId) &&
            (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
        });
    }
    if (normalized === "track-and-field") {
      return state.statLines
        .map(normalizeTeamStatLine)
        .filter((line) => {
          const lineSport = APP.normalizeSportSlug(line.sportSlug || line.sport || line.statData?.sport || line.statData?.sportSlug || state.team?.sportSlug || state.team?.sport);
          const teamId = line.teamId || line.statData?.uwiTeamId;
          return lineSport === "track-and-field" &&
            String(teamId || "") === String(state.teamId) &&
            (line.eventType === "scorecard" || line.statData?.eventType === "scorecard");
        });
    }
    return [];
  }

  function normalizeTeamStatLine(row) {
    const data = row?.statData && typeof row.statData === "object"
      ? row.statData
      : row?.data?.statData && typeof row.data.statData === "object"
        ? row.data.statData
        : row?.data && typeof row.data === "object"
          ? row.data
          : {};
    return {
      ...row,
      ...data,
      id: row.id,
      competitionId: row.competitionId || data.competitionId,
      teamId: row.teamId || data.teamId || data.uwiTeamId,
      sport: row.sport || data.sport,
      sportSlug: row.sportSlug || data.sportSlug,
      eventType: row.eventType || data.eventType,
      eventName: row.eventName || data.eventName || data.title,
      date: row.date || data.date || row.createdAt,
      statData: data
    };
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

  function renderTeamResultCard(line) {
    const data = line.statData || {};
    const innings = Array.isArray(data.innings) ? data.innings : [];
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.venue].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.title || "Cricket match"))}</div>
        ${innings.slice(0, 2).map((entry) => `
          <div class="result-team-row">
            <span>${escapeHtml(compactUwiTeamLabel(entry.team, "Team"))}</span>
            <strong>${escapeHtml(formatInningsScore(entry))}</strong>
          </div>
        `).join("")}
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="cricket-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Scorecard</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function renderTeamFootballResultCard(line) {
    const data = line.statData || {};
    const goals = Array.isArray(data.goals) ? data.goals : [];
    const scorerLine = goals.length ? goals.map((goal) => `${escapeHtml(goal.scorerName || (goal.team === "uwi" ? "UWI player" : "Opponent"))} ${escapeHtml(goal.minute ?? "")}'`).join("<br>") : "No goalscorers recorded.";
    const score = data.score || {};
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.location].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.title || "Football match"))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(score.uwi?.total ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(score.opponent?.total ?? 0)}</strong></div>
        <p class="result-text">${scorerLine}</p>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="football-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Match Details</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function renderTeamVolleyballResultCard(line) {
    const data = line.statData || {};
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.site].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.title || "Volleyball match"))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(data.finalSets?.uwi ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(data.finalSets?.opponent ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="volleyball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Scoresheet</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function renderTeamHockeyResultCard(line) {
    const data = line.statData || {};
    const score = data.score || {};
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.arena].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.title || "Hockey match"))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(score.uwi?.total ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(score.opponent?.total ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="hockey-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function renderTeamBasketballResultCard(line) {
    const data = line.statData || {};
    const score = data.score || {};
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.playedAt].filter(Boolean).join("  •  ");
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.title || "Basketball match"))}</div>
        <div class="result-team-row"><span>${escapeHtml(compactUwiTeamLabel(data.uwiTeamName))}</span><strong>${escapeHtml(score.uwi?.total ?? 0)}</strong></div>
        <div class="result-team-row"><span>${escapeHtml(data.opponentName || "Opponent")}</span><strong>${escapeHtml(score.opponent?.total ?? 0)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.result || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="basketball-scorecard-view.html?scorecardId=${encodeURIComponent(line.id)}">View Score Sheet</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function renderTeamSwimmingResultCard(line) {
    const data = line.statData || {};
    const lanes = Array.isArray(data.lanes) ? data.lanes : [];
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.session].filter(Boolean).join("  •  ");
    const topUwi = lanes
      .filter((lane) => lane.entryType === "uwi" && lane.finalTime && !lane.dq)
      .sort((a, b) => Number(a.place || 999) - Number(b.place || 999))[0];
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>Result</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.eventName || "Swimming event"))}</div>
        <div class="result-team-row"><span>${escapeHtml(topUwi?.name || compactUwiTeamLabel(data.uwiTeamName, "UWI"))}</span><strong>${escapeHtml(topUwi?.finalTime || data.summary?.winningTime || "—")}</strong></div>
        <div class="result-team-row"><span>UWI Entries</span><strong>${escapeHtml(data.summary?.uwiEntries ?? lanes.filter((lane) => lane.entryType === "uwi").length)}</strong></div>
        <p class="result-text">${escapeHtml([data.round, data.course, data.ageGroup].filter(Boolean).join(" • ") || "Results recorded")}</p>
        <div class="result-card-actions">
          <a href="swimming-results-view.html?scorecardId=${encodeURIComponent(line.id)}">View Results Sheet</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function renderTeamTrackFieldResultCard(line) {
    const data = line.statData || {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const competition = state.competitions.find((item) => String(item.id || item.competitionId) === String(line.competitionId));
    const meta = [competition?.title || competition?.name || "Competition", data.division, data.round].filter(Boolean).join("  â€¢  ");
    const topUwi = entries
      .filter((entry) => entry.entryType === "uwi")
      .sort((a, b) => data.resultType === "field" ? Number(a.finalRank || 999) - Number(b.finalRank || 999) : Number(a.place || 999) - Number(b.place || 999))[0];
    const result = data.resultType === "field" ? topUwi?.best : topUwi?.time;
    return `
      <article class="result-card">
        <div class="result-card-top">
          <span>${escapeHtml(data.resultType === "field" ? "Field" : "Track")}</span>
          <small>${escapeHtml(meta)}</small>
        </div>
        <div class="result-card-title">${escapeHtml(compactUwiResultLabel(line.eventName || data.eventName || "Track and field event"))}</div>
        <div class="result-team-row"><span>${escapeHtml(topUwi?.name || "Top UWI")}</span><strong>${escapeHtml(result || "â€”")}</strong></div>
        <div class="result-team-row"><span>UWI Entries</span><strong>${escapeHtml(data.summary?.uwiEntries ?? entries.filter((entry) => entry.entryType === "uwi").length)}</strong></div>
        <p class="result-text">${escapeHtml(compactUwiResultLabel(data.summary?.topUwiResult || data.summary?.winningResult || "Result recorded"))}</p>
        <div class="result-card-actions">
          <a href="track-field-results-view.html?scorecardId=${encodeURIComponent(line.id)}">View Results Sheet</a>
          <a href="competition-view.html?id=${encodeURIComponent(line.competitionId)}">Competition</a>
        </div>
      </article>
    `;
  }

  function formatInningsScore(innings) {
    if (!innings || (!innings.total && innings.total !== 0)) return "-";
    const wickets = innings.wickets === null || innings.wickets === undefined || innings.wickets === "" ? "" : `/${innings.wickets}`;
    const declared = innings.declared ? "d" : "";
    const overs = innings.overs ? ` (${innings.overs} ov)` : "";
    return `${innings.total}${wickets}${declared}${overs}`;
  }

  function populateSquadSelectors() {
    if (els.athleteSelect) {
      const availableAthletes = state.allAthletes
        .filter(function (athlete) {
          const athleteCampus = normalizeCampus(athlete.campus || state.session?.campus);
          return athleteCampus === normalizeCampus(state.session?.campus);
        })
        .sort(function (a, b) {
          return buildAthleteName(a).localeCompare(buildAthleteName(b));
        });

      els.athleteSelect.innerHTML = `
        <option value="">Select athlete</option>
        ${availableAthletes.map(function (athlete) {
          return `<option value="${escapeHtml(String(athlete.id || ""))}">${escapeHtml(buildAthleteName(athlete) || "Athlete")}</option>`;
        }).join("")}
      `;
    }

    if (els.coachSelect) {
      const availableCoaches = state.allCoaches
        .filter(function (coach) {
          const coachCampus = normalizeCampus(coach.campus || state.session?.campus);
          return coachCampus === normalizeCampus(state.session?.campus);
        })
        .sort(function (a, b) {
          return buildCoachName(a).localeCompare(buildCoachName(b));
        });

      els.coachSelect.innerHTML = `
        <option value="">Select coach/staff</option>
        ${availableCoaches.map(function (coach) {
          return `<option value="${escapeHtml(String(coach.id || ""))}">${escapeHtml(buildCoachName(coach) || "Coach")}</option>`;
        }).join("")}
      `;
    }
  }

  function validateTeamCampus() {
    const sessionCampus = normalizeCampus(state.session?.campus);
    const teamCampus = normalizeCampus(state.team?.campus || state.team?.campusSlug || sessionCampus);

    if (sessionCampus && teamCampus && sessionCampus !== teamCampus) {
      throw new Error("This team record does not belong to the signed-in campus.");
    }
  }

  function normalizeRosterArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.assignments)) return payload.assignments;
    if (Array.isArray(payload?.rosterAssignments)) return payload.rosterAssignments;
    if (Array.isArray(payload?.roster)) return payload.roster;
    if (Array.isArray(payload?.data?.assignments)) return payload.data.assignments;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeStaffArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.assignments)) return payload.assignments;
    if (Array.isArray(payload?.staffAssignments)) return payload.staffAssignments;
    if (Array.isArray(payload?.staff)) return payload.staff;
    if (Array.isArray(payload?.data?.assignments)) return payload.data.assignments;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeCompetitionsArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.competitions)) return payload.competitions;
    if (Array.isArray(payload?.data?.competitions)) return payload.data.competitions;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeResultsArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.data?.results)) return payload.data.results;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeStatLinesArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.statLines)) return payload.statLines;
    if (Array.isArray(payload?.data?.statLines)) return payload.data.statLines;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeAthletesArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.athletes)) return payload.athletes;
    if (Array.isArray(payload?.data?.athletes)) return payload.data.athletes;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeCoachesArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.coaches)) return payload.coaches;
    if (Array.isArray(payload?.data?.coaches)) return payload.data.coaches;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function collapseStaffAssignments(assignments) {
    const map = new Map();
    assignments.forEach(function (assignment) {
      const coachId = String(assignment.coachId || assignment.staffId || assignment.coach?.id || "");
      const key = `${assignment.teamId || state.teamId}:${coachId}`;
      if (!coachId || !key) return;
      const role = assignment.role || assignment.roleLabel || assignment.assignmentRole || "";
      if (!map.has(key)) {
        map.set(key, {
          ...assignment,
          roles: role ? [role] : [],
          isPrimary: Boolean(assignment.isPrimary)
        });
        return;
      }
      const current = map.get(key);
      if (role && !current.roles.includes(role)) current.roles.push(role);
      current.isPrimary = Boolean(current.isPrimary || assignment.isPrimary);
      current.status = current.status === "active" || assignment.status === "active" ? "active" : current.status || assignment.status;
    });
    return Array.from(map.values());
  }

  function resolveAthlete(athleteId) {
    return state.allAthletes.find(function (athlete) {
      return String(athlete.id) === String(athleteId);
    }) || null;
  }

  function resolveCoach(coachId) {
    return state.allCoaches.find(function (coach) {
      return String(coach.id) === String(coachId);
    }) || null;
  }

  function buildCoachName(coach) {
    if (!coach) return "";
    const fullName = String(coach.fullName || "").trim();
    if (fullName) return fullName;
    return `${coach.firstName || ""} ${coach.lastName || ""}`.trim();
  }

  function buildAthleteName(athlete) {
    if (!athlete) return "";
    const fullName = String(athlete.fullName || "").trim();
    if (fullName) return fullName;
    return `${athlete.firstName || ""} ${athlete.lastName || ""}`.trim();
  }

  function countResultsByOutcome(target) {
    return state.results.filter(function (result) {
      return normalizeText(result.outcome) === normalizeText(target);
    }).length;
  }

  function countUniqueValues(values) {
    return new Set(values.filter(Boolean).map(String)).size;
  }

  function dedupeBy(items, keyFn) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getSportName(value) {
    if (typeof APP.getSportName === "function") {
      return APP.getSportName(value);
    }

    const raw = String(value || "").trim();
    if (!raw) return "Sport not set";

    const normalizedSlug = raw.toLowerCase().replace(/\s+/g, "-");
    const match = SPORT_REGISTRY.find(function (sport) {
      return sport.slug === normalizedSlug || sport.name.toLowerCase() === raw.toLowerCase();
    });

    return match ? match.name : raw;
  }

  function normalizeCampus(value) {
    return APP.normalizeCampus(value);
  }

  function formatCampusLabel(campus) {
    return APP.getCampusMeta(normalizeCampus(campus)).name;
  }

  function formatStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized) return "Not set";

    switch (normalized) {
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "archived":
        return "Archived";
      case "pending":
        return "Pending";
      default:
        return toTitleCase(normalized.replace(/_/g, " "));
    }
  }

  function formatRole(role, otherTitle) {
    const normalized = String(role || "").trim().toLowerCase();

    switch (normalized) {
      case "head_coach":
      case "head coach":
        return "Head Coach";
      case "assistant_coach":
      case "assistant coach":
        return "Assistant Coach";
      case "strength_conditioning_coach":
      case "strength & conditioning coach":
      case "strength and conditioning coach":
        return "Strength & Conditioning Coach";
      case "physio":
        return "Physio";
      case "manager":
        return "Manager";
      case "analyst":
        return "Analyst";
      case "team_staff":
      case "team staff":
        return "Team Staff";
      case "other":
        return otherTitle || "Other";
      default:
        return role ? toTitleCase(String(role).replace(/_/g, " ")) : "—";
    }
  }

  function formatGenericStatus(status) {
    if (!status) return "—";
    return toTitleCase(String(status).replace(/_/g, " ").toLowerCase());
  }

  function formatResult(result) {
    if (!result) return "—";
    if (result.mark) return String(result.mark);
    if (result.time) return String(result.time);
    if (result.best) return String(result.best);
    if (result.scoreFor != null && result.scoreAgainst != null) {
      return `${result.scoreFor}-${result.scoreAgainst}`;
    }
    return String(result.value || result.result || "—");
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toTitleCase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      });
  }

  function detailCard(label, value) {
    return `
      <div class="detail-item">
        <span class="detail-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "—")}</strong>
      </div>
    `;
  }

  function emptyStateMarkup(title, body) {
    return `
      <div class="empty-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
    `;
  }

  function setSquadMessage(text, type) {
    if (!els.squadMessage) return;
    els.squadMessage.className = "message";
    els.squadMessage.textContent = text || "";
    if (text && type) {
      els.squadMessage.classList.add(type, "is-visible");
    }
  }

  function clearMessage(node) {
    if (!node) return;
    node.className = "message";
    node.textContent = "";
  }

  function setError(node, text) {
    if (!node) return;
    node.className = "message error is-visible";
    node.textContent = text || "";
  }

  function setField(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value == null ? "" : String(value);
  }

  function getField(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function normalizeStatus(value) {
    return String(value || "").toLowerCase().includes("inactive") ? "inactive" : "active";
  }

  function setEditMessage(text, type) {
    if (!els.teamEditMessage) return;
    els.teamEditMessage.className = "message";
    els.teamEditMessage.textContent = text || "";
    if (text && type) els.teamEditMessage.classList.add(type, "is-visible");
  }



  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
