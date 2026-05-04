/* =========================================================
   UWI Sports Hub — Coach View Page
   Backend-ready / no sample data / session-protected
========================================================= */

(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const state = {
    session: null,
    coachId: null,
    coach: null,
    teams: []
  };

  const els = {
    pageMessage: document.getElementById("pageMessage"),
    coachNameHeading: document.getElementById("coachNameHeading"),
    coachRoleSportLine: document.getElementById("coachRoleSportLine"),
    coachStatusPill: document.getElementById("coachStatusPill"),
    coachCampusPill: document.getElementById("coachCampusPill"),
    coachPrimaryRolePill: document.getElementById("coachPrimaryRolePill"),
    coachNotesPreview: document.getElementById("coachNotesPreview"),
    editCoachBtn: document.getElementById("editCoachBtn"),
    printBtn: document.getElementById("printBtn"),
    assignedTeamsStat: document.getElementById("assignedTeamsStat"),
    sportsCoveredStat: document.getElementById("sportsCoveredStat"),
    primaryRoleStat: document.getElementById("primaryRoleStat"),
    statusStat: document.getElementById("statusStat"),
    primarySportStat: document.getElementById("primarySportStat"),
    contactReadyStat: document.getElementById("contactReadyStat"),
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

      await Promise.all([loadCoach(), loadTeams()]);
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

  function bindStaticEvents() {
    if (els.printBtn) {
      els.printBtn.addEventListener("click", function () {
        window.print();
      });
    }
  }

  function getCoachIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("id") || params.get("coachId") || "").trim();
  }

  async function loadCoach() {
    const data = await APP.apiGet(`/coaches/${encodeURIComponent(state.coachId)}`);
    state.coach = normalizeCoach(data?.coach || data?.data?.coach || data?.data || data || null);
  }

  async function loadTeams() {
    const data = await APP.apiGet("/teams", true);
    state.teams =
      Array.isArray(data?.teams) ? data.teams :
      Array.isArray(data?.data?.teams) ? data.data.teams :
      Array.isArray(data?.data) ? data.data :
      [];
  }

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

  function renderCoachView() {
    const coach = state.coach;
    const assignments = getAssignments(coach);
    const primaryRole = formatRole(coach.role, coach.otherRoleTitle);
    const primarySport = APP.getSportName(coach.sport || "") || "Sport not set";
    const campusLabel = APP.getCampusMeta(coach.campus).name;
    const statusLabel = formatStatus(coach.status);
    const notes = coach.notes || "No notes available for this coach/staff record yet.";

    if (els.editCoachBtn) {
      els.editCoachBtn.href = `coaches.html?coachId=${encodeURIComponent(String(coach.id || state.coachId))}`;
    }

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
    assignments.forEach(function (assignment) {
      const teamId = assignment.teamId || assignment.team?.id || null;
      const team = resolveTeam(teamId) || assignment.team || null;
      if (teamId) uniqueTeamIds.add(String(teamId));
      const sportValue = team?.sport || team?.sportSlug || coach.sport || "";
      if (sportValue) uniqueSports.add(APP.getSportName(sportValue));
    });

    if (els.assignedTeamsStat) els.assignedTeamsStat.textContent = String(uniqueTeamIds.size);
    if (els.sportsCoveredStat) els.sportsCoveredStat.textContent = String(uniqueSports.size || (coach.sport ? 1 : 0));
    if (els.primaryRoleStat) els.primaryRoleStat.textContent = primaryRole;
    if (els.statusStat) els.statusStat.textContent = statusLabel;
    if (els.primarySportStat) els.primarySportStat.textContent = primarySport;
    if (els.contactReadyStat) els.contactReadyStat.textContent = coach.email || coach.phone ? "Yes" : "No";

    renderAssignments(assignments);
    renderTeamsSummary(assignments);
  }

  function getAssignments(coach) {
    if (!coach) return [];
    if (Array.isArray(coach.assignments)) return coach.assignments;
    if (Array.isArray(coach.teamAssignments)) return coach.teamAssignments;
    if (Array.isArray(coach.staffAssignments)) return coach.staffAssignments;
    return [];
  }

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
        <td>${escapeHtml(team?.name || team?.teamName || "Unknown Team")}</td>
        <td>${escapeHtml(APP.getSportName(team?.sport || team?.sportSlug || "") || "—")}</td>
        <td>${escapeHtml(formatRole(assignment.role, assignment.otherRoleTitle))}</td>
        <td>${assignment.isPrimary ? "Yes" : "No"}</td>
        <td>${escapeHtml(team?.seasonLabel || team?.season || "—")}</td>
        <td>${escapeHtml(formatGenericStatus(team?.status))}</td>
        <td>${team?.id ? `<a class="link-btn" href="team-view.html?id=${encodeURIComponent(String(team.id))}">View Team</a>` : "—"}</td>
      `;
      fragment.appendChild(row);
    });
    els.assignmentTableBody.appendChild(fragment);
  }

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
        <td>${team?.id ? `<a class="link-btn" href="team-view.html?id=${encodeURIComponent(String(team.id))}">Open</a>` : "—"}</td>
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

  function setError(message) {
    if (!els.pageMessage) return;
    els.pageMessage.className = "message error is-visible";
    els.pageMessage.textContent = message || "";
  }

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
