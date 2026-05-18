import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { supabaseAuth, supabaseAdmin } from "./supabase.js";
import {
  clearSessionCookies,
  cookieOptions,
  currentCampus,
  findOrCreateProfile,
  requireAuth,
  requireManager,
  setSessionCookies
} from "./middleware/auth.js";
import { cleanObject, flattenMany, flattenRecord, normalizeCampus, normalizeRole, sendError, toDate } from "./utils.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../../frontend");
const GENERAL_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 300 };
const AUTH_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };
const MAX_BODY_DEPTH = 12;
const MAX_BODY_KEYS = 1500;
const MAX_STRING_LENGTH = 12000;
const MAX_ARRAY_LENGTH = 600;

/**
 * Express API for the operational USH application.
 *
 * Routes are campus-scoped by default, use Supabase-backed sessions, and store
 * flexible sport metadata in `data` JSON while keeping common relational fields
 * available for reporting. Avoid moving sport-specific interpretation into this
 * file unless it affects persistence, permissions, or cross-page propagation.
 */
app.use(helmet());
app.use(createRateLimiter(GENERAL_RATE_LIMIT));
app.use(express.json({ limit: "2mb" }));
app.use(handleMalformedJson);
app.use(sanitizeRequestInput);
const parseCookies = cookieParser();
app.use((req, res, next) => {
  try {
    parseCookies(req, res, next);
  } catch (error) {
    if (config.nodeEnv !== "production") {
      console.warn("Ignoring malformed cookie header:", error.message);
    }
    req.cookies = Object.create(null);
    req.signedCookies = Object.create(null);
    next();
  }
});
app.use(
  cors({
    origin(origin, callback) {
      const localBackendOrigins = [`http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`];
      if (!origin || config.frontendOrigins.includes(origin) || localBackendOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true
  })
);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * Lightweight in-memory limiter used to protect public and auth endpoints.
 *
 * It is process-local by design for this deployment shape; if the API is scaled
 * horizontally, replace this with a shared store so limits remain consistent.
 */
function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.path}`;
    const bucket = hits.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    hits.set(key, bucket);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      return sendError(res, 429, "Too many requests. Please wait before trying again.");
    }
    next();
  };
}

const authRateLimit = createRateLimiter(AUTH_RATE_LIMIT);

function handleMalformedJson(error, _req, res, next) {
  if (error?.type === "entity.parse.failed") return sendError(res, 400, "Malformed JSON payload");
  if (error?.type === "entity.too.large") return sendError(res, 413, "Request payload is too large");
  next(error);
}

/**
 * Sanitizes request bodies before route logic sees them.
 *
 * Scorecard payloads are intentionally nested and sport-specific, so the
 * sanitizer limits depth/size and strips control characters without rejecting
 * valid scorecard structures such as innings, attempts, and player rows.
 */
function sanitizeRequestInput(req, res, next) {
  try {
    if (req.body && typeof req.body === "object") {
      const budget = { keys: 0 };
      req.body = sanitizeValue(req.body, 0, budget);
    }
    req.query = sanitizeValue(req.query || {}, 0, { keys: 0 });
    req.params = sanitizeValue(req.params || {}, 0, { keys: 0 });
    next();
  } catch (error) {
    return sendError(res, 400, error.message || "Invalid request payload");
  }
}

function sanitizeValue(value, depth, budget) {
  if (depth > MAX_BODY_DEPTH) throw new Error("Request payload is too deeply nested");
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) throw new Error("Request text field is too long");
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Request contains an invalid number");
    return value;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) throw new Error("Request array is too large");
    return value.map((item) => sanitizeValue(item, depth + 1, budget));
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) continue;
      if (key.length > 80) throw new Error("Request field name is too long");
      budget.keys += 1;
      if (budget.keys > MAX_BODY_KEYS) throw new Error("Request payload has too many fields");
      output[key] = sanitizeValue(item, depth + 1, budget);
    }
    return output;
  }
  throw new Error("Request contains an unsupported value");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()) && String(value || "").length <= 254;
}

function getRecordBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function getRecordCampus(req, body) {
  return normalizeCampus(body.campus || body.campusSlug || body.campusOwner || currentCampus(req));
}

/**
 * Applies the campus boundary used throughout the API.
 *
 * Any list/detail mutation that should respect the signed-in campus should
 * compose its Prisma `where` clause through this helper instead of accepting a
 * campus from the client.
 */
function scopedWhere(req, extra = {}) {
  return { campus: currentCampus(req), ...extra };
}

/**
 * Best-effort audit logging for operational changes.
 *
 * Audit writes must never block a user save. If logging fails, the API records
 * the server error and still returns the primary mutation result so scorecards
 * and roster updates do not get lost.
 */
async function writeAuditLog(req, details = {}) {
  try {
    const campus = normalizeCampus(details.campus || req?.auth?.profile?.campus || currentCampus(req));
    await prisma.auditLog.create({
      data: {
        campus,
        actorId: req?.auth?.profile?.id || req?.auth?.user?.id || details.actorId || null,
        actorEmail: req?.auth?.profile?.email || req?.auth?.user?.email || details.actorEmail || null,
        action: String(details.action || "activity"),
        entityType: details.entityType || null,
        entityId: details.entityId ? String(details.entityId) : null,
        summary: details.summary || null,
        data: cleanObject(details.data || {})
      }
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}

function entityResponse(record) {
  return flattenRecord(record);
}

function isArchivedRecord(record) {
  const row = flattenRecord(record);
  const data = row?.data && typeof row.data === "object" ? row.data : {};
  return (
    String(row?.status || data.status || "").trim().toLowerCase() === "archived" ||
    data.archived === true ||
    Boolean(data.archivedAt)
  );
}

function shouldIncludeArchived(req) {
  const value = String(req.query.includeArchived || req.query.archived || req.query.status || "").trim().toLowerCase();
  return ["1", "true", "all", "archived"].includes(value);
}

function visibleRows(req, rows) {
  const flattened = flattenMany(rows);
  if (shouldIncludeArchived(req)) return flattened;
  return flattened.filter((row) => !isArchivedRecord(row));
}

/**
 * Optimistic concurrency guard for edit workflows.
 *
 * Pages pass their last known `updatedAt` when available. A mismatch prevents
 * silent overwrites when two staff members edit the same athlete, team,
 * competition, or scorecard-related record.
 */
function assertVersionFresh(res, existing, body) {
  const expected = body.updatedAt || body.lastKnownUpdatedAt || body.versionUpdatedAt;
  if (!expected) return true;
  const actual = existing.updatedAt instanceof Date ? existing.updatedAt.toISOString() : String(existing.updatedAt || "");
  if (String(expected) === actual) return true;
  sendError(res, 409, "This record was updated elsewhere. Refresh the page before saving so you do not overwrite another update.");
  return false;
}

async function listEntity(req, res, model, extraWhere = {}) {
  const records = await prisma[model].findMany({
    where: scopedWhere(req, extraWhere),
    orderBy: { updatedAt: "desc" }
  });
  res.json(visibleRows(req, records));
}

function recordMatchesTeam(record, teamId) {
  const row = flattenRecord(record);
  const data = row?.data && typeof row.data === "object" ? row.data : {};
  const statData = data.statData && typeof data.statData === "object" ? data.statData : data;
  const candidates = [
    row?.teamId,
    data.teamId,
    data.uwiTeamId,
    statData.teamId,
    statData.uwiTeamId,
    statData.team?.id
  ].filter(Boolean).map(String);
  return candidates.includes(String(teamId));
}

async function listCompetitionsForTeam(req, res) {
  const campus = currentCampus(req);
  const teamId = String(req.query.teamId || "");
  const [competitions, results, statLines, participants] = await Promise.all([
    prisma.competition.findMany({ where: { campus }, orderBy: { updatedAt: "desc" } }),
    prisma.competitionResult.findMany({ where: { campus }, orderBy: { updatedAt: "desc" } }),
    prisma.competitionStatLine.findMany({ where: { campus }, orderBy: { updatedAt: "desc" } }),
    prisma.competitionParticipant.findMany({ where: { campus }, orderBy: { updatedAt: "desc" } })
  ]);
  const linkedCompetitionIds = new Set();
  [...results, ...statLines, ...participants].forEach((record) => {
    const row = flattenRecord(record);
    if (recordMatchesTeam(row, teamId) && row.competitionId) {
      linkedCompetitionIds.add(String(row.competitionId));
    }
  });
  const rows = visibleRows(req, competitions).filter((competition) => {
    if (linkedCompetitionIds.has(String(competition.id))) return true;
    return recordMatchesTeam(competition, teamId);
  });
  res.json(rows);
}

async function listAthletesWithRoster(req, res) {
  const campus = currentCampus(req);
  const [athletes, assignments, teams] = await Promise.all([
    prisma.athlete.findMany({
      where: { campus },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.teamRosterAssignment.findMany({
      where: { campus },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.team.findMany({
      where: { campus }
    })
  ]);

  const teamById = new Map(visibleRows(req, teams).map((team) => [String(team.id), team]));
  const assignmentsByAthleteId = new Map();
  dedupeAssignments(visibleRows(req, assignments), (assignment) => `${assignment.teamId}:${assignment.athleteId}`).forEach((assignment) => {
    const athleteId = String(assignment.athleteId || assignment.athlete?.id || "");
    if (!athleteId) return;
    const team = teamById.get(String(assignment.teamId || ""));
    const enrichedAssignment = cleanObject({
      ...assignment,
      team,
      teamName: team?.name || team?.teamName || assignment.teamName || "",
      sportSlug: team?.sportSlug || team?.sport || assignment.sportSlug || assignment.sport || ""
    });
    if (!assignmentsByAthleteId.has(athleteId)) assignmentsByAthleteId.set(athleteId, []);
    assignmentsByAthleteId.get(athleteId).push(enrichedAssignment);
  });

  const rows = visibleRows(req, athletes).map((athlete) => {
    const athleteAssignments = assignmentsByAthleteId.get(String(athlete.id)) || [];
    if (!athleteAssignments.length) return athlete;
    const assignment = athleteAssignments[0];
    const sports = Array.from(new Set([
      athlete.sportSlug,
      athlete.primarySportSlug,
      athlete.sport,
      ...(Array.isArray(athlete.sports) ? athlete.sports : []),
      ...athleteAssignments.map((item) => item.sportSlug || item.sport || item.team?.sportSlug || item.team?.sport)
    ].filter(Boolean)));
    return cleanObject({
      ...athlete,
      rosterAssignments: athleteAssignments,
      teamAssignments: athleteAssignments,
      teams: athleteAssignments.map((item) => item.team).filter(Boolean),
      sports,
      activeRosterAssignment: assignment,
      teamId: athlete.teamId || assignment.teamId,
      teamName: athlete.teamName || assignment.teamName,
      sportSlug: athlete.sportSlug || athlete.primarySportSlug || athlete.sport || sports[0] || assignment.team?.sportSlug || assignment.team?.sport
    });
  });

  res.json(rows);
}

async function listCoachesWithAssignments(req, res) {
  const campus = currentCampus(req);
  const [coaches, assignments, teams] = await Promise.all([
    prisma.coach.findMany({
      where: { campus },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.teamStaffAssignment.findMany({
      where: { campus },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.team.findMany({
      where: { campus }
    })
  ]);

  const teamById = new Map(visibleRows(req, teams).map((team) => [String(team.id), team]));
  const assignmentsByCoachId = new Map();

  dedupeAssignments(visibleRows(req, assignments), (assignment) => `${assignment.teamId}:${assignment.coachId}:${assignment.role || assignment.roleLabel || ""}`).forEach((assignment) => {
    const coachId = String(assignment.coachId || "");
    if (!coachId) return;
    const team = teamById.get(String(assignment.teamId || ""));
    const enrichedAssignment = cleanObject({
      ...assignment,
      team,
      teamName: team?.name || team?.teamName || assignment.teamName || ""
    });
    if (!assignmentsByCoachId.has(coachId)) assignmentsByCoachId.set(coachId, []);
    assignmentsByCoachId.get(coachId).push(enrichedAssignment);
  });

  const rows = visibleRows(req, coaches).map((coach) => {
    const coachAssignments = assignmentsByCoachId.get(String(coach.id)) || [];
    return cleanObject({
      ...coach,
      assignments: coachAssignments,
      staffAssignments: coachAssignments,
      teamAssignments: coachAssignments,
      teamId: coach.teamId || coachAssignments[0]?.teamId,
      teamName: coach.teamName || coachAssignments[0]?.teamName
    });
  });

  res.json(rows);
}

async function listAthleteTeamAssignments(req, res) {
  const campus = currentCampus(req);
  const [assignments, teams] = await Promise.all([
    prisma.teamRosterAssignment.findMany({
      where: scopedWhere(req, { athleteId: req.params.id }),
      orderBy: { updatedAt: "desc" }
    }),
    prisma.team.findMany({ where: { campus } })
  ]);
  const teamById = new Map(visibleRows(req, teams).map((team) => [String(team.id), team]));
  const rows = dedupeAssignments(visibleRows(req, assignments), (assignment) => `${assignment.teamId}:${assignment.athleteId}`).map((assignment) => {
    const team = teamById.get(String(assignment.teamId || ""));
    return cleanObject({
      ...assignment,
      team,
      teamName: team?.name || team?.teamName || assignment.teamName || "",
      sportSlug: team?.sportSlug || team?.sport || assignment.sportSlug || assignment.sport || ""
    });
  });
  res.json(rows);
}

async function getEntity(req, res, model) {
  const record = await prisma[model].findFirst({ where: scopedWhere(req, { id: req.params.id }) });
  if (!record) return sendError(res, 404, "Record not found");
  res.json(entityResponse(record));
}

async function syncAthleteRosterAssignment(req, athleteId, body) {
  const campus = getRecordCampus(req, body);
  const teamId = body.teamId || body.activeRosterAssignment?.teamId || null;
  if (!teamId) return;
  const existing = await prisma.teamRosterAssignment.findFirst({
    where: { campus, athleteId: String(athleteId), teamId: String(teamId) },
    orderBy: { updatedAt: "desc" }
  });

  const assignmentData = {
    ...(existing?.data || {}),
    ...(body.activeRosterAssignment || {}),
    teamId: String(teamId),
    athleteId: String(athleteId),
    roleLabel: body.roleLabel || body.activeRosterAssignment?.roleLabel || null,
    jerseyNumber: body.jerseyNumber || body.activeRosterAssignment?.jerseyNumber || null,
    isCaptain: Boolean(body.isCaptain || body.activeRosterAssignment?.isCaptain),
    status: body.activeRosterAssignment?.status || "ACTIVE"
  };

  if (existing) {
    await prisma.teamRosterAssignment.update({
      where: { id: existing.id },
      data: {
        teamId: String(teamId),
        athleteId: String(athleteId),
        campus,
        data: assignmentData
      }
    });
    return;
  }

  await prisma.teamRosterAssignment.create({
    data: {
      teamId: String(teamId),
      athleteId: String(athleteId),
      campus,
      data: assignmentData
    }
  });
}

async function syncCoachStaffAssignment(req, coachId, body) {
  const campus = getRecordCampus(req, body);
  const teamId = body.teamId || body.activeStaffAssignment?.teamId || body.assignment?.teamId || null;
  if (!teamId) return;

  const existing = await prisma.teamStaffAssignment.findFirst({
    where: { campus, coachId: String(coachId) },
    orderBy: { updatedAt: "desc" }
  });
  const assignmentData = {
    ...(existing?.data || {}),
    ...(body.activeStaffAssignment || {}),
    teamId: String(teamId),
    coachId: String(coachId),
    role: body.assignmentRole || body.activeStaffAssignment?.role || body.role || body.primaryRole || null,
    isPrimary: body.isPrimary ?? body.activeStaffAssignment?.isPrimary ?? true,
    status: body.activeStaffAssignment?.status || "active"
  };

  if (existing) {
    await prisma.teamStaffAssignment.update({
      where: { id: existing.id },
      data: {
        teamId: String(teamId),
        coachId: String(coachId),
        campus,
        data: assignmentData
      }
    });
    return;
  }

  await prisma.teamStaffAssignment.create({
    data: {
      teamId: String(teamId),
      coachId: String(coachId),
      campus,
      data: assignmentData
    }
  });
}

function dedupeAssignments(rows, keyFn) {
  const seen = new Set();
  return flattenMany(rows).filter((assignment) => {
    const key = keyFn(assignment);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cricketScorecardIncludesAthlete(record, athleteId) {
  const data = record?.data && typeof record.data === "object" ? record.data : {};
  const statData = data.statData && typeof data.statData === "object" ? data.statData : data;
  if (record?.athleteId === athleteId || data.athleteId === athleteId || statData.athleteId === athleteId) return true;
  return JSON.stringify(statData).includes(`"athleteId":"${athleteId}"`);
}

function scorecardIncludesAthlete(record, athleteId) {
  const data = record?.data && typeof record.data === "object" ? record.data : {};
  const statData = data.statData && typeof data.statData === "object" ? data.statData : data;
  if (record?.athleteId === athleteId || data.athleteId === athleteId || statData.athleteId === athleteId) return true;
  return JSON.stringify(statData).includes(`"athleteId":"${athleteId}"`) ||
    JSON.stringify(statData).includes(`"scorerAthleteId":"${athleteId}"`) ||
    JSON.stringify(statData).includes(`"assistAthleteId":"${athleteId}"`);
}

function athleteCricketRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!cricketScorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.innings || []).forEach((innings) => {
    (innings.batting || []).forEach((batting) => {
      if (String(batting.athleteId || "") !== String(athleteId)) return;
      output.push({
        ...row,
        id: `${row.id}-bat-${innings.innings}`,
        sport: "cricket",
        sportSlug: "cricket",
        eventType: "batting",
        statName: "Batting",
        eventName: row.eventName || statData.title || "Cricket scorecard",
        competitionName: row.competitionName || statData.title || "Cricket competition",
        statValue: batting.runs ?? "",
        performance: batting.runs == null ? "" : `${batting.runs} runs`,
        category: `Innings ${innings.innings}`,
        statData: { ...batting, innings: innings.innings, team: innings.team, result: statData.result }
      });
    });
    (innings.batting || []).forEach((batting, index) => {
      const dismissalMode = batting.dismissalMode || "";
      const isCaughtAndBowled = /caught-and-bowled|c\s*&\s*b|c&b/i.test(String(dismissalMode || batting.dismissalLabel || ""));
      const creditedFielderId = batting.fielderAthleteId || (isCaughtAndBowled ? batting.bowlerAthleteId : "");
      if (String(creditedFielderId || "") !== String(athleteId)) return;
      const fieldingType = /caught/i.test(dismissalMode) || isCaughtAndBowled ? "catch" : dismissalMode;
      output.push({
        ...row,
        id: `${row.id}-field-${innings.innings}-${index}`,
        sport: "cricket",
        sportSlug: "cricket",
        eventType: "fielding",
        statName: fieldingType === "catch" ? "Catch" : "Fielding Dismissal",
        eventName: row.eventName || statData.title || "Cricket scorecard",
        competitionName: row.competitionName || statData.title || "Cricket competition",
        statValue: fieldingType === "catch" ? 1 : "",
        performance: fieldingType === "catch" ? "1 catch" : batting.dismissalLabel || dismissalMode,
        category: `Innings ${innings.innings}`,
        statData: {
          innings: innings.innings,
          team: innings.team,
          result: statData.result,
          fieldingType,
          dismissalMode,
          dismissalLabel: batting.dismissalLabel || "",
          batterName: batting.name || "",
          fielderAthleteId: creditedFielderId,
          fielderName: batting.fielderName || (isCaughtAndBowled ? batting.bowlerName : ""),
          catches: fieldingType === "catch" ? 1 : 0
        }
      });
    });
    (innings.batting || []).forEach((batting, index) => {
      if (String(batting.bowlerAthleteId || "") !== String(athleteId)) return;
      output.push({
        ...row,
        id: `${row.id}-dismissal-bowler-${innings.innings}-${index}`,
        sport: "cricket",
        sportSlug: "cricket",
        eventType: "dismissal-bowling",
        statName: "Bowler Dismissal Credit",
        eventName: row.eventName || statData.title || "Cricket scorecard",
        competitionName: row.competitionName || statData.title || "Cricket competition",
        statValue: 1,
        performance: batting.dismissalLabel || batting.dismissalMode || "Dismissal",
        category: `Innings ${innings.innings}`,
        statData: {
          innings: innings.innings,
          team: innings.team,
          result: statData.result,
          dismissalMode: batting.dismissalMode || "",
          dismissalLabel: batting.dismissalLabel || "",
          batterName: batting.name || "",
          fielderName: batting.fielderName || "",
          wicketCredits: 1
        }
      });
    });
    (innings.bowling || []).forEach((bowling) => {
      if (String(bowling.athleteId || "") !== String(athleteId)) return;
      output.push({
        ...row,
        id: `${row.id}-bowl-${innings.innings}`,
        sport: "cricket",
        sportSlug: "cricket",
        eventType: "bowling",
        statName: "Bowling",
        eventName: row.eventName || statData.title || "Cricket scorecard",
        competitionName: row.competitionName || statData.title || "Cricket competition",
        statValue: bowling.wickets ?? "",
        performance: bowling.wickets == null ? "" : `${bowling.wickets} wickets`,
        category: `Innings ${innings.innings}`,
        statData: { ...bowling, innings: innings.innings, team: innings.team, result: statData.result }
      });
    });
  });
  return output;
}

function athleteFootballRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.playerStats || []).forEach((player, index) => {
    if (String(player.athleteId || "") !== String(athleteId)) return;
    const bits = [];
    if (player.goals != null) bits.push(`${player.goals} G`);
    if (player.assists != null) bits.push(`${player.assists} A`);
    if (player.shots != null) bits.push(`${player.shots} shots`);
    if (player.shotsOnTarget != null) bits.push(`${player.shotsOnTarget} on target`);
    if (player.saves != null) bits.push(`${player.saves} saves`);
    output.push({
      ...row,
      id: `${row.id}-football-player-${index}`,
      sourceId: row.id,
      sport: "football",
      sportSlug: "football",
      eventType: "match",
      statName: "Football Match Sheet",
      eventName: row.eventName || statData.title || "Football score sheet",
      competitionName: row.competitionName || statData.title || "Football competition",
      statValue: player.goals ?? "",
      performance: bits.join(", ") || "Match appearance",
      category: statData.result || "Match",
      statData: { ...player, offsides: player.offsides ?? player.offside, result: statData.result, score: statData.score, matchStats: statData.matchStats }
    });
  });

  (statData.goals || []).forEach((goal, index) => {
    if (String(goal.scorerAthleteId || "") === String(athleteId)) {
      output.push({
        ...row,
        id: `${row.id}-football-goal-${index}`,
        sourceId: row.id,
        sport: "football",
        sportSlug: "football",
        eventType: "goal",
        statName: "Goal",
        eventName: row.eventName || statData.title || "Football score sheet",
        competitionName: row.competitionName || statData.title || "Football competition",
        statValue: 1,
        performance: `${goal.minute ?? ""}' goal`.trim(),
        category: statData.result || "Match",
        statData: { ...goal, result: statData.result, score: statData.score }
      });
    }
    if (String(goal.assistAthleteId || "") === String(athleteId)) {
      output.push({
        ...row,
        id: `${row.id}-football-assist-${index}`,
        sourceId: row.id,
        sport: "football",
        sportSlug: "football",
        eventType: "assist",
        statName: "Assist",
        eventName: row.eventName || statData.title || "Football score sheet",
        competitionName: row.competitionName || statData.title || "Football competition",
        statValue: 1,
        performance: `${goal.minute ?? ""}' assist`.trim(),
        category: statData.result || "Match",
        statData: { ...goal, result: statData.result, score: statData.score }
      });
    }
  });
  return output;
}

function athleteVolleyballRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.playerStats || []).forEach((player, index) => {
    if (String(player.athleteId || "") !== String(athleteId)) return;
    const bits = [];
    if (player.kills != null) bits.push(`${player.kills} K`);
    if (player.aces != null) bits.push(`${player.aces} SA`);
    if (player.blocks != null) bits.push(`${player.blocks} BLK`);
    if (player.assists != null) bits.push(`${player.assists} A`);
    if (player.digs != null) bits.push(`${player.digs} D`);
    output.push({
      ...row,
      id: `${row.id}-volleyball-player-${index}`,
      sport: "volleyball",
      sportSlug: "volleyball",
      eventType: "match",
      statName: "Volleyball Scoresheet",
      eventName: row.eventName || statData.title || "Volleyball scoresheet",
      competitionName: row.competitionName || statData.title || "Volleyball competition",
      statValue: player.kills ?? "",
      performance: bits.join(", ") || "Match appearance",
      category: statData.result || "Match",
      statData: { ...player, result: statData.result, sets: statData.sets, finalSets: statData.finalSets }
    });
  });
  return output;
}

function athleteHockeyRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];
  const output = [];

  (statData.scoring || []).forEach((goal, index) => {
    if (String(goal.scorerAthleteId || "") === String(athleteId)) {
      output.push({
        ...row,
        id: `${row.id}-hockey-goal-${index}`,
        sport: "hockey",
        sportSlug: "hockey",
        eventType: "goal",
        statName: "Goal",
        eventName: row.eventName || statData.title || "Hockey score sheet",
        competitionName: row.competitionName || statData.title || "Hockey competition",
        statValue: goal.goal ?? 1,
        performance: `Period ${goal.period || ""} goal`.trim(),
        category: statData.result || "Match",
        statData: { ...goal, result: statData.result, score: statData.score }
      });
    }
    if (String(goal.assist1AthleteId || "") === String(athleteId) || String(goal.assist2AthleteId || "") === String(athleteId)) {
      output.push({
        ...row,
        id: `${row.id}-hockey-assist-${index}-${goal.assist1AthleteId === athleteId ? "1" : "2"}`,
        sport: "hockey",
        sportSlug: "hockey",
        eventType: "assist",
        statName: "Assist",
        eventName: row.eventName || statData.title || "Hockey score sheet",
        competitionName: row.competitionName || statData.title || "Hockey competition",
        statValue: 1,
        performance: `Period ${goal.period || ""} assist`.trim(),
        category: statData.result || "Match",
        statData: { ...goal, result: statData.result, score: statData.score }
      });
    }
  });

  (statData.penalties || []).forEach((penalty, index) => {
    if (String(penalty.athleteId || "") !== String(athleteId)) return;
    output.push({
      ...row,
      id: `${row.id}-hockey-penalty-${index}`,
      sport: "hockey",
      sportSlug: "hockey",
      eventType: "penalty",
      statName: "Penalty",
      eventName: row.eventName || statData.title || "Hockey score sheet",
      competitionName: row.competitionName || statData.title || "Hockey competition",
      statValue: penalty.minutes ?? "",
      performance: penalty.minutes == null ? (penalty.infraction || "Penalty") : `${penalty.minutes} penalty minutes`,
      category: statData.result || "Match",
      statData: { ...penalty, result: statData.result, score: statData.score }
    });
  });
  return output;
}

function athleteBasketballRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.playerStats || []).forEach((player, index) => {
    if (String(player.athleteId || "") !== String(athleteId)) return;
    const bits = [];
    if (player.points != null) bits.push(`${player.points} PTS`);
    if (player.rebounds != null) bits.push(`${player.rebounds} REB`);
    if (player.assists != null) bits.push(`${player.assists} AST`);
    if (player.steals != null) bits.push(`${player.steals} STL`);
    if (player.blocks != null) bits.push(`${player.blocks} BLK`);
    output.push({
      ...row,
      id: `${row.id}-basketball-player-${index}`,
      sport: "basketball",
      sportSlug: "basketball",
      eventType: "match",
      statName: "Basketball Score Sheet",
      eventName: row.eventName || statData.title || "Basketball score sheet",
      competitionName: row.competitionName || statData.title || "Basketball competition",
      statValue: player.points ?? "",
      performance: bits.join(", ") || "Match appearance",
      category: statData.result || "Match",
      statData: { ...player, result: statData.result, score: statData.score, teamTotals: statData.teamTotals }
    });
  });
  return output;
}

function athleteSwimmingRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.lanes || []).forEach((lane, index) => {
    if (String(lane.athleteId || "") !== String(athleteId)) return;
    const bits = [];
    if (lane.finalTime) bits.push(`${lane.finalTime}`);
    if (lane.place != null) bits.push(`Place ${lane.place}`);
    if (lane.points != null) bits.push(`${lane.points} pts`);
    if (lane.dq) bits.push("DQ");
    if (lane.exhibition) bits.push("Exh");
    output.push({
      ...row,
      id: `${row.id}-swimming-lane-${index}`,
      sport: "swimming",
      sportSlug: "swimming",
      eventType: "track",
      statName: statData.eventName || "Swimming Event",
      eventName: row.eventName || statData.eventName || "Swimming results sheet",
      competitionName: row.competitionName || statData.title || "Swimming competition",
      statValue: lane.finalTime || "",
      performance: bits.join(", ") || "Lane result",
      category: [statData.round, statData.course, statData.ageGroup].filter(Boolean).join(" • ") || "Swimming",
      statData: { ...lane, result: lane.finalTime || "", summary: statData.summary, eventName: statData.eventName }
    });
  });
  return output;
}

function athleteNetballRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.playerStats || []).forEach((player, index) => {
    if (String(player.athleteId || "") !== String(athleteId)) return;
    const bits = [];
    if (player.goals != null) bits.push(`${player.goals}/${player.attempts ?? 0} shooting`);
    if (player.goalAssists != null) bits.push(`${player.goalAssists} goal assists`);
    if (player.feeds != null) bits.push(`${player.feeds} feeds`);
    if (player.gains != null) bits.push(`${player.gains} gains`);
    if (player.penalties != null) bits.push(`${player.penalties} penalties`);
    output.push({
      ...row,
      id: `${row.id}-netball-player-${index}`,
      sport: "netball",
      sportSlug: "netball",
      eventType: "match",
      statName: "Netball Match Sheet",
      eventName: row.eventName || statData.title || "Netball match sheet",
      competitionName: row.competitionName || statData.title || "Netball competition",
      statValue: player.goals ?? "",
      performance: bits.join(", ") || "Match appearance",
      category: statData.result || "Match",
      statData: { ...player, result: statData.result, score: statData.score, teamTotals: statData.teamTotals }
    });
  });
  return output;
}

function athleteBadmintonRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  const players = Array.isArray(statData.uwiPlayers) ? statData.uwiPlayers : [];
  if (!players.some((player) => String(player.athleteId || "") === String(athleteId))) return [];

  const summary = statData.summary || {};
  const games = Array.isArray(statData.games) ? statData.games : [];
  const gameScores = games.map((game) => `${Number(game.uwi || 0)}-${Number(game.opponent || 0)}`).join(", ");
  const sideName = players.map((player) => player.name).filter(Boolean).join(" / ") || statData.uwiTeamName || "UWI";
  return players
    .filter((player) => String(player.athleteId || "") === String(athleteId))
    .map((player, index) => ({
      ...row,
      id: `${row.id}-badminton-player-${index}`,
      sport: "badminton",
      sportSlug: "badminton",
      eventType: "match",
      statName: "Badminton Match Sheet",
      eventName: row.eventName || statData.title || "Badminton match sheet",
      competitionName: row.competitionName || statData.title || "Badminton competition",
      statValue: summary.uwiGamesWon ?? "",
      performance: [
        `${summary.uwiGamesWon ?? 0}-${summary.opponentGamesWon ?? 0} games`,
        gameScores ? `${gameScores} points` : "",
        summary.pointDifferential != null ? `${summary.pointDifferential} point differential` : ""
      ].filter(Boolean).join(", ") || "Match appearance",
      category: [statData.discipline, statData.matchType, statData.result].filter(Boolean).join(" â€¢ ") || "Badminton",
      statData: {
        ...player,
        sideName,
        result: statData.result,
        discipline: statData.discipline,
        matchType: statData.matchType,
        games,
        summary,
        officials: statData.officials,
        timing: statData.timing
      }
    }));
}

function athleteTableTennisRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  const rubbers = Array.isArray(statData.rubbers) ? statData.rubbers : [];
  const output = [];
  rubbers.forEach((rubber, index) => {
    const players = Array.isArray(rubber.uwiPlayers) ? rubber.uwiPlayers : [];
    if (!players.some((player) => String(player.athleteId || "") === String(athleteId))) return;
    const gameScores = (rubber.games || []).map((game) => `${Number(game.uwi || 0)}-${Number(game.opponent || 0)}`).join(", ");
    players
      .filter((player) => String(player.athleteId || "") === String(athleteId))
      .forEach((player, playerIndex) => {
        output.push({
          ...row,
          id: `${row.id}-table-tennis-rubber-${index}-${playerIndex}`,
          sport: "table-tennis",
          sportSlug: "table-tennis",
          eventType: rubber.type || "match",
          statName: rubber.label || "Table Tennis Rubber",
          eventName: row.eventName || statData.title || "Table tennis score sheet",
          competitionName: row.competitionName || statData.title || "Table tennis competition",
          statValue: rubber.uwiGames ?? "",
          performance: [
            `${rubber.uwiGames ?? 0}-${rubber.opponentGames ?? 0} games`,
            gameScores ? `${gameScores} points` : "",
            rubber.winner ? `${rubber.winner} won rubber` : ""
          ].filter(Boolean).join(", ") || "Rubber appearance",
          category: [statData.category, rubber.type, statData.result].filter(Boolean).join(" â€¢ ") || "Table Tennis",
          statData: {
            ...player,
            rubber,
            result: statData.result,
            category: statData.category,
            summary: statData.summary,
            opponentTeamName: statData.opponentTeamName
          }
        });
      });
  });
  return output;
}

function athleteTennisRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  const matches = Array.isArray(statData.matches) ? statData.matches : [];
  const output = [];
  matches.forEach((match, index) => {
    const players = Array.isArray(match.uwiPlayers) ? match.uwiPlayers : [];
    if (!players.some((player) => String(player.athleteId || "") === String(athleteId))) return;
    const setScores = (match.setScores || []).map((set) => set.raw || `${Number(set.uwi || 0)}-${Number(set.opponent || 0)}`).join(", ");
    players
      .filter((player) => String(player.athleteId || "") === String(athleteId))
      .forEach((player, playerIndex) => {
        output.push({
          ...row,
          id: `${row.id}-tennis-match-${index}-${playerIndex}`,
          sport: "lawn-tennis",
          sportSlug: "lawn-tennis",
          eventType: match.type || "match",
          statName: match.label || "Tennis Match",
          eventName: row.eventName || statData.title || "Tennis score sheet",
          competitionName: row.competitionName || statData.title || "Tennis competition",
          statValue: match.uwiSets ?? "",
          performance: [
            `${match.uwiSets ?? 0}-${match.opponentSets ?? 0} sets`,
            setScores || "",
            match.winner ? `${match.winner} won match` : ""
          ].filter(Boolean).join(", ") || "Match appearance",
          category: [statData.category, match.type, statData.result].filter(Boolean).join(" â€¢ ") || "Tennis",
          statData: {
            ...player,
            match,
            result: statData.result,
            category: statData.category,
            summary: statData.summary,
            opponentTeamName: statData.opponentTeamName,
            weather: statData.weather,
            courtConditions: statData.courtConditions
          }
        });
      });
  });
  return output;
}

function athleteTaekwondoRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (String(statData.athlete?.athleteId || row.subjectId || "") !== String(athleteId)) return [];
  const summary = statData.summary || {};
  const bits = [];
  if (summary.finalScore != null) bits.push(`${Number(summary.finalScore).toFixed(2)} final score`);
  if (summary.rank) bits.push(`Rank ${summary.rank}`);
  if (summary.judgeCount) bits.push(`${summary.judgeCount} judges`);
  return [{
    ...row,
    id: `${row.id}-taekwondo-poomsae`,
    sport: "taekwondo",
    sportSlug: "taekwondo",
    eventType: "poomsae",
    statName: "Poomsae Judge Score",
    eventName: row.eventName || statData.title || "Taekwondo judge score sheet",
    competitionName: row.competitionName || statData.title || "Taekwondo competition",
    statValue: summary.finalScore ?? "",
    performance: bits.join(", ") || "Poomsae performance",
    category: [statData.division, statData.round, statData.poomsae].filter(Boolean).join(" â€¢ ") || "Taekwondo",
    statData: {
      athlete: statData.athlete,
      result: statData.result,
      summary,
      judges: statData.judges,
      division: statData.division,
      poomsae: statData.poomsae,
      round: statData.round
    }
  }];
}

function athleteChessRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (String(statData.uwiPlayer?.athleteId || row.subjectId || "") !== String(athleteId)) return [];
  const summary = statData.summary || {};
  const bits = [];
  if (summary.resultLabel) bits.push(summary.resultLabel);
  if (summary.uwiScore != null) bits.push(`${summary.uwiScore} point${Number(summary.uwiScore) === 1 ? "" : "s"}`);
  if (statData.opening) bits.push(statData.opening);
  if (summary.moveCount != null) bits.push(`${summary.moveCount} move pairs`);
  return [{
    ...row,
    id: `${row.id}-chess-game`,
    sport: "chess",
    sportSlug: "chess",
    eventType: "game",
    statName: "Chess Game",
    eventName: row.eventName || statData.title || "Chess score sheet",
    competitionName: row.competitionName || statData.title || "Chess competition",
    statValue: summary.uwiScore ?? "",
    performance: bits.join(", ") || "Chess game",
    category: [statData.round, statData.board ? `Board ${statData.board}` : "", statData.timeControl].filter(Boolean).join(" â€¢ ") || "Chess",
    statData: {
      uwiPlayer: statData.uwiPlayer,
      opponent: statData.opponent,
      result: statData.result,
      summary,
      opening: statData.opening,
      timeControl: statData.timeControl,
      moves: statData.moves
    }
  }];
}

function athleteTrackFieldRows(record, athleteId) {
  const row = flattenRecord(record);
  const statData = row?.statData && typeof row.statData === "object" ? row.statData : row?.data?.statData || {};
  if (!scorecardIncludesAthlete(record, athleteId)) return [];

  const output = [];
  (statData.entries || []).forEach((entry, index) => {
    if (String(entry.athleteId || "") !== String(athleteId)) return;
    const isField = statData.resultType === "field";
    const mark = isField ? entry.best : entry.time;
    const placing = isField ? entry.finalRank : entry.place;
    const bits = [];
    if (mark) bits.push(String(mark));
    if (placing != null) bits.push(`Place ${placing}`);
    if (entry.points != null) bits.push(`${entry.points} pts`);
    output.push({
      ...row,
      id: `${row.id}-track-field-${statData.resultType || "event"}-${index}`,
      sourceId: row.id,
      sport: "track-and-field",
      sportSlug: "track-and-field",
      eventType: statData.disciplineType || (isField ? "field" : "track"),
      statName: statData.eventName || (isField ? "Field Event" : "Track Event"),
      eventName: row.eventName || statData.eventName || "Track and field results sheet",
      competitionName: row.competitionName || statData.title || "Track and field competition",
      statValue: mark || "",
      performance: bits.join(", ") || "Event result",
      category: [statData.round, statData.division].filter(Boolean).join(" • ") || "Track and Field",
      statData: { ...entry, resultType: statData.resultType, disciplineType: statData.disciplineType, summary: statData.summary, eventName: statData.eventName, round: statData.round, division: statData.division, track: statData.track, field: statData.field }
    });
  });
  return output;
}

async function createEntity(req, res, model, columns) {
  const body = getRecordBody(req);
  const record = await prisma[model].create({
    data: {
      ...columns(body, req),
      campus: getRecordCampus(req, body),
      data: body
    }
  });
  await writeAuditLog(req, { action: "create", entityType: model, entityId: record.id, summary: `Created ${model}`, data: { body } });
  res.status(201).json(entityResponse(record));
}

async function patchEntity(req, res, model, columns) {
  const body = getRecordBody(req);
  const existing = await prisma[model].findFirst({ where: scopedWhere(req, { id: req.params.id }) });
  if (!existing) return sendError(res, 404, "Record not found");
  if (!assertVersionFresh(res, existing, body)) return;

  const record = await prisma[model].update({
    where: { id: existing.id },
    data: {
      ...columns(body, req),
      campus: getRecordCampus(req, body),
      data: { ...(existing.data || {}), ...body }
    }
  });
  await writeAuditLog(req, { action: "update", entityType: model, entityId: record.id, summary: `Updated ${model}`, data: { body } });
  res.json(entityResponse(record));
}

async function getLinkedDataSummary(req, model, id) {
  const campus = currentCampus(req);
  const summary = [];
  if (model === "athlete") {
    const [rosterAssignments, athleteStats, statLines] = await Promise.all([
      prisma.teamRosterAssignment.count({ where: { campus, athleteId: id } }),
      prisma.athleteStatLine.count({ where: { campus, athleteId: id } }),
      prisma.competitionStatLine.findMany({ where: { campus }, select: { id: true, athleteId: true, data: true } })
    ]);
    const embeddedStats = statLines.filter((line) => scorecardIncludesAthlete(line, id)).length;
    if (rosterAssignments) summary.push({ label: "team roster assignments", count: rosterAssignments });
    if (athleteStats || embeddedStats) summary.push({ label: "linked stat records", count: athleteStats + embeddedStats });
  }
  if (model === "team") {
    const [rosterAssignments, staffAssignments, results, statLines] = await Promise.all([
      prisma.teamRosterAssignment.count({ where: { campus, teamId: id } }),
      prisma.teamStaffAssignment.count({ where: { campus, teamId: id } }),
      prisma.competitionResult.count({ where: { campus, teamId: id } }),
      prisma.competitionStatLine.count({ where: { campus, teamId: id } })
    ]);
    if (rosterAssignments) summary.push({ label: "team roster assignments", count: rosterAssignments });
    if (staffAssignments) summary.push({ label: "staff assignments", count: staffAssignments });
    if (results || statLines) summary.push({ label: "results and stat records", count: results + statLines });
  }
  if (model === "coach") {
    const staffAssignments = await prisma.teamStaffAssignment.count({ where: { campus, coachId: id } });
    if (staffAssignments) summary.push({ label: "staff assignments", count: staffAssignments });
  }
  if (model === "competition") {
    const [units, participants, results, statLines] = await Promise.all([
      prisma.competitionUnit.count({ where: { campus, competitionId: id } }),
      prisma.competitionParticipant.count({ where: { campus, competitionId: id } }),
      prisma.competitionResult.count({ where: { campus, competitionId: id } }),
      prisma.competitionStatLine.count({ where: { campus, competitionId: id } })
    ]);
    if (units || participants) summary.push({ label: "structure and participants", count: units + participants });
    if (results || statLines) summary.push({ label: "results and stat records", count: results + statLines });
  }
  return summary;
}

