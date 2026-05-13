(function () {
  "use strict";

  const APP = window.UWISportsHub;

  document.addEventListener("DOMContentLoaded", async function () {
    await mountSignedInUtilityView("About");
    if (APP?.initNavToggle) {
      APP.initNavToggle(document);
    }
  });

  async function mountSignedInUtilityView(activeLabel) {
    const session = await APP.apiGet("/auth/session", true);
    const user = session?.user || session?.session || session;
    if (!user?.email) return;
    ensureSignedStyles();
    const campusClass = APP.normalizeCampus?.(user.campus) || "";
    if (campusClass) document.body.classList.add(campusClass);
    const topBar = document.getElementById("topBar");
    const header = document.querySelector("header.navbar, header.signed-navbar");
    if (topBar) {
      topBar.innerHTML = `
        <div class="top-left"><span>UWI Sports Hub</span><span class="top-divider">•</span><span>About</span></div>
        <div class="top-right utility-links">
          <span data-session-email>${escapeHtml(user.email)}</span>
          <a class="${activeLabel === "About" ? "active" : ""}" href="about.html">About</a>
          <a class="${activeLabel === "Legal" ? "active" : ""}" href="legal.html">Legal</a>
        </div>
      `;
    }
    if (header) {
      header.id = "shellNav";
      header.className = "signed-navbar";
      const campusName = APP.getCampusMeta?.(user.campus)?.name || "Campus";
      header.innerHTML = `
        <div class="signed-navbar-inner">
          <div class="brand-wrap">
            <a class="brand" href="dashboard.html"><img alt="UWI Sports Hub logo" class="brand-logo-img" onerror="this.style.display='none';" src="images/uwi-sports-hub-logo.png"/><div class="brand-text"><strong>UWI Sports Hub</strong><span>University Sports Records Platform</span></div></a>
            <div class="signed-campus-pill">${escapeHtml(campusName)}</div>
          </div>
          <button aria-label="Toggle navigation" class="nav-toggle" id="navToggle" type="button"><span></span><span></span><span></span></button>
          <nav class="signed-nav-links" id="signedNavLinks">
            <a href="dashboard.html">Dashboard</a><a href="athletes.html">Athletes</a><a href="coaches.html">Coaches</a><a href="teams.html">Teams</a><a href="competitions.html">Competitions</a><a href="reports.html">Reports</a><a href="support.html">Support</a><button class="sign-out-link" id="signOutButton" type="button">Sign Out</button>
          </nav>
        </div>
      `;
      document.getElementById("signOutButton")?.addEventListener("click", async function () {
        await APP.apiPost("/auth/logout", {}, { tolerateFailure: true, redirectOn401: false });
        window.location.href = "index.html";
      });
    }
  }

  function escapeHtml(value) {
    return APP.escapeHtml ? APP.escapeHtml(value) : String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function ensureSignedStyles() {
    if (document.querySelector('link[href="uwi-signed-base.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "uwi-signed-base.css";
    document.head.appendChild(link);
  }
})();
