(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const SPORTS = APP.SPORT_REGISTRY.map(function (sport) { return sport.name; });

  const state = {
    user: null,
    coaches: [],
    teams: [],
    filteredCoaches: []
  };

  const els = {
    totalCoachesStat: document.getElementById("totalCoachesStat"),
    headCoachesStat: document.getElementById("headCoachesStat"),
    supportStaffStat: document.getElementById("supportStaffStat"),
    teamsCoveredStat: document.getElementById("teamsCoveredStat"),
    sportsCoveredStat: document.getElementById("sportsCoveredStat"),
    unassignedStaffStat: document.getElementById("unassignedStaffStat"),

    focusCreateCoachBtn: document.getElementById("focusCreateCoachBtn"),
    focusAssignmentsBtn: document.getElementById("focusAssignmentsBtn"),

    createCoachSection: document.getElementById("createCoachSection"),
    assignmentSection: document.getElementById("assignmentSection"),

    coachForm: document.getElementById("coachForm"),
    firstName: document.getElementById("firstName"),
    lastName: document.getElementById("lastName"),
    email: document.getElementById("email"),
    phone: document.getElementById("phone"),
    role: document.getElementById("role"),
    otherRole: document.getElementById("otherRole"),
    otherRoleWrap: document.getElementById("otherRoleWrap"),
    sport: document.getElementById("sport"),
    employmentStatus: document.getElementById("employmentStatus"),
    assignmentMode: document.getElementById("assignmentMode"),
    teamAssignmentWrap: document.getElementById("teamAssignmentWrap"),
    assignmentRoleWrap: document.getElementById("assignmentRoleWrap"),
    teamId: document.getElementById("teamId"),
    assignmentRole: document.getElementById("assignmentRole"),
    notes: document.getElementById("notes"),
    coachFormMessage: document.getElementById("coachFormMessage"),
    resetCoachFormBtn: document.getElementById("resetCoachFormBtn"),
    saveCoachBtn: document.getElementById("saveCoachBtn"),

    assignmentForm: document.getElementById("assignmentForm"),
    assignmentCoachId: document.getElementById("assignmentCoachId"),
    assignmentTeamId: document.getElementById("assignmentTeamId"),
    assignmentRoleExisting: document.getElementById("assignmentRoleExisting"),
    assignmentPrimaryFlag: document.getElementById("assignmentPrimaryFlag"),
    assignmentMessage: document.getElementById("assignmentMessage"),

    searchInput: document.getElementById("searchInput"),
    filterRole: document.getElementById("filterRole"),
    filterSport: document.getElementById("filterSport"),
    filterStatus: document.getElementById("filterStatus"),
    registryMessage: document.getElementById("registryMessage"),
    coachTableBody: document.getElementById("coachTableBody"),
    emptyState: document.getElementById("emptyState"),
    coachTableWrap: document.getElementById("coachTableWrap")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    populateSports();
    clearMessage(els.registryMessage);
    clearMessage(els.coachFormMessage);
    clearMessage(els.assignmentMessage);

    try {
      const session = await APP.mountSignedInShell({
        active: "coaches",
        contextLabel: "Coaches"
      });

      if (!session) return;

      state.user = {
        fullName: session.fullName,
        email: session.email,
        campus: session.campus,
        role: session.role
      };

      await Promise.all([loadTeams(), loadCoaches()]);
      renderAll();
    } catch (error) {
      console.error("Coach page load error:", error);
      setError(els.registryMessage, "Failed to load coach management data.");
    }
  }

  function bindEvents() {
    els.role.addEventListener("change", function () {
      const isOther = els.role.value === "other";
      els.otherRoleWrap.classList.toggle("hidden", !isOther);
      if (!isOther) els.otherRole.value = "";
    });

    els.assignmentMode.addEventListener("change", function () {
      const show = els.assignmentMode.value === "single";
      els.teamAssignmentWrap.classList.toggle("hidden", !show);
      els.assignmentRoleWrap.classList.toggle("hidden", !show);

      if (!show) {
        els.teamId.value = "";
        els.assignmentRole.value = "";
      }
    });

    els.focusCreateCoachBtn.addEventListener("click", function () {
      els.createCoachSection.scrollIntoView({ behavior: "smooth", block: "start" });
      els.firstName.focus();
    });

    els.focusAssignmentsBtn.addEventListener("click", function () {
      els.assignmentSection.scrollIntoView({ behavior: "smooth", block: "start" });
      els.assignmentCoachId.focus();
    });

    els.coachForm.addEventListener("submit", handleCreateCoach);
    els.resetCoachFormBtn.addEventListener("click", resetCoachForm);
    els.assignmentForm.addEventListener("submit", handleCreateAssignment);

    els.searchInput.addEventListener("input", renderAll);
    els.filterRole.addEventListener("change", renderAll);
    els.filterSport.addEventListener("change", renderAll);
    els.filterStatus.addEventListener("change", renderAll);
  }

  async function loadTeams() {
  const data = await APP.apiGet("/teams", true);

  state.teams =
    Array.isArray(data?.teams) ? data.teams :
    Array.isArray(data?.data?.teams) ? data.data.teams :
    Array.isArray(data?.data) ? data.data :
    [];

  populateTeamSelects();
}

  async function loadCoaches() {
  const data = await APP.apiGet("/coaches", true);

  state.coaches =
    Array.isArray(data?.coaches) ? data.coaches :
    Array.isArray(data?.data?.coaches) ? data.data.coaches :
    Array.isArray(data?.data) ? data.data :
    [];
  
  populateCoachSelect();
}

  function populateSports() {
    SPORTS.forEach(function (sportName) {
      appendOption(els.sport, sportName, sportName);
      appendOption(els.filterSport, sportName, sportName);
    });
  }

  function populateTeamSelects() {
    clearSelectOptions(els.teamId, 1);
    clearSelectOptions(els.assignmentTeamId, 1);

    state.teams.forEach(function (team) {
      const label = team.name || "Unnamed Team";
      appendOption(els.teamId, String(team.id), label);
      appendOption(els.assignmentTeamId, String(team.id), label);
    });
  }

  function populateCoachSelect() {
    clearSelectOptions(els.assignmentCoachId, 1);

    state.coaches.forEach(function (coach) {
      appendOption(els.assignmentCoachId, String(coach.id), formatCoachName(coach));
    });
  }

  function appendOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function clearSelectOptions(select, keepCount) {
    while (select.options.length > keepCount) {
      select.remove(keepCount);
    }
  }

  async function handleCreateCoach(event) {
    event.preventDefault();
    clearMessage(els.coachFormMessage);

    const validation = validateCoachForm();
    if (!validation.ok) {
      setError(els.coachFormMessage, validation.message);
      return;
    }

    const payload = {
      firstName: els.firstName.value.trim(),
      lastName: els.lastName.value.trim(),
      email: els.email.value.trim() || null,
      phone: els.phone.value.trim() || null,
      primaryRole: els.role.value,
      otherRoleTitle: els.role.value === "other" ? els.otherRole.value.trim() : null,
      primarySport: els.sport.value,
      status: els.employmentStatus.value,
      notes: els.notes.value.trim() || null
    };

    setButtonLoading(els.saveCoachBtn, true, "Saving...");

    try {
      const data = await APP.apiPost("/coaches", payload);

      const createdCoach = data?.coach || null;

      if (els.assignmentMode.value === "single" && createdCoach?.id) {
        await APP.apiPost(
          "/team-staff-assignments",
          {
            coachId: createdCoach.id,
            teamId: els.teamId.value,
            role: els.assignmentRole.value === "other" ? (els.otherRole.value.trim() || "other") : els.assignmentRole.value,
            isPrimary: true
          },
          { tolerateFailure: false }
        );
      }

      setSuccess(els.coachFormMessage, "Coach record saved successfully.");
      resetCoachForm();
      await Promise.all([loadTeams(), loadCoaches()]);
      renderAll();
    } catch (error) {
      console.error("Save coach error:", error);
      setError(els.coachFormMessage, error?.message || "An unexpected error occurred while saving the coach.");
    } finally {
      setButtonLoading(els.saveCoachBtn, false, "Save Coach");
    }
  }

  function validateCoachForm() {
    if (!els.firstName.value.trim()) return { ok: false, message: "First name is required." };
    if (!els.lastName.value.trim()) return { ok: false, message: "Last name is required." };
    if (!els.role.value) return { ok: false, message: "Primary role is required." };
    if (els.role.value === "other" && !els.otherRole.value.trim()) {
      return { ok: false, message: "Please specify the other role title." };
    }
    if (!els.sport.value) return { ok: false, message: "Primary sport is required." };

    if (els.assignmentMode.value === "single") {
      if (!els.teamId.value) return { ok: false, message: "Please select a team." };
      if (!els.assignmentRole.value) return { ok: false, message: "Please select the team role." };
    }

    return { ok: true };
  }

  function resetCoachForm() {
    els.coachForm.reset();
    els.otherRoleWrap.classList.add("hidden");
    els.teamAssignmentWrap.classList.add("hidden");
    els.assignmentRoleWrap.classList.add("hidden");
  }

  async function handleCreateAssignment(event) {
    event.preventDefault();
    clearMessage(els.assignmentMessage);

    if (!els.assignmentCoachId.value || !els.assignmentTeamId.value || !els.assignmentRoleExisting.value) {
      setError(els.assignmentMessage, "Coach, team, and role are required.");
      return;
    }

    try {
      await APP.apiPost(
        "/team-staff-assignments",
        {
          coachId: els.assignmentCoachId.value,
          teamId: els.assignmentTeamId.value,
          role: els.assignmentRoleExisting.value,
          isPrimary: els.assignmentPrimaryFlag.value === "true"
        }
      );

      setSuccess(els.assignmentMessage, "Coach assignment saved successfully.");
      els.assignmentForm.reset();
      await loadCoaches();
      renderAll();
    } catch (error) {
      console.error("Assignment save error:", error);
      setError(els.assignmentMessage, error?.message || "An unexpected error occurred while saving the assignment.");
    }
  }

  function renderAll() {
    state.filteredCoaches = getFilteredCoaches();
    renderStats();
    renderCoachTable();
  }

  function getFilteredCoaches() {
    const searchTerm = els.searchInput.value.trim().toLowerCase();
    const roleFilter = els.filterRole.value;
    const sportFilter = els.filterSport.value;
    const statusFilter = els.filterStatus.value;

    return state.coaches.filter(function (coach) {
      const fullName = formatCoachName(coach).toLowerCase();
      const email = String(coach.email || "").toLowerCase();
      const phone = String(coach.phone || "").toLowerCase();
      const primaryRole = String(coach.primaryRole || "").toLowerCase();
      const primarySport = String(coach.primarySport || "").toLowerCase();
      const otherRoleTitle = String(coach.otherRoleTitle || "").toLowerCase();
      const teamNames = getAssignmentLabels(coach).join(" ").toLowerCase();

      const matchesSearch =
        !searchTerm ||
        fullName.includes(searchTerm) ||
        email.includes(searchTerm) ||
        phone.includes(searchTerm) ||
        primaryRole.includes(searchTerm) ||
        primarySport.includes(searchTerm) ||
        otherRoleTitle.includes(searchTerm) ||
        teamNames.includes(searchTerm);

      const matchesRole = !roleFilter || coach.primaryRole === roleFilter;
      const matchesSport = !sportFilter || coach.primarySport === sportFilter;
      const matchesStatus = !statusFilter || coach.status === statusFilter;

      return matchesSearch && matchesRole && matchesSport && matchesStatus;
    });
  }

  function renderStats() {
    const coaches = state.coaches;
    const total = coaches.length;
    const headCoaches = coaches.filter(c => c.primaryRole === "head_coach").length;
    const supportStaff = coaches.filter(c => c.primaryRole !== "head_coach" && c.primaryRole !== "assistant_coach").length;
    const sportsCovered = new Set();
    const teamsCovered = new Set();
    let unassigned = 0;

    coaches.forEach(function (coach) {
      if (coach.primarySport) sportsCovered.add(coach.primarySport);

      const assignments = getAssignments(coach);
      if (!assignments.length) {
        unassigned += 1;
      } else {
        assignments.forEach(function (assignment) {
          if (assignment.teamId) teamsCovered.add(String(assignment.teamId));
        });
      }
    });

    els.totalCoachesStat.textContent = String(total);
    els.headCoachesStat.textContent = String(headCoaches);
    els.supportStaffStat.textContent = String(supportStaff);
    els.teamsCoveredStat.textContent = String(teamsCovered.size);
    els.sportsCoveredStat.textContent = String(sportsCovered.size);
    els.unassignedStaffStat.textContent = String(unassigned);
  }

  function renderCoachTable() {
    els.coachTableBody.innerHTML = "";

    if (!state.filteredCoaches.length) {
      els.coachTableWrap.classList.add("hidden");
      els.emptyState.classList.remove("hidden");
      return;
    }

    els.coachTableWrap.classList.remove("hidden");
    els.emptyState.classList.add("hidden");

    const fragment = document.createDocumentFragment();

    state.filteredCoaches.forEach(function (coach) {
      const row = document.createElement("tr");
      const teamLabels = getAssignmentLabels(coach);
      const teamsText = teamLabels.length ? teamLabels.join(", ") : "Unassigned";

      row.innerHTML = `
        <td><strong>${escapeHtml(formatCoachName(coach))}</strong></td>
        <td>${escapeHtml(formatRole(coach.primaryRole, coach.otherRoleTitle))}</td>
        <td>${escapeHtml(coach.primarySport || "—")}</td>
        <td>${escapeHtml(teamsText)}</td>
        <td>${escapeHtml(coach.phone || "—")}</td>
        <td>${escapeHtml(coach.email || "—")}</td>
        <td>${escapeHtml(formatStatus(coach.status))}</td>
        <td>
          <div class="action-row">
            <button class="link-btn" type="button" data-action="view" data-id="${escapeHtml(String(coach.id))}">View</button>
          </div>
        </td>
      `;

      fragment.appendChild(row);
    });

    els.coachTableBody.appendChild(fragment);

    els.coachTableBody.querySelectorAll("[data-action='view']").forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-id");
        window.location.href = `coach-view.html?id=${encodeURIComponent(id)}`;
      });
    });
  }

  function getAssignments(coach) {
  if (!coach) return [];

  if (Array.isArray(coach.assignments)) return coach.assignments;
  if (Array.isArray(coach.teamAssignments)) return coach.teamAssignments;
  if (Array.isArray(coach.staffAssignments)) return coach.staffAssignments;

  return [];
}

  function getAssignmentLabels(coach) {
    return getAssignments(coach).map(function (assignment) {
      const team = state.teams.find(t => String(t.id) === String(assignment.teamId));
      const teamName = team?.name || "Unknown Team";
      const role = formatRole(assignment.role, assignment.otherRoleTitle);
      return `${teamName} (${role})`;
    });
  }

  function normalizeCampus(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function formatCampusLabel(campus) {
    switch (campus) {
      case "mona": return "Mona";
      case "cavehill": return "Cave Hill";
      case "staugustine": return "St Augustine";
      case "fiveislands": return "Five Islands";
      default: return "Campus";
    }
  }

  function formatCoachName(coach) {
    return `${coach.firstName || ""} ${coach.lastName || ""}`.trim() || "Unnamed Coach";
  }

  function formatRole(role, otherTitle) {
    switch (role) {
      case "head_coach": return "Head Coach";
      case "assistant_coach": return "Assistant Coach";
      case "strength_conditioning_coach": return "Strength & Conditioning Coach";
      case "physio": return "Physio";
      case "manager": return "Manager";
      case "analyst": return "Analyst";
      case "team_staff": return "Team Staff";
      case "other": return otherTitle || "Other";
      default: return "—";
    }
  }

  function formatStatus(status) {
  const normalized = String(status || "").toLowerCase();

  switch (normalized) {
      case "active": return "Active";
      case "inactive": return "Inactive";
      case "on_leave": return "On Leave";
      default: return "—";
    }
  }

  function setButtonLoading(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = text;
  }

  function setSuccess(element, message) {
    element.className = "message success";
    element.textContent = message;
  }

  function setError(element, message) {
    element.className = "message error";
    element.textContent = message;
  }

  function clearMessage(element) {
    element.className = "message";
    element.textContent = "";
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function hexToRgba(hex, alpha) {
    const normalized = String(hex).replace("#", "");
    const bigint = parseInt(normalized, 16);

    if (normalized.length !== 6 || Number.isNaN(bigint)) {
      return `rgba(0,0,0,${alpha})`;
    }

    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
