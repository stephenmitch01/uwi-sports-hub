(function () {
  "use strict";

  // Shared App Access
  /**
   * Competition registry workflow.
   *
   * Competitions are the entry point for official stats. Users create or select
   * a competition, then open the sport-specific scorecard/result workflow that
   * saves data for reports, leaderboards, athlete profiles, and team pages.
   */
  const APP = window.UWISportsHub;
  // Page State
  const state = {
    session: null,
    competitions: [],
    loadError: "",
    registrySearchApplied: false
  };

  // Page Elements
  const els = {
    competitionsTableBody: document.getElementById("competitionsTableBody"),
    competitionsEmpty: document.getElementById("competitionsEmpty"),
    searchInput: document.getElementById("competitionSearch"),
    sportFilter: document.getElementById("competitionSport"),
    campusFilter: document.getElementById("competitionCampus"),
    formatFilter: document.getElementById("competitionFormat"),
    qualityFilter: document.getElementById("competitionQuality"),
    searchButton: document.getElementById("competitionSearchButton"),
    totalCompetitionsStat: document.getElementById("totalCompetitionsStat"),
    activeCompetitionsStat: document.getElementById("activeCompetitionsStat"),
    competitionSportsStat: document.getElementById("competitionSportsStat"),
    completedCompetitionsStat: document.getElementById("completedCompetitionsStat"),
    competitionsMissingResultsStat: document.getElementById("competitionsMissingResultsStat"),
    competitionAlerts: document.getElementById("competitionAlerts"),
    competitionActivity: document.getElementById("competitionActivity"),
    competitionQualityScore: document.getElementById("competitionQualityScore"),
    competitionQualityBar: document.getElementById("competitionQualityBar"),
    competitionQualityCopy: document.getElementById("competitionQualityCopy")
  };

  document.addEventListener("DOMContentLoaded", init);

  // Page Setup
  /**
   * Coordinates the page lifecycle: mount/auth context first, fetch backend data, then render and bind events.
   */
  async function init() {
    state.session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Competitions" });
    if (!state.session) {
      window.location.href = "index.html";
      return;
    }

    populateFilters();
    ensureArchivedQualityOption(els.qualityFilter);
    renderCompetitionsPageShell();
    bindCreatePanelLink();
    bindCreatePanelClose();
    bindInsightActions();
    bindCompetitionFilters();
    await loadCompetitions();
    renderHeroStats();
    renderOperationalSummary();
    renderCompetitionsTable();
  }

  // Event Wiring
  /**
   * Binds the create panel link interactions once so rerenders do not duplicate listeners.
   */
  function bindCreatePanelLink() {
    document.querySelectorAll('a[href="#competitionCreatePanel"]').forEach((link) => {
      link.addEventListener("click", () => {
        const panel = document.getElementById("competitionCreatePanel");
        if (panel) {
          panel.hidden = false;
          panel.open = true;
        }
      });
    });
  }

  // Event Wiring
  /**
   * Binds the create panel close interactions once so rerenders do not duplicate listeners.
   */
  function bindCreatePanelClose() {
    const panel = document.getElementById("competitionCreatePanel");
    if (!panel) return;
    panel.addEventListener("toggle", () => {
      if (!panel.open) panel.hidden = true;
    });
  }

  // Edit Form Prefill
  /**
   * Populates editable controls from loaded backend data while preserving record IDs and relationships.
   */
  function populateFilters() {
    if (els.sportFilter) {
      els.sportFilter.innerHTML = `
        <option value="">All sports</option>
        ${APP.SPORT_REGISTRY.map((sport) => `
          <option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>
        `).join("")}
      `;
    }

   if (els.campusFilter) {
  const campus = state.session?.campus || "";

  els.campusFilter.innerHTML = `
    <option value="${escapeHtml(campus)}">
      ${escapeHtml(getCampusName(campus))}
    </option>
  `;

  els.campusFilter.disabled = true;
}
  }

  // Competitions Page Shell
  /**
   * Renders the competitions page shell section from normalized page state without mutating backend data.
   */
  function renderCompetitionsPageShell() {
    if (!els.competitionsEmpty) return;

    els.competitionsEmpty.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Create Competition</h2>
          <p>Add a competition, then open it to manage units, participants, results, and stat lines.</p>
        </div>
      </div>

      <form id="competitionCreateForm" class="filter-grid">
        <div>
          <label for="createCompetitionTitle">Competition Title</label>
          <input id="createCompetitionTitle" class="input" type="text" placeholder="e.g. UWI Football League 2026" />
        </div>

        <div>
          <label for="createCompetitionSport">Sport</label>
          <select id="createCompetitionSport" class="select">
            <option value="">Select sport</option>
            ${APP.SPORT_REGISTRY.map(
              (sport) => `<option value="${escapeHtml(sport.slug)}">${escapeHtml(sport.name)}</option>`
            ).join("")}
          </select>
        </div>

        <div>
          <label for="createCompetitionFormat">Format</label>
          <select id="createCompetitionFormat" class="select">
            <option value="">Select format</option>
            <option value="league">League</option>
            <option value="round-robin">Round Robin</option>
            <option value="knockout">Knockout</option>
            <option value="heats-final">Heats + Final</option>
            <option value="timed-final">Timed Final</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label for="createCompetitionSeason">Season</label>
          <input id="createCompetitionSeason" class="input" type="text" placeholder="e.g. 2026" />
        </div>

        <div>
          <label for="createCompetitionStart">Start Date</label>
          <input id="createCompetitionStart" class="input" type="date" />
        </div>

        <div>
          <label for="createCompetitionEnd">End Date</label>
          <input id="createCompetitionEnd" class="input" type="date" />
        </div>

        <div>
          <label for="createCompetitionStatus">Status</label>
          <select id="createCompetitionStatus" class="select">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div class="competition-create-action">
          <button type="submit" class="btn btn-campus">Create Competition</button>
        </div>
      </form>

      <div id="competitionsPageMessage" class="message" style="margin-top:12px;"></div>
    `;

    bindCompetitionCreateForm();
  }

  // Event Wiring
  /**
   * Binds the competition create form interactions once so rerenders do not duplicate listeners.
   */
  function bindCompetitionCreateForm() {
    const form = document.getElementById("competitionCreateForm");
    const messageEl = document.getElementById("competitionsPageMessage");

    if (!form || !messageEl) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      messageEl.className = "message";
      messageEl.textContent = "";

      const title = document.getElementById("createCompetitionTitle").value.trim();
      const sportSlug = document.getElementById("createCompetitionSport").value.trim();
      const campusOwner = APP.normalizeCampus(state.session?.campus || "");
      const formatSlug = document.getElementById("createCompetitionFormat").value.trim();
      const seasonLabel = document.getElementById("createCompetitionSeason").value.trim();
      const startDate = document.getElementById("createCompetitionStart").value.trim();
      const endDate = document.getElementById("createCompetitionEnd").value.trim();
      const status = document.getElementById("createCompetitionStatus").value.trim();

      if (!title || !sportSlug || !campusOwner) {
        messageEl.textContent = "Enter a title and sport.";
        messageEl.classList.add("error");
        return;
      }
      const candidate = { title, name: title, sportSlug, startDate };
      const duplicate = APP.findSimilarRecord(state.competitions, candidate, { type: "competition", threshold: 0.78 });
      if (duplicate) {
        const action = APP.promptDuplicateAction(duplicate, "competition");
        if (action === "cancel") return;
        if (action === "view" || action === "edit-existing") {
          window.location.href = `competition-view.html?competitionId=${encodeURIComponent(duplicate.id)}`;
          return;
        }
      }
      try {
        const data = await APP.apiPost("/competitions", {
          title,
          sportSlug,
          campusOwner,
          formatSlug: formatSlug || null,
          seasonLabel: seasonLabel || null,
          startDate: startDate || null,
          endDate: endDate || null,
          status: status || "DRAFT"
        }, { redirectOn401: true });

        const createdCompetition = data?.competition || data?.data?.competition || data?.data || data || null;

        messageEl.textContent = "Competition created successfully.";
        messageEl.classList.add("success");

        form.reset();

        await loadCompetitions();
        renderOperationalSummary();
        renderCompetitionsTable();

        if (createdCompetition?.id) {
          window.location.href = `competition-view.html?competitionId=${encodeURIComponent(createdCompetition.id)}`;
        }
      } catch (error) {
        console.error("Create competition error:", error);
        messageEl.textContent = "Unable to connect to the competitions API.";
        messageEl.classList.add("error");
      }
    });
  }

  // Event Wiring
  /**
   * Binds the competition filters interactions once so rerenders do not duplicate listeners.
   */
  function bindCompetitionFilters() {
    [els.searchInput, els.sportFilter, els.campusFilter, els.formatFilter, els.qualityFilter].forEach((node) => {
      if (!node) return;
      node.addEventListener("input", handleFilterChange);
      node.addEventListener("change", handleFilterChange);
    });
    if (els.searchButton) els.searchButton.addEventListener("click", applyRegistrySearch);
    mountRecentSearches("competitions");
  }

  // Workflow: Filter Change
  /**
   * Handles the filter change workflow and keeps side effects inside the intended API/action path.
   */
  function handleFilterChange() {
    const panel = document.getElementById("competitionsListPanel");
    if (hasActiveRegistryFilter() && panel) panel.open = true;
    state.registrySearchApplied = false;
  }

  function applyRegistrySearch() {
    const panel = document.getElementById("competitionsListPanel");
    if (panel) panel.open = true;
    state.registrySearchApplied = true;
    saveCurrentSearch("competitions");
    mountRecentSearches("competitions");
    renderCompetitionsTable();
  }

  // Data Loading
  /**
   * Loads competitions data required by later normalization and rendering steps.
   */
  async function loadCompetitions() {    try {
      const data = await APP.apiGet("/competitions?includeArchived=true", true);
      state.competitions =
        Array.isArray(data) ? data :
        Array.isArray(data?.competitions) ? data.competitions :
        Array.isArray(data?.data?.competitions) ? data.data.competitions :
        Array.isArray(data?.data) ? data.data :
        [];
      state.loadError = "";
      renderHeroStats();
      renderOperationalSummary();
    } catch (error) {
      console.error("Load competitions error:", error);
      state.competitions = [];
      state.loadError = error?.message || "Competitions could not be loaded right now.";
    }
  }

  // Competitions Table
  /**
   * Renders the competitions table section from normalized page state without mutating backend data.
   */
  function renderCompetitionsTable() {
    if (!els.competitionsTableBody) return;

    if (!state.registrySearchApplied) {
      els.competitionsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <h3>Search competition records.</h3>
              <p>Click Search to show all competitions, or choose filters for a focused list.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const competitions = getFilteredCompetitions();

    if (!competitions.length) {
      const title = state.loadError ? "Competition records are unavailable right now." : "Records will appear here once added.";
      const copy = state.loadError
        ? escapeHtml(state.loadError)
        : "Create a competition to manage units, participants, results, and statistics.";

      els.competitionsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <h3>${title}</h3>
              <p>${copy}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    els.competitionsTableBody.innerHTML = competitions
      .map((competition) => {
        const sportName = getSportName(competition.sportSlug || competition.sport);
        const campusName = getCampusName(competition.campusOwner || competition.campus);
        const formatLabel = formatCompetitionFormat(competition.formatSlug || competition.format);

        return `
          <tr>
            <td><strong>${escapeHtml(competition.title || "Competition")}</strong></td>
            <td>${escapeHtml(sportName || "—")}</td>
            <td>${escapeHtml(campusName)}</td>
            <td>${escapeHtml(formatLabel)}</td>
            <td>${escapeHtml(competition.seasonLabel || "—")}</td>
            <td>${completenessMarkup(getCompetitionQuality(competition))}</td>
            <td>
              <a class="btn btn-campus" href="competition-view.html?competitionId=${encodeURIComponent(competition.id)}">Open</a>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Hero Stats
  /**
   * Renders the hero stats section from normalized page state without mutating backend data.
   */
  function renderHeroStats() {
    const sessionCampus = normalizeCampusFilter(state.session?.campus);
    const rows = state.competitions.filter((competition) => normalizeCampusFilter(competition.campusOwner || competition.campus || "") === sessionCampus && !APP.isArchivedRecord(competition));
    if (els.totalCompetitionsStat) els.totalCompetitionsStat.textContent = String(rows.length);
    if (els.activeCompetitionsStat) els.activeCompetitionsStat.textContent = String(rows.filter((competition) => String(competition.status || "").toLowerCase() === "active").length);
    if (els.competitionSportsStat) els.competitionSportsStat.textContent = String(new Set(rows.map((competition) => competition.sportSlug || competition.sport).filter(Boolean)).size);
    if (els.completedCompetitionsStat) els.completedCompetitionsStat.textContent = String(rows.filter((competition) => String(competition.status || "").toLowerCase() === "completed").length);
    if (els.competitionsMissingResultsStat) els.competitionsMissingResultsStat.textContent = String(rows.filter((competition) => !hasCompetitionResults(competition)).length);
  }

  // Operational Summary
  /**
   * Renders the operational summary section from normalized page state without mutating backend data.
   */
  function renderOperationalSummary() {
    const sessionCampus = normalizeCampusFilter(state.session?.campus);
    const rows = state.competitions.filter((competition) => normalizeCampusFilter(competition.campusOwner || competition.campus || "") === sessionCampus && !APP.isArchivedRecord(competition));
    const missingResults = rows.filter((competition) => !hasCompetitionResults(competition));
    const missingDates = rows.filter((competition) => !competition.startDate && !competition.endDate);
    const missingFormat = rows.filter((competition) => !(competition.formatSlug || competition.format));
    const quality = rows.length
      ? Math.round(rows.reduce((sum, competition) => sum + getCompetitionQuality(competition), 0) / rows.length)
      : 0;

    renderInsightList(els.competitionAlerts, [
      { label: "Missing result data", value: missingResults.length, target: "competitionsListPanel", filter: "incomplete" },
      { label: "Missing dates", value: missingDates.length, target: "competitionsListPanel", filter: "incomplete" },
      { label: "Missing format", value: missingFormat.length, target: "competitionsListPanel", filter: "incomplete" }
    ], "No competition alerts right now.");

    renderActivityList(els.competitionActivity, getRecentRecords(rows, "competition"));
    renderQuality(els.competitionQualityScore, els.competitionQualityBar, els.competitionQualityCopy, quality, `${rows.filter((competition) => getCompetitionQuality(competition) < 100).length} competition setup${rows.length === 1 ? "" : "s"} below 100% completion.`);
  }

  function getCompetitionQuality(competition) {
    const checks = [
      competition.title,
      competition.sportSlug || competition.sport,
      competition.formatSlug || competition.format,
      competition.seasonLabel,
      competition.startDate || competition.endDate,
      competition.status,
      hasCompetitionResults(competition)
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function hasCompetitionResults(competition) {
    return Boolean(
      Number(competition.resultsCount || competition.resultCount || 0) > 0 ||
      (Array.isArray(competition.results) && competition.results.length) ||
      (Array.isArray(competition.matches) && competition.matches.some((match) => match.result || match.status === "COMPLETED"))
    );
  }

  function getFilteredCompetitions() {
    const searchValue = String(els.searchInput?.value || "").trim().toLowerCase();
    const sportValue = String(els.sportFilter?.value || "").trim().toLowerCase();
    const campusValue = String(els.campusFilter?.value || "").trim().toLowerCase();
    const formatValue = String(els.formatFilter?.value || "").trim().toLowerCase();
    const qualityValue = String(els.qualityFilter?.value || "").trim().toLowerCase();

    return state.competitions.filter((competition) => {
      const title = String(competition.title || "").toLowerCase();
      const id = String(competition.id || "").toLowerCase();
      const sportSlug = String(competition.sportSlug || competition.sport || "").toLowerCase();
      const campusOwner = normalizeCampusFilter(competition.campusOwner || competition.campus || "");
      const formatSlug = String(competition.formatSlug || competition.format || "").toLowerCase();
      const seasonLabel = String(competition.seasonLabel || "").toLowerCase();

      const matchesSearch =
        !searchValue ||
        title.includes(searchValue) ||
        id.includes(searchValue) ||
        seasonLabel.includes(searchValue);

      const matchesSport = !sportValue || sportSlug === sportValue;
      const sessionCampus = normalizeCampusFilter(state.session?.campus);
      const matchesCampus = campusOwner === sessionCampus;
      const matchesFormat = !formatValue || formatSlug === normalizeFormatFilter(formatValue);
      const archived = APP.isArchivedRecord(competition);
      const matchesQuality = qualityValue === "archived" ? archived : qualityValue !== "incomplete" || getCompetitionQuality(competition) < 100;

      return (qualityValue === "archived" || !archived) && matchesSearch && matchesSport && matchesCampus && matchesFormat && matchesQuality;
    });
  }

  function hasActiveRegistryFilter() {
    return Boolean(
      String(els.searchInput?.value || "").trim() ||
      String(els.sportFilter?.value || "").trim() ||
      String(els.formatFilter?.value || "").trim() ||
      String(els.qualityFilter?.value || "").trim()
    );
  }

  function getSportName(slug) {
    const sport = APP.SPORT_REGISTRY.find((item) => item.slug === slug);
    return sport ? sport.name : (slug || "—");
  }

  function getCampusName(slug) {
    const normalized = normalizeCampusFilter(slug);
    const map = {
      mona: "Mona",
      staugustine: "St Augustine",
      cavehill: "Cave Hill",
      fiveislands: "Five Islands"
    };
    return map[normalized] || slug || "—";
  }

  // Normalize Campus Filter
  /**
   * Normalizes campus filter data across current API and legacy nested shapes.
   */
  function normalizeCampusFilter(value) {
    const raw = String(value || "").trim().toLowerCase();
    const map = {
      mona: "mona",
      "st augustine": "staugustine",
      "st-augustine": "staugustine",
      staugustine: "staugustine",
      cavehill: "cavehill",
      "cave hill": "cavehill",
      "cave-hill": "cavehill",
      fiveislands: "fiveislands",
      "five islands": "fiveislands",
      "five-islands": "fiveislands"
    };
    return map[raw] || raw;
  }

  // Normalize Format Filter
  /**
   * Normalizes format filter data across current API and legacy nested shapes.
   */
  function normalizeFormatFilter(value) {
    const raw = String(value || "").trim().toLowerCase();
    const map = {
      league: "league",
      "round robin": "round-robin",
      "round-robin": "round-robin",
      knockout: "knockout",
      "heats + final": "heats-final",
      "heats-final": "heats-final",
      "timed final": "timed-final",
      "timed-final": "timed-final",
      custom: "custom"
    };
    return map[raw] || raw;
  }

  function formatCompetitionFormat(value) {
    const raw = String(value || "").trim().toLowerCase();
    const labels = {
      league: "League",
      "round-robin": "Round Robin",
      knockout: "Knockout",
      "heats-final": "Heats + Final",
      "timed-final": "Timed Final",
      custom: "Custom"
    };
    return labels[raw] || value || "—";
  }

  function escapeHtml(value) {
    return UWISportsHub.escapeHtml(value);
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
    document.addEventListener("click", (event) => {
      const action = event.target.closest(".insight-action[data-target]");
      if (!action) return;
      const target = document.getElementById(action.getAttribute("data-target"));
      if (!target) return;
      if (action.getAttribute("data-filter") === "incomplete" && els.qualityFilter) {
        els.qualityFilter.value = "incomplete";
        state.registrySearchApplied = true;
        renderCompetitionsTable();
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
      .map((record) => ({ label: record.title || "Competition", type }));
  }

  function getRecordTime(record) {
    return Date.parse(record.updatedAt || record.createdAt || record.modifiedAt || record.startDate || "") || 0;
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
      q: els.searchInput?.value || "",
      sport: els.sportFilter?.value || "",
      format: els.formatFilter?.value || "",
      quality: els.qualityFilter?.value || ""
    };
    const label = [values.q, values.sport ? getSportName(values.sport) : "", values.format, values.quality].filter(Boolean).join(" / ") || "All competitions";
    APP.saveRecentSearch(scope, label, values);
  }

  // Shared UI Mounting
  /**
   * Mounts the recent searches feature after required context has loaded.
   */
  function mountRecentSearches(scope) {
    if (!APP.renderRecentSearches || !els.searchButton?.parentElement) return;
    document.querySelector(`[data-recent-searches='${scope}']`)?.remove();
    els.searchButton.parentElement.insertAdjacentHTML("afterend", APP.renderRecentSearches(scope));
    document.querySelectorAll("[data-recent-searches='competitions'] [data-recent-search-index]").forEach((button) => {
      button.addEventListener("click", function () {
        const item = APP.readRecentSearches(scope)[Number(this.dataset.recentSearchIndex)];
        if (!item) return;
        if (els.searchInput) els.searchInput.value = item.values.q || "";
        if (els.sportFilter) els.sportFilter.value = item.values.sport || "";
        if (els.formatFilter) els.formatFilter.value = item.values.format || "";
        if (els.qualityFilter) els.qualityFilter.value = item.values.quality || "";
        applyRegistrySearch();
      });
    });
  }

})();
