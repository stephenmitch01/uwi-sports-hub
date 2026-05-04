(() => {
  "use strict";

  const APP = window.UWISportsHub;

  const state = {
    session: null,
    athletes: [],
    teams: []
  };

  const els = {
    pageMessage: document.getElementById("athletePageMessage"),
    athletesTableBody: document.getElementById("athletesTableBody"),

    campusNameNodes: Array.from(document.querySelectorAll("[data-campus-name]")),

    searchInput: document.getElementById("athleteSearch"),
    statusFilter: document.getElementById("athleteStatus"),
    athleteTypeFilter: document.getElementById("athleteTypeFilter"),
    athleteSportFilter: document.getElementById("athleteSportFilter"),

    athleteCreateForm: document.getElementById("athleteCreateForm"),
    athleteEditForm: document.getElementById("athleteEditForm"),
    editAthleteSelect: document.getElementById("editAthleteSelect"),

    createAthleteFirstName: document.getElementById("createAthleteFirstName"),
    createAthleteLastName: document.getElementById("createAthleteLastName"),
    createAthleteType: document.getElementById("createAthleteType"),
    createAthleteEmail: document.getElementById("createAthleteEmail"),
    createAthletePhone: document.getElementById("createAthletePhone"),
    createAthleteStudentId: document.getElementById("createAthleteStudentId"),
    createAthleteYear: document.getElementById("createAthleteYear"),
    createAthleteFaculty: document.getElementById("createAthleteFaculty"),
    createAthleteStatus: document.getElementById("createAthleteStatus"),
    createAthletePrimarySport: document.getElementById("createAthletePrimarySport"),
    createAthletePosition: document.getElementById("createAthletePosition"),
    createAthleteEvents: document.getElementById("createAthleteEvents"),
    createAthleteHeight: document.getElementById("createAthleteHeight"),
    createAthleteWeight: document.getElementById("createAthleteWeight"),
    createAthleteHand: document.getElementById("createAthleteHand"),
    createAthleteLeg: document.getElementById("createAthleteLeg"),
    createAthleteTeam: document.getElementById("createAthleteTeam"),
    createAthleteRole: document.getElementById("createAthleteRole"),
    createAthleteJersey: document.getElementById("createAthleteJersey"),
    createAthleteCaptain: document.getElementById("createAthleteCaptain"),

    editAthleteFirstName: document.getElementById("editAthleteFirstName"),
    editAthleteLastName: document.getElementById("editAthleteLastName"),
    editAthleteType: document.getElementById("editAthleteType"),
    editAthleteEmail: document.getElementById("editAthleteEmail"),
    editAthletePhone: document.getElementById("editAthletePhone"),
    editAthleteStudentId: document.getElementById("editAthleteStudentId"),
    editAthleteYear: document.getElementById("editAthleteYear"),
    editAthleteFaculty: document.getElementById("editAthleteFaculty"),
    editAthleteStatus: document.getElementById("editAthleteStatus"),
    editAthletePrimarySport: document.getElementById("editAthletePrimarySport"),
    editAthletePosition: document.getElementById("editAthletePosition"),
    editAthleteEvents: document.getElementById("editAthleteEvents"),
    editAthleteHeight: document.getElementById("editAthleteHeight"),
    editAthleteWeight: document.getElementById("editAthleteWeight"),
    editAthleteHand: document.getElementById("editAthleteHand"),
    editAthleteLeg: document.getElementById("editAthleteLeg"),
    editAthleteTeam: document.getElementById("editAthleteTeam"),
    editAthleteRole: document.getElementById("editAthleteRole"),
    editAthleteJersey: document.getElementById("editAthleteJersey"),
    editAthleteCaptain: document.getElementById("editAthleteCaptain")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      const session = await APP.mountSignedInShell({
        active: "athletes",
        contextLabel: "Athletes"
      });
      if (!session) return;

      state.session = session;

      addHeadshotFieldIfMissing("create");
      addHeadshotFieldIfMissing("edit");

      populateCampusLabels();
      populateSportSelects();
      bindFilters();
      bindCreateForm();
      bindEditForm();

      await refreshData();
      clearMessage();
    } catch (error) {
      console.error("Athletes page init error:", error);
      setError(error?.message || "Failed to load athlete records.");
    }
  }

  async function refreshData(selectedAthleteId = "") {
    const [teamsPayload, athletesPayload] = await Promise.all([
      apiGet("/teams", true),
      apiGet("/athletes", true)
    ]);

    state.teams = normalizeCollection(teamsPayload, ["teams", "data", "items"])
      .map(normalizeTeamRecord);

    state.athletes = normalizeCollection(athletesPayload, ["athletes", "data", "items"])
      .map(normalizeAthleteRecord);

    populateCampusTeamSelects(selectedAthleteId ? getSelectedAthleteTeamId(selectedAthleteId) : "");
    renderAll(selectedAthleteId);
  }

  function bindFilters() {
    [els.searchInput, els.statusFilter, els.athleteTypeFilter, els.athleteSportFilter].forEach((node) => {
      if (!node) return;
      node.addEventListener("input", renderAthletesTable);
      node.addEventListener("change", renderAthletesTable);
    });
  }

  function bindCreateForm() {
    if (!els.athleteCreateForm) return;

    els.athleteCreateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage();

      const payload = await collectAthleteFormPayload("create");

      if (!payload.firstName || !payload.lastName) {
        setError("Enter the athlete’s first and last name.");
        return;
      }

      try {
        await apiPost("/athletes", buildAthleteRecord(payload));
        els.athleteCreateForm.reset();
        const createPreview = document.getElementById("createAthleteHeadshotPreview");
        if (createPreview) createPreview.textContent = "Optional athlete headshot.";
        await refreshData();
        setSuccess("Athlete added successfully.");
      } catch (error) {
        console.error("Create athlete failed:", error);
        setError(error?.message || "Failed to add athlete.");
      }
    });
  }

  function bindEditForm() {
    if (els.editAthleteSelect) {
      els.editAthleteSelect.addEventListener("change", () => {
        loadSelectedAthleteIntoForm(els.editAthleteSelect.value);
      });
    }

    if (!els.athleteEditForm) return;

    els.athleteEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage();

      const athleteId = String(els.editAthleteSelect?.value || "").trim();
      if (!athleteId) {
        setError("Select an athlete to edit.");
        return;
      }

      const athlete = state.athletes.find((item) => String(item.id) === athleteId);
      if (!athlete) {
        setError("Selected athlete could not be found.");
        return;
      }

      const payload = await collectAthleteFormPayload("edit");
      if (!payload.firstName || !payload.lastName) {
        setError("Enter the athlete’s first and last name.");
        return;
      }

      try {
        await apiPatch(`/athletes/${encodeURIComponent(athleteId)}`, buildAthleteRecord(payload, athlete));
        await refreshData(athleteId);
        setSuccess("Athlete updated successfully.");
      } catch (error) {
        console.error("Update athlete failed:", error);
        setError(error?.message || "Failed to update athlete.");
      }
    });
  }

  function renderAll(selectedAthleteId = "") {
    renderAthleteEditSelect(selectedAthleteId);
    renderAthletesTable();
  }

  function populateCampusLabels() {
    const campusLabel = APP.getCampusMeta(state.session.campus).name;
    els.campusNameNodes.forEach((node) => {
      node.textContent = campusLabel;
    });
  }

  function populateSportSelects() {
    const options = APP.SPORT_REGISTRY.map(
      (sport) => `<option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>`
    ).join("");

    const createOptions = `<option value="">Not set</option>${options}`;
    const filterOptions = `<option value="">All sports</option>${options}`;

    if (els.createAthletePrimarySport) els.createAthletePrimarySport.innerHTML = createOptions;
    if (els.editAthletePrimarySport) els.editAthletePrimarySport.innerHTML = createOptions;
    if (els.athleteSportFilter) els.athleteSportFilter.innerHTML = filterOptions;
  }

  function populateCampusTeamSelects(selectedTeamId = "") {
    const teams = getCampusTeams();

    const options = [
      `<option value="">No squad selected</option>`,
      ...teams.map((team) => {
        const selected = String(selectedTeamId) === String(team.id) ? "selected" : "";
        return `<option value="${escapeHtml(team.id)}" ${selected}>${escapeHtml(team.name || "Team")}</option>`;
      })
    ].join("");

    if (els.createAthleteTeam) els.createAthleteTeam.innerHTML = options;
    if (els.editAthleteTeam) els.editAthleteTeam.innerHTML = options;
  }

  function renderAthleteEditSelect(selectedAthleteId = "") {
    if (!els.editAthleteSelect) return;

    const athletes = getCampusAthletes();

    if (!athletes.length) {
      els.editAthleteSelect.innerHTML = `<option value="">No athletes available</option>`;
      clearEditForm();
      return;
    }

    els.editAthleteSelect.innerHTML = `
      <option value="">Select athlete</option>
      ${athletes.map((athlete) => {
        const selected = String(selectedAthleteId) === String(athlete.id) ? "selected" : "";
        return `<option value="${escapeHtml(athlete.id)}" ${selected}>${escapeHtml(athlete.fullName || "Athlete")}</option>`;
      }).join("")}
    `;

    if (selectedAthleteId) {
      loadSelectedAthleteIntoForm(selectedAthleteId);
    }
  }

  function loadSelectedAthleteIntoForm(athleteId) {
    const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));

    if (!athlete || normalizeCampus(athlete.campus) !== normalizeCampus(state.session.campus)) {
      clearEditForm();
      return;
    }

    const profile = athlete.profile || {};
    const roster = athlete.activeRosterAssignment || null;

    if (els.editAthleteFirstName) els.editAthleteFirstName.value = athlete.firstName || "";
    if (els.editAthleteLastName) els.editAthleteLastName.value = athlete.lastName || "";
    if (els.editAthleteType) els.editAthleteType.value = athlete.athleteType || "student-athlete";
    if (els.editAthleteEmail) els.editAthleteEmail.value = athlete.email || "";
    if (els.editAthletePhone) els.editAthletePhone.value = athlete.phone || "";
    if (els.editAthleteStudentId) els.editAthleteStudentId.value = athlete.studentId || "";
    if (els.editAthleteYear) els.editAthleteYear.value = athlete.yearOfStudy || "";
    if (els.editAthleteFaculty) els.editAthleteFaculty.value = athlete.facultyProgram || "";
    if (els.editAthleteStatus) els.editAthleteStatus.value = normalizeStatus(athlete.status);
    if (els.editAthletePrimarySport) els.editAthletePrimarySport.value = profile.sportSlug || "";
    if (els.editAthletePosition) els.editAthletePosition.value = profile.position || "";
    if (els.editAthleteEvents) els.editAthleteEvents.value = profile.eventsSpecialties || "";
    if (els.editAthleteHeight) els.editAthleteHeight.value = stringifyNullable(profile.heightCm);
    if (els.editAthleteWeight) els.editAthleteWeight.value = stringifyNullable(profile.weightKg);
    if (els.editAthleteHand) els.editAthleteHand.value = profile.dominantHand || "";
    if (els.editAthleteLeg) els.editAthleteLeg.value = profile.dominantLeg || "";

    populateCampusTeamSelects(roster?.teamId || "");

    if (els.editAthleteRole) els.editAthleteRole.value = roster?.roleLabel || "";
    if (els.editAthleteJersey) els.editAthleteJersey.value = roster?.jerseyNumber || "";
    if (els.editAthleteCaptain) els.editAthleteCaptain.value = roster?.isCaptain ? "true" : "false";

    const headshotPreview = document.getElementById("editAthleteHeadshotPreview");
    if (headshotPreview) {
      headshotPreview.textContent = athlete.imageUrl ? "Headshot loaded for this athlete." : "No headshot currently saved.";
    }
  }

  function clearEditForm() {
    [
      els.editAthleteFirstName,
      els.editAthleteLastName,
      els.editAthleteEmail,
      els.editAthletePhone,
      els.editAthleteStudentId,
      els.editAthleteYear,
      els.editAthleteFaculty,
      els.editAthletePosition,
      els.editAthleteEvents,
      els.editAthleteHeight,
      els.editAthleteWeight,
      els.editAthleteHand,
      els.editAthleteLeg,
      els.editAthleteRole,
      els.editAthleteJersey
    ].forEach((node) => {
      if (node) node.value = "";
    });

    if (els.editAthleteType) els.editAthleteType.value = "student-athlete";
    if (els.editAthleteStatus) els.editAthleteStatus.value = "active";
    if (els.editAthletePrimarySport) els.editAthletePrimarySport.value = "";
    if (els.editAthleteCaptain) els.editAthleteCaptain.value = "false";

    const fileInput = document.getElementById("editAthleteHeadshot");
    if (fileInput) fileInput.value = "";

    const preview = document.getElementById("editAthleteHeadshotPreview");
    if (preview) preview.textContent = "No athlete selected.";

    populateCampusTeamSelects("");
  }

  function renderAthletesTable() {
    if (!els.athletesTableBody) return;

    const athletes = getFilteredAthletes();

    if (!athletes.length) {
      els.athletesTableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <h3>No athlete records match the current filters.</h3>
              <p>Add or edit athlete records to begin building profiles, squad assignments, and athlete-view routing.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    els.athletesTableBody.innerHTML = athletes.map((athlete) => {
      const profile = athlete.profile || {};
      const roster = athlete.activeRosterAssignment || null;
      const team = roster ? state.teams.find((item) => String(item.id) === String(roster.teamId)) : null;

      return `
        <tr>
          <td><strong>${escapeHtml(athlete.fullName || "Athlete")}</strong></td>
          <td>${escapeHtml(getSportName(profile.sportSlug || "") || "—")}</td>
          <td>${escapeHtml(team?.name || "—")}</td>
          <td>${escapeHtml(athlete.email || "—")}</td>
          <td>${escapeHtml(formatAthleteType(athlete.athleteType))}</td>
          <td>${escapeHtml(normalizeStatus(athlete.status) === "inactive" ? "Inactive" : "Active")}</td>
          <td>${athlete.imageUrl ? "Yes" : "No"}</td>
          <td><a class="btn btn-soft" href="athlete-view.html?athleteId=${encodeURIComponent(athlete.id)}">Open</a></td>
        </tr>
      `;
    }).join("");
  }

  async function collectAthleteFormPayload(mode) {
    const isEdit = mode === "edit";

    const firstName = getValue(isEdit ? els.editAthleteFirstName : els.createAthleteFirstName);
    const lastName = getValue(isEdit ? els.editAthleteLastName : els.createAthleteLastName);

    const payload = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      athleteType: getValue(isEdit ? els.editAthleteType : els.createAthleteType) || "student-athlete",
      email: getValue(isEdit ? els.editAthleteEmail : els.createAthleteEmail),
      phone: getValue(isEdit ? els.editAthletePhone : els.createAthletePhone),
      studentId: getValue(isEdit ? els.editAthleteStudentId : els.createAthleteStudentId),
      yearOfStudy: getValue(isEdit ? els.editAthleteYear : els.createAthleteYear),
      facultyProgram: getValue(isEdit ? els.editAthleteFaculty : els.createAthleteFaculty),
      status: getValue(isEdit ? els.editAthleteStatus : els.createAthleteStatus) || "active",
      primarySport: getValue(isEdit ? els.editAthletePrimarySport : els.createAthletePrimarySport),
      position: getValue(isEdit ? els.editAthletePosition : els.createAthletePosition),
      eventsSpecialties: getValue(isEdit ? els.editAthleteEvents : els.createAthleteEvents),
      heightCm: toNullableNumber(getValue(isEdit ? els.editAthleteHeight : els.createAthleteHeight)),
      weightKg: toNullableNumber(getValue(isEdit ? els.editAthleteWeight : els.createAthleteWeight)),
      dominantHand: getValue(isEdit ? els.editAthleteHand : els.createAthleteHand),
      dominantLeg: getValue(isEdit ? els.editAthleteLeg : els.createAthleteLeg),
      teamId: getValue(isEdit ? els.editAthleteTeam : els.createAthleteTeam),
      roleLabel: getValue(isEdit ? els.editAthleteRole : els.createAthleteRole),
      jerseyNumber: getValue(isEdit ? els.editAthleteJersey : els.createAthleteJersey),
      isCaptain: getValue(isEdit ? els.editAthleteCaptain : els.createAthleteCaptain) === "true",
      imageUrl: ""
    };

    const fileInput = document.getElementById(isEdit ? "editAthleteHeadshot" : "createAthleteHeadshot");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      payload.imageUrl = await readFileAsDataUrl(fileInput.files[0]);
    }

    return payload;
  }

  function buildAthleteRecord(payload, existingAthlete) {
    const base = existingAthlete && typeof existingAthlete === "object" ? existingAthlete : {};
    const profile = base.profile && typeof base.profile === "object" ? base.profile : {};
    const roster = base.activeRosterAssignment && typeof base.activeRosterAssignment === "object"
      ? base.activeRosterAssignment
      : null;

    return {
      ...base,
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName: payload.fullName,
      athleteType: payload.athleteType,
      email: payload.email,
      phone: payload.phone,
      studentId: payload.studentId,
      yearOfStudy: payload.yearOfStudy,
      facultyProgram: payload.facultyProgram,
      status: payload.status,
      campus: normalizeCampus(state.session.campus),
      imageUrl: payload.imageUrl || base.imageUrl || "",
      profile: {
        ...profile,
        sportSlug: payload.primarySport,
        position: payload.position,
        eventsSpecialties: payload.eventsSpecialties,
        heightCm: payload.heightCm,
        weightKg: payload.weightKg,
        dominantHand: payload.dominantHand,
        dominantLeg: payload.dominantLeg
      },
      activeRosterAssignment: payload.teamId
        ? {
            ...(roster || {}),
            teamId: payload.teamId,
            roleLabel: payload.roleLabel,
            jerseyNumber: payload.jerseyNumber,
            isCaptain: payload.isCaptain,
            status: "active"
          }
        : null
    };
  }

  function getFilteredAthletes() {
    const athletes = getCampusAthletes();
    const searchValue = String(els.searchInput?.value || "").trim().toLowerCase();
    const statusValue = String(els.statusFilter?.value || "").trim().toLowerCase();
    const athleteTypeValue = String(els.athleteTypeFilter?.value || "").trim().toLowerCase();
    const sportFilterValue = String(els.athleteSportFilter?.value || "").trim().toLowerCase();

    return athletes
      .filter((athlete) => {
        const profile = athlete.profile || {};

        const matchesSearch =
          !searchValue ||
          String(athlete.fullName || "").toLowerCase().includes(searchValue) ||
          String(athlete.firstName || "").toLowerCase().includes(searchValue) ||
          String(athlete.lastName || "").toLowerCase().includes(searchValue) ||
          String(athlete.email || "").toLowerCase().includes(searchValue) ||
          String(athlete.phone || "").toLowerCase().includes(searchValue) ||
          String(athlete.studentId || "").toLowerCase().includes(searchValue) ||
          String(athlete.id || "").toLowerCase().includes(searchValue);

        const matchesStatus = !statusValue || normalizeStatus(athlete.status) === statusValue;
        const matchesAthleteType = !athleteTypeValue || String(athlete.athleteType || "").toLowerCase() === athleteTypeValue;
        const matchesSport = !sportFilterValue || String(profile.sportSlug || "").toLowerCase() === sportFilterValue;

        return matchesSearch && matchesStatus && matchesAthleteType && matchesSport;
      })
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
  }

  function getCampusAthletes() {
    return state.athletes.filter(
      (athlete) => normalizeCampus(athlete.campus || state.session.campus) === normalizeCampus(state.session.campus)
    );
  }

  function getCampusTeams() {
    return state.teams.filter(
      (team) => normalizeCampus(team.campus || state.session.campus) === normalizeCampus(state.session.campus)
    );
  }

  function getSelectedAthleteTeamId(athleteId) {
    const athlete = state.athletes.find((item) => String(item.id) === String(athleteId));
    return athlete?.activeRosterAssignment?.teamId || "";
  }

  function addHeadshotFieldIfMissing(mode) {
    const form = mode === "edit" ? els.athleteEditForm : els.athleteCreateForm;
    if (!form) return;

    const fieldId = mode === "edit" ? "editAthleteHeadshot" : "createAthleteHeadshot";
    if (document.getElementById(fieldId)) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <label for="${fieldId}">Headshot</label>
      <input id="${fieldId}" class="input" type="file" accept="image/*" />
      <div class="fine" id="${fieldId}Preview">${mode === "edit" ? "No athlete selected." : "Optional athlete headshot."}</div>
    `;

    const actions = form.querySelector(".form-actions");
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(wrapper, actions);
    } else {
      form.appendChild(wrapper);
    }
  }

  function normalizeCollection(payload, keys) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    if (payload.data && typeof payload.data === "object") {
      for (const key of keys) {
        if (Array.isArray(payload.data[key])) return payload.data[key];
      }
    }
    return [];
  }

  function normalizeTeamRecord(team) {
    if (!team || typeof team !== "object") return {};
    return {
      ...team,
      id: team.id || team.teamId || team._id || APP.cryptoRandomId(),
      name: team.name || team.teamName || "Team",
      campus: normalizeCampus(team.campus || team.campusSlug || state.session?.campus),
      sportSlug: APP.normalizeSportSlug(team.sportSlug || team.sport || "")
    };
  }

  function normalizeAthleteRecord(athlete) {
    if (!athlete || typeof athlete !== "object") return {};
    const profile = athlete.profile && typeof athlete.profile === "object" ? athlete.profile : {};
    const roster = athlete.activeRosterAssignment && typeof athlete.activeRosterAssignment === "object"
      ? athlete.activeRosterAssignment
      : null;

    return {
      ...athlete,
      id: athlete.id || athlete.athleteId || athlete._id || APP.cryptoRandomId(),
      firstName: athlete.firstName || athlete.givenName || "",
      lastName: athlete.lastName || athlete.familyName || "",
      fullName: athlete.fullName || `${athlete.firstName || athlete.givenName || ""} ${athlete.lastName || athlete.familyName || ""}`.trim(),
      athleteType: athlete.athleteType || athlete.type || "student-athlete",
      email: athlete.email || "",
      phone: athlete.phone || "",
      studentId: athlete.studentId || "",
      yearOfStudy: athlete.yearOfStudy || "",
      facultyProgram: athlete.facultyProgram || "",
      status: athlete.status || "active",
      campus: normalizeCampus(athlete.campus || athlete.campusSlug || state.session?.campus),
      imageUrl: athlete.imageUrl || athlete.headshotUrl || "",
      profile: {
        ...profile,
        sportSlug: APP.normalizeSportSlug(profile.sportSlug || athlete.primarySport || athlete.sport || ""),
        position: profile.position || "",
        eventsSpecialties: profile.eventsSpecialties || "",
        heightCm: profile.heightCm ?? null,
        weightKg: profile.weightKg ?? null,
        dominantHand: profile.dominantHand || "",
        dominantLeg: profile.dominantLeg || ""
      },
      activeRosterAssignment: roster
        ? {
            ...roster,
            teamId: roster.teamId || roster.team?.id || "",
            roleLabel: roster.roleLabel || "",
            jerseyNumber: roster.jerseyNumber || "",
            isCaptain: Boolean(roster.isCaptain)
          }
        : null
    };
  }

  async function apiGet(path, tolerateFailure = false) {
    return APP.apiGet(path, tolerateFailure);
  }

  async function apiPost(path, body) {
    return APP.apiPost(path, body);
  }

  async function apiPatch(path, body) {
    return APP.apiPatch(path, body);
  }

  function getValue(node) {
    return String(node?.value || "").trim();
  }

  function toNullableNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function stringifyNullable(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
  }

  function normalizeCampus(value) {
    return APP.normalizeCampus(value);
  }

  function formatAthleteType(value) {
    const raw = String(value || "").trim();
    if (!raw) return "—";
    return raw
      .split(/[\s_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getSportName(slug) {
    return APP.getSportName(slug);
  }

  function setSuccess(message) {
    APP.showMessage?.(els.pageMessage, message, "success");
  }

  function setError(message) {
    APP.showMessage?.(els.pageMessage, message, "error");
  }

  function clearMessage() {
    APP.clearMessage?.(els.pageMessage);
  }

  function escapeHtml(value) {
    return APP.escapeHtml(value);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.USH_ATHLETES_DEBUG = {
    get session() {
      return state.session;
    },
    get athletes() {
      return state.athletes;
    },
    get teams() {
      return state.teams;
    },
    async refresh() {
      await refreshData();
      return state.athletes;
    }
  };
})();
