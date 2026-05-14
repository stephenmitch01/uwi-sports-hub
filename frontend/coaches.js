(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const SPORTS = APP.SPORT_REGISTRY.map(function (sport) { return sport.name; });

  const state = {
    user: null,
    coaches: [],
    teams: [],
    filteredCoaches: [],
    registrySearchApplied: false
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
    filterQuality: document.getElementById("filterQuality"),
    coachSearchButton: document.getElementById("coachSearchButton"),
    registryMessage: document.getElementById("registryMessage"),
    coachTableBody: document.getElementById("coachTableBody"),
    emptyState: document.getElementById("emptyState"),
    coachTableWrap: document.getElementById("coachTableWrap"),
    coachAlerts: document.getElementById("coachAlerts"),
    coachActivity: document.getElementById("coachActivity"),
    coachQualityScore: document.getElementById("coachQualityScore"),
    coachQualityBar: document.getElementById("coachQualityBar"),
    coachQualityCopy: document.getElementById("coachQualityCopy")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    bindInsightActions();
    populateSports();
    ensureArchivedQualityOption(els.filterQuality);
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
      const workflows = document.getElementById("coachWorkflows");
      if (workflows) workflows.hidden = false;
      els.createCoachSection.hidden = false;
      els.createCoachSection.open = true;
      els.createCoachSection.scrollIntoView({ behavior: "smooth", block: "start" });
      els.firstName.focus();
    });

    els.focusAssignmentsBtn.addEventListener("click", function () {
      const workflows = document.getElementById("coachWorkflows");
      if (workflows) workflows.hidden = false;
      els.assignmentSection.hidden = false;
      els.assignmentSection.open = true;
      els.assignmentSection.scrollIntoView({ behavior: "smooth", block: "start" });
      els.assignmentCoachId.focus();
    });

    els.coachForm.addEventListener("submit", handleCreateCoach);
    els.resetCoachFormBtn.addEventListener("click", resetCoachForm);
    els.assignmentForm.addEventListener("submit", handleCreateAssignment);

    [els.searchInput, els.filterRole, els.filterSport, els.filterStatus, els.filterQuality].forEach(function (node) {
      if (!node) return;
      node.addEventListener("input", handleFilterChange);
      node.addEventListener("change", handleFilterChange);
    });
    if (els.coachSearchButton) els.coachSearchButton.addEventListener("click", applyRegistrySearch);
    mountRecentSearches("coaches");
    bindWorkflowClose();
  }

  function bindWorkflowClose() {
    const workflows = document.getElementById("coachWorkflows");
    [els.createCoachSection, els.assignmentSection].forEach(function (panel) {
      if (!panel) return;
      panel.addEventListener("toggle", function () {
        if (panel.open) return;
        panel.hidden = true;
        if (workflows && els.createCoachSection.hidden && els.assignmentSection.hidden) {
          workflows.hidden = true;
        }
      });
    });
  }

  function handleFilterChange() {
    const panel = document.getElementById("coachRegistryPanel");
    if (hasActiveRegistryFilter() && panel) panel.open = true;
    state.registrySearchApplied = false;
  }

  function applyRegistrySearch() {
    const panel = document.getElementById("coachRegistryPanel");
    if (panel) panel.open = true;
    state.registrySearchApplied = true;
    saveCurrentSearch("coaches");
    mountRecentSearches("coaches");
    renderAll();
  }

  async function loadTeams() {
  const data = await APP.apiGet("/teams?includeArchived=true", true);

  state.teams =
    Array.isArray(data) ? data :
    Array.isArray(data?.teams) ? data.teams :
    Array.isArray(data?.data?.teams) ? data.data.teams :
    Array.isArray(data?.data) ? data.data :
    [];

  populateTeamSelects();
}

  async function loadCoaches() {
  const data = await APP.apiGet("/coaches?includeArchived=true", true);

  state.coaches =
    Array.isArray(data) ? data :
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
      const duplicate = APP.findSimilarRecord(state.coaches, {
        firstName: payload.firstName,
        lastName: payload.lastName,
        primarySport: payload.primarySport,
        sport: payload.primarySport
      }, { type: "coach" });
      if (duplicate) {
        const action = APP.promptDuplicateAction(duplicate, "coach");
        if (action === "cancel") return;
        if (action === "use-existing" || action === "edit-existing") {
          window.location.href = `coach-view.html?coachId=${encodeURIComponent(duplicate.id)}`;
          return;
        }
      }
      const data = await APP.apiPost("/coaches", payload);

      const createdCoach = data?.coach || data?.data?.coach || data?.data || data || null;

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
    renderOperationalSummary();
    renderCoachTable();
  }

  function renderOperationalSummary() {
    const coaches = state.coaches.filter((coach) => !APP.isArchivedRecord(coach));
    const unassigned = coaches.filter((coach) => !getAssignments(coach).length);
    const missingContact = coaches.filter((coach) => !coach.email && !coach.phone);
    const missingSport = coaches.filter((coach) => !coach.primarySport);
    const quality = coaches.length
      ? Math.round(coaches.reduce((sum, coach) => sum + getCoachQuality(coach), 0) / coaches.length)
      : 0;

    renderInsightList(els.coachAlerts, [
      { label: "Unassigned staff", value: unassigned.length, target: "coachRegistryPanel", filter: "incomplete" },
      { label: "Missing contact info", value: missingContact.length, target: "coachRegistryPanel", filter: "incomplete" },
      { label: "Missing primary sport", value: missingSport.length, target: "coachRegistryPanel", filter: "incomplete" }
    ], "No coach alerts right now.");

    renderActivityList(els.coachActivity, getRecentRecords(coaches, "coach"));
    renderQuality(els.coachQualityScore, els.coachQualityBar, els.coachQualityCopy, quality, `${coaches.filter((coach) => getCoachQuality(coach) < 100).length} coach profile${coaches.length === 1 ? "" : "s"} below 100% completion.`);
  }

  function getCoachQuality(coach) {
    const checks = [
      coach.firstName,
      coach.lastName,
      coach.primaryRole,
      coach.primarySport,
      coach.email || coach.phone,
      coach.status,
      getAssignments(coach).length,
      coach.notes
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function getFilteredCoaches() {
    const searchTerm = els.searchInput.value.trim().toLowerCase();
    const roleFilter = els.filterRole.value;
    const sportFilter = els.filterSport.value;
    const statusFilter = els.filterStatus.value;
    const qualityFilter = els.filterQuality?.value || "";

    return state.coaches.filter(function (coach) {
      const archived = APP.isArchivedRecord(coach);
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
      const matchesQuality = qualityFilter === "archived" ? archived : qualityFilter !== "incomplete" || getCoachQuality(coach) < 100;

      return (qualityFilter === "archived" || !archived) && matchesSearch && matchesRole && matchesSport && matchesStatus && matchesQuality;
    });
  }

  function renderStats() {
    const coaches = state.coaches.filter((coach) => !APP.isArchivedRecord(coach));
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

    if (!state.registrySearchApplied) {
      els.coachTableWrap.classList.remove("hidden");
      els.emptyState.classList.add("hidden");
      els.coachTableBody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state">
              <h3>Search coach records.</h3>
              <p>Click Search to show all coaches, or choose filters for a focused list.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

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
        <td>${completenessMarkup(getCoachQuality(coach))}</td>
        <td>
          <div class="action-row">
            <button class="btn btn-campus" type="button" data-action="view" data-id="${escapeHtml(String(coach.id))}">View</button>
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

  function hasActiveRegistryFilter() {
    return Boolean(
      String(els.searchInput?.value || "").trim() ||
      String(els.filterRole?.value || "").trim() ||
      String(els.filterSport?.value || "").trim() ||
      String(els.filterStatus?.value || "").trim() ||
      String(els.filterQuality?.value || "").trim()
    );
  }

  function getAssignments(coach) {
  if (!coach) return [];

  const assignments = Array.isArray(coach.assignments) ? coach.assignments
    : Array.isArray(coach.teamAssignments) ? coach.teamAssignments
      : Array.isArray(coach.staffAssignments) ? coach.staffAssignments
        : [];

  const seen = new Set();
  return assignments.filter((assignment) => {
    const key = String(assignment.teamId || assignment.team?.id || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

  function getAssignmentLabels(coach) {
    return getAssignments(coach).map(function (assignment) {
      const team = state.teams.find(t => String(t.id) === String(assignment.teamId));
      const teamName = team?.name || team?.teamName || assignment.teamName || assignment.team?.name || "Unknown Team";
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

  function bindInsightActions() {
    document.addEventListener("click", function (event) {
      const action = event.target.closest(".insight-action[data-target]");
      if (!action) return;
      const target = document.getElementById(action.getAttribute("data-target"));
      if (!target) return;
      if (action.getAttribute("data-filter") === "incomplete" && els.filterQuality) {
        els.filterQuality.value = "incomplete";
        state.registrySearchApplied = true;
        renderAll();
      }
      if (target.tagName.toLowerCase() === "details") target.open = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

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
      .map((record) => ({ label: formatCoachName(record), type }));
  }

  function getRecordTime(record) {
    return Date.parse(record.updatedAt || record.createdAt || record.modifiedAt || "") || 0;
  }

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
      q: els.searchInput?.value || "",
      role: els.filterRole?.value || "",
      sport: els.filterSport?.value || "",
      status: els.filterStatus?.value || "",
      quality: els.filterQuality?.value || ""
    };
    const label = [values.q, values.role, values.sport, values.status, values.quality].filter(Boolean).join(" / ") || "All coaches";
    APP.saveRecentSearch(scope, label, values);
  }

  function mountRecentSearches(scope) {
    if (!APP.renderRecentSearches || !els.coachSearchButton?.parentElement) return;
    document.querySelector(`[data-recent-searches='${scope}']`)?.remove();
    els.coachSearchButton.parentElement.insertAdjacentHTML("afterend", APP.renderRecentSearches(scope));
    document.querySelectorAll("[data-recent-searches='coaches'] [data-recent-search-index]").forEach((button) => {
      button.addEventListener("click", function () {
        const item = APP.readRecentSearches(scope)[Number(this.dataset.recentSearchIndex)];
        if (!item) return;
        if (els.searchInput) els.searchInput.value = item.values.q || "";
        if (els.filterRole) els.filterRole.value = item.values.role || "";
        if (els.filterSport) els.filterSport.value = item.values.sport || "";
        if (els.filterStatus) els.filterStatus.value = item.values.status || "";
        if (els.filterQuality) els.filterQuality.value = item.values.quality || "";
        applyRegistrySearch();
      });
    });
  }
})();