async function archiveEntity(req, res, model) {
  const body = getRecordBody(req);
  const existing = await prisma[model].findFirst({ where: scopedWhere(req, { id: req.params.id }) });
  if (!existing) return sendError(res, 404, "Record not found");
  if (!assertVersionFresh(res, existing, body)) return;
  const linkedDataSummary = await getLinkedDataSummary(req, model, existing.id);
  const archivedAt = new Date().toISOString();
  const record = await prisma[model].update({
    where: { id: existing.id },
    data: {
      status: "ARCHIVED",
      data: {
        ...(existing.data || {}),
        archived: true,
        archivedAt,
        archivedReason: body.reason || body.archivedReason || "",
        linkedDataSummary
      }
    }
  });
  await writeAuditLog(req, { action: "archive", entityType: model, entityId: record.id, summary: `Archived ${model}`, data: { reason: body.reason || body.archivedReason || "", linkedDataSummary } });
  res.json(cleanObject({ ...entityResponse(record), linkedDataSummary }));
}

function expandCompetitionRowsForAthlete(record, athleteId) {
  return [
    ...athleteCricketRows(record, athleteId),
    ...athleteFootballRows(record, athleteId),
    ...athleteVolleyballRows(record, athleteId),
    ...athleteHockeyRows(record, athleteId),
    ...athleteBasketballRows(record, athleteId),
    ...athleteSwimmingRows(record, athleteId),
    ...athleteNetballRows(record, athleteId),
    ...athleteBadmintonRows(record, athleteId),
    ...athleteTableTennisRows(record, athleteId),
    ...athleteTennisRows(record, athleteId),
    ...athleteTaekwondoRows(record, athleteId),
    ...athleteChessRows(record, athleteId),
    ...athleteTrackFieldRows(record, athleteId)
  ];
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "uwi-sports-hub-api" });
});

app.get("/debug/cookies", (req, res) => {
  if (config.nodeEnv === "production") return sendError(res, 404, "Not found");
  res.json({
    cookies: Object.keys(req.cookies || {}),
    hasAccessToken: Boolean(req.cookies?.ush_access_token),
    hasRefreshToken: Boolean(req.cookies?.ush_refresh_token),
    hasSessionId: Boolean(req.cookies?.ush_session_id)
  });
});

app.get("/debug/set-cookie", (req, res) => {
  if (config.nodeEnv === "production") return sendError(res, 404, "Not found");
  res.cookie("ush_debug_cookie", "ok", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 10
  });
  res.json({ ok: true, message: "Debug cookie sent" });
});

app.get("/debug/set-session-cookie", (req, res) => {
  if (config.nodeEnv === "production") return sendError(res, 404, "Not found");
  res.cookie("ush_session_id", "debug-session-id", cookieOptions(req));
  res.json({ ok: true, message: "Debug session cookie sent" });
});

app.get("/debug/clear-cookies", (_req, res) => {
  if (config.nodeEnv === "production") return sendError(res, 404, "Not found");
  res.clearCookie("ush_debug_cookie", { path: "/" });
  res.clearCookie("ush_session_id", { path: "/" });
  res.clearCookie("ush_access_token", { path: "/" });
  res.clearCookie("ush_refresh_token", { path: "/" });
  res.json({ ok: true, message: "Local debug/auth cookies cleared" });
});

app.use(express.static(frontendDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.post(
  "/auth/login",
  authRateLimit,
  asyncRoute(async (req, res) => {
    const { email, password } = getRecordBody(req);
    if (!email || !password) return sendError(res, 400, "Email and password are required");
    if (!isValidEmail(email) || String(password).length > 256) return sendError(res, 400, "Invalid email or password format");

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error || !data?.user || !data?.session) return sendError(res, 401, "Invalid email or password");

    let profile;
    try {
      profile = await findOrCreateProfile(data.user, {
        role: String(email).toLowerCase() === config.firstAdminEmail ? "admin" : undefined
      });
    } catch (profileError) {
      console.error("Login profile sync failed:", profileError);
      return sendError(res, 500, "Login profile sync failed", config.nodeEnv === "production" ? undefined : profileError.message);
    }

    try {
      const sessionId = setSessionCookies(req, res, data.session);
      res.setHeader("X-UWI-Session-Set", sessionId ? "true" : "false");
    } catch (cookieError) {
      console.error("Login cookie write failed:", cookieError);
      return sendError(res, 500, "Login cookie write failed", config.nodeEnv === "production" ? undefined : cookieError.message);
    }

    res.json({
      ok: true,
      sessionSet: true,
      user: entityResponse(profile)
    });
  })
);

app.get(
  "/auth/session",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: entityResponse(req.auth.profile) });
  })
);

app.post("/auth/logout", (req, res) => {
  clearSessionCookies(res);
  res.json({ ok: true });
});

app.post(
  "/auth/create-account",
  authRateLimit,
  asyncRoute(async (req, res) => {
    if (!supabaseAdmin) return sendError(res, 500, "SUPABASE_SECRET_KEY is not configured");
    const body = getRecordBody(req);
    const inviteCode = body.inviteCode || body.inviteToken || body.token;
    if (config.accountInviteCode && inviteCode !== config.accountInviteCode) {
      return sendError(res, 403, "Invalid invite code");
    }
    if (!body.email || !body.password) return sendError(res, 400, "Email and password are required");

    const requestedEmail = String(body.email || "").trim().toLowerCase();
    if (!isValidEmail(requestedEmail)) return sendError(res, 400, "Enter a valid email address");
    if (String(body.password || "").length < 8 || String(body.password || "").length > 256) {
      return sendError(res, 400, "Password must be between 8 and 256 characters");
    }
    const role = normalizeRole(requestedEmail === config.firstAdminEmail ? "admin" : body.role || "staff");
    const campus = normalizeCampus(body.campus || body.campusSlug);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: requestedEmail,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        fullName: body.fullName,
        campus,
        role
      }
    });
    if (error || !data?.user) return sendError(res, 400, error?.message || "Account could not be created");

    const profile = await findOrCreateProfile(data.user, { fullName: body.fullName, campus, role });
    await writeAuditLog(req, { campus, actorEmail: requestedEmail, action: "create_account", entityType: "userProfile", entityId: profile.id, summary: "Created invited account", data: { email: requestedEmail, role } });
    res.status(201).json({ message: "Account created successfully. You can now sign in.", user: entityResponse(profile) });
  })
);

app.use(requireAuth);

app.get("/athletes", asyncRoute(listAthletesWithRoster));
app.post(
  "/athletes",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const record = await prisma.athlete.create({
      data: {
        sport: body.sport || body.sportSlug || body.primarySport || body.profile?.sportSlug,
        firstName: body.firstName,
        lastName: body.lastName,
        status: body.status || "active",
        campus: getRecordCampus(req, body),
        data: body
      }
    });
    await syncAthleteRosterAssignment(req, record.id, body);
    await writeAuditLog(req, { action: "create", entityType: "athlete", entityId: record.id, summary: "Created athlete", data: { fullName: body.fullName || [body.firstName, body.lastName].filter(Boolean).join(" "), sport: body.sport || body.sportSlug } });
    res.status(201).json(entityResponse(record));
  })
);
app.get("/athletes/:id", asyncRoute((req, res) => getEntity(req, res, "athlete")));
app.patch(
  "/athletes/:id",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const existing = await prisma.athlete.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return sendError(res, 404, "Record not found");
    if (!assertVersionFresh(res, existing, body)) return;
    const record = await prisma.athlete.update({
      where: { id: existing.id },
      data: {
        ...cleanObject({
          sport: body.sport || body.sportSlug || body.primarySport || body.profile?.sportSlug,
          firstName: body.firstName,
          lastName: body.lastName,
          status: body.status
        }),
        campus: getRecordCampus(req, body),
        data: { ...(existing.data || {}), ...body }
      }
    });
    await syncAthleteRosterAssignment(req, record.id, body);
    await writeAuditLog(req, { action: "update", entityType: "athlete", entityId: record.id, summary: "Updated athlete", data: { fullName: body.fullName || [body.firstName, body.lastName].filter(Boolean).join(" "), sport: body.sport || body.sportSlug } });
    res.json(entityResponse(record));
  })
);
app.patch("/athletes/:id/archive", requireManager, asyncRoute((req, res) => archiveEntity(req, res, "athlete")));

