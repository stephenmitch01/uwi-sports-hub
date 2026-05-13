(function () {
  "use strict";

  const APP = window.UWISportsHub;

  const state = {
    session: null,
    athletes: [],
    teams: [],
    competitions: [],
    statLines: [],
    filteredSport: "",
    filteredSeason: "",
    filteredCampus: "",
    reportType: "",
    selectedAthleteId: "",
    selectedTeamId: "",
    selectedCompetitionId: "",
    selectedTeamFilterId: "",
    latestReportHtml: "",
    latestReportTitle: "Report",
    loadError: ""
  };

  const els = {
    reportCampus: document.getElementById("reportCampus"),
    reportSport: document.getElementById("reportSport"),
    reportSeason: document.getElementById("reportSeason"),
    reportType: document.getElementById("reportType"),

    reportSelectionCard: document.getElementById("reportSelectionCard"),
    reportSelectionTitle: document.getElementById("reportSelectionTitle"),
    reportSelectionSubtitle: document.getElementById("reportSelectionSubtitle"),

    reportTeamFilterWrap: document.getElementById("reportTeamFilterWrap"),
    reportTeamFilter: document.getElementById("reportTeamFilter"),
    reportAthleteWrap: document.getElementById("reportAthleteWrap"),
    reportAthlete: document.getElementById("reportAthlete"),
    reportTeamWrap: document.getElementById("reportTeamWrap"),
    reportTeam: document.getElementById("reportTeam"),
    reportCompetitionWrap: document.getElementById("reportCompetitionWrap"),
    reportCompetition: document.getElementById("reportCompetition"),

    reportActionBar: document.getElementById("reportActionBar"),
    reportActionTitle: document.getElementById("reportActionTitle"),
    reportActionSubtitle: document.getElementById("reportActionSubtitle"),
    generateReportButton: document.getElementById("generateReportButton"),
    previewPdfButton: document.getElementById("previewPdfButton"),
    downloadPdfButton: document.getElementById("downloadPdfButton"),

    reportsList: document.getElementById("reportsList"),
    reportsHelp: document.getElementById("reportsHelp"),

    reportPreviewModal: document.getElementById("reportPreviewModal"),
    reportPreviewBackdrop: document.getElementById("reportPreviewBackdrop"),
    reportPreviewBody: document.getElementById("reportPreviewBody"),
    reportPreviewTitle: document.getElementById("reportPreviewTitle"),
    closePreviewButton: document.getElementById("closePreviewButton")
  };

  document.addEventListener("DOMContentLoaded", init);

  function ensurePageMessage() {
    let node = document.getElementById("reportsPageMessage");
    if (node) return node;
    const main = document.querySelector("main.page");
    if (!main) return null;
    node = document.createElement("div");
    node.id = "reportsPageMessage";
    node.className = "message";
    node.setAttribute("aria-live", "polite");
    main.insertBefore(node, main.firstChild);
    return node;
  }

  async function init() {
    const session = await APP.mountSignedInShell({
      active: "reports",
      contextLabel: "Reports"
    });
    if (!session) {
      window.location.href = "index.html";
      return;
    }

    state.session = session;
    hydrateFilters();
    bindEvents();

    try {
      await loadReportData();
      state.loadError = "";
      APP.clearMessage?.(ensurePageMessage());
    } catch (error) {
      console.error("Reports load error:", error);
      state.loadError = error?.message || "Reports could not be loaded right now.";
      APP.showError?.(ensurePageMessage(), state.loadError);
    }

    syncFiltersFromInputs();
    renderAll();
  }

  function hydrateFilters() {
    if (els.reportCampus) {
      const campus = APP.normalizeCampus(state.session?.campus || "");
      const campusLabel = getCampusName(campus);

      els.reportCampus.innerHTML = `
        <option value="${escapeHtml(campus)}">${escapeHtml(campusLabel)}</option>
      `;
      els.reportCampus.value = campus;
      els.reportCampus.disabled = true;
    }

    if (els.reportSport && Array.isArray(APP.SPORT_REGISTRY)) {
      els.reportSport.innerHTML = `
        <option value="">All sports</option>
        ${APP.SPORT_REGISTRY.map((sport) => `
          <option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>
        `).join("")}
      `;
    }
  }

  function bindEvents() {
    [
      "reportCampus", "reportSport", "reportSeason", "reportType",
      "reportTeamFilter", "reportAthlete", "reportTeam", "reportCompetition"
    ].forEach((key) => {
      if (!els[key]) return;
      els[key].addEventListener("input", handleInputChange);
      els[key].addEventListener("change", handleInputChange);
    });

    if (els.generateReportButton) {
      els.generateReportButton.addEventListener("click", renderAll);
    }
    if (els.previewPdfButton) {
      els.previewPdfButton.addEventListener("click", openPreviewModal);
    }
    if (els.downloadPdfButton) {
      els.downloadPdfButton.addEventListener("click", downloadCurrentReportPdf);
    }
    if (els.closePreviewButton) {
      els.closePreviewButton.addEventListener("click", closePreviewModal);
    }
    if (els.reportPreviewBackdrop) {
      els.reportPreviewBackdrop.addEventListener("click", closePreviewModal);
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closePreviewModal();
    });
  }

  function handleInputChange(event) {
    const targetId = event && event.target ? event.target.id : "";
    if (["reportCampus", "reportSport", "reportSeason", "reportType"].includes(targetId)) {
      state.selectedAthleteId = "";
      state.selectedTeamId = "";
      state.selectedCompetitionId = "";
      state.selectedTeamFilterId = "";
      if (els.reportAthlete) els.reportAthlete.value = "";
      if (els.reportTeam) els.reportTeam.value = "";
      if (els.reportCompetition) els.reportCompetition.value = "";
      if (els.reportTeamFilter) els.reportTeamFilter.value = "";
    }
    if (targetId === "reportTeamFilter") {
      state.selectedAthleteId = "";
      if (els.reportAthlete) els.reportAthlete.value = "";
    }
    syncFiltersFromInputs();
    renderSelectionControls();
  }

  function syncFiltersFromInputs() {
    state.filteredCampus = APP.normalizeCampus(
      (els.reportCampus && els.reportCampus.value) || state.session?.campus || ""
    );
    state.filteredSport = APP.normalizeSportSlug((els.reportSport && els.reportSport.value) || "");
    state.filteredSeason = (els.reportSeason && els.reportSeason.value || "").trim();
    state.reportType = ((els.reportType && els.reportType.value) || "").trim().toLowerCase();
    state.selectedTeamFilterId = (els.reportTeamFilter && els.reportTeamFilter.value || "").trim();
    state.selectedAthleteId = (els.reportAthlete && els.reportAthlete.value || state.selectedAthleteId || "").trim();
    state.selectedTeamId = (els.reportTeam && els.reportTeam.value || state.selectedTeamId || "").trim();
    state.selectedCompetitionId = (els.reportCompetition && els.reportCompetition.value || state.selectedCompetitionId || "").trim();
  }

  async function loadReportData() {
    const [athletesRes, teamsRes, competitionsRes, athleteStatsRes] = await Promise.allSettled([
      APP.apiGet("/athletes", true),
      APP.apiGet("/teams", true),
      APP.apiGet("/competitions", true),
      APP.apiGet("/athlete-stat-lines", true)
    ]);

    state.athletes = normalizeArray(athletesRes, ["athletes", "data"], []);
    state.teams = normalizeArray(teamsRes, ["teams", "data"], []);
    state.competitions = normalizeArray(competitionsRes, ["competitions", "data"], []);
    state.statLines = normalizeArray(athleteStatsRes, ["stats", "statLines", "data"], []).map(normalizeStat);
  }

  function renderAll() {
    renderSelectionControls();
    renderReports();
    renderHelp();
  }

  function renderSelectionControls() {
    if (!els.reportSelectionCard) return;

    const hasType = Boolean(state.reportType);
    els.reportSelectionCard.classList.toggle("hidden", !hasType);
    els.reportTeamFilterWrap.classList.add("hidden");
    els.reportAthleteWrap.classList.add("hidden");
    els.reportTeamWrap.classList.add("hidden");
    els.reportCompetitionWrap.classList.add("hidden");
    els.reportActionBar.classList.toggle("hidden", !hasType);

    if (!hasType) {
      setActionBarDisabled(true, "Choose a report type", "Select the kind of report you want to generate first.");
      return;
    }

    if (state.reportType === "athlete report") {
      els.reportSelectionTitle.textContent = "Athlete report selection";
      els.reportSelectionSubtitle.textContent = "Optionally narrow by team, then choose a specific athlete to generate the full internal athlete dossier.";
      els.reportTeamFilterWrap.classList.remove("hidden");
      els.reportAthleteWrap.classList.remove("hidden");
      hydrateTeamFilter(els.reportTeamFilter, state.selectedTeamFilterId, "All teams");
      hydrateAthleteSelect();
      const enabled = Boolean(getSelectedAthlete());
      setActionBarDisabled(!enabled, enabled ? "Athlete report selected" : "Select an athlete", enabled ? "Generate, preview, or download the current athlete report." : "Choose an athlete to unlock the report actions.");
      return;
    }

    if (state.reportType === "team report") {
      els.reportSelectionTitle.textContent = "Team report selection";
      els.reportSelectionSubtitle.textContent = "Choose the team you want to review. The output will include roster coverage, team context, competition activity, and player-level contributions.";
      els.reportTeamWrap.classList.remove("hidden");
      hydrateTeamFilter(els.reportTeam, state.selectedTeamId, "Select team");
      const enabled = Boolean(getSelectedTeam());
      setActionBarDisabled(!enabled, enabled ? "Team report selected" : "Select a team", enabled ? "Generate, preview, or download the current team report." : "Choose a team to unlock the report actions.");
      return;
    }

    if (state.reportType === "competition report") {
      els.reportSelectionTitle.textContent = "Competition report selection";
      els.reportSelectionSubtitle.textContent = "Choose a competition to generate a structured competition report with context, participants, and performance activity.";
      els.reportCompetitionWrap.classList.remove("hidden");
      hydrateCompetitionSelect();
      const enabled = Boolean(getSelectedCompetition());
      setActionBarDisabled(!enabled, enabled ? "Competition report selected" : "Select a competition", enabled ? "Generate, preview, or download the current competition report." : "Choose a competition to unlock the report actions.");
      return;
    }

    if (state.reportType === "campus summary") {
      els.reportSelectionTitle.textContent = "Campus summary context";
      els.reportSelectionSubtitle.textContent = "No individual subject is required here. The report will reflect the current campus, sport, and season filters.";
      setActionBarDisabled(false, "Campus summary selected", "Generate, preview, or download the current campus summary report.");
    }
  }

  function setActionBarDisabled(disabled, title, subtitle) {
    if (els.reportActionTitle) els.reportActionTitle.textContent = title;
    if (els.reportActionSubtitle) els.reportActionSubtitle.textContent = subtitle;
    [els.generateReportButton, els.previewPdfButton, els.downloadPdfButton].forEach((button) => {
      if (button) button.disabled = disabled;
    });
  }

  function hydrateTeamFilter(selectEl, currentValue, firstLabel) {
    if (!selectEl) return;
    const visibleTeams = getFilteredTeams();
    const options = visibleTeams.map((team) => {
      const id = compactId(team.id || team.teamId);
      const label = team.name || team.teamName || "Unnamed Team";
      return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
    }).join("");
    selectEl.innerHTML = `<option value="">${escapeHtml(firstLabel || "All teams")}</option>${options}`;
    if (currentValue && visibleTeams.some((team) => compactId(team.id || team.teamId) === currentValue)) {
      selectEl.value = currentValue;
    } else {
      selectEl.value = "";
      if (selectEl === els.reportTeamFilter) state.selectedTeamFilterId = "";
      if (selectEl === els.reportTeam) state.selectedTeamId = "";
    }
  }

  function hydrateAthleteSelect() {
    if (!els.reportAthlete) return;
    const athleteOptions = getSelectableAthletes().map((athlete) => {
      const id = compactId(athlete.id || athlete.athleteId);
      const label = getAthleteDisplayName(athlete);
      const sport = getSportName(getAthleteSportSlug(athlete));
      const team = lookupTeamName(getAthleteTeamId(athlete) || athlete.teamName);
      const descriptor = [sport, team].filter(Boolean).join(" • ");
      return `<option value="${escapeHtml(id)}">${escapeHtml(label)}${descriptor ? ` — ${escapeHtml(descriptor)}` : ""}</option>`;
    }).join("");
    const current = state.selectedAthleteId;
    const selectableAthletes = getSelectableAthletes();
    els.reportAthlete.innerHTML = `<option value="">Select athlete</option>${athleteOptions}`;
    if (current && selectableAthletes.some((athlete) => compactId(athlete.id || athlete.athleteId) === current)) {
      els.reportAthlete.value = current;
    } else {
      els.reportAthlete.value = "";
      state.selectedAthleteId = "";
    }
  }

  function hydrateCompetitionSelect() {
    if (!els.reportCompetition) return;
    const visibleCompetitions = getFilteredCompetitions();
    const rows = visibleCompetitions.map((competition) => {
      const id = compactId(competition.id || competition.competitionId);
      const label = competition.title || competition.competitionName || "Competition";
      const season = competition.seasonLabel || competition.season || "";
      const sport = getSportName(competition.sportSlug || competition.sport);
      const descriptor = [sport, season].filter(Boolean).join(" • ");
      return `<option value="${escapeHtml(id)}">${escapeHtml(label)}${descriptor ? ` — ${escapeHtml(descriptor)}` : ""}</option>`;
    }).join("");
    const current = state.selectedCompetitionId;
    els.reportCompetition.innerHTML = `<option value="">Select competition</option>${rows}`;
    if (current && visibleCompetitions.some((competition) => compactId(competition.id || competition.competitionId) === current)) {
      els.reportCompetition.value = current;
    } else {
      els.reportCompetition.value = "";
      state.selectedCompetitionId = "";
    }
  }

  function renderReports() {
    if (!els.reportsList) return;

    const payload = buildCurrentReportPayload(false);
    state.latestReportHtml = payload.html;
    state.latestReportTitle = payload.title;
    els.reportsList.innerHTML = payload.html;
  }

  function renderHelp() {
    if (!els.reportsHelp) return;

    const seasonLabel = state.filteredSeason || "All seasons";
    const campusLabel = getCampusName(state.filteredCampus || state.session?.campus);
    const sportLabel = state.filteredSport ? getSportName(state.filteredSport) : "All sports";

    if (state.reportType === "athlete report") {
      const athlete = getSelectedAthlete();
      els.reportsHelp.innerHTML = `
        <div class="section-title"><div><h2>Athlete report guidance</h2><p>The athlete report is the deepest report in the system and is designed for internal review, roster management, and transfer-style context.</p></div></div>
        <div class="stack-list">
          <div class="stack-item"><div class="stack-item-title">Current filter context</div><div class="stack-item-sub">${escapeHtml(campusLabel)} • ${escapeHtml(sportLabel)} • ${escapeHtml(seasonLabel)}</div></div>
          <div class="stack-item"><div class="stack-item-title">Selected athlete</div><div class="stack-item-sub">${escapeHtml(athlete ? getAthleteDisplayName(athlete) : "No athlete selected yet")}</div></div>
          <div class="stack-item"><div class="stack-item-title">Report depth</div><div class="stack-item-sub">The report combines identity, contact, campus context, body profile, performance summary, best marks, and competition history in one place.</div></div>
          <div class="stack-item"><div class="stack-item-title">Export flow</div><div class="stack-item-sub">Use Preview PDF to inspect the current layout, then Download PDF to open the browser print and save flow.</div></div>
        </div>
      `;
      return;
    }

    if (state.reportType === "team report") {
      const team = getSelectedTeam();
      els.reportsHelp.innerHTML = `
        <div class="section-title"><div><h2>Team report guidance</h2><p>The team report is intended to summarize the selected squad, its roster coverage, visible performance contributions, and competition activity.</p></div></div>
        <div class="stack-list">
          <div class="stack-item"><div class="stack-item-title">Current filter context</div><div class="stack-item-sub">${escapeHtml(campusLabel)} • ${escapeHtml(sportLabel)} • ${escapeHtml(seasonLabel)}</div></div>
          <div class="stack-item"><div class="stack-item-title">Selected team</div><div class="stack-item-sub">${escapeHtml(team ? (team.name || team.teamName || "Team") : "No team selected yet")}</div></div>
          <div class="stack-item"><div class="stack-item-title">Best use</div><div class="stack-item-sub">Use this to review squad composition, internal contribution depth, and which athletes are driving visible team performance records.</div></div>
          <div class="stack-item"><div class="stack-item-title">Data note</div><div class="stack-item-sub">Competition-linked stat lines are treated as the strongest source of truth for the report output.</div></div>
        </div>
      `;
      return;
    }

    if (state.reportType === "competition report") {
      const competition = getSelectedCompetition();
      els.reportsHelp.innerHTML = `
        <div class="section-title"><div><h2>Competition report guidance</h2><p>The competition report gives a structured summary of one competition and the visible athlete and team activity attached to it.</p></div></div>
        <div class="stack-list">
          <div class="stack-item"><div class="stack-item-title">Current filter context</div><div class="stack-item-sub">${escapeHtml(campusLabel)} • ${escapeHtml(sportLabel)} • ${escapeHtml(seasonLabel)}</div></div>
          <div class="stack-item"><div class="stack-item-title">Selected competition</div><div class="stack-item-sub">${escapeHtml(competition ? (competition.title || competition.competitionName || "Competition") : "No competition selected yet")}</div></div>
          <div class="stack-item"><div class="stack-item-title">Best use</div><div class="stack-item-sub">Use this to review competition context, visible participation, and the spread of recorded performance lines tied to the event.</div></div>
          <div class="stack-item"><div class="stack-item-title">Data note</div><div class="stack-item-sub">This page summarizes current records; full event and result detail should still be managed through Competition View.</div></div>
        </div>
      `;
      return;
    }

    els.reportsHelp.innerHTML = `
      <div class="section-title"><div><h2>Campus reporting guidance</h2><p>The campus summary is the broadest report. It reflects the current campus, sport, and season filters and gives a high-level operational snapshot.</p></div></div>
      <div class="stack-list">
        <div class="stack-item"><div class="stack-item-title">Current filter context</div><div class="stack-item-sub">${escapeHtml(campusLabel)} • ${escapeHtml(sportLabel)} • ${escapeHtml(seasonLabel)}</div></div>
        <div class="stack-item"><div class="stack-item-title">Core coverage</div><div class="stack-item-sub">Athletes, teams, competitions, and visible performance lines are summarized together in one operational view.</div></div>
        <div class="stack-item"><div class="stack-item-title">Track &amp; field note</div><div class="stack-item-sub">Where applicable, timed events and field events are summarized differently so the output stays sport-aware instead of generic.</div></div>
        <div class="stack-item"><div class="stack-item-title">Next step</div><div class="stack-item-sub">Use the more specific athlete, team, or competition reports when you need a deeper operational or performance dossier.</div></div>
      </div>
    `;
  }

  function buildCurrentReportPayload(forPreview) {
    if (!state.reportType) {
      return {
        title: "Reports",
        html: `<div class="empty-state"><h3>Choose a report type to continue.</h3><p>Select athlete, team, competition, or campus summary to generate a report.</p></div>`
      };
    }

    if (state.reportType === "athlete report") {
      const athlete = getSelectedAthlete();
      if (!athlete) {
        return {
          title: "Athlete report",
          html: `<div class="empty-state"><h3>Select an athlete to generate the report.</h3><p>Use the report filters, optionally narrow by team, then choose an athlete from the dropdown above. The full athlete dossier will appear here.</p></div>`
        };
      }
      return {
        title: `${getAthleteDisplayName(athlete)} | Athlete Report`,
        html: renderAthleteReportContent(athlete, forPreview)
      };
    }

    if (state.reportType === "team report") {
      const team = getSelectedTeam();
      if (!team) {
        return {
          title: "Team report",
          html: `<div class="empty-state"><h3>Select a team to generate the report.</h3><p>Choose a team above and the full team report will appear here.</p></div>`
        };
      }
      return {
        title: `${team.name || team.teamName || "Team"} | Team Report`,
        html: renderTeamReportContent(team, forPreview)
      };
    }

    if (state.reportType === "competition report") {
      const competition = getSelectedCompetition();
      if (!competition) {
        return {
          title: "Competition report",
          html: `<div class="empty-state"><h3>Select a competition to generate the report.</h3><p>Choose a competition above and the full competition report will appear here.</p></div>`
        };
      }
      return {
        title: `${competition.title || competition.competitionName || "Competition"} | Competition Report`,
        html: renderCompetitionReportContent(competition, forPreview)
      };
    }

    return {
      title: "Campus Summary Report",
      html: renderCampusSummaryContent(forPreview)
    };
  }

  function renderAthleteReportContent(athlete, forPreview) {
    const athleteId = compactId(athlete.id || athlete.athleteId);
    const athleteSportSlug = getAthleteSportSlug(athlete);
    const athleteTeamName = lookupTeamName(getAthleteTeamId(athlete) || athlete.teamName);
    const athleteProfile = getAthleteProfile(athlete);
    const athleteRoster = getAthleteRosterAssignment(athlete);
    const athleteDateOfBirth = athlete.dateOfBirth || athlete.dob || athleteProfile.dateOfBirth || "";
    const athleteSex = formatSex(athlete.gender || athlete.sex || athleteProfile.gender || athleteProfile.sex || "");
    const athleteSquadName = athlete.squadName || athlete.squad || athleteRoster.squadName || athleteRoster.squad || athleteRoster.division || athleteTeamName || "";
    const athleteSchoolClub = athlete.schoolOrClub || athlete.school || athlete.club || athleteProfile.schoolOrClub || athleteProfile.school || athleteProfile.club || "";
    const allStats = getAthleteStats(athleteId, false);
    const filteredStats = getAthleteStats(athleteId, true);
    const bests = getAthleteBestRows(allStats);
    const recentRows = [...filteredStats].sort((a, b) => compareDatesDesc(a.date, b.date)).slice(0, 12);
    const competitions = buildAthleteCompetitionRows(filteredStats);
    const performanceSummary = buildAthletePerformanceSummary(allStats, filteredStats);
    const reportDate = new Date();

    return `<div class="report-shell">
      ${renderReportHero({
        eyebrow: "Athlete report",
        title: getAthleteDisplayName(athlete),
        subtitle: "Internal athlete dossier combining identity, institutional context, body profile, performance records, best marks, and competition history.",
        pills: [
          getSportName(athleteSportSlug) || "Sport not set",
          getCampusName(athlete.campus || athlete.campusSlug || state.session.campus),
          athleteTeamName || "No team assigned"
        ],
        meta: [
          ["Filtered stats", filteredStats.length, "Visible stat lines in the current report view"],
          ["Competitions", performanceSummary.competitionCount, "Distinct competitions touched by visible stat lines"],
          ["Best marks", bests.length, "Unique best-performance event groups on record"]
        ],
        note: `Generated ${escapeHtml(reportDate.toLocaleDateString())} • ${escapeHtml(state.filteredSeason || "All seasons")}`,
        showInlineActions: !forPreview
      })}

      <div class="report-section-grid">
        <section class="report-section">
          <h3>Identity &amp; contact</h3>
          <p class="section-copy">Core identifying and contact information for the athlete.</p>
          <div class="report-meta-grid">
            ${renderMetaItem("Full name", getAthleteDisplayName(athlete))}
            ${renderMetaItem("Email", athlete.email || "—")}
            ${renderMetaItem("Phone", athlete.phone || "—")}
            ${renderMetaItem("Nationality", athlete.nationality || athlete.country || "—")}
            ${renderMetaItem("Sex", athleteSex || "—")}
            ${renderMetaItem("Hometown", athlete.hometown || athleteProfile.hometown || "—")}
            ${renderMetaItem("Date of birth", formatDate(athleteDateOfBirth) || "—")}
          </div>
        </section>

        <section class="report-section">
          <h3>Campus &amp; athlete context</h3>
          <p class="section-copy">Administrative and representation details relevant to internal movement and review.</p>
          <div class="report-meta-grid">
            ${renderMetaItem("Campus", getCampusName(athlete.campus || athlete.campusSlug || state.session.campus))}
            ${renderMetaItem("Sport", getSportName(athleteSportSlug) || "—")}
            ${renderMetaItem("Team", athleteTeamName || "—")}
            ${renderMetaItem("Squad", athleteSquadName || "—")}
            ${renderMetaItem("School / club", athleteSchoolClub || "—")}
            ${renderMetaItem("Athlete type", athlete.athleteType || athlete.type || "—")}
            ${renderMetaItem("Status", athlete.status || "—")}
            ${renderMetaItem("Position / role", getAthletePosition(athlete) || "—")}
            ${renderMetaItem("Squad role", athleteRoster.role || athleteRoster.roleLabel || "—")}
            ${renderMetaItem("Jersey / bib", athlete.jerseyNumber || athlete.bibNumber || athleteRoster.jerseyNumber || athleteRoster.bibNumber || "—")}
            ${renderMetaItem("Captain", athlete.isCaptain || athleteRoster.isCaptain ? "Yes" : "No")}
          </div>
        </section>

        <section class="report-section">
          <h3>Student context</h3>
          <p class="section-copy">Institutional details that may matter for registration, transfer context, and internal review.</p>
          <div class="report-meta-grid">
            ${renderMetaItem("Student ID", athlete.studentId || "—")}
            ${renderMetaItem("Year of study", athlete.yearOfStudy || athlete.year || "—")}
            ${renderMetaItem("Faculty", athlete.faculty || athleteProfile.faculty || "—")}
            ${renderMetaItem("Program", athlete.program || athleteProfile.program || "—")}
            ${renderMetaItem("Representation season", athlete.season || state.filteredSeason || "—")}
          </div>
        </section>

        <section class="report-section">
          <h3>Body profile</h3>
          <p class="section-copy">Physical profile fields available on the athlete record.</p>
          <div class="report-meta-grid">
            ${renderMetaItem("Height", getAthleteHeight(athlete) || "—")}
            ${renderMetaItem("Weight", getAthleteWeight(athlete) || "—")}
            ${renderMetaItem("Dominant hand", getAthleteDominantHand(athlete) || "—")}
            ${renderMetaItem("Dominant foot / leg", getAthleteDominantLeg(athlete) || "—")}
          </div>
        </section>
      </div>

      <section class="report-section">
        <h3>Performance summary</h3>
        <p class="section-copy">Summary of the visible performance context for the athlete in the current report filters.</p>
        <div class="summary-cards">
          <div class="mini-card"><div class="mini-label">Visible stat lines</div><div class="mini-value">${filteredStats.length}</div><div class="mini-sub">Current filter context</div></div>
          <div class="mini-card"><div class="mini-label">Competitions</div><div class="mini-value">${performanceSummary.competitionCount}</div><div class="mini-sub">Distinct competitions represented</div></div>
          <div class="mini-card"><div class="mini-label">Best marks</div><div class="mini-value">${bests.length}</div><div class="mini-sub">Grouped best-performance entries</div></div>
          <div class="mini-card"><div class="mini-label">Sport</div><div class="mini-value">${escapeHtml(getSportName(athleteSportSlug) || "—")}</div><div class="mini-sub">Primary reporting sport</div></div>
        </div>
      </section>

      <section class="report-section">
        <h3>Best performances</h3>
        <p class="section-copy">Best available marks grouped by event or metric.</p>
        ${bests.length ? `
          <div class="data-table-wrap" style="margin-top:14px;">
            <table class="table">
              <thead><tr><th>Event / metric</th><th>Best result</th><th>Date</th><th>Competition</th></tr></thead>
              <tbody>
                ${bests.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.eventName || row.statName || "General")}</td>
                    <td>${escapeHtml(describeStat(row))}</td>
                    <td>${escapeHtml(formatDate(row.date) || "—")}</td>
                    <td>${escapeHtml(row.competitionName || row.competitionTitle || "—")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><h3>No best-performance rows yet.</h3><p>No athlete stat lines are available to calculate best marks in the current dataset.</p></div>`}
      </section>

      <section class="report-section">
        <h3>Recent visible performance lines</h3>
        <p class="section-copy">Most recent visible entries for the current report context.</p>
        ${recentRows.length ? `
          <div class="data-table-wrap" style="margin-top:14px;">
            <table class="table">
              <thead><tr><th>Date</th><th>Event / metric</th><th>Result</th><th>Competition</th><th>Team</th></tr></thead>
              <tbody>
                ${recentRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(formatDate(row.date) || "—")}</td>
                    <td>${escapeHtml(row.eventName || row.statName || "General")}</td>
                    <td>${escapeHtml(describeStat(row))}</td>
                    <td>${escapeHtml(row.competitionName || row.competitionTitle || "—")}</td>
                    <td>${escapeHtml(lookupTeamName(row.teamId || row.teamName) || "—")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><h3>No visible stat lines.</h3><p>No athlete-linked performance lines match the current report filters.</p></div>`}
      </section>

      <section class="report-section">
        <h3>Competition history touched by visible lines</h3>
        <p class="section-copy">Distinct competitions represented inside the current athlete report context.</p>
        ${competitions.length ? `
          <div class="report-list">
            ${competitions.map((row) => `
              <div class="report-inline-stat">
                <span><strong>${escapeHtml(row.label)}</strong></span>
                <span>${escapeHtml(row.subtext)}</span>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty-state"><h3>No competition history in view.</h3><p>No competition rows are available from the currently visible athlete stat lines.</p></div>`}
      </section>
    </div>`;
  }

  function renderTeamReportContent(team, forPreview) {
    const teamId = compactId(team.id || team.teamId);
    const athletes = getFilteredAthletes().filter((athlete) => getAthleteTeamId(athlete) === teamId);
    const stats = getFilteredStats().filter((row) => compactId(row.teamId || row.team || row.teamName) === teamId);
    const competitions = getFilteredCompetitions().filter((competition) => compactId(competition.teamId || competition.team || competition.teamName) === teamId);
    const reportDate = new Date();

    return `<div class="report-shell">
      ${renderReportHero({
        eyebrow: "Team report",
        title: team.name || team.teamName || "Team",
        subtitle: "Structured team report covering squad context, visible athlete records, performance activity, and competition footprint.",
        pills: [
          getSportName(team.sportSlug || team.sport) || "Sport not set",
          getCampusName(team.campus || state.session.campus),
          team.seasonLabel || team.season || state.filteredSeason || "All seasons"
        ],
        meta: [
          ["Visible athletes", athletes.length, "Athletes tied to the selected team in the current context"],
          ["Visible stat lines", stats.length, "Performance lines tied to the selected team"],
          ["Visible competitions", competitions.length, "Competitions matching the current team context"]
        ],
        note: `Generated ${escapeHtml(reportDate.toLocaleDateString())}`,
        showInlineActions: !forPreview
      })}

      <div class="report-section-grid">
        <section class="report-section">
          <h3>Team context</h3>
          <p class="section-copy">Core administrative and seasonal team details.</p>
          <div class="report-meta-grid">
            ${renderMetaItem("Team name", team.name || team.teamName || "—")}
            ${renderMetaItem("Campus", getCampusName(team.campus || state.session.campus))}
            ${renderMetaItem("Sport", getSportName(team.sportSlug || team.sport) || "—")}
            ${renderMetaItem("Division", team.division || "—")}
            ${renderMetaItem("Season", team.seasonLabel || team.season || "—")}
            ${renderMetaItem("Status", team.status || "—")}
          </div>
        </section>

        <section class="report-section">
          <h3>Roster coverage</h3>
          <p class="section-copy">Visible athlete records linked to the selected team in the current report filters.</p>
          ${athletes.length ? `
            <div class="data-table-wrap" style="margin-top:14px;">
              <table class="table">
                <thead><tr><th>Athlete</th><th>Sport</th><th>Status</th><th>Position / role</th></tr></thead>
                <tbody>
                  ${athletes.map((athlete) => `
                    <tr>
                      <td>${escapeHtml(getAthleteDisplayName(athlete))}</td>
                      <td>${escapeHtml(getSportName(getAthleteSportSlug(athlete)) || "—")}</td>
                      <td>${escapeHtml(athlete.status || "—")}</td>
                      <td>${escapeHtml(getAthletePosition(athlete) || "—")}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty-state"><h3>No visible roster rows.</h3><p>No athlete records currently match this team and the active report filters.</p></div>`}
        </section>
      </div>

      <section class="report-section">
        <h3>Visible performance activity</h3>
        <p class="section-copy">Performance lines linked to the selected team in the current report context.</p>
        ${stats.length ? `
          <div class="data-table-wrap" style="margin-top:14px;">
            <table class="table">
              <thead><tr><th>Participant</th><th>Event / metric</th><th>Result</th><th>Date</th></tr></thead>
              <tbody>
                ${stats.slice(0, 25).map((row) => `
                  <tr>
                    <td>${escapeHtml(resolveParticipantLabel(row))}</td>
                    <td>${escapeHtml(row.eventName || row.statName || "General")}</td>
                    <td>${escapeHtml(describeStat(row))}</td>
                    <td>${escapeHtml(formatDate(row.date) || "—")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><h3>No visible performance lines.</h3><p>No team-linked stat lines currently match the selected report context.</p></div>`}
      </section>

      <section class="report-section">
        <h3>Competition footprint</h3>
        <p class="section-copy">Visible competition records associated with the selected team in the current context.</p>
        ${competitions.length ? `
          <div class="report-list">
            ${competitions.map((competition) => `
              <div class="report-inline-stat">
                <span><strong>${escapeHtml(competition.title || competition.competitionName || "Competition")}</strong></span>
                <span>${escapeHtml([
                  getSportName(competition.sportSlug || competition.sport) || "",
                  competition.seasonLabel || competition.season || "",
                  formatDate(competition.startDate || competition.date) || ""
                ].filter(Boolean).join(" • ") || "—")}</span>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty-state"><h3>No visible competition rows.</h3><p>No competition records currently match the selected team and report context.</p></div>`}
      </section>
    </div>`;
  }

  function renderCompetitionReportContent(competition, forPreview) {
    const competitionId = compactId(competition.id || competition.competitionId);
    const stats = getFilteredStats().filter((row) => compactId(row.competitionId || row.competition || row.competitionName) === competitionId);
    const tfSummary = buildTrackFieldSummary(stats);
    const sportSummary = buildSportSchemaSummary(stats, competition.sportSlug || competition.sport);

    return `<div class="report-shell">
      ${renderReportHero({
        eyebrow: "Competition report",
        title: competition.title || competition.competitionName || "Competition",
        subtitle: "Structured competition report showing context, visible participants, and performance activity tied to the selected competition.",
        pills: [
          getSportName(competition.sportSlug || competition.sport) || "Sport not set",
          getCampusName(competition.campus || state.session.campus),
          competition.seasonLabel || competition.season || state.filteredSeason || "All seasons"
        ],
        meta: [
          ["Visible stat lines", stats.length, "Performance lines tied to this competition"],
          ["Sport", getSportName(competition.sportSlug || competition.sport) || "—", "Competition sport"],
          ["Campus", getCampusName(competition.campus || state.session.campus), "Owning campus"]
        ],
        note: `Generated ${escapeHtml(new Date().toLocaleDateString())}`,
        showInlineActions: !forPreview
      })}

      <div class="report-section-grid">
        <section class="report-section">
          <h3>Competition context</h3>
          <p class="section-copy">Core competition metadata visible in the current dataset.</p>
          <div class="report-meta-grid">
            ${renderMetaItem("Title", competition.title || competition.competitionName || "—")}
            ${renderMetaItem("Campus", getCampusName(competition.campus || state.session.campus))}
            ${renderMetaItem("Sport", getSportName(competition.sportSlug || competition.sport) || "—")}
            ${renderMetaItem("Season", competition.seasonLabel || competition.season || "—")}
            ${renderMetaItem("Format", competition.format || competition.stageType || competition.structure || "—")}
            ${renderMetaItem("Date", formatDate(competition.startDate || competition.date) || "—")}
          </div>
        </section>

        <section class="report-section">
          <h3>Visibility summary</h3>
          <p class="section-copy">What is currently visible inside the selected report context.</p>
          <div class="summary-cards">
            <div class="mini-card"><div class="mini-label">Stat lines</div><div class="mini-value">${stats.length}</div><div class="mini-sub">Visible competition-linked performance rows</div></div>
            <div class="mini-card"><div class="mini-label">Campus</div><div class="mini-value">${escapeHtml(getCampusName(competition.campus || state.session.campus))}</div><div class="mini-sub">Owning campus</div></div>
            <div class="mini-card"><div class="mini-label">Sport</div><div class="mini-value">${escapeHtml(getSportName(competition.sportSlug || competition.sport) || "—")}</div><div class="mini-sub">Competition sport</div></div>
            <div class="mini-card"><div class="mini-label">Season</div><div class="mini-value">${escapeHtml(competition.seasonLabel || competition.season || "—")}</div><div class="mini-sub">Competition season</div></div>
          </div>
        </section>
      </div>

      ${tfSummary ? `
        <section class="report-section">
          <h3>Track &amp; field summary</h3>
          <p class="section-copy">Sport-aware summary for timed and field entries inside this competition report.</p>
          <div class="data-table-wrap" style="margin-top:14px;">
            <table class="table">
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Timed entries</td><td>${tfSummary.timedEntries}</td></tr>
                <tr><td>Field entries</td><td>${tfSummary.fieldEntries}</td></tr>
                <tr><td>Average timed mark</td><td>${escapeHtml(tfSummary.averageTimed || "—")}</td></tr>
                <tr><td>Average field mark</td><td>${escapeHtml(tfSummary.averageField || "—")}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ` : ""}

      ${renderSportSchemaSummarySection(sportSummary, "Sport-specific summary")}

      <section class="report-section">
        <h3>Visible performance lines</h3>
        <p class="section-copy">Recorded lines tied to this competition in the current report context.</p>
        ${stats.length ? `
          <div class="data-table-wrap" style="margin-top:14px;">
            <table class="table">
              <thead><tr><th>Participant</th><th>Event / metric</th><th>Result</th><th>Team</th><th>Date</th></tr></thead>
              <tbody>
                ${stats.slice(0, 25).map((row) => `
                  <tr>
                    <td>${escapeHtml(resolveParticipantLabel(row))}</td>
                    <td>${escapeHtml(row.eventName || row.statName || "General")}</td>
                    <td>${escapeHtml(describeStat(row))}</td>
                    <td>${escapeHtml(lookupTeamName(row.teamId || row.teamName) || "—")}</td>
                    <td>${escapeHtml(formatDate(row.date) || "—")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><h3>No visible performance lines.</h3><p>No competition-linked stat lines currently match the chosen report context.</p></div>`}
      </section>
    </div>`;
  }

  function renderCampusSummaryContent(forPreview) {
    const stats = getFilteredStats();
    const athletes = getFilteredAthletes();
    const teams = getFilteredTeams();
    const competitions = getFilteredCompetitions();
    const tfSummary = buildTrackFieldSummary(stats);
    const sportSummary = buildSportSchemaSummary(stats, state.filteredSport);

    return `<div class="report-shell">
      ${renderReportHero({
        eyebrow: "Campus summary",
        title: `${getCampusName(state.filteredCampus || state.session.campus)} summary`,
        subtitle: "High-level operational snapshot of the currently selected report context across athletes, teams, competitions, and visible performance records.",
        pills: [
          getCampusName(state.filteredCampus || state.session.campus),
          getSportName(state.filteredSport) || "All sports",
          state.filteredSeason || "All seasons"
        ],
        meta: [
          ["Athletes", athletes.length, "Visible athlete records"],
          ["Teams", teams.length, "Visible team records"],
          ["Competitions", competitions.length, "Visible competition records"]
        ],
        note: `Generated ${escapeHtml(new Date().toLocaleDateString())}`,
        showInlineActions: !forPreview
      })}

      <section class="report-section">
        <h3>Operational summary</h3>
        <p class="section-copy">High-level view of the current campus reporting context.</p>
        <div class="summary-cards">
          <div class="mini-card"><div class="mini-label">Athletes</div><div class="mini-value">${athletes.length}</div><div class="mini-sub">Visible athlete records</div></div>
          <div class="mini-card"><div class="mini-label">Teams</div><div class="mini-value">${teams.length}</div><div class="mini-sub">Visible team records</div></div>
          <div class="mini-card"><div class="mini-label">Competitions</div><div class="mini-value">${competitions.length}</div><div class="mini-sub">Visible competition records</div></div>
          <div class="mini-card"><div class="mini-label">Stat Lines</div><div class="mini-value">${stats.length}</div><div class="mini-sub">Visible performance records</div></div>
        </div>
      </section>

      ${tfSummary ? `
        <section class="report-section">
          <h3>Track &amp; field summary</h3>
          <p class="section-copy">Sport-aware summary for timed and field entries inside the current campus report context.</p>
          <div class="data-table-wrap" style="margin-top:14px;">
            <table class="table">
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Timed entries</td><td>${tfSummary.timedEntries}</td></tr>
                <tr><td>Field entries</td><td>${tfSummary.fieldEntries}</td></tr>
                <tr><td>Average timed mark</td><td>${escapeHtml(tfSummary.averageTimed || "—")}</td></tr>
                <tr><td>Average field mark</td><td>${escapeHtml(tfSummary.averageField || "—")}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ` : ""}

      ${renderSportSchemaSummarySection(sportSummary, "Sport coverage summary")}

      <section class="report-section">
        <h3>Visible records snapshot</h3>
        <p class="section-copy">A quick view of visible records inside the current campus report context.</p>
        <div class="report-list">
          <div class="report-inline-stat"><span><strong>Campus</strong></span><span>${escapeHtml(getCampusName(state.filteredCampus || state.session.campus))}</span></div>
          <div class="report-inline-stat"><span><strong>Sport filter</strong></span><span>${escapeHtml(getSportName(state.filteredSport) || "All sports")}</span></div>
          <div class="report-inline-stat"><span><strong>Season filter</strong></span><span>${escapeHtml(state.filteredSeason || "All seasons")}</span></div>
          <div class="report-inline-stat"><span><strong>Visible stat lines</strong></span><span>${escapeHtml(String(stats.length))}</span></div>
        </div>
      </section>
    </div>`;
  }

  function renderReportHero(config) {
    const pills = Array.isArray(config.pills) ? config.pills.filter(Boolean) : [];
    const meta = Array.isArray(config.meta) ? config.meta : [];

    return `
      <section class="report-hero card">
        <div class="report-hero-main">
          <div>
            <div class="eyebrow">${escapeHtml(config.eyebrow || "Report")}</div>
            <h1>${escapeHtml(config.title || "Report")}</h1>
            <p class="hero-text">${escapeHtml(config.subtitle || "")}</p>
            <div class="pill-row">
              ${pills.map((pill) => `<span class="status-pill">${escapeHtml(String(pill))}</span>`).join("")}
            </div>
            ${config.note ? `<p class="report-note">${escapeHtml(config.note)}</p>` : ""}
            ${config.showInlineActions ? `
              <div class="report-actions-inline">
                <button class="btn btn-soft" type="button" onclick="window.print()">Print</button>
              </div>
            ` : ""}
          </div>
          <div class="report-hero-meta">
            ${meta.map((item) => `
              <div class="mini-card">
                <div class="mini-label">${escapeHtml(String(item[0] || ""))}</div>
                <div class="mini-value">${escapeHtml(String(item[1] ?? "—"))}</div>
                <div class="mini-sub">${escapeHtml(String(item[2] || ""))}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderMetaItem(label, value) {
    return `
      <div class="report-meta-item">
        <span class="report-meta-label">${escapeHtml(label)}</span>
        <div class="report-meta-value">${escapeHtml(String(value ?? "—"))}</div>
      </div>
    `;
  }

  function getAthleteProfile(athlete) {
    return athlete?.profile && typeof athlete.profile === "object" ? athlete.profile : {};
  }

  function getAthleteRosterAssignment(athlete) {
    if (athlete?.activeRosterAssignment && typeof athlete.activeRosterAssignment === "object") {
      return athlete.activeRosterAssignment;
    }
    if (athlete?.rosterAssignment && typeof athlete.rosterAssignment === "object") {
      return athlete.rosterAssignment;
    }
    return {};
  }

  function getAthleteSportSlug(athlete) {
    const profile = getAthleteProfile(athlete);
    const roster = getAthleteRosterAssignment(athlete);
    return APP.normalizeSportSlug(
      athlete?.sportSlug ||
      athlete?.primarySportSlug ||
      athlete?.sport ||
      athlete?.primarySport ||
      profile.sportSlug ||
      profile.sport ||
      roster.sportSlug ||
      roster.team?.sportSlug ||
      roster.team?.sport
    );
  }

  function getAthleteTeamId(athlete) {
    const roster = getAthleteRosterAssignment(athlete);
    return compactId(
      athlete?.teamId ||
      athlete?.team?.id ||
      roster.teamId ||
      roster.team?.id ||
      roster.team?.teamId
    );
  }

  function getAthletePosition(athlete) {
    const profile = getAthleteProfile(athlete);
    const roster = getAthleteRosterAssignment(athlete);
    return athlete?.position || athlete?.role || athlete?.eventGroup || athlete?.events || profile.position || profile.eventsSpecialties || roster.roleLabel || roster.role || "";
  }

  function getAthleteHeight(athlete) {
    const profile = getAthleteProfile(athlete);
    return athlete?.height || athlete?.heightCm || profile.height || profile.heightCm || "";
  }

  function getAthleteWeight(athlete) {
    const profile = getAthleteProfile(athlete);
    return athlete?.weight || athlete?.weightKg || profile.weight || profile.weightKg || "";
  }

  function getAthleteDominantHand(athlete) {
    const profile = getAthleteProfile(athlete);
    return athlete?.dominantHand || athlete?.hand || profile.dominantHand || profile.hand || "";
  }

  function getAthleteDominantLeg(athlete) {
    const profile = getAthleteProfile(athlete);
    return athlete?.dominantFoot || athlete?.dominantLeg || athlete?.leg || profile.dominantFoot || profile.dominantLeg || profile.leg || "";
  }

  function getFilteredAthletes() {
    const campus = APP.normalizeCampus(state.filteredCampus || state.session?.campus);
    return state.athletes.filter((athlete) => {
      const athleteCampus = APP.normalizeCampus(athlete.campus || athlete.campusSlug || state.session?.campus);
      const sportSlug = getAthleteSportSlug(athlete);
      const season = String(athlete.season || athlete.seasonLabel || "").trim();

      if (campus && athleteCampus !== campus) return false;
      if (state.filteredSport && sportSlug !== state.filteredSport) return false;
      if (state.filteredSeason && season && season !== state.filteredSeason) return false;
      return true;
    });
  }

  function getFilteredTeams() {
    const campus = APP.normalizeCampus(state.filteredCampus || state.session?.campus);
    return state.teams.filter((team) => {
      const teamCampus = APP.normalizeCampus(team.campus || state.session?.campus);
      const sportSlug = APP.normalizeSportSlug(team.sportSlug || team.sport);
      const season = String(team.season || team.seasonLabel || "").trim();

      if (campus && teamCampus !== campus) return false;
      if (state.filteredSport && sportSlug !== state.filteredSport) return false;
      if (state.filteredSeason && season && season !== state.filteredSeason) return false;
      return true;
    });
  }

  function getFilteredCompetitions() {
    const campus = APP.normalizeCampus(state.filteredCampus || state.session?.campus);
    return state.competitions.filter((competition) => {
      const compCampus = APP.normalizeCampus(competition.campus || state.session?.campus);
      const sportSlug = APP.normalizeSportSlug(competition.sportSlug || competition.sport);
      const season = String(competition.season || competition.seasonLabel || "").trim();

      if (campus && compCampus !== campus) return false;
      if (state.filteredSport && sportSlug !== state.filteredSport) return false;
      if (state.filteredSeason && season && season !== state.filteredSeason) return false;
      return true;
    });
  }

  function getFilteredStats() {
    const campus = APP.normalizeCampus(state.filteredCampus || state.session?.campus);
    return state.statLines.filter((row) => {
      const rowCampus = APP.normalizeCampus(row.campus || row.campusSlug || state.session?.campus);
      const sportSlug = APP.normalizeSportSlug(row.sportSlug || row.sport);
      const season = String(row.season || row.seasonLabel || "").trim();

      if (campus && rowCampus !== campus) return false;
      if (state.filteredSport && sportSlug !== state.filteredSport) return false;
      if (state.filteredSeason && season && season !== state.filteredSeason) return false;
      return true;
    });
  }

  function getSelectableAthletes() {
    const teamFilterId = state.selectedTeamFilterId;
    const athletes = getFilteredAthletes();
    if (!teamFilterId) return athletes;
    return athletes.filter((athlete) => getAthleteTeamId(athlete) === teamFilterId);
  }

  function getSelectedAthlete() {
    return getSelectableAthletes().find((athlete) => compactId(athlete.id || athlete.athleteId) === state.selectedAthleteId) || null;
  }

  function getSelectedTeam() {
    return getFilteredTeams().find((team) => compactId(team.id || team.teamId) === state.selectedTeamId) || null;
  }

  function getSelectedCompetition() {
    return getFilteredCompetitions().find((competition) => compactId(competition.id || competition.competitionId) === state.selectedCompetitionId) || null;
  }

  function getAthleteStats(athleteId, filteredOnly) {
    const source = filteredOnly ? getFilteredStats() : state.statLines;
    return source.filter((row) => compactId(row.athleteId || row.athlete || row.participantId || row.subjectId || row.playerId) === athleteId);
  }

  function getAthleteBestRows(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const key = String(row.eventName || row.statName || "general").toLowerCase();
      if (!map.has(key)) {
        map.set(key, row);
        return;
      }
      const current = map.get(key);
      if (compareBestStat(row, current) < 0) {
        map.set(key, row);
      }
    });
    return Array.from(map.values()).sort((a, b) => String(a.eventName || a.statName || "").localeCompare(String(b.eventName || b.statName || "")));
  }

  function buildAthleteCompetitionRows(rows) {
    const seen = new Map();
    rows.forEach((row) => {
      const label = row.competitionName || row.competitionTitle || "Competition";
      const key = `${label}__${formatDate(row.date) || ""}`;
      if (!seen.has(key)) {
        seen.set(key, {
          label,
          subtext: [formatDate(row.date) || "", describeStat(row)].filter(Boolean).join(" • ")
        });
      }
    });
    return Array.from(seen.values());
  }

  function buildAthletePerformanceSummary(allStats, filteredStats) {
    const competitionCount = new Set(filteredStats.map((row) => row.competitionId || row.competitionName || row.competitionTitle || "")).size;
    return {
      totalStats: allStats.length,
      visibleStats: filteredStats.length,
      competitionCount
    };
  }

  function buildTrackFieldSummary(stats) {
    const tfRows = stats.filter((row) => APP.normalizeSportSlug(row.sportSlug || row.sport) === "track-and-field");
    if (!tfRows.length) return null;

    const timed = tfRows.filter((row) => isTimedMark(row));
    const field = tfRows.filter((row) => isFieldMark(row));

    return {
      timedEntries: timed.length,
      fieldEntries: field.length,
      averageTimed: timed.length ? averageOf(timed.map((row) => parseFloat(row.resultTime || row.time || row.performance))).toFixed(2) : "",
      averageField: field.length ? averageOf(field.map((row) => parseFloat(row.resultDistance || row.distance || row.height || row.performance))).toFixed(2) : ""
    };
  }

  function buildSportSchemaSummary(stats, sportFilter) {
    const rows = Array.isArray(stats) ? stats : [];
    const selectedSport = APP.normalizeSportSlug(sportFilter || "");
    const grouped = new Map();

    rows.forEach((row) => {
      const sportSlug = APP.normalizeSportSlug(row.sportSlug || row.sport);
      if (!sportSlug || (selectedSport && sportSlug !== selectedSport)) return;
      if (!APP.getSportSchema?.(sportSlug)) return;
      if (!grouped.has(sportSlug)) grouped.set(sportSlug, []);
      grouped.get(sportSlug).push(row);
    });

    if (!grouped.size) return null;

    return Array.from(grouped.entries()).map(([sportSlug, sportRows]) => {
      const schema = APP.getSportSchema?.(sportSlug);
      const fieldNames = Object.values(schema?.eventTypes || {}).flatMap((eventSchema) => eventSchema.fields || []);
      const uniqueFields = Array.from(new Set(fieldNames));
      const populatedFields = uniqueFields.filter((fieldName) =>
        sportRows.some((row) => getStatDataValue(row, fieldName) !== null && getStatDataValue(row, fieldName) !== "")
      );

      return {
        sportSlug,
        sportName: getSportName(sportSlug),
        statLines: sportRows.length,
        subjects: new Set(sportRows.map((row) => compactId(row.subjectId || row.athleteId || row.teamId || resolveParticipantLabel(row)))).size,
        fieldsCovered: populatedFields.length,
        schemaFields: uniqueFields.length,
        sampleFields: populatedFields.slice(0, 6).map(formatFieldLabel)
      };
    });
  }

  function renderSportSchemaSummarySection(summary, title) {
    if (!summary || !summary.length) return "";
    return `
      <section class="report-section">
        <h3>${escapeHtml(title)}</h3>
        <p class="section-copy">Sport-aware coverage based on the blueprint schema for each visible sport.</p>
        <div class="data-table-wrap" style="margin-top:14px;">
          <table class="table">
            <thead><tr><th>Sport</th><th>Stat lines</th><th>Subjects</th><th>Fields covered</th><th>Visible field examples</th></tr></thead>
            <tbody>
              ${summary.map((item) => `
                <tr>
                  <td>${escapeHtml(item.sportName)}</td>
                  <td>${escapeHtml(String(item.statLines))}</td>
                  <td>${escapeHtml(String(item.subjects))}</td>
                  <td>${escapeHtml(`${item.fieldsCovered}/${item.schemaFields}`)}</td>
                  <td>${escapeHtml(item.sampleFields.length ? item.sampleFields.join(", ") : "No populated schema fields yet")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function getStatDataValue(row, fieldName) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : row;
    const value = data?.[fieldName];
    return value === undefined ? null : value;
  }

  function formatFieldLabel(fieldName) {
    return String(fieldName || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function isTimedMark(row) {
    const event = String(row.eventName || row.statName || "").toLowerCase();
    return /m|hurdle|relay|dash|run|swim|freestyle|butterfly|backstroke|breaststroke|medley/.test(event);
  }

  function isFieldMark(row) {
    const event = String(row.eventName || row.statName || "").toLowerCase();
    return /jump|vault|put|throw|discus|javelin|hammer/.test(event);
  }

  function averageOf(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    if (!clean.length) return 0;
    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
  }

  function compareBestStat(a, b) {
    const aValue = numericStatValue(a);
    const bValue = numericStatValue(b);

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    if (isTimedMark(a) || isTimedMark(b)) {
      return aValue - bValue;
    }
    return bValue - aValue;
  }

  function numericStatValue(row) {
    const possible = [
      row.resultTime, row.time, row.performance,
      row.resultDistance, row.distance, row.height,
      row.score, row.value
    ];
    for (const item of possible) {
      const parsed = parseFloat(item);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function resolveParticipantLabel(row) {
    if (row.participantName) return row.participantName;
    if (row.athleteName) return row.athleteName;
    if (row.teamName) return row.teamName;
    const athlete = state.athletes.find((item) => compactId(item.id || item.athleteId) === compactId(row.athleteId || row.athlete || row.participantId));
    if (athlete) return getAthleteDisplayName(athlete);
    return "Participant";
  }

  function lookupTeamName(teamValue) {
    if (teamValue && typeof teamValue === "object") {
      return teamValue.name || teamValue.teamName || lookupTeamName(teamValue.id || teamValue.teamId);
    }
    const compact = compactId(teamValue);
    if (!compact) return typeof teamValue === "string" ? teamValue : "";
    const team = state.teams.find((item) => compactId(item.id || item.teamId) === compact);
    return team ? (team.name || team.teamName || "") : "";
  }

  function getAthleteDisplayName(athlete) {
    return athlete.fullName || [athlete.firstName, athlete.lastName].filter(Boolean).join(" ").trim() || athlete.name || "Athlete";
  }

  function normalizeArray(result, preferredKeys, fallback) {
    if (!result) return fallback || [];
    const source = result.status === "fulfilled" ? result.value : null;
    if (Array.isArray(source)) return source;
    if (!source || typeof source !== "object") return fallback || [];
    for (const key of preferredKeys) {
      if (Array.isArray(source[key])) return source[key];
      if (source.data && Array.isArray(source.data[key])) return source.data[key];
    }
    if (Array.isArray(source.data)) return source.data;
    if (Array.isArray(source)) return source;
    return fallback || [];
  }

  function normalizeStat(row) {
    return row && typeof row === "object" ? row : {};
  }

  function compactId(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function getCampusName(value) {
    const slug = APP.normalizeCampus(value);
    return APP.CAMPUS_META?.[slug]?.name || value || "Campus";
  }

  function getSportName(value) {
    const slug = APP.normalizeSportSlug(value);
    const match = (APP.SPORT_REGISTRY || []).find((sport) => sport.slug === slug);
    return match ? match.name : value || "";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  }

  function calculateAge(value) {
    if (!value) return "";
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return "";
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
    return age > 0 ? String(age) : "";
  }

  function formatSex(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "m" || raw === "male") return "Male";
    if (raw === "f" || raw === "female") return "Female";
    return "";
  }

  function compareDatesDesc(a, b) {
    const aTime = a ? new Date(a).getTime() : 0;
    const bTime = b ? new Date(b).getTime() : 0;
    return bTime - aTime;
  }

  function describeStat(row) {
    const data = row?.statData && typeof row.statData === "object" ? row.statData : {};
    const summary = data.summary && typeof data.summary === "object" ? data.summary : {};
    const candidates = [
      row.result,
      row.performance,
      row.resultTime,
      row.time,
      row.resultDistance,
      row.distance,
      row.height,
      row.score,
      row.value,
      data.result,
      data.performance,
      data.resultTime,
      data.time,
      data.finalTime,
      data.resultDistance,
      data.distance,
      data.bestDistance,
      data.height,
      data.bestHeight,
      data.bestMark,
      data.score,
      data.value,
      data.runs,
      data.goals,
      data.points,
      summary.result,
      summary.resultLabel,
      summary.winningResult,
      summary.finalScore,
      summary.total,
      summary.points
    ];
    const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim() !== "");
    return value === undefined ? "—" : String(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function openPreviewModal() {
    if (!els.reportPreviewModal || !els.reportPreviewBody || !els.reportPreviewTitle) return;
    const payload = buildCurrentReportPayload(true);
    els.reportPreviewTitle.textContent = payload.title;
    els.reportPreviewBody.innerHTML = `<div class="preview-page">${payload.html}</div>`;
    els.reportPreviewModal.classList.remove("hidden");
    els.reportPreviewModal.setAttribute("aria-hidden", "false");
  }

  function closePreviewModal() {
    if (!els.reportPreviewModal) return;
    els.reportPreviewModal.classList.add("hidden");
    els.reportPreviewModal.setAttribute("aria-hidden", "true");
  }

  function downloadCurrentReportPdf() {
    const payload = buildCurrentReportPayload(true);
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) return;

    popup.document.open();
    popup.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title>${escapeHtml(payload.title)}</title>
        <link rel="stylesheet" href="uwi-core-base.css"/>
        <link rel="stylesheet" href="uwi-signed-base.css"/>
        <link rel="stylesheet" href="reports.css"/>
        <style>
          body{padding:24px;background:#fff;}
          .report-actions-inline{display:none!important;}
          .preview-page{border:none;box-shadow:none;padding:0;}
        </style>
      </head>
      <body>
        <div class="preview-page">${payload.html}</div>
        <script>
          window.onload = function () {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);
    popup.document.close();
  }
})();
