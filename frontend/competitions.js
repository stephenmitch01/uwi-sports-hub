(function () {
  "use strict";

  const APP = window.UWISportsHub;
    const state = {
    session: null,
    competitions: [],
    loadError: ""
  };

  const els = {
    competitionsTableBody: document.getElementById("competitionsTableBody"),
    competitionsEmpty: document.getElementById("competitionsEmpty"),
    searchInput: document.getElementById("competitionSearch"),
    sportFilter: document.getElementById("competitionSport"),
    campusFilter: document.getElementById("competitionCampus"),
    formatFilter: document.getElementById("competitionFormat")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    state.session = await APP.mountSignedInShell({ active: "competitions", contextLabel: "Competitions" });
    if (!state.session) {
      window.location.href = "index.html";
      return;
    }

    populateFilters();
    renderCompetitionsPageShell();
    bindCompetitionFilters();
    await loadCompetitions();
    renderCompetitionsTable();
  }

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

  function renderCompetitionsPageShell() {
    if (!els.competitionsEmpty) return;

    els.competitionsEmpty.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Create Competition</h2>
          <p>Add a competition, then open it to build units, participants, results, and stat lines.</p>
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
          <label for="createCompetitionCampusLabel">Campus Owner</label>
          <input id="createCompetitionCampusLabel" class="input" type="text" value="${escapeHtml(getCampusName(state.session?.campus || ""))}" readonly />
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

        <div style="display:flex;align-items:flex-end;">
          <button type="submit" class="btn btn-campus" style="width:100%;">Create Competition</button>
        </div>
      </form>

      <div id="competitionsPageMessage" class="message" style="margin-top:12px;"></div>
    `;

    bindCompetitionCreateForm();
  }

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
      }      try {
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

        const createdCompetition = data?.competition || data?.data?.competition || data?.data || null;

        messageEl.textContent = "Competition created successfully.";
        messageEl.classList.add("success");

        form.reset();

        await loadCompetitions();
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

  function bindCompetitionFilters() {
    [els.searchInput, els.sportFilter, els.campusFilter, els.formatFilter].forEach((node) => {
      if (!node) return;
      node.addEventListener("input", renderCompetitionsTable);
      node.addEventListener("change", renderCompetitionsTable);
    });
  }

  async function loadCompetitions() {    try {
      const data = await APP.apiGet("/competitions", true);
      state.competitions =
        Array.isArray(data?.competitions) ? data.competitions :
        Array.isArray(data?.data?.competitions) ? data.data.competitions :
        Array.isArray(data?.data) ? data.data :
        [];
      state.loadError = "";
    } catch (error) {
      console.error("Load competitions error:", error);
      state.competitions = [];
      state.loadError = error?.message || "Competitions could not be loaded right now.";
    }
  }

  function renderCompetitionsTable() {
    if (!els.competitionsTableBody) return;

    const competitions = getFilteredCompetitions();

    if (!competitions.length) {
      const title = state.loadError ? "Competition records are unavailable right now." : "Records will appear here once added.";
      const copy = state.loadError
        ? escapeHtml(state.loadError)
        : "Create a competition to begin building units, participants, results, and statistics.";

      els.competitionsTableBody.innerHTML = `
        <tr>
          <td colspan="6">
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
            <td>
              <a class="btn btn-soft" href="competition-view.html?competitionId=${encodeURIComponent(competition.id)}">Open</a>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function getFilteredCompetitions() {
    const searchValue = String(els.searchInput?.value || "").trim().toLowerCase();
    const sportValue = String(els.sportFilter?.value || "").trim().toLowerCase();
    const campusValue = String(els.campusFilter?.value || "").trim().toLowerCase();
    const formatValue = String(els.formatFilter?.value || "").trim().toLowerCase();

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

      return matchesSearch && matchesSport && matchesCampus && matchesFormat;
    });
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

})();