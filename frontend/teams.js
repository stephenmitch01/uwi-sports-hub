(function () {
  "use strict";

  const APP = window.UWISportsHub;
  if (!APP) throw new Error("APP not initialized");
  const SPORT_REGISTRY = APP.SPORT_REGISTRY || [];

  const state = {
    session: null,
    teams: []
  };

  const els = {
    campusNameNodes: Array.from(document.querySelectorAll("[data-campus-name]")),

    teamsTableBody: document.getElementById("teamsTableBody"),
    teamSearch: document.getElementById("teamSearch"),
    teamSport: document.getElementById("teamSport"),
    teamStatus: document.getElementById("teamStatus"),
    teamSeasonFilter: document.getElementById("teamSeasonFilter"),
    pageMessageEl: document.getElementById("teamsPageMessage"),

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

  async function init() {
    bindEvents();
    populateSportSelects();
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

    [els.teamSearch, els.teamSport, els.teamStatus, els.teamSeasonFilter].forEach(function (node) {
      if (!node) return;
      node.addEventListener("input", renderTeamsTable);
      node.addEventListener("change", renderTeamsTable);
    });
  }

  function applyCampusLabels() {
    const campusLabel = formatCampus(state.session?.campus);
    els.campusNameNodes.forEach(function (node) {
      node.textContent = campusLabel;
    });
  }

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
    const data = await apiGet("/teams");
    state.teams =
      Array.isArray(data?.teams) ? data.teams :
      Array.isArray(data?.data?.teams) ? data.data.teams :
      Array.isArray(data?.data) ? data.data :
      [];

    renderTeamEditSelect();
    renderTeamsTable();
  }

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

    const ok = await saveTeam(payload);
    if (!ok) return;

    els.createForm?.reset();
    populateSportSelects();
    await refreshTeams();
    setMessage("Team created successfully.", "success");
  }

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
        await apiPatch(`/teams/${encodeURIComponent(teamId)}`, payload);
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

  function renderTeamsTable() {
    if (!els.teamsTableBody) return;

    const teams = getFilteredTeams();

    if (!teams.length) {
      els.teamsTableBody.innerHTML = `
        <tr>
          <td colspan="8">
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
          <td>
            <a class="btn btn-soft" href="team-view.html?id=${encodeURIComponent(teamId)}">Open</a>
          </td>
        </tr>
      `;
    }).join("");
  }

  function getFilteredCampusTeams() {
    const campus = normalizeCampus(state.session?.campus);
    return state.teams
      .filter(function (team) {
        return normalizeCampus(team.campus || state.session?.campus) === campus;
      })
      .sort(function (a, b) {
        return String(a.name || a.teamName || "").localeCompare(String(b.name || b.teamName || ""));
      });
  }

  function getFilteredTeams() {
    const campusTeams = getFilteredCampusTeams();

    const searchValue = String(els.teamSearch?.value || "").trim().toLowerCase();
    const sportValue = String(els.teamSport?.value || "").trim().toLowerCase();
    const statusValue = String(els.teamStatus?.value || "").trim().toLowerCase();
    const seasonValue = String(els.teamSeasonFilter?.value || "").trim().toLowerCase();

    return campusTeams.filter(function (team) {
      const name = String(team.name || team.teamName || "").toLowerCase();
      const sport = String(team.sport || team.sportSlug || "").toLowerCase();
      const division = String(team.division || "").toLowerCase();
      const notes = String(team.notes || "").toLowerCase();
      const season = String(team.seasonLabel || team.season || "").toLowerCase();
      const status = normalizeStatus(team.status);

      const matchesSearch =
        !searchValue ||
        name.includes(searchValue) ||
        division.includes(searchValue) ||
        season.includes(searchValue) ||
        notes.includes(searchValue);

      const matchesSport = !sportValue || sport === sportValue;
      const matchesStatus = !statusValue || status === statusValue;
      const matchesSeason = !seasonValue || season.includes(seasonValue);

      return matchesSearch && matchesSport && matchesStatus && matchesSeason;
    });
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

  function normalizeStatus(value) {
    return String(value || "ACTIVE").toLowerCase().includes("inactive") ? "inactive" : "active";
  }

  function normalizeOutgoingStatus(value) {
    return String(value || "").toLowerCase() === "inactive" ? "INACTIVE" : "ACTIVE";
  }

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
})();