app.get("/teams", asyncRoute((req, res) => listEntity(req, res, "team", req.query.teamId ? { id: String(req.query.teamId) } : {})));
app.post(
  "/teams",
  requireManager,
  asyncRoute((req, res) =>
    createEntity(req, res, "team", (body) => ({
      sport: body.sport || body.sportSlug,
      name: body.name || body.teamName,
      status: body.status || "active"
    }))
  )
);
app.get("/teams/:id", asyncRoute((req, res) => getEntity(req, res, "team")));
app.patch(
  "/teams/:id",
  requireManager,
  asyncRoute((req, res) =>
    patchEntity(req, res, "team", (body) =>
      cleanObject({
        sport: body.sport || body.sportSlug,
        name: body.name || body.teamName,
        status: body.status
      })
    )
  )
);
app.patch("/teams/:id/archive", requireManager, asyncRoute((req, res) => archiveEntity(req, res, "team")));

app.get("/coaches", asyncRoute(listCoachesWithAssignments));
app.post(
  "/coaches",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const record = await prisma.coach.create({
      data: {
        sport: body.sport || body.sportSlug || body.primarySport,
        firstName: body.firstName,
        lastName: body.lastName,
        status: body.status || "active",
        campus: getRecordCampus(req, body),
        data: body
      }
    });
    await syncCoachStaffAssignment(req, record.id, body);
    await writeAuditLog(req, { action: "create", entityType: "coach", entityId: record.id, summary: "Created coach", data: { fullName: body.fullName || [body.firstName, body.lastName].filter(Boolean).join(" "), sport: body.sport || body.sportSlug } });
    res.status(201).json(entityResponse(record));
  })
);
app.get("/coaches/:id", asyncRoute((req, res) => getEntity(req, res, "coach")));
app.patch(
  "/coaches/:id",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const existing = await prisma.coach.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return sendError(res, 404, "Record not found");
    if (!assertVersionFresh(res, existing, body)) return;
    const record = await prisma.coach.update({
      where: { id: existing.id },
      data: {
        ...cleanObject({
          sport: body.sport || body.sportSlug || body.primarySport,
          firstName: body.firstName,
          lastName: body.lastName,
          status: body.status
        }),
        campus: getRecordCampus(req, body),
        data: { ...(existing.data || {}), ...body }
      }
    });
    await syncCoachStaffAssignment(req, record.id, body);
    await writeAuditLog(req, { action: "update", entityType: "coach", entityId: record.id, summary: "Updated coach", data: { fullName: body.fullName || [body.firstName, body.lastName].filter(Boolean).join(" "), sport: body.sport || body.sportSlug } });
    res.json(entityResponse(record));
  })
);
app.patch("/coaches/:id/archive", requireManager, asyncRoute((req, res) => archiveEntity(req, res, "coach")));

app.get(
  "/competitions",
  asyncRoute((req, res) => {
    if (req.query.teamId) return listCompetitionsForTeam(req, res);
    const where = {};
    return listEntity(req, res, "competition", where);
  })
);
app.post(
  "/competitions",
  requireManager,
  asyncRoute((req, res) =>
    createEntity(req, res, "competition", (body) => ({
      sport: body.sport || body.sportSlug,
      name: body.name || body.title,
      status: body.status || "scheduled",
      startDate: toDate(body.startDate || body.date),
      endDate: toDate(body.endDate)
    }))
  )
);
app.get("/competitions/:id", asyncRoute((req, res) => getEntity(req, res, "competition")));
app.patch(
  "/competitions/:id",
  requireManager,
  asyncRoute((req, res) =>
    patchEntity(req, res, "competition", (body) =>
      cleanObject({
        sport: body.sport || body.sportSlug,
        name: body.name || body.title,
        status: body.status,
        startDate: toDate(body.startDate || body.date),
        endDate: toDate(body.endDate)
      })
    )
  )
);
app.patch("/competitions/:id/archive", requireManager, asyncRoute((req, res) => archiveEntity(req, res, "competition")));

app.get(
  "/team-roster-assignments",
  asyncRoute(async (req, res) => {
    const campus = currentCampus(req);
    const records = await prisma.teamRosterAssignment.findMany({
      where: scopedWhere(req, req.query.teamId ? { teamId: String(req.query.teamId) } : {}),
      orderBy: { updatedAt: "desc" }
    });
    const athleteRows = await prisma.athlete.findMany({ where: { campus }, orderBy: { updatedAt: "desc" } });
    const virtualAssignments = flattenMany(athleteRows)
      .map((athlete) => {
        const assignment = athlete.activeRosterAssignment && typeof athlete.activeRosterAssignment === "object"
          ? athlete.activeRosterAssignment
          : null;
        if (!assignment?.teamId) return null;
        if (req.query.teamId && String(assignment.teamId) !== String(req.query.teamId)) return null;
        return cleanObject({
          ...assignment,
          id: assignment.id || `athlete-${athlete.id}-roster`,
          teamId: assignment.teamId,
          athleteId: athlete.id,
          athlete,
          campus
        });
      })
      .filter(Boolean);
    res.json(dedupeAssignments([...records, ...virtualAssignments], (assignment) => `${assignment.teamId}:${assignment.athleteId}`));
  })
);
app.post(
  "/team-roster-assignments",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const campus = getRecordCampus(req, body);
    if (!body.teamId || !body.athleteId) return sendError(res, 400, "Team and athlete are required");
    const existing = await prisma.teamRosterAssignment.findFirst({
      where: { campus, teamId: String(body.teamId || ""), athleteId: String(body.athleteId || "") },
      orderBy: { updatedAt: "desc" }
    });
    const payload = {
      teamId: String(body.teamId || ""),
      athleteId: String(body.athleteId || ""),
      campus,
      data: { ...(existing?.data || {}), ...body }
    };
    const record = existing ? await prisma.teamRosterAssignment.update({
      where: { id: existing.id },
      data: payload
    }) : await prisma.teamRosterAssignment.create({
      data: {
        ...payload,
        data: body
      }
    });
    await writeAuditLog(req, { action: existing ? "update" : "create", entityType: "teamRosterAssignment", entityId: record.id, summary: "Saved team roster assignment", data: { teamId: payload.teamId, athleteId: payload.athleteId } });
    res.status(201).json(entityResponse(record));
  })
);

app.get(
  "/team-staff-assignments",
  asyncRoute(async (req, res) => {
    const where = {};
    if (req.query.teamId) where.teamId = String(req.query.teamId);
    if (req.query.coachId) where.coachId = String(req.query.coachId);
    const records = await prisma.teamStaffAssignment.findMany({
      where: scopedWhere(req, where),
      orderBy: { updatedAt: "desc" }
    });
    res.json(dedupeAssignments(records, (assignment) => `${assignment.teamId}:${assignment.coachId}:${assignment.role || assignment.roleLabel || ""}`));
  })
);
app.post(
  "/team-staff-assignments",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const campus = getRecordCampus(req, body);
    if (!body.teamId || !body.coachId) return sendError(res, 400, "Team and coach are required");
    const existing = await prisma.teamStaffAssignment.findFirst({
      where: { campus, teamId: String(body.teamId || ""), coachId: body.coachId ? String(body.coachId) : null },
      orderBy: { updatedAt: "desc" }
    });
    const payload = {
      teamId: String(body.teamId || ""),
      coachId: body.coachId ? String(body.coachId) : null,
      campus,
      data: { ...(existing?.data || {}), ...body }
    };
    const record = existing ? await prisma.teamStaffAssignment.update({
      where: { id: existing.id },
      data: payload
    }) : await prisma.teamStaffAssignment.create({
      data: {
        ...payload,
        data: body
      }
    });
    await writeAuditLog(req, { action: existing ? "update" : "create", entityType: "teamStaffAssignment", entityId: record.id, summary: "Saved team staff assignment", data: { teamId: payload.teamId, coachId: payload.coachId } });
    res.status(201).json(entityResponse(record));
  })
);

