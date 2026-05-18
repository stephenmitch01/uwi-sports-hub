(function () {
  "use strict";

  // Shared App Access
  /**
   * Team registry workflow.
   *
   * Teams bridge athlete assignments, staff assignments, and competition
   * results. Create/edit actions save backend records that downstream pages can
   * join by stable team IDs.
   */
  const APP = window.UWISportsHub;
  if (!APP) throw new Error("APP not initialized");
  // Shared Registries
  const SPORT_REGISTRY = APP.SPORT_REGISTRY || [];
  const apiGet = APP.apiGet.bind(APP);
  const apiPost = APP.apiPost.bind(APP);
  const apiPatch = APP.apiPatch.bind(APP);

  // Page State
  const state = {
    session: null,
    teams: [],
    athletes: [],
    coaches: [],
    registrySearchApplied: false
  };

  // Page Elements
  const els = {
    campusNameNodes: Array.from(document.querySelectorAll("[data-campus-name]")),

    teamsTableBody: document.getElementById("teamsTableBody"),
    teamSearch: document.getElementById("teamSearch"),
    teamSport: document.getElementById("teamSport"),
    teamStatus: document.getElementById("teamStatus"),
    teamSeasonFilter: document.getElementById("teamSeasonFilter"),
    teamQualityFilter: document.getElementById("teamQualityFilter"),
    teamSearchButton: document.getElementById("teamSearchButton"),
    pageMessageEl: document.getElementById("teamsPageMessage"),
    totalTeamsStat: document.getElementById("totalTeamsStat"),
    activeTeamsStat: document.getElementById("activeTeamsStat"),
    teamSportsStat: document.getElementById("teamSportsStat"),
    averageRosterStat: document.getElementById("averageRosterStat"),
    teamsWithoutCoachStat: document.getElementById("teamsWithoutCoachStat"),
    teamAlerts: document.getElementById("teamAlerts"),
    teamActivity: document.getElementById("teamActivity"),
    teamQualityScore: document.getElementById("teamQualityScore"),
    teamQualityBar: document.getElementById("teamQualityBar"),
    teamQualityCopy: document.getElementById("teamQualityCopy"),

    createForm: document.getElementById("teamCreateForm"),
    createTeamName: document.getElementById("createTeamName"),
    createTeamSport: document.getElementById("createTeamSport"),
    createTeamDivision: document.getElementById("createTeamDivision"),
    createTeamSeason: document.getElementById("createTeamSeason"),
    createTeamStatus: document.getElementById("createTeamStatus"),
    createTeamNotes: document.getElementById("createTeamNotes"),

    editForm: document.getElementById("teamEditForm"),
    editTeamSelect: document.getElementById("editTeamSelect"),
    editTeamName: document.getElementById("editTeamName"),
    editTeamSport: document.getElementById("editTeamSport"),
    editTeamDivision: document.getElementById("editTeamDivision"),
    editTeamSeason: document.getElementById("editTeamSeason"),
    editTeamStatus: document.getElementById("editTeamStatus"),
    editTeamNotes: document.getElementById("editTeamNotes")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    bindEvents();
    bindInsightActions();
    bindWorkflowLinks();
    bindWorkflowClose();
    populateSportSelects();
    ensureArchivedQualityOption(els.teamQualityFilter);
    clearMessage();

    try {
      const session = await APP.mountSignedInShell({
        active: "teams",
        contextLabel: "Teams"
      });
      if (!session) {
        window.location.href = "index.html";
        return;
      }

      state.session = session;
      applyCampusLabels();

      await refreshTeams();
    } catch (error) {
      console.error("Teams page init error:", error);
      state.teams = [];
      renderTeamEditSelect();
      renderTeamsTable();
      setMessage(error.message || "Failed to load team data.", "error");
    }
  }

  // Event Wiring
  /**
   * Centralizes event wiring so rendering functions can rebuild dynamic controls safely.
   */
  function bindEvents() {
    if (els.createForm) {
      els.createForm.addEventListener("submit", handleCreateTeam);
    }

    if (els.editTeamSelect) {
      els.editTeamSelect.addEventListener("change", function () {
        loadSelectedTeamIntoForm(els.editTeamSelect.value);
      });
    }

    if (els.editForm) {
      els.editForm.addEventListener("submit", handleEditTeam);
    }

    [els.teamSearch, els.teamSport, els.teamStatus, els.teamSeasonFilter, els.teamQualityFilter].forEach(function (node) {
      if (!node) return;
      node.addEventListener("input", handleFilterChange);
      node.addEventListener("change", handleFilterChange);
    });
    if (els.teamSearchButton) els.teamSearchButton.addEventListener("click", applyRegistrySearch);
    mountRecentSearches("teams");
  }

  // Workflow: Filter Change
  /**
   * Handles the filter change workflow and keeps side effects inside the intended API/action path.
   */
  function handleFilterChange() {
    const panel = document.getElementById("teamsListPanel");
    if (hasActiveRegistryFilter() && panel) panel.open = true;
    state.registrySearchApplied = false;
  }

  function applyRegistrySearch() {
    const panel = document.getElementById("teamsListPanel");
    if (panel) panel.open = true;
    state.registrySearchApplied = true;
    saveCurrentSearch("teams");
    mountRecentSearches("teams");
    renderTeamsTable();
  }

  // Event Wiring
  /**
   * Binds the workflow links interactions once so rerenders do not duplicate listeners.
   */
  function bindWorkflowLinks() {
    document.querySelectorAll("a[href='#teamWorkflows']").forEach(function (link) {
      link.addEventListener("click", function () {
        const panel = document.getElementById("teamWorkflows");
        if (panel) {
          panel.hidden = false;
          panel.open = true;
        }
      });
    });
  }

  // Event Wiring
  /**
   * Binds the workflow close interactions once so rerenders do not duplicate listeners.
   */
  function bindWorkflowClose() {
    const panel = document.getElementById("teamWorkflows");
    if (!panel) return;
    panel.addEventListener("toggle", function () {
      if (!panel.open) panel.hidden = true;
    });
  }

  function applyCampusLabels() {
    const campusLabel = formatCampus(state.session?.campus);
    els.campusNameNodes.forEach(function (node) {
      node.textContent = campusLabel;
    });
  }

  // Edit Form Prefill
  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateSportSelects() {
    const sportOptions = SPORT_REGISTRY.map(function (sport) {
      return `<option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>`;
    }).join("");

    if (els.createTeamSport) {
      els.createTeamSport.innerHTML = `<option value="">Select sport</option>${sportOptions}`;
    }

    if (els.editTeamSport) {
      els.editTeamSport.innerHTML = `<option value="">Select sport</option>${sportOptions}`;
    }

    if (els.teamSport) {
      els.teamSport.innerHTML = `<option value="">All sports</option>${sportOptions}`;
    }
  }

  async function refreshTeams() {
    const [data, athletesData, coachesData] = await Promise.all([
      apiGet("/teams?includeArchived=true"),
      apiGet("/athletes?includeArchived=true", true),
      apiGet("/coaches?includeArchived=true", true)
    ]);
    state.teams =
      Array.isArray(data) ? data :
      Array.isArray(data?.teams) ? data.teams :
      Array.isArray(data?.data?.teams) ? data.data.teams :
      Array.isArray(data?.data) ? data.data :
      [];

    state.athletes =
      Array.isArray(athletesData) ? athletesData :
      Array.isArray(athletesData?.athletes) ? athletesData.athletes :
      Array.isArray(athletesData?.data?.athletes) ? athletesData.data.athletes :
      Array.isArray(athletesData?.data) ? athletesData.data :
      [];

    state.coaches =
      Array.isArray(coachesData) ? coachesData :
      Array.isArray(coachesData?.coaches) ? coachesData.coaches :
      Array.isArray(coachesData?.data?.coaches) ? coachesData.data.coaches :
      Array.isArray(coachesData?.data) ? coachesData.data :
      [];

    renderHeroStats();
    renderOperationalSummary();
    renderTeamEditSelect();
    renderTeamsTable();
  }

  // Hero Stats
  /**
   * Renders the hero stats section from normalized page state without mutating backend data.
   */
  function renderHeroStats() {
    const teams = getFilteredCampusTeams();
    const rosterCounts = teams.map((team) => getTeamAthletes(team.id).length);
    const averageRoster = rosterCounts.length
      ? Math.round(rosterCounts.reduce((sum, count) => sum + count, 0) / rosterCounts.length)
      : 0;
    const withoutCoach = teams.filter((team) => !getTeamCoaches(team.id).length).length;

    if (els.totalTeamsStat) els.totalTeamsStat.textContent = String(teams.length);
    if (els.activeTeamsStat) els.activeTeamsStat.textContent = String(teams.filter((team) => normalizeStatus(team.status) !== "inactive").length);
    if (els.teamSportsStat) els.teamSportsStat.textContent = String(new Set(teams.map((team) => team.sportSlug || team.sport).filter(Boolean)).size);
    if (els.averageRosterStat) els.averageRosterStat.textContent = String(averageRoster);
    if (els.teamsWithoutCoachStat) els.teamsWithoutCoachStat.textContent = String(withoutCoach);
  }

  // Operational Summary
  /**
   * Renders the operational summary section from normalized page state without mutating backend data.
   */
  function renderOperationalSummary() {
    const teams = getFilteredCampusTeams();
    const withoutCoach = teams.filter((team) => !getTeamCoaches(team.id).length);
    const emptyRosters = teams.filter((team) => !getTeamAthletes(team.id).length);
    const missingSport = teams.filter((team) => !(team.sport || team.sportSlug));
    const quality = teams.length
      ? Math.round(teams.reduce((sum, team) => sum + getTeamQuality(team), 0) / teams.length)
      : 0;

    renderInsightList(els.teamAlerts, [
      { label: "Teams without coach", value: withoutCoach.length, target: "teamsListPanel", filter: "incomplete" },
      { label: "Teams without athletes", value: emptyRosters.length, target: "teamsListPanel", filter: "incomplete" },
      { label: "Teams missing sport", value: missingSport.length, target: "teamsListPanel", filter: "incomplete" }
    ], "No team alerts right now.");

    renderActivityList(els.teamActivity, getRecentRecords(teams, "team"));
    renderQuality(els.teamQualityScore, els.teamQualityBar, els.teamQualityCopy, quality, `${teams.filter((team) => getTeamQuality(team) < 100).length} team setup${teams.length === 1 ? "" : "s"} below 100% completion.`);
  }

  function getTeamQuality(team) {
    const checks = [
      team.name || team.teamName,
      team.sport || team.sportSlug,
      team.division,
      team.seasonLabel || team.season,
      team.status,
      getTeamAthletes(team.id).length,
      getTeamCoaches(team.id).length
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  // Workflow: Create Team
  /**
   * Handles the create team workflow and keeps side effects inside the intended API/action path.
   */
  async function handleCreateTeam(event) {
    event.preventDefault();
    clearMessage();

    const payload = {
      name: (els.createTeamName?.value || "").trim(),
      sport: (els.createTeamSport?.value || "").trim(),
      division: (els.createTeamDivision?.value || "").trim() || null,
      seasonLabel: (els.createTeamSeason?.value || "").trim() || null,
      notes: (els.createTeamNotes?.value || "").trim() || null,
      status: normalizeOutgoingStatus((els.createTeamStatus?.value || "").trim()),
      campus: normalizeCampus(state.session?.campus)
    };

    if (!payload.name || !payload.sport) {
      setMessage("Enter the team name and sport.", "error");
      return;
    }

    const duplicate = APP.findSimilarRecord(state.teams, payload, { type: "team" });
    if (duplicate) {
      const action = APP.promptDuplicateAction(duplicate, "team");
      if (action === "cancel") return;
      if (action === "use-existing" || action === "edit-existing") {
        window.location.href = `team-view.html?teamId=${encodeURIComponent(duplicate.id)}`;
        return;
      }
    }

    const ok = await saveTeam(payload);
    if (!ok) return;

    els.createForm?.reset();
    populateSportSelects();
    await refreshTeams();
    setMessage("Team created successfully.", "success");
  }

  // Workflow: Edit Team
  /**
   * Persists team edits used by roster, staff, competition, and result projections.
   */
  async function handleEditTeam(event) {
    event.preventDefault();
    clearMessage();

    const teamId = (els.editTeamSelect?.value || "").trim();

    if (!teamId) {
      setMessage("Select a team to edit.", "error");
      return;
    }

    const payload = {
      name: (els.editTeamName?.value || "").trim(),
      sport: (els.editTeamSport?.value || "").trim(),
      division: (els.editTeamDivision?.value || "").trim() || null,
      seasonLabel: (els.editTeamSeason?.value || "").trim() || null,
      notes: (els.editTeamNotes?.value || "").trim() || null,
      status: normalizeOutgoingStatus((els.editTeamStatus?.value || "").trim())
    };

    if (!payload.name || !payload.sport) {
      setMessage("Enter the team name and sport.", "error");
      return;
    }

    const ok = await saveTeam(payload, teamId);
    if (!ok) return;

    await refreshTeams();
    renderTeamEditSelect(teamId);
    setMessage("Team updated successfully.", "success");
  }

  async function saveTeam(payload, teamId) {
    try {
      if (teamId) {
        const existing = state.teams.find((team) => String(team.id) === String(teamId));
        await apiPatch(`/teams/${encodeURIComponent(teamId)}`, { ...payload, updatedAt: existing?.updatedAt });
      } else {
        await apiPost("/teams", payload);
      }
      return true;
    } catch (error) {
      console.error("saveTeam error:", error);
      setMessage(error.message || "Unable to connect to the teams API.", "error");
      return false;
    }
  }

  // Team Edit Select
  /**
   * Renders the team edit select section from normalized page state without mutating backend data.
   */
  function renderTeamEditSelect(selectedTeamId) {
    if (!els.editTeamSelect) return;

    const teams = getFilteredCampusTeams();

    if (!teams.length) {
      els.editTeamSelect.innerHTML = `<option value="">No teams available</option>`;
      clearEditForm();
      return;
    }

    els.editTeamSelect.innerHTML = `
      <option value="">Select team</option>
      ${teams.map(function (team) {
        const teamId = String(team.id || "");
        const selected = String(selectedTeamId || "") === teamId ? "selected" : "";
        const teamName = team.name || team.teamName || "Unnamed Team";
        return `<option value="${escapeHtml(teamId)}" ${selected}>${escapeHtml(teamName)}</option>`;
      }).join("")}
    `;

    if (selectedTeamId) {
      loadSelectedTeamIntoForm(selectedTeamId);
    } else {
      clearEditForm();
    }
  }

  // Data Loading
  /**
   * Loads selected team into form data required by later normalization and rendering steps.
   */
  function loadSelectedTeamIntoForm(teamId) {
    const team = state.teams.find(function (item) {
      return String(item.id) === String(teamId);
    });

    if (!team) {
      clearEditForm();
      return;
    }

    if (els.editTeamName) els.editTeamName.value = team.name || team.teamName || "";
    if (els.editTeamSport) els.editTeamSport.value = team.sport || team.sportSlug || "";
    if (els.editTeamDivision) els.editTeamDivision.value = team.division || "";
    if (els.editTeamSeason) els.editTeamSeason.value = team.seasonLabel || team.season || "";
    if (els.editTeamStatus) els.editTeamStatus.value = normalizeStatus(team.status);
    if (els.editTeamNotes) els.editTeamNotes.value = team.notes || "";
  }

  function clearEditForm() {
    [
      els.editTeamName,
      els.editTeamDivision,
      els.editTeamSeason,
      els.editTeamNotes
    ].forEach(function (field) {
      if (field) field.value = "";
    });

    if (els.editTeamSport) els.editTeamSport.value = "";
    if (els.editTeamStatus) els.editTeamStatus.value = "active";
  }

  // Teams Table
  /**
   * Renders the teams table section from normalized page state without mutating backend data.
   */
  function renderTeamsTable() {
    if (!els.teamsTableBody) return;

    if (!state.registrySearchApplied) {
      els.teamsTableBody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state">
              <h3>Search team records.</h3>
              <p>Click Search to show all teams, or choose filters for a focused list.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const teams = getFilteredTeams();

    if (!teams.length) {
      els.teamsTableBody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state">
              <h3>No teams found</h3>
              <p>There are no teams matching the current campus and filter selection.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    els.teamsTableBody.innerHTML = teams.map(function (team) {
      const teamId = String(team.id || "");
      const campusLabel = formatCampus(team.campus || state.session?.campus);
      const statusLabel = normalizeStatus(team.status) === "inactive" ? "Inactive" : "Active";
      const sportName = getSportName(team.sport || team.sportSlug);

      return `
        <tr>
          <td><strong>${escapeHtml(team.name || team.teamName || "Unnamed Team")}</strong></td>
          <td>${escapeHtml(sportName || "—")}</td>
          <td>${escapeHtml(team.division || "—")}</td>
          <td>${escapeHtml(team.seasonLabel || team.season || "—")}</td>
          <td>${escapeHtml(statusLabel)}</td>
          <td>${escapeHtml(campusLabel)}</td>
          <td>${escapeHtml(team.notes || "—")}</td>
          <td>${completenessMarkup(getTeamQuality(team))}</td>
          <td>
            <a class="btn btn-campus" href="team-view.html?id=${encodeURIComponent(teamId)}">Open</a>
          </td>
        </tr>
      `;
    }).join("");
  }

  function getFilteredCampusTeams() {
    const campus = normalizeCampus(state.session?.campus);
    return state.teams
      .filter(function (team) {
        return normalizeCampus(team.campus || state.session?.campus) === campus && !APP.isArchivedRecord(team);
      })
      .sort(function (a, b) {
        return String(a.name || a.teamName || "").localeCompare(String(b.name || b.teamName || ""));
      });
  }

  function getTeamAthletes(teamId) {
    return state.athletes.filter(function (athlete) {
      return APP.athleteHasTeam(athlete, teamId);
    });
  }

  function getTeamCoaches(teamId) {
    return state.coaches.filter(function (coach) {
      const assignments = Array.isArray(coach.assignments) ? coach.assignments
        : Array.isArray(coach.teamAssignments) ? coach.teamAssignments
          : Array.isArray(coach.staffAssignments) ? coach.staffAssignments
            : [];
      return assignments.some((assignment) => String(assignment.teamId || "") === String(teamId));
    });
  }

  function getFilteredTeams() {
    const campusTeams = state.teams.filter(function (team) {
      return normalizeCampus(team.campus || state.session?.campus) === normalizeCampus(state.session?.campus);
    });

    const searchValue = String(els.teamSearch?.value || "").trim().toLowerCase();
    const sportValue = String(els.teamSport?.value || "").trim().toLowerCase();
    const statusValue = String(els.teamStatus?.value || "").trim().toLowerCase();
    const seasonValue = String(els.teamSeasonFilter?.value || "").trim().toLowerCase();
    const qualityValue = String(els.teamQualityFilter?.value || "").trim().toLowerCase();

    return campusTeams.filter(function (team) {
      const name = String(team.name || team.teamName || "").toLowerCase();
      const sport = String(team.sport || team.sportSlug || "").toLowerCase();
      const division = String(team.division || "").toLowerCase();
      const notes = String(team.notes || "").toLowerCase();
      const season = String(team.seasonLabel || team.season || "").toLowerCase();
      const status = normalizeStatus(team.status);
      const archived = APP.isArchivedRecord(team);

      const matchesSearch =
        !searchValue ||
        name.includes(searchValue) ||
        division.includes(searchValue) ||
        season.includes(searchValue) ||
        notes.includes(searchValue);

      const matchesSport = !sportValue || sport === sportValue;
      const matchesStatus = !statusValue || status === statusValue;
      const matchesSeason = !seasonValue || season.includes(seasonValue);
      const matchesQuality = qualityValue === "archived" ? archived : qualityValue !== "incomplete" || getTeamQuality(team) < 100;

      return (qualityValue === "archived" || !archived) && matchesSearch && matchesSport && matchesStatus && matchesSeason && matchesQuality;
    });
  }

  function hasActiveRegistryFilter() {
    return Boolean(
      String(els.teamSearch?.value || "").trim() ||
      String(els.teamSport?.value || "").trim() ||
      String(els.teamStatus?.value || "").trim() ||
      String(els.teamSeasonFilter?.value || "").trim() ||
      String(els.teamQualityFilter?.value || "").trim()
    );
  }

  function getSportName(slug) {
    if (typeof APP.getSportName === "function") {
      return APP.getSportName(slug);
    }

    if (!slug) return "";
    const sport = SPORT_REGISTRY.find(function (item) {
      return item.slug === slug;
    });
    return sport ? sport.name : slug;
  }

  // Normalize Status
  /**
   * Normalizes status data across current API and legacy nested shapes.
   */
  function normalizeStatus(value) {
    return String(value || "ACTIVE").toLowerCase().includes("inactive") ? "inactive" : "active";
  }

  // Normalize Outgoing Status
  /**
   * Normalizes outgoing status data across current API and legacy nested shapes.
   */
  function normalizeOutgoingStatus(value) {
    return String(value || "").toLowerCase() === "inactive" ? "INACTIVE" : "ACTIVE";
  }

  // Normalize Campus
  /**
   * Normalizes campus data across current API and legacy nested shapes.
   */
  function normalizeCampus(value) {
    return APP.normalizeCampus(value);
  }

  function formatCampus(value) {
    return APP.getCampusMeta(normalizeCampus(value)).name;
  }

  function setMessage(text, type) {
    if (!els.pageMessageEl) return;
    els.pageMessageEl.className = "message";
    els.pageMessageEl.textContent = text || "";
    if (type) els.pageMessageEl.classList.add(type);
  }

  // Messages and UI State
  /**
   * Resets message state before a new fetch or submit attempt.
   */
  function clearMessage() {
    if (!els.pageMessageEl) return;
    els.pageMessageEl.className = "message";
    els.pageMessageEl.textContent = "";
  }



  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Insight List
  /**
   * Renders the insight list section from normalized page state without mutating backend data.
   */
  function renderInsightList(node, rows, emptyText) {
    if (!node) return;
    const activeRows = rows.filter((row) => Number(row.value) > 0);
    if (!activeRows.length) {
      node.innerHTML = `<div class="insight-item"><span>${escapeHtml(emptyText)}</span><span class="insight-meta">Clear</span></div>`;
      return;
    }
    node.innerHTML = activeRows.map((row) => `
      <button class="insight-item insight-action" type="button" data-target="${escapeHtml(row.target || "")}" data-filter="${escapeHtml(row.filter || "")}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(String(row.value))}</strong>
      </button>
    `).join("");
  }

  // Event Wiring
  /**
   * Binds the insight actions interactions once so rerenders do not duplicate listeners.
   */
  function bindInsightActions() {
    document.addEventListener("click", function (event) {
      const action = event.target.closest(".insight-action[data-target]");
      if (!action) return;
      const target = document.getElementById(action.getAttribute("data-target"));
      if (!target) return;
      if (action.getAttribute("data-filter") === "incomplete" && els.teamQualityFilter) {
        els.teamQualityFilter.value = "incomplete";
        state.registrySearchApplied = true;
        renderTeamsTable();
      }
      if (target.tagName.toLowerCase() === "details") target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Activity List
  /**
   * Renders the activity list section from normalized page state without mutating backend data.
   */
  function renderActivityList(node, records) {
    if (!node) return;
    if (!records.length) {
      node.innerHTML = `<div class="insight-item"><span>No recent records yet.</span><span class="insight-meta">--</span></div>`;
      return;
    }
    node.innerHTML = records.map((record) => `
      <div class="insight-item">
        <span>${escapeHtml(record.label)}</span>
        <span class="insight-meta">${escapeHtml(record.type)}</span>
      </div>
    `).join("");
  }

  function getRecentRecords(records, type) {
    return records
      .slice()
      .sort((a, b) => getRecordTime(b) - getRecordTime(a))
      .slice(0, 3)
      .map((record) => ({ label: record.name || record.teamName || "Team", type }));
  }

  function getRecordTime(record) {
    return Date.parse(record.updatedAt || record.createdAt || record.modifiedAt || "") || 0;
  }

  // Quality
  /**
   * Renders the quality section from normalized page state without mutating backend data.
   */
  function renderQuality(scoreNode, barNode, copyNode, score, copy) {
    if (scoreNode) scoreNode.textContent = `${score}%`;
    if (barNode) barNode.style.width = `${Math.max(0, Math.min(100, score))}%`;
    if (copyNode) copyNode.textContent = copy;
  }

  function completenessMarkup(score) {
    const normalized = Math.max(0, Math.min(100, Number(score) || 0));
    return `<div class="completeness-cell"><span class="completeness-ring" style="--score:${normalized}"></span><span class="completeness-text">${normalized}%</span></div>`;
  }

  function ensureArchivedQualityOption(select) {
    if (!select || select.querySelector("option[value='archived']")) return;
    select.insertAdjacentHTML("beforeend", `<option value="archived">Archived records</option>`);
  }

  function saveCurrentSearch(scope) {
    if (!APP.saveRecentSearch) return;
    const values = {
      q: els.teamSearch?.value || "",
      sport: els.teamSport?.value || "",
      status: els.teamStatus?.value || "",
      season: els.teamSeasonFilter?.value || "",
      quality: els.teamQualityFilter?.value || ""
    };
    const label = [values.q, values.sport ? getSportName(values.sport) : "", values.status, values.season, values.quality].filter(Boolean).join(" / ") || "All teams";
    APP.saveRecentSearch(scope, label, values);
  }

  // Shared UI Mounting
  /**
   * Mounts the recent searches feature after required context has loaded.
   */
  function mountRecentSearches(scope) {
    if (!APP.renderRecentSearches || !els.teamSearchButton?.parentElement) return;
    document.querySelector(`[data-recent-searches='${scope}']`)?.remove();
    els.teamSearchButton.parentElement.insertAdjacentHTML("afterend", APP.renderRecentSearches(scope));
    document.querySelectorAll("[data-recent-searches='teams'] [data-recent-search-index]").forEach((button) => {
      button.addEventListener("click", function () {
        const item = APP.readRecentSearches(scope)[Number(this.dataset.recentSearchIndex)];
        if (!item) return;
        if (els.teamSearch) els.teamSearch.value = item.values.q || "";
        if (els.teamSport) els.teamSport.value = item.values.sport || "";
        if (els.teamStatus) els.teamStatus.value = item.values.status || "";
        if (els.teamSeasonFilter) els.teamSeasonFilter.value = item.values.season || "";
        if (els.teamQualityFilter) els.teamQualityFilter.value = item.values.quality || "";
        applyRegistrySearch();
      });
    });
  }
})();
