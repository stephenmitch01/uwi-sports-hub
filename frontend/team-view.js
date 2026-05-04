(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const SPORT_REGISTRY = APP.SPORT_REGISTRY || [];

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
    allCoaches: []
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

    rosterCountStat: document.getElementById("rosterCountStat"),
    staffCountStat: document.getElementById("staffCountStat"),
    competitionCountStat: document.getElementById("competitionCountStat"),
    resultCountStat: document.getElementById("resultCountStat"),
    primarySportStat: document.getElementById("primarySportStat"),
    seasonStat: document.getElementById("seasonStat"),

    teamIdentity: document.getElementById("teamIdentity"),
    teamStaff: document.getElementById("teamStaff"),
    teamRoster: document.getElementById("teamRoster"),
    teamCompetitions: document.getElementById("teamCompetitions"),
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
      teamData?.team ||
      teamData?.data?.team ||
      teamData?.data ||
      null;

    state.roster = normalizeRosterArray(rosterData);
    state.staff = normalizeStaffArray(staffData);
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
    renderTeamPerformance();
    populateSquadSelectors();
  }

  async function handleAddAthleteToTeam(event) {
    event.preventDefault();
    setSquadMessage("", "");

    const athleteId = (els.athleteSelect?.value || "").trim();
    const roleLabel = (els.athleteRole?.value || "").trim();
    const jerseyNumber = (els.athleteJersey?.value || "").trim();

    if (!athleteId) {
      setSquadMessage("Select an athlete before adding to the squad.", "error");
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

    if (els.teamNameHeading) els.teamNameHeading.textContent = "Team Not Found";
    if (els.teamSubtitle) els.teamSubtitle.textContent = "The selected team could not be loaded.";
    if (els.teamStatusPill) els.teamStatusPill.textContent = "Unavailable";
  }

  function renderLoadFailure(error) {
    const message = error?.message || "Team data could not be loaded from the backend.";

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

    setSquadMessage("Some or all team-view endpoints are not ready yet.", "error");
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

      return `
        <tr>
          <td>${coachId ? `<a href="coach-view.html?id=${encodeURIComponent(String(coachId))}">${escapeHtml(coachName)}</a>` : escapeHtml(coachName)}</td>
          <td>${escapeHtml(formatRole(assignment.role || assignment.roleLabel || assignment.assignmentRole, assignment.otherRoleTitle))}</td>
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
        "Add athletes to this team using the squad management form."
      );
      return;
    }

    const rows = state.roster.map(function (assignment) {
      const athleteId = assignment.athleteId || assignment.athlete?.id || "";
      const athlete = resolveAthlete(athleteId) || assignment.athlete || null;
      const athleteName = buildAthleteName(athlete) || assignment.athleteName || "Unknown Athlete";

      return `
        <tr>
          <td>${athleteId ? `<a href="athlete-view.html?athleteId=${encodeURIComponent(String(athleteId))}">${escapeHtml(athleteName)}</a>` : escapeHtml(athleteName)}</td>
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

      ${resultRows}
    `;
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
    if (Array.isArray(payload?.assignments)) return payload.assignments;
    if (Array.isArray(payload?.rosterAssignments)) return payload.rosterAssignments;
    if (Array.isArray(payload?.roster)) return payload.roster;
    if (Array.isArray(payload?.data?.assignments)) return payload.data.assignments;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeStaffArray(payload) {
    if (Array.isArray(payload?.assignments)) return payload.assignments;
    if (Array.isArray(payload?.staffAssignments)) return payload.staffAssignments;
    if (Array.isArray(payload?.staff)) return payload.staff;
    if (Array.isArray(payload?.data?.assignments)) return payload.data.assignments;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeCompetitionsArray(payload) {
    if (Array.isArray(payload?.competitions)) return payload.competitions;
    if (Array.isArray(payload?.data?.competitions)) return payload.data.competitions;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeResultsArray(payload) {
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.data?.results)) return payload.data.results;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeStatLinesArray(payload) {
    if (Array.isArray(payload?.statLines)) return payload.statLines;
    if (Array.isArray(payload?.data?.statLines)) return payload.data.statLines;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeAthletesArray(payload) {
    if (Array.isArray(payload?.athletes)) return payload.athletes;
    if (Array.isArray(payload?.data?.athletes)) return payload.data.athletes;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function normalizeCoachesArray(payload) {
    if (Array.isArray(payload?.coaches)) return payload.coaches;
    if (Array.isArray(payload?.data?.coaches)) return payload.data.coaches;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
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



  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();