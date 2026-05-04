(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const dashboardMessage = document.getElementById("dashboardMessage");
  const roleEyebrow = document.getElementById("roleEyebrow");
  const welcomeHeading = document.getElementById("welcomeHeading");
  const welcomeText = document.getElementById("welcomeText");
  const rolePill = document.getElementById("rolePill");
  const campusPill = document.getElementById("campusPill");
  const sessionStatusStat = document.getElementById("sessionStatusStat");
  const campusStat = document.getElementById("campusStat");
  const roleStat = document.getElementById("roleStat");
  const userNameValue = document.getElementById("userNameValue");
  const userEmailValue = document.getElementById("userEmailValue");
  const userRoleValue = document.getElementById("userRoleValue");
  const userCampusValue = document.getElementById("userCampusValue");

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    clearMessage();
    try {
      const session = await APP.mountSignedInShell({
        active: "dashboard",
        contextLabel: "Campus Dashboard"
      });
      if (!session) return;
      renderUser(session);
    } catch (error) {
      console.error("Dashboard load error:", error);
      showError("Failed to load dashboard session.");
    }
  }

  function renderUser(user) {
    const campusLabel = UWISportsHub.getCampusMeta(user.campus).name;
    const roleLabel = formatRole(user.role);

    roleEyebrow.textContent = roleLabel;
    welcomeHeading.textContent = `Welcome, ${user.fullName || "User"}`;
    welcomeText.textContent = `You are signed in to the ${campusLabel} campus workspace. All platform data and actions should be scoped to this campus and your assigned role.`;
    rolePill.textContent = roleLabel;
    campusPill.textContent = campusLabel;
    sessionStatusStat.textContent = "Authenticated";
    campusStat.textContent = campusLabel;
    roleStat.textContent = roleLabel;
    userNameValue.textContent = user.fullName || "Not available";
    userEmailValue.textContent = user.email || "Not available";
    userRoleValue.textContent = roleLabel;
    userCampusValue.textContent = campusLabel;
  }

  function formatRole(role) {
    return String(role || "viewer").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function showError(message) {
    dashboardMessage.className = "message error";
    dashboardMessage.textContent = message;
  }

  function clearMessage() {
    dashboardMessage.className = "message";
    dashboardMessage.textContent = "";
  }
})();