app.get("/competitions/:id/units", asyncRoute((req, res) => listEntity(req, res, "competitionUnit", { competitionId: req.params.id })));
app.get("/competitions/:id/participants", asyncRoute((req, res) => listEntity(req, res, "competitionParticipant", { competitionId: req.params.id })));
app.get("/competitions/:id/results", asyncRoute((req, res) => listEntity(req, res, "competitionResult", { competitionId: req.params.id })));
app.get("/competitions/:id/stat-lines", asyncRoute((req, res) => listEntity(req, res, "competitionStatLine", { competitionId: req.params.id })));
app.get(
  "/competitions/:id/audit",
  requireManager,
  asyncRoute(async (req, res) => {
    const records = await prisma.auditLog.findMany({
      where: scopedWhere(req, { entityId: req.params.id }),
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(flattenMany(records));
  })
);

app.get(
  "/audit-logs",
  requireManager,
  asyncRoute(async (req, res) => {
    const where = {};
    if (req.query.action) where.action = String(req.query.action);
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.entityId) where.entityId = String(req.query.entityId);
    const records = await prisma.auditLog.findMany({
      where: scopedWhere(req, where),
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(req.query.limit || 200) || 200, 500)
    });
    res.json(flattenMany(records));
  })
);

app.get(
  "/competition-results",
  asyncRoute((req, res) => {
    const where = {};
    if (req.query.teamId) where.teamId = String(req.query.teamId);
    return listEntity(req, res, "competitionResult", where);
  })
);

app.get(
  "/competition-stat-lines",
  asyncRoute(async (req, res) => {
    const where = {};
    if (req.query.competitionId) where.competitionId = String(req.query.competitionId);
    if (req.query.teamId) {
      const records = await prisma.competitionStatLine.findMany({
        where: scopedWhere(req, where),
        orderBy: { updatedAt: "desc" }
      });
      return res.json(visibleRows(req, records).filter((record) => recordMatchesTeam(record, req.query.teamId)));
    }
    return listEntity(req, res, "competitionStatLine", where);
  })
);
app.get(
  "/competition-stat-lines/:id",
  asyncRoute((req, res) => getEntity(req, res, "competitionStatLine"))
);
app.patch(
  "/competition-stat-lines/:id",
  requireManager,
  asyncRoute(async (req, res) => {
    const existing = await prisma.competitionStatLine.findFirst({ where: scopedWhere(req, { id: req.params.id }) });
    if (!existing) return sendError(res, 404, "Record not found.");
    const body = getRecordBody(req);
    const record = await prisma.competitionStatLine.update({
      where: { id: req.params.id },
      data: {
        competitionId: body.competitionId ? String(body.competitionId) : existing.competitionId,
        subjectId: body.subjectId ? String(body.subjectId) : existing.subjectId,
        subjectType: body.subjectType || existing.subjectType,
        teamId: body.teamId ? String(body.teamId) : body.subjectType === "team" ? String(body.subjectId || "") : existing.teamId,
        athleteId: body.athleteId ? String(body.athleteId) : body.subjectType === "athlete" ? String(body.subjectId || "") : existing.athleteId,
        sport: body.sport || body.sportSlug || existing.sport,
        data: body
      }
    });
    await writeAuditLog(req, { action: "update", entityType: "competitionStatLine", entityId: record.id, summary: "Updated competition stat line or score sheet", data: { competitionId: record.competitionId, teamId: record.teamId, athleteId: record.athleteId, sport: record.sport, eventType: body.eventType } });
    res.json(entityResponse(record));
  })
);
app.post(
  "/competition-stat-lines",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const record = await prisma.competitionStatLine.create({
      data: {
        competitionId: body.competitionId ? String(body.competitionId) : null,
        subjectId: body.subjectId ? String(body.subjectId) : null,
        subjectType: body.subjectType || null,
        teamId: body.teamId ? String(body.teamId) : body.subjectType === "team" ? String(body.subjectId || "") : null,
        athleteId: body.athleteId ? String(body.athleteId) : body.subjectType === "athlete" ? String(body.subjectId || "") : null,
        campus: getRecordCampus(req, body),
        sport: body.sport || body.sportSlug || null,
        data: body
      }
    });
    await writeAuditLog(req, { action: "create", entityType: "competitionStatLine", entityId: record.id, summary: "Created competition stat line or score sheet", data: { competitionId: record.competitionId, teamId: record.teamId, athleteId: record.athleteId, sport: record.sport, eventType: body.eventType } });
    res.status(201).json(entityResponse(record));
  })
);

app.get(
  "/athletes/:id/stats",
  asyncRoute(async (req, res) => {
    const athleteRows = await prisma.athleteStatLine.findMany({
      where: scopedWhere(req, { athleteId: req.params.id }),
      orderBy: { updatedAt: "desc" }
    });
    const competitionRows = await prisma.competitionStatLine.findMany({
      where: {
        ...scopedWhere(req),
        sport: { in: ["cricket", "football", "volleyball", "hockey", "basketball", "swimming", "track-and-field", "netball", "badminton", "table-tennis", "lawn-tennis", "taekwondo", "chess"] }
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json([
      ...flattenMany(athleteRows),
      ...competitionRows.flatMap((record) => expandCompetitionRowsForAthlete(record, req.params.id))
    ]);
  })
);
app.post(
  "/athletes/:id/stats",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const record = await prisma.athleteStatLine.create({
      data: {
        athleteId: req.params.id,
        campus: getRecordCampus(req, body),
        sport: body.sport || body.sportSlug || null,
        season: body.season || null,
        data: { ...body, athleteId: req.params.id }
      }
    });
    await writeAuditLog(req, { action: "create", entityType: "athleteStatLine", entityId: record.id, summary: "Created athlete stat line", data: { athleteId: req.params.id, sport: record.sport, season: record.season } });
    res.status(201).json(entityResponse(record));
  })
);

app.get(
  "/athletes/:id/personal-bests",
  asyncRoute((req, res) => listEntity(req, res, "athletePersonalBest", { athleteId: req.params.id }))
);
app.post(
  "/athletes/:id/personal-bests",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const record = await prisma.athletePersonalBest.create({
      data: {
        athleteId: req.params.id,
        campus: getRecordCampus(req, body),
        sport: body.sport || body.sportSlug || null,
        eventName: body.eventName || body.event || null,
        data: { ...body, athleteId: req.params.id }
      }
    });
    await writeAuditLog(req, { action: "create", entityType: "athletePersonalBest", entityId: record.id, summary: "Created athlete personal best", data: { athleteId: req.params.id, sport: record.sport, eventName: record.eventName } });
    res.status(201).json(entityResponse(record));
  })
);

app.get("/athletes/:id/history", (_req, res) => res.json([]));
app.get("/athletes/:id/teams", asyncRoute(listAthleteTeamAssignments));
app.get("/athletes/:id/records", (_req, res) => res.json([]));

app.get(
  "/athlete-stat-lines",
  asyncRoute(async (req, res) => {
    const [athleteStats, competitionStats, athletes] = await Promise.all([
      prisma.athleteStatLine.findMany({ where: scopedWhere(req), orderBy: { updatedAt: "desc" } }),
      prisma.competitionStatLine.findMany({ where: scopedWhere(req), orderBy: { updatedAt: "desc" } }),
      prisma.athlete.findMany({ where: scopedWhere(req), select: { id: true } })
    ]);
    const expandedCompetitionStats = competitionStats.flatMap((record) =>
      athletes.flatMap((athlete) => expandCompetitionRowsForAthlete(record, athlete.id))
    );
    res.json([...flattenMany(athleteStats), ...expandedCompetitionStats, ...flattenMany(competitionStats)]);
  })
);

app.post(
  "/support-requests",
  requireManager,
  asyncRoute(async (req, res) => {
    const body = getRecordBody(req);
    const record = await prisma.supportRequest.create({
      data: {
        campus: getRecordCampus(req, body),
        email: body.email || req.auth.profile.email,
        category: body.category || body.topic || null,
        data: body
      }
    });
    await writeAuditLog(req, { action: "create", entityType: "supportRequest", entityId: record.id, summary: "Submitted support request", data: { category: record.category, email: record.email } });
    res.status(201).json(entityResponse(record));
  })
);

app.use((error, _req, res, _next) => {
  console.error(error);
  const developmentMessage = error?.message
    ? `Unexpected server error: ${error.message}`
    : "Unexpected server error";
  sendError(
    res,
    500,
    config.nodeEnv === "production" ? "Unexpected server error" : developmentMessage,
    config.nodeEnv === "production" ? undefined : error?.message
  );
});

app.listen(config.port, () => {
  console.log(`UWI Sports Hub API listening on port ${config.port}`);
});
