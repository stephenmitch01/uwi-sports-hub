(function () {
  "use strict";

  const API_BASE = window.__UWI_API_BASE || window.UWI_API_BASE || "";
  let currentSession = null;

  const CAMPUS_META = {
    mona: { name: "Mona", color: "#c62828", light: "rgba(198,40,40,0.12)", border: "rgba(198,40,40,0.24)" },
    staugustine: { name: "St Augustine", color: "#1565c0", light: "rgba(21,101,192,0.12)", border: "rgba(21,101,192,0.24)" },
    cavehill: { name: "Cave Hill", color: "#f9a825", light: "rgba(249,168,37,0.16)", border: "rgba(249,168,37,0.30)" },
    fiveislands: { name: "Five Islands", color: "#4fc3f7", light: "rgba(79,195,247,0.14)", border: "rgba(79,195,247,0.28)" }
  };

  const SPORT_REGISTRY = [
    { slug: "track-and-field", name: "Track and Field" },
    { slug: "football", name: "Football" },
    { slug: "cricket", name: "Cricket" },
    { slug: "basketball", name: "Basketball" },
    { slug: "netball", name: "Netball" },
    { slug: "hockey", name: "Hockey" },
    { slug: "volleyball", name: "Volleyball" },
    { slug: "badminton", name: "Badminton" },
    { slug: "table-tennis", name: "Table Tennis" },
    { slug: "lawn-tennis", name: "Lawn Tennis" },
    { slug: "swimming", name: "Swimming" },
    { slug: "chess", name: "Chess" },
    { slug: "taekwondo", name: "Taekwondo" },
    { slug: "beach-volleyball", name: "Beach Volleyball" }
  ];

  const TRACK_FIELD_EVENT_PATTERNS = {
    relay: [/(^|\b)(4x|relay|medley|shuttle)(\b|$)/i],
    horizontalJump: [/(^|\b)(long\s?jump|triple\s?jump)(\b|$)/i],
    verticalJump: [/(^|\b)(high\s?jump|pole\s?vault)(\b|$)/i],
    throw: [/(^|\b)(shot\s?put|discus|javelin|hammer)(\b|$)/i],
    track: [
      /(^|\b)(\d{2,4}m|mile|hurdles?|steeple|walk|dash|sprint|run)(\b|$)/i,
      /(^|\b)(100m|200m|300m|400m|600m|800m|1000m|1500m|3000m|5000m|10000m)(\b|$)/i
    ]
  };

  const STAT_SCHEMAS = {
    "track-and-field": {
      subjectTypes: ["athlete", "relay-team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        track: { primaryMetric: "time", better: "lower", fields: ["time", "wind", "lane", "reactionTime", "splits"] },
        "horizontal-jump": { primaryMetric: "best", better: "higher", fields: ["best", "attempts", "wind"] },
        "vertical-jump": { primaryMetric: "best", better: "higher", fields: ["best", "progression"] },
        throw: { primaryMetric: "best", better: "higher", fields: ["best", "attempts"] },
        relay: { primaryMetric: "time", better: "lower", fields: ["time", "splits"] }
      }
    },
    football: {
      subjectTypes: ["athlete", "team"],
      supportsPB: false,
      supportsSeasonBest: false,
      supportsPlacings: true,
      eventTypes: {
        match: {
          primaryMetric: null,
          better: null,
          fields: ["goals", "assists", "minutesPlayed", "shots", "shotsOnTarget", "passes", "tackles", "interceptions", "yellowCards", "redCards"]
        }
      }
    },
    cricket: {
      subjectTypes: ["athlete", "team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["runs", "ballsFaced", "fours", "sixes", "wickets", "oversBowled", "maidens", "runsConceded", "catches", "runOuts", "stumpings"] }
      }
    },
    basketball: {
      subjectTypes: ["athlete", "team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["points", "fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted", "rebounds", "assists", "steals", "blocks", "turnovers", "personalFouls"] }
      }
    },
    netball: {
      subjectTypes: ["athlete", "team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["goalsAttempted", "goalsScored", "goalAssists", "feeds", "centrePassReceives", "turnovers", "gains", "deflections", "intercepts", "rebounds", "penalties"] }
      }
    },
    hockey: {
      subjectTypes: ["athlete", "team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["goals", "assists", "shots", "shotsOnTarget", "tackles", "interceptions", "recoveries", "blocks", "clearances", "cards", "saves", "goalsConceded"] }
      }
    },
    volleyball: {
      subjectTypes: ["athlete", "team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["kills", "attackAttempts", "attackErrors", "serviceAces", "serveAttempts", "serveErrors", "soloBlocks", "blockAssists", "assists", "digs", "receptionAttempts", "receptionErrors"] }
      }
    },
    badminton: {
      subjectTypes: ["athlete", "pair"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["setsWon", "setsLost", "gamesWon", "gamesLost", "pointsWon", "stage", "result"] }
      }
    },
    "table-tennis": {
      subjectTypes: ["athlete", "pair"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["gamesWon", "gamesLost", "pointsWon", "pointsLost", "stage", "result"] }
      }
    },
    "lawn-tennis": {
      subjectTypes: ["athlete", "pair"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["setsWon", "setsLost", "gamesWon", "gamesLost", "tieBreaksWon", "stage", "result"] }
      }
    },
    swimming: {
      subjectTypes: ["athlete", "relay-team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        track: { primaryMetric: "time", better: "lower", fields: ["time", "splits", "lane", "reactionTime"] },
        relay: { primaryMetric: "time", better: "lower", fields: ["time", "splits", "leg"] }
      }
    },
    chess: {
      subjectTypes: ["athlete", "team"],
      supportsPB: false,
      supportsSeasonBest: false,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["result", "round", "opponent", "points", "color", "opening"] }
      }
    },
    taekwondo: {
      subjectTypes: ["athlete", "team"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["pointsScored", "pointsConceded", "weightClass", "method", "warnings", "penalties", "stage", "result"] }
      }
    },
    "beach-volleyball": {
      subjectTypes: ["athlete", "pair"],
      supportsPB: true,
      supportsSeasonBest: true,
      supportsPlacings: true,
      eventTypes: {
        match: { primaryMetric: null, better: null, fields: ["setsWon", "setsLost", "kills", "blocks", "aces", "digs", "errors", "stage", "result"] }
      }
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  function showMessage(node, text, type) {
    if (!node) return;
    node.textContent = text || "";
    node.className = "message";
    if (text) node.classList.add(type || "success", "is-visible");
  }

  function showSuccess(node, text) {
    showMessage(node, text, "success");
  }

  function showError(node, text) {
    showMessage(node, text, "error");
  }

  function showWarning(node, text) {
    showMessage(node, text, "warning");
  }

  function clearMessage(node) {
    if (!node) return;
    node.textContent = "";
    node.className = "message";
  }

  function cryptoRandomId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `id_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeCampus(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "").replace(/-/g, "");
    if (raw in CAMPUS_META) return raw;
    if (raw in { "staugustine": 1, "staug": 1, "staugustinecampus": 1 }) return "staugustine";
    if (raw in { "cavehill": 1, "cave": 1 }) return "cavehill";
    if (raw in { "fiveislands": 1, "fiveisland": 1 }) return "fiveislands";
    if (raw in { "mona": 1 }) return "mona";
    return "";
  }

  function getCampusMeta(value) {
    const slug = normalizeCampus(value) || "cavehill";
    return CAMPUS_META[slug] || CAMPUS_META.cavehill;
  }

  function normalizeRole(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function canManageRecords(session) {
    const role = normalizeRole(session?.role);
    if (!role) return false;
    return !["viewer", "read_only", "readonly", "guest"].includes(role);
  }

  function isPublicMutationPath(pathOrUrl) {
    const value = String(pathOrUrl || "").toLowerCase();
    return (
      value.includes("/auth/login") ||
      value.includes("/auth/logout") ||
      value.includes("/auth/create-account") ||
      value.includes("/support")
    );
  }

  function applyCampusTheme(value) {
    const slug = normalizeCampus(value) || "cavehill";
    document.body.classList.remove("mona", "staugustine", "cavehill", "fiveislands");
    document.body.classList.add(slug);
    return slug;
  }

  function canonicalSportSlug(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    const collapsed = raw.replace(/[_\s]+/g, "-");
    const aliases = {
      track: "track-and-field",
      "track-field": "track-and-field",
      "trackandfield": "track-and-field",
      soccer: "football",
      "table tennis": "table-tennis",
      tabletennis: "table-tennis",
      "lawn tennis": "lawn-tennis",
      lawntennis: "lawn-tennis",
      "beach volleyball": "beach-volleyball",
      beachvolleyball: "beach-volleyball"
    };
    return aliases[collapsed] || aliases[raw.replace(/[-\s]/g, "")] || collapsed;
  }

  function normalizeSportSlug(value) {
    return canonicalSportSlug(value);
  }

  function getSportName(value) {
    const slug = canonicalSportSlug(value);
    const match = SPORT_REGISTRY.find((sport) => sport.slug === slug || sport.name.toLowerCase() === String(value || "").trim().toLowerCase());
    return match ? match.name : (value ? String(value) : "Unassigned");
  }

  function setEmptyState(containerId, title, text) {
    const node = document.getElementById(containerId);
    if (!node) return;
    node.innerHTML = `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
  }

  function initNavToggle(root) {
    const scope = root || document;
    const navToggle = scope.querySelector("#navToggle");
    const navLinks = scope.querySelector("#signedNavLinks, #navLinks, .signed-nav-links, .nav-links");
    if (!navToggle || !navLinks || navToggle.dataset.bound === "true") return;
    navToggle.dataset.bound = "true";
    navToggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
  }

  async function apiFetch(pathOrUrl, options) {
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const tolerateFailure = Boolean(opts.tolerateFailure || opts.softFail);
    const redirectOn401 = opts.redirectOn401 !== false;

    if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && !isPublicMutationPath(pathOrUrl) && !canManageRecords(currentSession)) {
      const error = new Error("Your current role does not permit this action.");
      error.status = 403;
      if (tolerateFailure) return null;
      throw error;
    }

    if (!API_BASE && !/^https?:\/\//i.test(pathOrUrl)) {
      if (tolerateFailure) return null;
      throw new Error("API base URL is not configured. Set window.UWI_API_BASE before loading uwi-app.js.");
    }

    const url = /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${API_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    const headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    let body = opts.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      body = JSON.stringify(body);
    }

    const response = await fetch(url, {
      method,
      credentials: "include",
      headers,
      body
    });

    if (response.status === 401 && (tolerateFailure || !redirectOn401)) {
      return null;
    }

    if (response.status === 401 && redirectOn401) {
      window.location.href = "index.html";
      return null;
    }

    const data = await safeJson(response);

    if (!response.ok) {
      if (tolerateFailure) return null;
      const error = new Error(data?.message || data?.error || `Request failed with status ${response.status}.`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  const apiGet = (pathOrUrl, tolerateFailure) => apiFetch(pathOrUrl, { method: "GET", tolerateFailure });
  const apiPost = (pathOrUrl, body, options) => apiFetch(pathOrUrl, Object.assign({}, options, { method: "POST", body }));
  const apiPatch = (pathOrUrl, body, options) => apiFetch(pathOrUrl, Object.assign({}, options, { method: "PATCH", body }));
  const apiDelete = (pathOrUrl, body, options) => apiFetch(pathOrUrl, Object.assign({}, options, { method: "DELETE", body }));

  async function getSession() {
    const data = await apiGet("/auth/session", true);
    if (!data) return null;
    const user = data.user || data.session || data;
    if (!user) return null;
    currentSession = {
      id: String(user.id || ""),
      email: user.email || "",
      campus: normalizeCampus(user.campus || user.campusSlug || "cavehill") || "cavehill",
      role: user.role || "viewer",
      fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || ""
    };
    return currentSession;
  }

  async function clearSession() {
    await apiPost("/auth/logout", {}, { tolerateFailure: true, redirectOn401: false });
    currentSession = null;
  }

  async function requireSession() {
    const session = await getSession();
    if (!session) {
      window.location.href = "index.html";
      return null;
    }
    return session;
  }

  function buildSignedInShellHtml(session, options) {
    const campusMeta = getCampusMeta(session.campus);
    const active = String(options?.active || "").toLowerCase();
    const navItems = [
      ["dashboard", "Dashboard", "dashboard.html"],
      ["athletes", "Athletes", "athletes.html"],
      ["coaches", "Coaches", "coaches.html"],
      ["teams", "Teams", "teams.html"],
      ["competitions", "Competitions", "competitions.html"],
      ["reports", "Reports", "reports.html"],
      ["audit", "Audit Logs", "audit-logs.html"],
      ["support", "Support", "support.html"]
    ];
    return {
      topBar: `
        <div class="top-left">
          <span>UWI Sports Hub</span>
          <span class="top-divider">•</span>
          <span>${escapeHtml(options?.contextLabel || "Signed In")}</span>
        </div>
        <div class="top-right">
          <span data-session-email>${escapeHtml(session.email || "Signed in")}</span>
          <a href="support.html">Support</a>
        </div>
      `,
      nav: `
        <div class="signed-navbar-inner">
          <div class="brand-wrap">
            <a class="brand" href="dashboard.html">
              <img alt="UWI Sports Hub logo" class="brand-logo-img" onerror="this.style.display='none';" src="images/uwi-sports-hub-logo.png" />
              <div class="brand-text">
                <strong>UWI Sports Hub</strong>
                <span>University Sports Records Platform</span>
              </div>
            </a>
            <div class="signed-campus-pill">${escapeHtml(campusMeta.name)}</div>
          </div>
          <button aria-label="Toggle navigation" class="nav-toggle" id="navToggle" type="button">
            <span></span><span></span><span></span>
          </button>
          <nav class="signed-nav-links" id="signedNavLinks">
            ${navItems.map(([key, label, href]) => `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
            <button class="sign-out-link" id="signOutButton" type="button">Sign Out</button>
          </nav>
        </div>
      `
    };
  }

  function syncSignedInShell(topBar, shellNav, session, options) {
    const campusMeta = getCampusMeta(session.campus);
    const active = String(options?.active || "").toLowerCase();
    const expectedHrefByKey = {
      dashboard: "dashboard.html",
      athletes: "athletes.html",
      coaches: "coaches.html",
      teams: "teams.html",
      competitions: "competitions.html",
      reports: "reports.html",
      audit: "audit-logs.html",
      support: "support.html"
    };

    if (topBar) {
      const hasStructuredTopBar = topBar.querySelector(".top-left") && topBar.querySelector(".top-right");
      if (!hasStructuredTopBar) {
        console.warn("Top bar structure missing. HTML shell must include .top-left and .top-right.");
      }

      const contextNode = topBar.querySelector("[data-shell-context]") || topBar.querySelector(".top-left span:last-child");
      if (contextNode) {
        contextNode.textContent = options?.contextLabel || "Signed In";
      }
    }

    if (shellNav) {
      const hasStructuredNav = shellNav.querySelector(".signed-navbar-inner") && shellNav.querySelector(".signed-nav-links");
      if (!hasStructuredNav) {
        console.warn("Navbar structure missing. HTML shell must include .signed-navbar-inner and .signed-nav-links.");
      }

      const campusPill = shellNav.querySelector(".signed-campus-pill");
      if (campusPill) {
        campusPill.textContent = campusMeta.name;
      }

      const signedLinks = shellNav.querySelector(".signed-nav-links");
      if (signedLinks && !signedLinks.querySelector('a[href="audit-logs.html"]')) {
        const auditLink = document.createElement("a");
        auditLink.href = "audit-logs.html";
        auditLink.textContent = "Audit Logs";
        const supportLink = signedLinks.querySelector('a[href="support.html"]');
        signedLinks.insertBefore(auditLink, supportLink || signedLinks.querySelector(".sign-out-link"));
      }

      const navLinks = Array.from(shellNav.querySelectorAll(".signed-nav-links a[href]"));
      navLinks.forEach((link) => {
        const href = String(link.getAttribute("href") || "").trim().toLowerCase();
        const key = Object.keys(expectedHrefByKey).find((candidate) => expectedHrefByKey[candidate] === href);
        link.classList.toggle("active", Boolean(key) && key === active);
      });
    }

    document.querySelectorAll("[data-session-email]").forEach((node) => {
      node.textContent = session.email || "Signed in";
    });

    initNavToggle(document);

    const signOutButton = document.getElementById("signOutButton");
    if (signOutButton && signOutButton.dataset.bound !== "true") {
      signOutButton.dataset.bound = "true";
      signOutButton.addEventListener("click", async function () {
        await clearSession();
        window.location.href = "index.html";
      });
    }
  }

  async function mountSignedInShell(options) {
    const session = await requireSession();
    if (!session) return null;

    applyCampusTheme(session.campus);

    const topBar = document.getElementById("topBar");
    const shellNav = document.getElementById("shellNav");
    syncSignedInShell(topBar, shellNav, session, options || {});

    return session;
  }

  function parseNumeric(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = String(value).trim();
    if (!normalized || normalized.toUpperCase() === "X") return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeAttempts(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (item === null || item === undefined || item === "") return null;
      if (typeof item === "string" && item.trim().toUpperCase() === "X") return "X";
      const parsed = parseNumeric(item);
      return parsed === null ? String(item) : parsed;
    });
  }

  function normalizeProgression(value) {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => ({
      height: parseNumeric(entry?.height),
      attempts: Array.isArray(entry?.attempts) ? entry.attempts.map((item) => String(item ?? "").trim()) : []
    }));
  }

  function normalizeSplits(value) {
    if (!value) return {};
    if (Array.isArray(value)) {
      return value.reduce((acc, split, index) => {
        acc[`split${index + 1}`] = parseNumeric(split);
        return acc;
      }, {});
    }
    if (typeof value === "object") {
      return Object.keys(value).reduce((acc, key) => {
        acc[key] = parseNumeric(value[key]);
        return acc;
      }, {});
    }
    return {};
  }

  function normalizeTrackFieldStatData(eventType, input) {
    const data = input && typeof input === "object" ? input : {};
    if (eventType === "track" || eventType === "relay") {
      return {
        time: parseNumeric(data.time ?? data.performance ?? data.result),
        wind: parseNumeric(data.wind),
        lane: parseNumeric(data.lane),
        reactionTime: parseNumeric(data.reactionTime),
        splits: normalizeSplits(data.splits || {
          "50m": data.split50m,
          "100m": data.split100m,
          "200m": data.split200m,
          "300m": data.split300m,
          "400m": data.split400m
        })
      };
    }
    if (eventType === "horizontal-jump") {
      return {
        best: parseNumeric(data.best ?? data.distance ?? data.performance),
        wind: parseNumeric(data.wind),
        attempts: normalizeAttempts(data.attempts || data.attemptSeries)
      };
    }
    if (eventType === "vertical-jump") {
      return {
        best: parseNumeric(data.best ?? data.height ?? data.performance),
        progression: normalizeProgression(data.progression || data.heightProgression)
      };
    }
    if (eventType === "throw") {
      return {
        best: parseNumeric(data.best ?? data.distance ?? data.performance),
        attempts: normalizeAttempts(data.attempts || data.attemptSeries)
      };
    }
    return data;
  }

  function normalizeEventType(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["horizontal jump", "horizontal-jump", "jump-horizontal"].includes(raw)) return "horizontal-jump";
    if (["vertical jump", "vertical-jump", "jump-vertical"].includes(raw)) return "vertical-jump";
    if (["throw", "throws", "field-throw"].includes(raw)) return "throw";
    if (["relay", "relay-team"].includes(raw)) return "relay";
    if (["track", "run", "timed", "race"].includes(raw)) return "track";
    if (["match"].includes(raw)) return "match";
    return raw;
  }

  function getSportSchema(sportSlug) {
    return STAT_SCHEMAS[normalizeSportSlug(sportSlug)] || null;
  }

  function getTrackFieldEventType(eventName) {
    const label = String(eventName || "").trim();
    if (!label) return "track";
    if (TRACK_FIELD_EVENT_PATTERNS.relay.some((pattern) => pattern.test(label))) return "relay";
    if (TRACK_FIELD_EVENT_PATTERNS.horizontalJump.some((pattern) => pattern.test(label))) return "horizontal-jump";
    if (TRACK_FIELD_EVENT_PATTERNS.verticalJump.some((pattern) => pattern.test(label))) return "vertical-jump";
    if (TRACK_FIELD_EVENT_PATTERNS.throw.some((pattern) => pattern.test(label))) return "throw";
    return "track";
  }

  function getEventTypeForSport(sportSlug, eventName, explicitEventType) {
    const normalizedSport = normalizeSportSlug(sportSlug);
    if (normalizedSport === "track-and-field") return normalizeEventType(explicitEventType) || getTrackFieldEventType(eventName);
    return normalizeEventType(explicitEventType) || "match";
  }

  function normalizeStatLine(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const sport = normalizeSportSlug(item.sport || item.sportSlug || options?.sport || "");
    const eventName = item.eventName || item.event || item.discipline || "";
    const eventType = getEventTypeForSport(sport, eventName, item.eventType || item.disciplineType);
    const statDataInput = item.statData || item.metrics || item.result || item;
    return {
      id: String(item.id || item.statId || cryptoRandomId()),
      sport,
      eventName,
      eventType,
      subjectType: item.subjectType || (item.teamId ? "team" : "athlete"),
      subjectId: String(item.subjectId || item.athleteId || item.teamId || item.relayTeamId || ""),
      competitionId: String(item.competitionId || item.linkedCompetitionId || ""),
      competitionName: item.competitionName || item.competition || "",
      category: item.category || item.division || "",
      season: String(item.season || item.seasonLabel || item.year || options?.season || "").trim() || "Unknown",
      date: item.date || item.achievedDate || item.resultDate || "",
      placement: parseNumeric(item.placement || item.place || item.position),
      verified: Boolean(item.verified),
      statData: sport === "track-and-field" ? normalizeTrackFieldStatData(eventType, statDataInput) : statDataInput,
      raw: item
    };
  }

  function getEventSchema(sportSlug, eventType, eventName) {
    const sportSchema = getSportSchema(sportSlug);
    if (!sportSchema) return null;
    const normalizedType = getEventTypeForSport(sportSlug, eventName, eventType);
    return sportSchema.eventTypes?.[normalizedType] || null;
  }

  function getPrimaryMetricValue(statLine) {
    const normalized = normalizeStatLine(statLine, { sport: statLine?.sport || statLine?.sportSlug });
    const schema = getEventSchema(normalized.sport, normalized.eventType, normalized.eventName);
    if (!schema || !schema.primaryMetric) return null;
    return parseNumeric(normalized.statData?.[schema.primaryMetric]);
  }

  function compareStatLines(a, b) {
    const lineA = normalizeStatLine(a, { sport: a?.sport || a?.sportSlug });
    const lineB = normalizeStatLine(b, { sport: b?.sport || b?.sportSlug });
    const schema = getEventSchema(lineA.sport, lineA.eventType, lineA.eventName);
    if (!schema || !schema.better) return 0;
    const valueA = getPrimaryMetricValue(lineA);
    const valueB = getPrimaryMetricValue(lineB);
    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    if (schema.better === "lower") return valueA - valueB;
    if (schema.better === "higher") return valueB - valueA;
    return 0;
  }

  function filterStatsBySeason(statLines, season) {
    if (!Array.isArray(statLines)) return [];
    const seasonLabel = String(season || "all").trim().toLowerCase();
    if (!seasonLabel || seasonLabel === "all") return statLines.slice();
    return statLines.filter((line) => String(line?.season || "").trim().toLowerCase() === seasonLabel);
  }

  function getAvailableSeasons(statLines) {
    if (!Array.isArray(statLines)) return ["all"];
    const values = Array.from(
      new Set(
        statLines
          .map((line) => String(line?.season || "").trim())
          .filter(Boolean)
      )
    );
    values.sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true }));
    return ["all"].concat(values);
  }

  function getPersonalBest(statLines, options) {
    const list = Array.isArray(statLines) ? statLines.map((line) => normalizeStatLine(line, options)) : [];
    if (!list.length) return null;
    return list.reduce((best, current) => (!best || compareStatLines(current, best) < 0 ? current : best), null);
  }

  function getSeasonBest(statLines, season, options) {
    return getPersonalBest(filterStatsBySeason(statLines, season), options);
  }

  function groupTrackFieldStatsByEvent(statLines) {
    const list = Array.isArray(statLines) ? statLines.map((line) => normalizeStatLine(line)) : [];
    return list.reduce((acc, line) => {
      const key = `${line.eventName || "Unknown Event"}__${line.eventType || "track"}`;
      if (!acc[key]) {
        acc[key] = {
          eventName: line.eventName || "Unknown Event",
          eventType: line.eventType || "track",
          sport: line.sport,
          stats: []
        };
      }
      acc[key].stats.push(line);
      return acc;
    }, {});
  }

  function computeTrackAndFieldSummary(statLines) {
    const groups = groupTrackFieldStatsByEvent(statLines);
    return Object.keys(groups)
      .map((key) => {
        const group = groups[key];
        const best = getPersonalBest(group.stats, { sport: "track-and-field" });
        return {
          eventName: group.eventName,
          eventType: group.eventType,
          attemptsCount: group.stats.length,
          personalBest: best,
          seasons: getAvailableSeasons(group.stats).filter((value) => value !== "all")
        };
      })
      .sort((a, b) => a.eventName.localeCompare(b.eventName));
  }

  function computeTrackDerivedMetrics(statLines) {
    const normalized = Array.isArray(statLines)
      ? statLines.map((line) => normalizeStatLine(line, { sport: "track-and-field" }))
      : [];
    const timed = normalized.filter((line) => ["track", "relay"].includes(line.eventType));
    const field = normalized.filter((line) => ["horizontal-jump", "vertical-jump", "throw"].includes(line.eventType));
    const timedValues = timed.map((line) => getPrimaryMetricValue(line)).filter((value) => value !== null);
    const fieldValues = field.map((line) => getPrimaryMetricValue(line)).filter((value) => value !== null);
    return {
      appearances: normalized.length,
      timedAppearances: timed.length,
      fieldAppearances: field.length,
      averageTime: timedValues.length ? timedValues.reduce((sum, value) => sum + value, 0) / timedValues.length : null,
      averageMark: fieldValues.length ? fieldValues.reduce((sum, value) => sum + value, 0) / fieldValues.length : null,
      eventBreakdown: computeTrackAndFieldSummary(normalized)
    };
  }

  function getBestDisplayValue(statLine) {
    const line = normalizeStatLine(statLine, { sport: statLine?.sport || statLine?.sportSlug });
    const value = getPrimaryMetricValue(line);
    return value === null ? "—" : String(value);
  }

  function normalizeComparableName(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function levenshteinDistance(a, b) {
    const left = normalizeComparableName(a);
    const right = normalizeComparableName(b);
    if (!left) return right.length;
    if (!right) return left.length;
    const row = Array.from({ length: right.length + 1 }, (_value, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const current = row[j];
        row[j] = left[i - 1] === right[j - 1] ? previous : Math.min(previous + 1, row[j] + 1, row[j - 1] + 1);
        previous = current;
      }
    }
    return row[right.length];
  }

  function nameSimilarity(a, b) {
    const left = normalizeComparableName(a);
    const right = normalizeComparableName(b);
    if (!left && !right) return 1;
    if (!left || !right) return 0;
    return 1 - levenshteinDistance(left, right) / Math.max(left.length, right.length, 1);
  }

  function recordDisplayName(record) {
    return record?.fullName || record?.name || record?.title || [record?.firstName, record?.lastName].filter(Boolean).join(" ") || "Unnamed record";
  }

  function isArchivedRecord(record) {
    const data = record?.data && typeof record.data === "object" ? record.data : {};
    return String(record?.status || data.status || "").trim().toLowerCase() === "archived" || data.archived === true || Boolean(data.archivedAt);
  }

  function findSimilarRecord(records, candidate, options = {}) {
    const threshold = options.threshold ?? 0.82;
    const candidateName = recordDisplayName(candidate);
    const candidateSport = normalizeSportSlug(candidate?.sportSlug || candidate?.sport || candidate?.primarySport || candidate?.profile?.sportSlug);
    const candidateDate = candidate?.startDate || candidate?.date || "";
    let best = null;
    (Array.isArray(records) ? records : []).forEach((record) => {
      if (isArchivedRecord(record)) return;
      const score = nameSimilarity(candidateName, recordDisplayName(record));
      if (score < threshold) return;
      const recordSport = normalizeSportSlug(record?.sportSlug || record?.sport || record?.primarySport || record?.profile?.sportSlug);
      if (candidateSport && recordSport && candidateSport !== recordSport) return;
      if (options.type === "competition" && candidateDate) {
        const recordDate = record?.startDate || record?.date || "";
        if (recordDate && Math.abs(new Date(candidateDate) - new Date(recordDate)) > 1000 * 60 * 60 * 24 * 7) return;
      }
      if (!best || score > best.score) best = { record, score };
    });
    return best?.record || null;
  }

  function promptDuplicateAction(record, type = "record") {
    const competition = type === "competition";
    const title = recordDisplayName(record);
    const message = competition
      ? `A similar competition already exists:\n\n${title}\n\nChoose an option:\n1. View\n2. Create Anyway\n3. Edit Existing\n4. Cancel`
      : `A similar ${type} record already exists:\n\n${title}\n\nChoose an option:\n1. Use Existing\n2. Create Anyway\n3. Edit Existing\n4. Cancel`;
    const choice = window.prompt(message, "1");
    if (choice === null) return "cancel";
    if (choice.trim() === "2") return "create-anyway";
    if (choice.trim() === "3") return "edit-existing";
    if (choice.trim() === "4") return "cancel";
    return competition ? "view" : "use-existing";
  }

  function confirmReportImpact(hasLinkedData) {
    return !hasLinkedData || window.confirm("This will update standings and reports connected to this record. Continue?");
  }

  function confirmArchive(recordType, record) {
    const linked = Array.isArray(record?.linkedDataSummary) && record.linkedDataSummary.length
      ? `\n\nLinked data will be preserved:\n${record.linkedDataSummary.map((item) => `- ${item.count} ${item.label}`).join("\n")}`
      : "";
    return window.confirm(`Archive this ${recordType}?\n\n${recordDisplayName(record)}${linked}\n\nArchived records are hidden unless you search archived records.`);
  }

  function trackUnsavedChanges(form) {
    if (!form) return { markClean() {}, markDirty() {}, isDirty: () => false };
    let dirty = false;
    let submitting = false;
    const markDirty = () => { dirty = true; };
    const markClean = () => { dirty = false; };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", () => {
      submitting = true;
      dirty = false;
      window.setTimeout(() => { submitting = false; }, 1200);
    });
    window.addEventListener("beforeunload", (event) => {
      if (!dirty || submitting) return;
      event.preventDefault();
      event.returnValue = "";
    });
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || !dirty || submitting) return;
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#") || link.target === "_blank") return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault();
    });
    return { markClean, markDirty, isDirty: () => dirty };
  }

  function saveRecentSearch(scope, label, values) {
    const key = `uwi_recent_searches_${String(scope || "general")}`;
    const entry = {
      label: String(label || "Recent search").trim(),
      values: values || {},
      at: new Date().toISOString()
    };
    if (!entry.label) return;
    const existing = readRecentSearches(scope).filter((item) => item.label !== entry.label);
    localStorage.setItem(key, JSON.stringify([entry].concat(existing).slice(0, 5)));
  }

  function readRecentSearches(scope) {
    try {
      const key = `uwi_recent_searches_${String(scope || "general")}`;
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function renderRecentSearches(scope, onApply) {
    const items = readRecentSearches(scope);
    if (!items.length) return "";
    return `
      <div class="recent-searches" data-recent-searches="${escapeHtml(scope)}">
        <span>Recent searches</span>
        ${items.map((item, index) => `<button type="button" class="recent-search-chip" data-recent-search-index="${index}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    `;
  }

  async function quickAddAthleteForTeam(options = {}) {
    const teamId = options.teamId || "";
    const sportSlug = normalizeSportSlug(options.sportSlug || options.sport || "");
    const teamName = options.teamName || "this team";
    if (!teamId) {
      window.alert("Select the UWI team first, then quick-add the athlete.");
      return null;
    }
    const firstName = String(window.prompt("Quick Add New Athlete\n\nFirst name:", "") || "").trim();
    if (!firstName) return null;
    const lastName = String(window.prompt("Quick Add New Athlete\n\nLast name:", "") || "").trim();
    if (!lastName) return null;
    const sportName = getSportName(sportSlug) || sportSlug || "the team sport";
    if (!window.confirm(`${firstName} ${lastName} will be added to ${teamName}, assigned to ${sportName}, and available in this scorecard. You must complete their full profile later.`)) return null;
    return apiPost("/athletes", {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      primarySport: sportSlug,
      sportSlug,
      teamId,
      profile: { sportSlug, profileStatus: "incomplete" },
      activeRosterAssignment: { teamId, status: "ACTIVE" }
    });
  }

  function confirmScorecardValues(form, sportSlug) {
    if (!form) return true;
    const values = Array.from(form.querySelectorAll("input[type='number']")).map((input) => {
      const max = input.getAttribute("max");
      return {
        input,
        label: input.getAttribute("aria-label") || input.id || input.name || "value",
        value: input.value === "" ? null : Number(input.value),
        max: max === null || max === "" ? null : Number(max)
      };
    }).filter((item) => item.value !== null && Number.isFinite(item.value));
    const impossible = values.filter((item) => item.value < 0 || (Number.isFinite(item.max) && item.value > item.max));
    if (impossible.length) {
      window.alert(`Please fix these values before saving:\n${impossible.map((item) => `${item.label}: ${item.value}`).join("\n")}`);
      return false;
    }
    const thresholds = { cricket: 400, football: 50, basketball: 100, volleyball: 80, hockey: 60, swimming: 30, "track-and-field": 100, netball: 120, badminton: 40, "table-tennis": 30, "lawn-tennis": 80, taekwondo: 10 };
    const limit = thresholds[normalizeSportSlug(sportSlug)] || 100;
    const unusual = values.filter((item) => item.value > limit);
    if (!unusual.length) return true;
    return window.confirm(`This value seems unusually high:\n${unusual.slice(0, 8).map((item) => `${item.label}: ${item.value}`).join("\n")}\n\nSave anyway?`);
  }

  window.UWISportsHub = {
    API_BASE,
    CAMPUS_META,
    SPORT_REGISTRY,
    STAT_SCHEMAS,
    TRACK_FIELD_EVENT_PATTERNS,
    apiFetch,
    apiGet,
    apiPost,
    apiPatch,
    apiDelete,
    getSession,
    clearSession,
    requireSession,
    applyCampusTheme,
    mountSignedInShell,
    setEmptyState,
    getCampusMeta,
    normalizeCampus,
    normalizeRole,
    canManageRecords,
    normalizeSportSlug,
    normalizeEventType,
    getSportSchema,
    getTrackFieldEventType,
    getEventTypeForSport,
    normalizeStatLine,
    getEventSchema,
    getPrimaryMetricValue,
    compareStatLines,
    filterStatsBySeason,
    getAvailableSeasons,
    getPersonalBest,
    getSeasonBest,
    groupTrackFieldStatsByEvent,
    computeTrackAndFieldSummary,
    computeTrackDerivedMetrics,
    getBestDisplayValue,
    normalizeComparableName,
    nameSimilarity,
    recordDisplayName,
    findSimilarRecord,
    promptDuplicateAction,
    isArchivedRecord,
    confirmReportImpact,
    confirmArchive,
    trackUnsavedChanges,
    saveRecentSearch,
    readRecentSearches,
    renderRecentSearches,
    quickAddAthleteForTeam,
    confirmScorecardValues,
    getSportName,
    showMessage,
    showSuccess,
    showError,
    showWarning,
    clearMessage,
    safeJson,
    initNavToggle,
    syncSignedInShell,
    escapeHtml,
    cryptoRandomId
  };
})();
