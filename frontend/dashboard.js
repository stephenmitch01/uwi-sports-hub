(function () {
  "use strict";

  const APP = window.UWISportsHub;
  const dashboardMessage = document.getElementById("dashboardMessage");
  const roleEyebrow = document.getElementById("roleEyebrow");
  const welcomeHeading = document.getElementById("welcomeHeading");
  const welcomeText = document.getElementById("welcomeText");
  const rolePill = document.getElementById("rolePill");
  const roleStat = document.getElementById("roleStat");
  const accountSummaryText = document.getElementById("accountSummaryText");
  const athleteCountStat = document.getElementById("athleteCountStat");
  const athleteCoverageStat = document.getElementById("athleteCoverageStat");
  const coachCountStat = document.getElementById("coachCountStat");
  const coachCoverageStat = document.getElementById("coachCoverageStat");
  const teamCountStat = document.getElementById("teamCountStat");
  const teamCoverageStat = document.getElementById("teamCoverageStat");
  const competitionCountStat = document.getElementById("competitionCountStat");
  const competitionCoverageStat = document.getElementById("competitionCoverageStat");
  const sportsCoveredValue = document.getElementById("sportsCoveredValue");
  const recordActivityValue = document.getElementById("recordActivityValue");
  const permissionValue = document.getElementById("permissionValue");
  const overviewAthletesData = document.getElementById("overviewAthletesData");
  const overviewCoachesData = document.getElementById("overviewCoachesData");
  const overviewTeamsData = document.getElementById("overviewTeamsData");
  const overviewCompetitionsData = document.getElementById("overviewCompetitionsData");
  const overviewReportsData = document.getElementById("overviewReportsData");
  const overviewSupportData = document.getElementById("overviewSupportData");

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
      await renderCampusSummary(session);
    } catch (error) {
      console.error("Dashboard load error:", error);
      showError("Dashboard information could not be loaded.");
    }
  }

  function renderUser(user) {
    const campusLabel = UWISportsHub.getCampusMeta(user.campus).name;
    const roleLabel = formatRole(user.role);

    roleEyebrow.textContent = roleLabel;
    welcomeHeading.textContent = `Welcome, ${user.fullName || "User"}`;
    welcomeText.textContent = `Signed in as ${user.email || "your campus account"}. Your campus summary is loading below.`;
    rolePill.textContent = roleLabel;
    if (roleStat) roleStat.textContent = roleLabel;
    if (accountSummaryText) {
      accountSummaryText.textContent = `${campusLabel} records available to ${user.fullName || user.email || "this account"}.`;
    }
    if (permissionValue) permissionValue.textContent = describePermissions(user.role);
  }

  async function renderCampusSummary(user) {
    const [athletesResult, coachesResult, teamsResult, competitionsResult] = await Promise.allSettled([
      APP.apiGet("/athletes", true),
      APP.apiGet("/coaches", true),
      APP.apiGet("/teams", true),
      APP.apiGet("/competitions", true)
    ]);

    const athletes = normalizeArray(athletesResult);
    const coaches = normalizeArray(coachesResult);
    const teams = normalizeArray(teamsResult);
    const competitions = normalizeArray(competitionsResult);

    const assignedAthletes = athletes.filter((athlete) => getAthleteTeamId(athlete)).length;
    const assignedCoaches = coaches.filter((coach) => getAssignments(coach).length).length;
    const activeTeams = teams.filter((team) => isActiveStatus(team.status)).length;
    const scheduledCompetitions = competitions.filter((competition) => isActiveStatus(competition.status) || isScheduledStatus(competition.status)).length;
    const sportsCovered = getSportsCovered([athletes, coaches, teams, competitions]);
    const mostRecent = getMostRecentActivity([athletes, coaches, teams, competitions]);

    setText(athleteCountStat, athletes.length);
    setText(athleteCoverageStat, `${assignedAthletes}/${athletes.length} assigned to teams`);
    setText(coachCountStat, coaches.length);
    setText(coachCoverageStat, `${assignedCoaches}/${coaches.length} assigned to teams`);
    setText(teamCountStat, teams.length);
    setText(teamCoverageStat, `${activeTeams} active`);
    setText(competitionCountStat, competitions.length);
    setText(competitionCoverageStat, `${scheduledCompetitions} active or scheduled`);
    setText(sportsCoveredValue, sportsCovered.length);
    setText(recordActivityValue, mostRecent || "No record activity yet");
    setText(welcomeText, `${athletes.length} athlete records, ${coaches.length} coach/staff records, ${teams.length} teams, and ${competitions.length} competitions are connected to this account.`);
    setText(overviewAthletesData, `${athletes.length} total, ${assignedAthletes} assigned to teams`);
    setText(overviewCoachesData, `${coaches.length} total, ${assignedCoaches} assigned to teams`);
    setText(overviewTeamsData, `${teams.length} total, ${activeTeams} active`);
    setText(overviewCompetitionsData, `${competitions.length} total, ${scheduledCompetitions} active or scheduled`);
    setText(overviewReportsData, `${sportsCovered.length} sports represented`);
    setText(overviewSupportData, mostRecent || "No record activity yet");

    if (accountSummaryText) {
      const campusLabel = UWISportsHub.getCampusMeta(user.campus).name;
      accountSummaryText.textContent = `${campusLabel} currently has ${athletes.length} athlete records, ${coaches.length} coach/staff records, ${teams.length} teams, and ${competitions.length} competitions.`;
    }
  }

  function normalizeArray(result) {
    const source = result?.status === "fulfilled" ? result.value : null;
    if (Array.isArray(source)) return source;
    if (Array.isArray(source?.data)) return source.data;
    if (Array.isArray(source?.athletes)) return source.athletes;
    if (Array.isArray(source?.coaches)) return source.coaches;
    if (Array.isArray(source?.teams)) return source.teams;
    if (Array.isArray(source?.competitions)) return source.competitions;
    return [];
  }

  function getAthleteTeamId(athlete) {
    return String(
      athlete?.teamId ||
      athlete?.team?.id ||
      athlete?.activeRosterAssignment?.teamId ||
      athlete?.activeRosterAssignment?.team?.id ||
      ""
    ).trim();
  }

  function getAssignments(coach) {
    if (Array.isArray(coach?.assignments)) return coach.assignments;
    if (Array.isArray(coach?.staffAssignments)) return coach.staffAssignments;
    if (Array.isArray(coach?.teamAssignments)) return coach.teamAssignments;
    return [];
  }

  function getSportsCovered(groups) {
    const sports = new Set();
    groups.flat().forEach((record) => {
      const sport = record?.sportSlug || record?.primarySportSlug || record?.sport || record?.primarySport || record?.profile?.sportSlug;
      const label = sport ? APP.getSportName?.(sport) || sport : "";
      if (label) sports.add(label);
    });
    return Array.from(sports).sort((a, b) => a.localeCompare(b));
  }

  function getMostRecentActivity(groups) {
    const timestamps = groups
      .flat()
      .map((record) => record?.updatedAt || record?.createdAt || "")
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    return timestamps.length ? `Last updated ${timestamps[0].toLocaleDateString()}` : "";
  }

  function isActiveStatus(status) {
    const value = String(status || "active").toLowerCase();
    return !["inactive", "archived", "cancelled", "canceled"].includes(value);
  }

  function isScheduledStatus(status) {
    return ["scheduled", "upcoming", "open"].includes(String(status || "").toLowerCase());
  }

  function describePermissions(role) {
    const normalized = String(role || "viewer").toLowerCase();
    if (["admin", "manager", "staff"].includes(normalized)) return "Manage campus records";
    return "View campus records";
  }

  function setText(node, value) {
    if (node) node.textContent = String(value);
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
