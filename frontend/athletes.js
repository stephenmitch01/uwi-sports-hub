(() => {
  "use strict";

  // Shared App Access
  /**
   * Athlete registry workflow.
   *
   * This page owns create/edit/search interactions while preserving the
   * multi-sport/team model consumed by scorecards, team views, athlete reports,
   * leaderboards, and profile completeness summaries.
   */
  const APP = window.UWISportsHub;

  // Page State
  const state = {
    session: null,
    athletes: [],
    teams: [],
    selectedAthleteIds: new Set(),
    registrySearchApplied: false
  };

  // Page Elements
  const els = {
    pageMessage: document.getElementById("athletePageMessage"),
    athletesTableBody: document.getElementById("athletesTableBody"),
    totalAthletesStat: document.getElementById("totalAthletesStat"),
    activeAthletesStat: document.getElementById("activeAthletesStat"),
    assignedAthletesStat: document.getElementById("assignedAthletesStat"),
    athleteSportsStat: document.getElementById("athleteSportsStat"),
    incompleteAthletesStat: document.getElementById("incompleteAthletesStat"),
    athleteAlerts: document.getElementById("athleteAlerts"),
    athleteActivity: document.getElementById("athleteActivity"),
    athleteQualityScore: document.getElementById("athleteQualityScore"),
    athleteQualityBar: document.getElementById("athleteQualityBar"),
    athleteQualityCopy: document.getElementById("athleteQualityCopy"),

    campusNameNodes: Array.from(document.querySelectorAll("[data-campus-name]")),

    searchInput: document.getElementById("athleteSearch"),
    statusFilter: document.getElementById("athleteStatus"),
    athleteTypeFilter: document.getElementById("athleteTypeFilter"),
    athleteGenderFilter: document.getElementById("athleteGenderFilter"),
    athleteSportFilter: document.getElementById("athleteSportFilter"),
    athleteQualityFilter: document.getElementById("athleteQualityFilter"),
    athleteSearchButton: document.getElementById("athleteSearchButton"),
    athleteSelectAll: document.getElementById("athleteSelectAll"),
    athleteBulkActionBar: document.getElementById("athleteBulkActionBar"),
    athleteBulkCount: document.getElementById("athleteBulkCount"),
    bulkAssignTeamSelect: document.getElementById("bulkAssignTeamSelect"),
    bulkAssignTeamButton: document.getElementById("bulkAssignTeamButton"),
    bulkClearSelectionButton: document.getElementById("bulkClearSelectionButton"),

    athleteCreateForm: document.getElementById("athleteCreateForm"),
    athleteEditForm: document.getElementById("athleteEditForm"),
    editAthleteSelect: document.getElementById("editAthleteSelect"),

    createAthleteFirstName: document.getElementById("createAthleteFirstName"),
    createAthleteLastName: document.getElementById("createAthleteLastName"),
    createAthleteType: document.getElementById("createAthleteType"),
    createAthleteDateOfBirth: document.getElementById("createAthleteDateOfBirth"),
    createAthleteGender: document.getElementById("createAthleteGender"),
    createAthleteEmail: document.getElementById("createAthleteEmail"),
    createAthletePhone: document.getElementById("createAthletePhone"),
    createAthleteStudentId: document.getElementById("createAthleteStudentId"),
    createAthleteYear: document.getElementById("createAthleteYear"),
    createAthleteFaculty: document.getElementById("createAthleteFaculty"),
    createAthleteProgram: document.getElementById("createAthleteProgram"),
    createAthleteNationality: document.getElementById("createAthleteNationality"),
    createAthleteHometown: document.getElementById("createAthleteHometown"),
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
    editAthleteDateOfBirth: document.getElementById("editAthleteDateOfBirth"),
    editAthleteGender: document.getElementById("editAthleteGender"),
    editAthleteEmail: document.getElementById("editAthleteEmail"),
    editAthletePhone: document.getElementById("editAthletePhone"),
    editAthleteStudentId: document.getElementById("editAthleteStudentId"),
    editAthleteYear: document.getElementById("editAthleteYear"),
    editAthleteFaculty: document.getElementById("editAthleteFaculty"),
    editAthleteProgram: document.getElementById("editAthleteProgram"),
    editAthleteNationality: document.getElementById("editAthleteNationality"),
    editAthleteHometown: document.getElementById("editAthleteHometown"),
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

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
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
      ensureArchivedQualityOption(els.athleteQualityFilter);
      bindFilters();
      bindWorkflowLinks();
      bindWorkflowClose();
      bindInsightActions();
      bindCreateForm();
      bindEditForm();
      bindBulkActions();

      await refreshData();
      clearMessage();
    } catch (error) {
      console.error("Athletes page init error:", error);
      setError(error?.message || "Failed to load athlete records.");
    }
  }

  async function refreshData(selectedAthleteId = "") {
    const [teamsPayload, athletesPayload] = await Promise.all([
      apiGet("/teams?includeArchived=true", true),
      apiGet("/athletes?includeArchived=true", true)
    ]);

    state.teams = normalizeCollection(teamsPayload, ["teams", "data", "items"])
      .map(normalizeTeamRecord);

    state.athletes = normalizeCollection(athletesPayload, ["athletes", "data", "items"])
      .map(normalizeAthleteRecord);

    populateCampusTeamSelects(selectedAthleteId ? getSelectedAthleteTeamId(selectedAthleteId) : "");
    renderAll(selectedAthleteId);
  }

  // Event Wiring
  /**
   * Binds the filters interactions once so rerenders do not duplicate listeners.
   */
  function bindFilters() {
    [els.searchInput, els.statusFilter, els.athleteTypeFilter, els.athleteGenderFilter, els.athleteSportFilter, els.athleteQualityFilter].forEach((node) => {
      if (!node) return;
      node.addEventListener("input", handleFilterChange);
      node.addEventListener("change", handleFilterChange);
    });
    if (els.athleteSearchButton) els.athleteSearchButton.addEventListener("click", applyRegistrySearch);
    mountRecentSearches("athletes");
  }

  // Workflow: Filter Change
  /**
   * Handles the filter change workflow and keeps side effects inside the intended API/action path.
   */
  function handleFilterChange() {
    const panel = document.getElementById("athleteRegistryPanel");
    if (hasActiveRegistryFilter() && panel) panel.open = true;
    state.registrySearchApplied = false;
  }

  function applyRegistrySearch() {
    const panel = document.getElementById("athleteRegistryPanel");
    if (!String(els.athleteSportFilter?.value || "").trim() && String(els.athleteQualityFilter?.value || "") !== "incomplete") {
      if (els.athletesTableBody) {
        els.athletesTableBody.innerHTML = `
          <tr><td colspan="11"><div class="empty-state"><h3>Select a sport first.</h3><p>Athlete searches must be narrowed by sport before results are shown.</p></div></td></tr>
        `;
      }
      if (panel) panel.open = true;
      return;
    }
    if (panel) panel.open = true;
    state.registrySearchApplied = true;
    saveCurrentSearch("athletes");
    mountRecentSearches("athletes");
    renderAthletesTable();
  }

  // Event Wiring
  /**
   * Binds the workflow links interactions once so rerenders do not duplicate listeners.
   */
  function bindWorkflowLinks() {
    document.querySelectorAll("a[href='#athleteWorkflows']").forEach((link) => {
      link.addEventListener("click", () => {
        const panel = document.getElementById("athleteWorkflows");
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
    const panel = document.getElementById("athleteWorkflows");
    if (!panel) return;
    panel.addEventListener("toggle", () => {
      if (!panel.open) panel.hidden = true;
    });
  }

  // Event Wiring
  /**
   * Binds the create form interactions once so rerenders do not duplicate listeners.
   */
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
        const record = buildAthleteRecord(payload);
        const duplicate = APP.findSimilarRecord(state.athletes, record, { type: "athlete" });
        if (duplicate) {
          const action = APP.promptDuplicateAction(duplicate, "athlete");
          if (action === "cancel") return;
          if (action === "use-existing" || action === "edit-existing") {
            window.location.href = `athlete-view.html?athleteId=${encodeURIComponent(duplicate.id)}`;
            return;
          }
        }
        await apiPost("/athletes", record);
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

  // Event Wiring
  /**
   * Binds the edit form interactions once so rerenders do not duplicate listeners.
   */
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

  // Full Page Render
  /**
   * Renders the registry table and summary widgets from the current campus-scoped athlete state.
   */
  function renderAll(selectedAthleteId = "") {
    renderAthleteEditSelect(selectedAthleteId);
    renderOperationalSummary();
    renderAthletesTable();
  }

  // Operational Summary
  /**
   * Renders the operational summary section from normalized page state without mutating backend data.
   */
  function renderOperationalSummary() {
    const athletes = getCampusAthletes();
    const active = athletes.filter((athlete) => normalizeStatus(athlete.status) !== "inactive");
    const assigned = athletes.filter((athlete) => athlete.activeRosterAssignment?.teamId);
    const sports = new Set(athletes.map((athlete) => athlete.profile?.sportSlug).filter(Boolean));
    const incomplete = athletes.filter((athlete) => getAthleteQuality(athlete) < 100);
    const quality = athletes.length
      ? Math.round(athletes.reduce((sum, athlete) => sum + getAthleteQuality(athlete), 0) / athletes.length)
      : 0;

    setText(els.totalAthletesStat, athletes.length);
    setText(els.activeAthletesStat, active.length);
    setText(els.assignedAthletesStat, assigned.length);
    setText(els.athleteSportsStat, sports.size);
    setText(els.incompleteAthletesStat, incomplete.length);

    renderInsightList(els.athleteAlerts, [
      { label: "Unassigned athletes", value: athletes.length - assigned.length, target: "athleteRegistryPanel", filter: "incomplete" },
      { label: "Missing primary sport", value: athletes.filter((athlete) => !athlete.profile?.sportSlug).length, target: "athleteRegistryPanel", filter: "incomplete" },
      { label: "Missing body data", value: athletes.filter((athlete) => !athlete.profile?.heightCm || !athlete.profile?.weightKg).length, target: "athleteRegistryPanel", filter: "incomplete" }
    ], "No athlete alerts right now.");

    renderActivityList(els.athleteActivity, getRecentRecords(athletes, "athlete"));
    renderQuality(els.athleteQualityScore, els.athleteQualityBar, els.athleteQualityCopy, quality, `${incomplete.length} athlete profile${incomplete.length === 1 ? "" : "s"} below 100% completion.`);
  }

  function getAthleteQuality(athlete) {
    const profile = athlete.profile || {};
    const checks = [
      athlete.firstName,
      athlete.lastName,
      athlete.email || athlete.phone,
      athlete.athleteType,
      athlete.dateOfBirth || profile.dateOfBirth,
      athlete.gender || profile.gender,
      profile.sportSlug,
      athlete.activeRosterAssignment?.teamId,
      profile.position || profile.eventsSpecialties,
      profile.heightCm,
      profile.weightKg,
      athlete.imageUrl
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  // Edit Form Prefill
  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateCampusLabels() {
    const campusLabel = APP.getCampusMeta(state.session.campus).name;
    els.campusNameNodes.forEach((node) => {
      node.textContent = campusLabel;
    });
  }

  // Edit Form Prefill
  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
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

  // Edit Form Prefill
  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateCampusTeamSelects(selectedTeamId = "") {
    const teams = getCampusTeams();

    const options = [
      `<option value="">No team selected</option>`,
      ...teams.map((team) => {
        const selected = String(selectedTeamId) === String(team.id) ? "selected" : "";
        return `<option value="${escapeHtml(team.id)}" ${selected}>${escapeHtml(team.name || "Team")}</option>`;
      })
    ].join("");

    if (els.createAthleteTeam) els.createAthleteTeam.innerHTML = options;
    if (els.editAthleteTeam) els.editAthleteTeam.innerHTML = options;
    if (els.bulkAssignTeamSelect) {
      els.bulkAssignTeamSelect.innerHTML = [
        `<option value="">Assign selected to team</option>`,
        ...teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name || "Team")}</option>`)
      ].join("");
    }
  }

  // Athlete Edit Select
  /**
   * Renders the athlete edit select section from normalized page state without mutating backend data.
   */
  function renderAthleteEditSelect(selectedAthleteId = "") {
    if (!els.editAthleteSelect) return;

    const athletes = getCampusAthletes(true);

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

  // Data Loading
  /**
   * Loads selected athlete into form data required by later normalization and rendering steps.
   */
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
    if (els.editAthleteDateOfBirth) els.editAthleteDateOfBirth.value = toDateInputValue(athlete.dateOfBirth || profile.dateOfBirth || "");
    if (els.editAthleteGender) els.editAthleteGender.value = normalizeGender(athlete.gender || profile.gender || "");
    if (els.editAthleteEmail) els.editAthleteEmail.value = athlete.email || "";
    if (els.editAthletePhone) els.editAthletePhone.value = athlete.phone || "";
    if (els.editAthleteStudentId) els.editAthleteStudentId.value = athlete.studentId || "";
    if (els.editAthleteYear) els.editAthleteYear.value = athlete.yearOfStudy || "";
    if (els.editAthleteFaculty) els.editAthleteFaculty.value = athlete.faculty || athlete.facultyProgram || "";
    if (els.editAthleteProgram) els.editAthleteProgram.value = athlete.program || "";
    if (els.editAthleteNationality) els.editAthleteNationality.value = athlete.nationality || "";
    if (els.editAthleteHometown) els.editAthleteHometown.value = athlete.hometown || "";
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
      els.editAthleteDateOfBirth,
      els.editAthleteEmail,
      els.editAthletePhone,
      els.editAthleteStudentId,
      els.editAthleteYear,
      els.editAthleteFaculty,
      els.editAthleteProgram,
      els.editAthleteNationality,
      els.editAthleteHometown,
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
    if (els.editAthleteGender) els.editAthleteGender.value = "";
    if (els.editAthleteStatus) els.editAthleteStatus.value = "active";
    if (els.editAthletePrimarySport) els.editAthletePrimarySport.value = "";
    if (els.editAthleteCaptain) els.editAthleteCaptain.value = "false";

    const fileInput = document.getElementById("editAthleteHeadshot");
    if (fileInput) fileInput.value = "";

    const preview = document.getElementById("editAthleteHeadshotPreview");
    if (preview) preview.textContent = "No athlete selected.";

    populateCampusTeamSelects("");
  }

  // Athletes Table
  /**
   * Renders the athletes table section from normalized page state without mutating backend data.
   */
  function renderAthletesTable() {
    if (!els.athletesTableBody) return;

    if (!hasActiveRegistryFilter() || !state.registrySearchApplied) {
      state.selectedAthleteIds.clear();
      updateBulkActionBar();
      els.athletesTableBody.innerHTML = `
        <tr>
              <td colspan="11">
            <div class="empty-state">
              <h3>Use filters to view athlete records.</h3>
              <p>Choose filters, then click Search to show a focused list.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const athletes = getFilteredAthletes();
    pruneSelectionToVisibleAthletes(athletes);

    if (!athletes.length) {
      updateBulkActionBar();
      els.athletesTableBody.innerHTML = `
        <tr>
              <td colspan="11">
            <div class="empty-state">
              <h3>No athlete records match the current filters.</h3>
              <p>Add athlete records to manage profiles, team assignments, and athlete details.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    els.athletesTableBody.innerHTML = athletes.map((athlete) => {
      const profile = athlete.profile || {};
      const sports = getAthleteSports(athlete).map(getSportName).filter(Boolean);
      const teamNames = getAthleteTeamNames(athlete);

      return `
        <tr>
          <td class="athlete-select-cell"><input type="checkbox" data-athlete-select="${escapeHtml(athlete.id)}" ${state.selectedAthleteIds.has(String(athlete.id)) ? "checked" : ""} aria-label="Select ${escapeHtml(athlete.fullName || "athlete")}"/></td>
          <td><strong>${escapeHtml(athlete.fullName || "Athlete")}</strong></td>
          <td>${escapeHtml(formatGender(athlete.gender || profile.gender || ""))}</td>
          <td>${escapeHtml(sports.join(" / ") || getSportName(profile.sportSlug || "") || "—")}</td>
          <td>${escapeHtml(teamNames.join(" / ") || "—")}</td>
          <td>${escapeHtml(athlete.email || "—")}</td>
          <td>${escapeHtml(formatAthleteType(athlete.athleteType))}</td>
          <td>${escapeHtml(normalizeStatus(athlete.status) === "inactive" ? "Inactive" : "Active")}</td>
          <td>${completenessMarkup(getAthleteQuality(athlete))}</td>
          <td>${athlete.imageUrl ? "Yes" : "No"}</td>
          <td><a class="btn btn-campus" href="athlete-view.html?athleteId=${encodeURIComponent(athlete.id)}">Open</a></td>
        </tr>
      `;
    }).join("");
    bindRowSelectionControls(athletes);
    updateBulkActionBar(athletes);
  }

  // Event Wiring
  /**
   * Binds the bulk actions interactions once so rerenders do not duplicate listeners.
   */
  function bindBulkActions() {
    if (els.athleteSelectAll) {
      els.athleteSelectAll.addEventListener("change", () => {
        getFilteredAthletes().forEach((athlete) => {
          const id = String(athlete.id || "");
          if (!id) return;
          if (els.athleteSelectAll.checked) state.selectedAthleteIds.add(id);
          else state.selectedAthleteIds.delete(id);
        });
        renderAthletesTable();
      });
    }
    if (els.bulkClearSelectionButton) {
      els.bulkClearSelectionButton.addEventListener("click", () => {
        state.selectedAthleteIds.clear();
        renderAthletesTable();
      });
    }
    if (els.bulkAssignTeamButton) {
      els.bulkAssignTeamButton.addEventListener("click", handleBulkAssignTeam);
    }
  }

  // Event Wiring
  /**
   * Binds the row selection controls interactions once so rerenders do not duplicate listeners.
   */
  function bindRowSelectionControls(visibleAthletes) {
    document.querySelectorAll("[data-athlete-select]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = String(checkbox.dataset.athleteSelect || "");
        if (!id) return;
        if (checkbox.checked) state.selectedAthleteIds.add(id);
        else state.selectedAthleteIds.delete(id);
        updateBulkActionBar(visibleAthletes);
      });
    });
  }

  // Workflow: Bulk Assign Team
  /**
   * Handles the bulk assign team workflow and keeps side effects inside the intended API/action path.
   */
  async function handleBulkAssignTeam() {
    clearMessage();
    const teamId = String(els.bulkAssignTeamSelect?.value || "").trim();
    const athleteIds = Array.from(state.selectedAthleteIds);
    if (!athleteIds.length) {
      setError("Select at least one athlete first.");
      return;
    }
    if (!teamId) {
      setError("Choose a team to assign the selected athletes to.");
      return;
    }
    const team = state.teams.find((item) => String(item.id) === teamId);
    const confirmed = window.confirm(`Assign ${athleteIds.length} selected athlete${athleteIds.length === 1 ? "" : "s"} to ${team?.name || "this team"}?`);
    if (!confirmed) return;
    try {
      await Promise.all(athleteIds.map((athleteId) => {
        const athlete = state.athletes.find((item) => String(item.id) === String(athleteId)) || {};
        return apiPost("/team-roster-assignments", {
          athleteId,
          teamId,
          roleLabel: athlete.activeRosterAssignment?.roleLabel || "",
          jerseyNumber: athlete.activeRosterAssignment?.jerseyNumber || "",
          isCaptain: Boolean(athlete.activeRosterAssignment?.isCaptain),
          status: "ACTIVE"
        });
      }));
      state.selectedAthleteIds.clear();
      if (els.bulkAssignTeamSelect) els.bulkAssignTeamSelect.value = "";
      await refreshData();
      setSuccess(`Assigned ${athleteIds.length} athlete${athleteIds.length === 1 ? "" : "s"} to ${team?.name || "the selected team"}.`);
    } catch (error) {
      console.error("Bulk athlete team assignment failed:", error);
      setError(error?.message || "Selected athletes could not be assigned to the team.");
    }
  }

  function pruneSelectionToVisibleAthletes(visibleAthletes) {
    const visibleIds = new Set(visibleAthletes.map((athlete) => String(athlete.id || "")));
    Array.from(state.selectedAthleteIds).forEach((id) => {
      if (!visibleIds.has(id)) state.selectedAthleteIds.delete(id);
    });
  }

  // Derived Bulk Action Bar
  /**
   * Updates derived UI state from the current form/model values without persisting changes directly.
   */
  function updateBulkActionBar(visibleAthletes = getFilteredAthletes()) {
    const count = state.selectedAthleteIds.size;
    if (els.athleteBulkActionBar) els.athleteBulkActionBar.hidden = count === 0;
    if (els.athleteBulkCount) els.athleteBulkCount.textContent = `${count} selected`;
    if (els.bulkAssignTeamButton) els.bulkAssignTeamButton.disabled = count === 0;
    if (els.athleteSelectAll) {
      const visibleIds = visibleAthletes.map((athlete) => String(athlete.id || "")).filter(Boolean);
      const selectedVisibleCount = visibleIds.filter((id) => state.selectedAthleteIds.has(id)).length;
      els.athleteSelectAll.checked = Boolean(visibleIds.length && selectedVisibleCount === visibleIds.length);
      els.athleteSelectAll.indeterminate = Boolean(selectedVisibleCount && selectedVisibleCount < visibleIds.length);
    }
  }

  function hasActiveRegistryFilter() {
    return Boolean(
      String(els.searchInput?.value || "").trim() ||
      String(els.statusFilter?.value || "").trim() ||
      String(els.athleteTypeFilter?.value || "").trim() ||
      String(els.athleteGenderFilter?.value || "").trim() ||
      String(els.athleteSportFilter?.value || "").trim() ||
      String(els.athleteQualityFilter?.value || "").trim()
    );
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
      dateOfBirth: getValue(isEdit ? els.editAthleteDateOfBirth : els.createAthleteDateOfBirth),
      gender: normalizeGender(getValue(isEdit ? els.editAthleteGender : els.createAthleteGender)),
      email: getValue(isEdit ? els.editAthleteEmail : els.createAthleteEmail),
      phone: getValue(isEdit ? els.editAthletePhone : els.createAthletePhone),
      studentId: getValue(isEdit ? els.editAthleteStudentId : els.createAthleteStudentId),
      yearOfStudy: getValue(isEdit ? els.editAthleteYear : els.createAthleteYear),
      faculty: getValue(isEdit ? els.editAthleteFaculty : els.createAthleteFaculty),
      program: getValue(isEdit ? els.editAthleteProgram : els.createAthleteProgram),
      nationality: getValue(isEdit ? els.editAthleteNationality : els.createAthleteNationality),
      hometown: getValue(isEdit ? els.editAthleteHometown : els.createAthleteHometown),
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

  // Build Athlete Record
  /**
   * Builds athlete record from shared state so markup and payload labels stay consistent.
   */
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
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender,
      age: calculateAge(payload.dateOfBirth),
      email: payload.email,
      phone: payload.phone,
      studentId: payload.studentId,
      yearOfStudy: payload.yearOfStudy,
      faculty: payload.faculty,
      program: payload.program,
      facultyProgram: [payload.faculty, payload.program].filter(Boolean).join(" / "),
      nationality: payload.nationality,
      hometown: payload.hometown,
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
        dominantLeg: payload.dominantLeg,
        dateOfBirth: payload.dateOfBirth,
        gender: payload.gender,
        faculty: payload.faculty,
        program: payload.program,
        nationality: payload.nationality,
        hometown: payload.hometown
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
    const genderValue = String(els.athleteGenderFilter?.value || "").trim().toLowerCase();
    const sportFilterValue = String(els.athleteSportFilter?.value || "").trim().toLowerCase();
    const qualityValue = String(els.athleteQualityFilter?.value || "").trim().toLowerCase();

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
        const matchesGender = !genderValue || normalizeGender(athlete.gender || profile.gender || "") === genderValue;
        const matchesSport = !sportFilterValue || getAthleteSports(athlete).includes(sportFilterValue);
        const archived = APP.isArchivedRecord(athlete);
        const matchesQuality = qualityValue === "archived" ? archived : qualityValue !== "incomplete" || getAthleteQuality(athlete) < 100;

        return (qualityValue === "archived" || !archived) && matchesSearch && matchesStatus && matchesAthleteType && matchesGender && matchesSport && matchesQuality;
      })
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
  }

  function getCampusAthletes(includeArchived = false) {
    return state.athletes.filter(
      (athlete) => normalizeCampus(athlete.campus || state.session.campus) === normalizeCampus(state.session.campus) &&
        (includeArchived || !APP.isArchivedRecord(athlete))
    );
  }

  function getCampusTeams() {
    return state.teams.filter(
      (team) => normalizeCampus(team.campus || state.session.campus) === normalizeCampus(state.session.campus)
    );
  }

  function ensureArchivedQualityOption(select) {
    if (!select || select.querySelector("option[value='archived']")) return;
    select.insertAdjacentHTML("beforeend", `<option value="archived">Archived records</option>`);
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

  // Normalize Collection
  /**
   * Normalizes collection data across current API and legacy nested shapes.
   */
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

  // Normalize Team Record
  /**
   * Normalizes team record data across current API and legacy nested shapes.
   */
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

  // Normalize Athlete Record
  /**
   * Normalizes athlete record data across current API and legacy nested shapes.
   */
  function normalizeAthleteRecord(athlete) {
    if (!athlete || typeof athlete !== "object") return {};
    const profile = athlete.profile && typeof athlete.profile === "object" ? athlete.profile : {};
    const rosterAssignments = Array.isArray(athlete.rosterAssignments)
      ? athlete.rosterAssignments
      : Array.isArray(athlete.teamAssignments)
        ? athlete.teamAssignments
        : [];
    const roster = athlete.activeRosterAssignment && typeof athlete.activeRosterAssignment === "object"
      ? athlete.activeRosterAssignment
      : rosterAssignments[0] || null;
    const sports = Array.from(new Set([
      profile.sportSlug,
      athlete.primarySport,
      athlete.sport,
      athlete.sportSlug,
      ...(Array.isArray(athlete.sports) ? athlete.sports : []),
      ...rosterAssignments.map((assignment) => assignment.sportSlug || assignment.sport || assignment.team?.sportSlug || assignment.team?.sport)
    ].map((value) => APP.normalizeSportSlug(value)).filter(Boolean)));

    return {
      ...athlete,
      id: athlete.id || athlete.athleteId || athlete._id || APP.cryptoRandomId(),
      firstName: athlete.firstName || athlete.givenName || "",
      lastName: athlete.lastName || athlete.familyName || "",
      fullName: athlete.fullName || `${athlete.firstName || athlete.givenName || ""} ${athlete.lastName || athlete.familyName || ""}`.trim(),
      athleteType: athlete.athleteType || athlete.type || "student-athlete",
      dateOfBirth: athlete.dateOfBirth || athlete.dob || profile.dateOfBirth || "",
      gender: normalizeGender(athlete.gender || profile.gender || ""),
      age: athlete.age || calculateAge(athlete.dateOfBirth || athlete.dob || profile.dateOfBirth || ""),
      email: athlete.email || "",
      phone: athlete.phone || "",
      studentId: athlete.studentId || "",
      yearOfStudy: athlete.yearOfStudy || "",
      facultyProgram: athlete.facultyProgram || "",
      status: athlete.status || "active",
      campus: normalizeCampus(athlete.campus || athlete.campusSlug || state.session?.campus),
      imageUrl: athlete.imageUrl || athlete.headshotUrl || "",
      sports,
      rosterAssignments,
      teamAssignments: rosterAssignments,
      profile: {
        ...profile,
        sportSlug: APP.normalizeSportSlug(profile.sportSlug || athlete.primarySport || athlete.sport || sports[0] || ""),
        position: profile.position || "",
        eventsSpecialties: profile.eventsSpecialties || "",
        heightCm: profile.heightCm ?? null,
        weightKg: profile.weightKg ?? null,
        dominantHand: profile.dominantHand || "",
        dominantLeg: profile.dominantLeg || "",
        dateOfBirth: profile.dateOfBirth || athlete.dateOfBirth || athlete.dob || "",
        gender: normalizeGender(profile.gender || athlete.gender || "")
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

  function getAthleteSports(athlete) {
    return Array.from(new Set([
      athlete?.profile?.sportSlug,
      athlete?.sportSlug,
      athlete?.sport,
      athlete?.primarySport,
      ...(Array.isArray(athlete?.sports) ? athlete.sports : []),
      ...(Array.isArray(athlete?.rosterAssignments) ? athlete.rosterAssignments : []).map((assignment) => assignment.sportSlug || assignment.sport || assignment.team?.sportSlug || assignment.team?.sport)
    ].map((value) => APP.normalizeSportSlug(value)).filter(Boolean)));
  }

  function getAthleteTeamNames(athlete) {
    const assignments = Array.isArray(athlete?.rosterAssignments)
      ? athlete.rosterAssignments
      : Array.isArray(athlete?.teamAssignments)
        ? athlete.teamAssignments
        : [];
    const names = assignments.map((assignment) => {
      const teamId = assignment.teamId || assignment.team?.id || "";
      const team = state.teams.find((item) => String(item.id || "") === String(teamId || ""));
      return assignment.teamName || assignment.team?.name || assignment.team?.teamName || team?.name || team?.teamName || "";
    });
    if (!names.length && athlete?.activeRosterAssignment) {
      const roster = athlete.activeRosterAssignment;
      const team = state.teams.find((item) => String(item.id || "") === String(roster.teamId || ""));
      names.push(roster.teamName || roster.team?.name || team?.name || team?.teamName || "");
    }
    return Array.from(new Set(names.filter(Boolean)));
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

  // Normalize Gender
  /**
   * Normalizes gender data across current API and legacy nested shapes.
   */
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

  // Normalize Status
  /**
   * Normalizes status data across current API and legacy nested shapes.
   */
  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
  }

  // Normalize Campus
  /**
   * Normalizes campus data across current API and legacy nested shapes.
   */
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

  // Messages and UI State
  /**
   * Resets message state before a new fetch or submit attempt.
   */
  function clearMessage() {
    APP.clearMessage?.(els.pageMessage);
  }

  function escapeHtml(value) {
    return APP.escapeHtml(value);
  }

  function setText(node, value) {
    if (node) node.textContent = String(value);
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
        <strong>${escapeHtml(row.value)}</strong>
      </button>
    `).join("");
  }

  // Event Wiring
  /**
   * Binds the insight actions interactions once so rerenders do not duplicate listeners.
   */
  function bindInsightActions() {
    document.addEventListener("click", (event) => {
      const action = event.target.closest(".insight-action[data-target]");
      if (!action) return;
      const target = document.getElementById(action.getAttribute("data-target"));
      if (!target) return;
      const filter = action.getAttribute("data-filter");
      if (filter === "incomplete" && els.athleteQualityFilter) {
        els.athleteQualityFilter.value = "incomplete";
        state.registrySearchApplied = true;
        renderAthletesTable();
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
      .map((record) => ({ label: record.fullName || record.name || record.title || "Record", type }));
  }

  function getRecordTime(record) {
    return Date.parse(record.updatedAt || record.createdAt || record.modifiedAt || record.date || "") || 0;
  }

  // Quality
  /**
   * Renders the quality section from normalized page state without mutating backend data.
   */
  function renderQuality(scoreNode, barNode, copyNode, score, copy) {
    setText(scoreNode, `${score}%`);
    if (barNode) barNode.style.width = `${Math.max(0, Math.min(100, score))}%`;
    setText(copyNode, copy);
  }

  function completenessMarkup(score) {
    const normalized = Math.max(0, Math.min(100, Number(score) || 0));
    return `<div class="completeness-cell"><span class="completeness-ring" style="--score:${normalized}"></span><span class="completeness-text">${normalized}%</span></div>`;
  }

  // Collect File As Data Url
  /**
   * Reads file as data url values into the structured payload consumed by reports and result views.
   */
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function saveCurrentSearch(scope) {
    if (!APP.saveRecentSearch) return;
    const values = {
      q: els.searchInput?.value || "",
      status: els.statusFilter?.value || "",
      type: els.athleteTypeFilter?.value || "",
      gender: els.athleteGenderFilter?.value || "",
      sport: els.athleteSportFilter?.value || "",
      quality: els.athleteQualityFilter?.value || ""
    };
    const label = [values.q, values.sport ? APP.getSportName?.(values.sport) || values.sport : "", values.gender ? formatGender(values.gender) : "", values.status, values.type, values.quality].filter(Boolean).join(" / ") || "Athlete search";
    APP.saveRecentSearch(scope, label, values);
  }

  // Shared UI Mounting
  /**
   * Mounts the recent searches feature after required context has loaded.
   */
  function mountRecentSearches(scope) {
    if (!APP.renderRecentSearches || !els.athleteSearchButton?.parentElement) return;
    document.querySelector(`[data-recent-searches='${scope}']`)?.remove();
    els.athleteSearchButton.parentElement.insertAdjacentHTML("afterend", APP.renderRecentSearches(scope));
    document.querySelectorAll("[data-recent-searches='athletes'] [data-recent-search-index]").forEach((button) => {
      button.addEventListener("click", function () {
        const item = APP.readRecentSearches(scope)[Number(this.dataset.recentSearchIndex)];
        if (!item) return;
        if (els.searchInput) els.searchInput.value = item.values.q || "";
        if (els.statusFilter) els.statusFilter.value = item.values.status || "";
        if (els.athleteTypeFilter) els.athleteTypeFilter.value = item.values.type || "";
        if (els.athleteGenderFilter) els.athleteGenderFilter.value = item.values.gender || "";
        if (els.athleteSportFilter) els.athleteSportFilter.value = item.values.sport || "";
        if (els.athleteQualityFilter) els.athleteQualityFilter.value = item.values.quality || "";
        applyRegistrySearch();
      });
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
