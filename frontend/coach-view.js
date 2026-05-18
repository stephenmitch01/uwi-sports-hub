/* =========================================================
   UWI Sports Hub — Coach View Page
   Backend-ready / no sample data / session-protected
========================================================= */

(function () {
  "use strict";

  // Shared App Access
  /**
   * Coach/staff detail workflow.
   *
   * This view normalizes embedded and endpoint-loaded staff assignments into a
   * single table, avoiding duplicate display when backend responses include
   * both current relationship data and legacy nested shapes.
   */
  const APP = window.UWISportsHub;

  // Page State
  const state = {
    session: null,
    coachId: null,
    coach: null,
    teams: [],
    staffAssignments: []
  };

  // Page Elements
  const els = {
    pageMessage: document.getElementById("pageMessage"),
    coachNameHeading: document.getElementById("coachNameHeading"),
    coachRoleSportLine: document.getElementById("coachRoleSportLine"),
    coachStatusPill: document.getElementById("coachStatusPill"),
    coachCampusPill: document.getElementById("coachCampusPill"),
    coachPrimaryRolePill: document.getElementById("coachPrimaryRolePill"),
    coachNotesPreview: document.getElementById("coachNotesPreview"),
    editCoachBtn: document.getElementById("editCoachBtn"),
    editCoachPanel: document.getElementById("editCoachPanel"),
    coachEditForm: document.getElementById("coachEditForm"),
    coachEditMessage: document.getElementById("coachEditMessage"),
    printBtn: document.getElementById("printBtn"),
    assignedTeamsStat: document.getElementById("assignedTeamsStat"),
    sportsCoveredStat: document.getElementById("sportsCoveredStat"),
    primaryRoleStat: document.getElementById("primaryRoleStat"),
    statusStat: document.getElementById("statusStat"),
    primarySportStat: document.getElementById("primarySportStat"),
    contactReadyStat: document.getElementById("contactReadyStat"),
    coachCompletenessStat: document.getElementById("coachCompletenessStat"),
    firstNameValue: document.getElementById("firstNameValue"),
    lastNameValue: document.getElementById("lastNameValue"),
    emailValue: document.getElementById("emailValue"),
    phoneValue: document.getElementById("phoneValue"),
    roleValue: document.getElementById("roleValue"),
    otherRoleValue: document.getElementById("otherRoleValue"),
    sportValue: document.getElementById("sportValue"),
    campusValue: document.getElementById("campusValue"),
    statusValue: document.getElementById("statusValue"),
    recordIdValue: document.getElementById("recordIdValue"),
    notesBox: document.getElementById("notesBox"),
    assignmentTableWrap: document.getElementById("assignmentTableWrap"),
    assignmentTableBody: document.getElementById("assignmentTableBody"),
    assignmentEmptyState: document.getElementById("assignmentEmptyState"),
    teamsSummaryWrap: document.getElementById("teamsSummaryWrap"),
    teamsSummaryBody: document.getElementById("teamsSummaryBody"),
    teamsSummaryEmptyState: document.getElementById("teamsSummaryEmptyState")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    bindStaticEvents();
    clearMessage();

    try {
      state.coachId = getCoachIdFromUrl();
      if (!state.coachId) {
        setError("No coach ID was provided in the page URL.");
        renderEmptyState("No coach selected", "Open this page from the Coaches registry to review a specific coach or staff profile.");
        return;
      }

      const session = await APP.mountSignedInShell({ active: "coaches", contextLabel: "Coach View" });
      if (!session) return;
      state.session = session;

      await Promise.all([loadCoach(), loadTeams(), loadCoachAssignments()]);
      validateCoachCampus();
      renderCoachView();
    } catch (error) {
      console.error("Coach view load error:", error);
      if (error?.status === 401) {
        window.location.href = "index.html";
        return;
      }
      setError(error?.message || "Failed to load coach profile data.");
      renderEmptyState("Coach details unavailable", error?.message || "The selected coach record could not be loaded.");
    }
  }

  // Event Wiring
  /**
   * Binds one-time page controls that should not be recreated during data refreshes.
   */
  function bindStaticEvents() {
    if (els.printBtn) {
      els.printBtn.addEventListener("click", function () {
        window.print();
      });
    }

    if (els.editCoachBtn && els.editCoachPanel) {
      els.editCoachBtn.addEventListener("click", function () {
        els.editCoachPanel.classList.remove("hidden");
        els.editCoachPanel.open = true;
        els.editCoachPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (els.coachEditForm) {
      APP.trackUnsavedChanges(els.coachEditForm);
      els.coachEditForm.addEventListener("submit", handleEditCoachSubmit);
    }
    mountArchiveButton();
  }

  function getCoachIdFromUrl() {
    // URL Parameters
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || params.get("coachId") || "").trim();
  }

  // Data Loading
  /**
   * Fetches the selected coach record before assignment normalization and rendering.
   */
  async function loadCoach() {
    const data = await APP.apiGet(`/coaches/${encodeURIComponent(state.coachId)}`);
    state.coach = normalizeCoach(data?.coach || data?.data?.coach || data?.data || data || null);
  }

  // Data Loading
  /**
   * Fetches teams used to resolve relationship IDs into display labels and links.
   */
  async function loadTeams() {
    const data = await APP.apiGet("/teams?includeArchived=true", true);
    state.teams =
      Array.isArray(data) ? data :
      Array.isArray(data?.teams) ? data.teams :
      Array.isArray(data?.data?.teams) ? data.data.teams :
      Array.isArray(data?.data) ? data.data :
      [];
  }

  // Data Loading
  /**
   * Loads staff assignment rows so the view can merge embedded and current relationship data.
   */
  async function loadCoachAssignments() {
    const data = await APP.apiGet(`/team-staff-assignments?coachId=${encodeURIComponent(state.coachId)}`, true);
    const rows =
      Array.isArray(data) ? data :
      Array.isArray(data?.assignments) ? data.assignments :
      Array.isArray(data?.staffAssignments) ? data.staffAssignments :
      Array.isArray(data?.data?.assignments) ? data.data.assignments :
      Array.isArray(data?.data) ? data.data :
      [];
    state.staffAssignments = rows.filter(function (assignment) {
      return String(assignment.coachId || assignment.staffId || assignment.coach?.id || "") === String(state.coachId);
    });
  }

  // Normalize Coach
  /**
   * Normalizes coach/profile fields from current and legacy response shapes before display.
   */
  function normalizeCoach(raw) {
    const coach = raw && typeof raw === "object" ? raw : {};
    return {
      id: coach.id || state.coachId || "",
      firstName: coach.firstName || "",
      lastName: coach.lastName || "",
      fullName: coach.fullName || `${coach.firstName || ""} ${coach.lastName || ""}`.trim(),
      email: coach.email || "",
      phone: coach.phone || "",
      role: coach.role || coach.primaryRole || "",
      otherRoleTitle: coach.otherRoleTitle || coach.otherRole || "",
      sport: coach.sport || coach.primarySport || coach.sportSlug || "",
      campus: coach.campus || coach.campusSlug || state.session?.campus || "",
      status: coach.status || coach.employmentStatus || "",
      notes: coach.notes || coach.internalNotes || coach.bio || "",
      assignments: getAssignments(coach)
    };
  }

  function validateCoachCampus() {
    const sessionCampus = APP.normalizeCampus(state.session?.campus || "");
    const coachCampus = APP.normalizeCampus(state.coach?.campus || sessionCampus);
    if (sessionCampus && coachCampus && sessionCampus !== coachCampus) {
      throw new Error("This coach record does not belong to the signed-in campus.");
    }
  }

  // Coach View
  /**
   * Renders the coach profile from normalized identity, role, and assignment data.
   */
  function renderCoachView() {
    const coach = state.coach;
    const assignments = getAssignments(coach);
    const primaryRole = formatRole(coach.role, coach.otherRoleTitle);
    const primarySport = APP.getSportName(coach.sport || "") || "Sport not set";
    const campusLabel = APP.getCampusMeta(coach.campus).name;
    const statusLabel = formatStatus(coach.status);
    const notes = coach.notes || "No notes available for this coach/staff record yet.";

    populateCoachEditForm(coach);

    if (els.coachNameHeading) els.coachNameHeading.textContent = coach.fullName || "Coach Profile";
    if (els.coachRoleSportLine) els.coachRoleSportLine.textContent = `${primaryRole} • ${primarySport}`;
    if (els.coachStatusPill) els.coachStatusPill.textContent = statusLabel;
    if (els.coachCampusPill) els.coachCampusPill.textContent = campusLabel;
    if (els.coachPrimaryRolePill) els.coachPrimaryRolePill.textContent = primaryRole;
    if (els.coachNotesPreview) els.coachNotesPreview.textContent = notes;

    if (els.firstNameValue) els.firstNameValue.textContent = coach.firstName || "—";
    if (els.lastNameValue) els.lastNameValue.textContent = coach.lastName || "—";
    if (els.emailValue) els.emailValue.textContent = coach.email || "—";
    if (els.phoneValue) els.phoneValue.textContent = coach.phone || "—";
    if (els.roleValue) els.roleValue.textContent = primaryRole;
    if (els.otherRoleValue) els.otherRoleValue.textContent = coach.otherRoleTitle || "—";
    if (els.sportValue) els.sportValue.textContent = primarySport;
    if (els.campusValue) els.campusValue.textContent = campusLabel;
    if (els.statusValue) els.statusValue.textContent = statusLabel;
    if (els.recordIdValue) els.recordIdValue.textContent = coach.id || state.coachId || "—";
    if (els.notesBox) els.notesBox.textContent = notes;

    const uniqueTeamIds = new Set();
    const uniqueSports = new Set();
    const uniqueTeamNames = new Set();
    assignments.forEach(function (assignment) {
      const teamId = assignment.teamId || assignment.team?.id || null;
      const team = resolveTeam(teamId) || assignment.team || null;
      if (teamId) uniqueTeamIds.add(String(teamId));
      const teamName = team?.name || team?.teamName || assignment.teamName || assignment.team?.name || "";
      if (teamName) uniqueTeamNames.add(teamName);
      const sportValue = team?.sport || team?.sportSlug || coach.sport || "";
      if (sportValue) uniqueSports.add(APP.getSportName(sportValue));
    });

    if (els.assignedTeamsStat) els.assignedTeamsStat.textContent = Array.from(uniqueTeamNames).slice(0, 2).join(", ") || "Not assigned";
    if (els.sportsCoveredStat) els.sportsCoveredStat.textContent = String(uniqueSports.size || (coach.sport ? 1 : 0));
    if (els.primaryRoleStat) els.primaryRoleStat.textContent = primaryRole;
    if (els.statusStat) els.statusStat.textContent = statusLabel;
    if (els.primarySportStat) els.primarySportStat.textContent = primarySport;
    if (els.contactReadyStat) els.contactReadyStat.textContent = coach.email || coach.phone ? "Yes" : "No";
    if (els.coachCompletenessStat) els.coachCompletenessStat.innerHTML = completenessMarkup(getCoachCompleteness(coach), true);

    renderAssignments(assignments);
  }

  // Edit Form Prefill
  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateCoachEditForm(coach) {
    const sportSelect = document.getElementById("editCoachSport");
    if (sportSelect) {
      sportSelect.innerHTML = `<option value="">Select sport</option>${APP.SPORT_REGISTRY.map((sport) => `<option value="${escapeHtml(sport.name)}">${escapeHtml(sport.name)}</option>`).join("")}`;
    }
    const teamSelect = document.getElementById("editCoachTeam");
    if (teamSelect) {
      teamSelect.innerHTML = `<option value="">${state.teams.length ? "No team selected" : "No teams available"}</option>${state.teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || team.teamName || "Team")}</option>`).join("")}`;
      teamSelect.disabled = !state.teams.length;
    }
    const primaryAssignment = getAssignments(coach)[0] || {};
    setField("editCoachFirstName", coach.firstName);
    setField("editCoachLastName", coach.lastName);
    setField("editCoachEmail", coach.email);
    setField("editCoachPhone", coach.phone);
    setField("editCoachRole", coach.role);
    setField("editCoachOtherRole", coach.otherRoleTitle);
    setField("editCoachSport", coach.sport);
    setField("editCoachTeam", primaryAssignment.teamId || primaryAssignment.team?.id || coach.teamId || "");
    setField("editCoachAssignmentRole", primaryAssignment.role || primaryAssignment.roleLabel || "");
    setField("editCoachStatus", String(coach.status || "active").toLowerCase());
    setField("editCoachNotes", coach.notes);
  }

  // Save Workflow
  /**
   * Persists coach edits and active team assignment changes in one operational workflow.
   */
  async function handleEditCoachSubmit(event) {
    event.preventDefault();
    clearEditMessage();

    const payload = {
      firstName: getField("editCoachFirstName"),
      lastName: getField("editCoachLastName"),
      email: getField("editCoachEmail") || null,
      phone: getField("editCoachPhone") || null,
      primaryRole: getField("editCoachRole"),
      otherRoleTitle: getField("editCoachOtherRole") || null,
      primarySport: getField("editCoachSport"),
      teamId: getField("editCoachTeam"),
      activeStaffAssignment: getField("editCoachTeam")
        ? {
            teamId: getField("editCoachTeam"),
            role: getField("editCoachAssignmentRole") || getField("editCoachRole"),
            isPrimary: true,
            status: "active"
          }
        : null,
      status: getField("editCoachStatus") || "active",
      notes: getField("editCoachNotes") || null,
      campus: state.session?.campus,
      updatedAt: state.coach?.updatedAt
    };

    if (!payload.firstName || !payload.lastName || !payload.primaryRole || !payload.primarySport) {
      setEditMessage("First name, last name, role, and sport are required.", "error");
      return;
    }

    try {
      if (!APP.confirmReportImpact(getAssignments(state.coach).length)) return;
      await APP.apiPatch(`/coaches/${encodeURIComponent(state.coachId)}`, payload);
      setEditMessage("Coach updated successfully.", "success");
      await Promise.all([loadCoach(), loadCoachAssignments()]);
      renderCoachView();
    } catch (error) {
      setEditMessage(error?.message || "Failed to update coach.", "error");
    }
  }

  // Archive Workflow
  /**
   * Adds archive behavior after data load so warnings can include the current record context.
   */
  function mountArchiveButton() {
    if (!els.editCoachBtn || document.getElementById("archiveCoachBtn")) return;
    const button = document.createElement("button");
    button.id = "archiveCoachBtn";
    button.className = "btn btn-soft";
    button.type = "button";
    button.textContent = "Archive";
    button.addEventListener("click", async function () {
      if (!state.coach || !APP.confirmArchive("coach", state.coach)) return;
      await APP.apiPatch(`/coaches/${encodeURIComponent(state.coachId)}/archive`, { updatedAt: state.coach.updatedAt });
      window.location.href = "coaches.html";
    });
    els.editCoachBtn.insertAdjacentElement("afterend", button);
  }

  function getAssignments(coach) {
    if (!coach) return [];
    const embedded =
      Array.isArray(coach.assignments) ? coach.assignments :
      Array.isArray(coach.teamAssignments) ? coach.teamAssignments :
      Array.isArray(coach.staffAssignments) ? coach.staffAssignments :
      [];
    const merged = [...embedded, ...state.staffAssignments];
    const seen = new Set();
    return merged
      .filter(function (assignment) {
        const coachId = assignment.coachId || assignment.staffId || assignment.coach?.id || state.coachId;
        if (String(coachId || "") !== String(state.coachId)) return false;
        const key = `${assignment.teamId || assignment.team?.id || ""}:${coachId}:${assignment.role || assignment.roleLabel || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(function (assignment) {
        const team = assignment.team || resolveTeam(assignment.teamId || assignment.team?.id);
        return { ...assignment, team };
      });
  }

  function getCoachCompleteness(coach) {
    const checks = [
      coach.firstName,
      coach.lastName,
      coach.role,
      coach.sport,
      coach.email || coach.phone,
      coach.status,
      getAssignments(coach).length,
      coach.notes
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function completenessMarkup(score, large) {
    const normalized = Math.max(0, Math.min(100, Number(score) || 0));
    const wrapperClass = large ? "completeness-large" : "completeness-cell";
    return `<div class="${wrapperClass}"><span class="completeness-ring" style="--score:${normalized}"></span><span class="completeness-text">${normalized}%</span></div>`;
  }

  // Assignments
  /**
   * Renders the assignments section from normalized page state without mutating backend data.
   */
  function renderAssignments(assignments) {
    if (!els.assignmentTableBody || !els.assignmentTableWrap || !els.assignmentEmptyState) return;
    els.assignmentTableBody.innerHTML = "";

    if (!assignments.length) {
      els.assignmentTableWrap.classList.add("hidden");
      els.assignmentEmptyState.classList.remove("hidden");
      return;
    }

    els.assignmentTableWrap.classList.remove("hidden");
    els.assignmentEmptyState.classList.add("hidden");

    const fragment = document.createDocumentFragment();
    assignments.forEach(function (assignment) {
      const teamId = assignment.teamId || assignment.team?.id || null;
      const team = resolveTeam(teamId) || assignment.team || null;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(team?.name || team?.teamName || assignment.teamName || assignment.team?.name || "Unknown Team")}</td>
        <td>${escapeHtml(APP.getSportName(team?.sport || team?.sportSlug || "") || "—")}</td>
        <td>${escapeHtml(formatRole(assignment.role, assignment.otherRoleTitle))}</td>
        <td>${assignment.isPrimary ? "Yes" : "No"}</td>
        <td>${escapeHtml(team?.seasonLabel || team?.season || "—")}</td>
        <td>${escapeHtml(formatGenericStatus(team?.status))}</td>
        <td>${team?.id ? `<a class="btn btn-campus" href="team-view.html?id=${encodeURIComponent(String(team.id))}">View Team</a>` : "—"}</td>
      `;
      fragment.appendChild(row);
    });
    els.assignmentTableBody.appendChild(fragment);
  }

  // Teams Summary
  /**
   * Renders the teams summary section from normalized page state without mutating backend data.
   */
  function renderTeamsSummary(assignments) {
    if (!els.teamsSummaryBody || !els.teamsSummaryWrap || !els.teamsSummaryEmptyState) return;
    els.teamsSummaryBody.innerHTML = "";

    const uniqueTeamIds = Array.from(new Set(assignments.map(function (assignment) {
      return String(assignment.teamId || assignment.team?.id || "").trim();
    }).filter(Boolean)));

    if (!uniqueTeamIds.length) {
      els.teamsSummaryWrap.classList.add("hidden");
      els.teamsSummaryEmptyState.classList.remove("hidden");
      return;
    }

    els.teamsSummaryWrap.classList.remove("hidden");
    els.teamsSummaryEmptyState.classList.add("hidden");

    const fragment = document.createDocumentFragment();
    uniqueTeamIds.forEach(function (teamId) {
      const team = resolveTeam(teamId);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(team?.name || team?.teamName || "Unknown Team")}</td>
        <td>${escapeHtml(APP.getSportName(team?.sport || team?.sportSlug || "") || "—")}</td>
        <td>${escapeHtml(stringValue(team?.rosterCount))}</td>
        <td>${escapeHtml(stringValue(team?.staffCount))}</td>
        <td>${team?.id ? `<a class="btn btn-campus" href="team-view.html?id=${encodeURIComponent(String(team.id))}">Open</a>` : "—"}</td>
      `;
      fragment.appendChild(row);
    });
    els.teamsSummaryBody.appendChild(fragment);
  }

  function resolveTeam(teamId) {
    return state.teams.find(function (team) {
      return String(team.id) === String(teamId);
    }) || null;
  }

  // Empty State
  /**
   * Renders the empty state section from normalized page state without mutating backend data.
   */
  function renderEmptyState(title, message) {
    if (els.assignmentTableWrap) els.assignmentTableWrap.classList.add("hidden");
    if (els.assignmentEmptyState) {
      els.assignmentEmptyState.classList.remove("hidden");
      const h3 = els.assignmentEmptyState.querySelector("h3");
      const p = els.assignmentEmptyState.querySelector("p");
      if (h3) h3.textContent = title;
      if (p) p.textContent = message;
    }
    if (els.teamsSummaryWrap) els.teamsSummaryWrap.classList.add("hidden");
    if (els.teamsSummaryEmptyState) els.teamsSummaryEmptyState.classList.remove("hidden");
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

  function formatStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    switch (normalized) {
      case "active": return "Active";
      case "inactive": return "Inactive";
      case "on_leave":
      case "on leave": return "On Leave";
      default: return status ? toTitleCase(String(status).replace(/_/g, " ")) : "—";
    }
  }

  function formatGenericStatus(status) {
    if (!status) return "—";
    return toTitleCase(String(status).replace(/_/g, " ").toLowerCase());
  }

  function stringValue(value) {
    return value === null || value === undefined || value === "" ? "—" : String(value);
  }

  function setField(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value == null ? "" : String(value);
  }

  function getField(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function setEditMessage(message, type) {
    if (!els.coachEditMessage) return;
    els.coachEditMessage.className = `message ${type || ""}`.trim();
    els.coachEditMessage.textContent = message || "";
  }

  function clearEditMessage() {
    setEditMessage("", "");
  }

  function setError(message) {
    if (!els.pageMessage) return;
    els.pageMessage.className = "message error is-visible";
    els.pageMessage.textContent = message || "";
  }

  // Messages and UI State
  /**
   * Resets message state before a new fetch or submit attempt.
   */
  function clearMessage() {
    if (!els.pageMessage) return;
    els.pageMessage.className = "message";
    els.pageMessage.textContent = "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toTitleCase(value) {
    return String(value || "")
      .split(" ")
      .filter(Boolean)
      .map(function (word) { return word.charAt(0).toUpperCase() + word.slice(1); })
      .join(" ");
  }
})();
