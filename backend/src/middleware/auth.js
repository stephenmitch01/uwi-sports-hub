import { prisma } from "../db.js";
import { supabaseAuth } from "../supabase.js";
import { canManage, normalizeCampus, normalizeRole, sendError } from "../utils.js";

const ACCESS_COOKIE = "ush_access_token";
const REFRESH_COOKIE = "ush_refresh_token";
const SESSION_COOKIE = "ush_session_id";
const memorySessions = new Map();

/**
 * Cookie policy for the API-managed Supabase session bridge.
 *
 * Local development uses lax, non-secure cookies so localhost works; production
 * uses secure cross-site cookies for deployed frontend/backend origins.
 */
export function cookieOptions(req) {
  const production = process.env.NODE_ENV === "production";
  if (!production) {
    return {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7
    };
  }

  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7
  };
}

export function setSessionCookies(req, res, session) {
  const sessionId = crypto.randomUUID();
  memorySessions.set(sessionId, {
    accessToken: session?.access_token,
    refreshToken: session?.refresh_token,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  });
  res.cookie(SESSION_COOKIE, sessionId, cookieOptions(req));
  return sessionId;
}

export function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
}

/**
 * Ensures every authenticated Supabase user has a campus-scoped USH profile.
 *
 * Supabase is the identity provider, while this profile stores application
 * permissions and campus ownership used by route scoping and signed-in shell UI.
 */
export async function findOrCreateProfile(authUser, defaults = {}) {
  const email = String(authUser.email || defaults.email || "").trim().toLowerCase();
  if (!email) return null;

  const fullName =
    defaults.fullName ||
    authUser.user_metadata?.fullName ||
    authUser.user_metadata?.full_name ||
    [authUser.user_metadata?.firstName, authUser.user_metadata?.lastName].filter(Boolean).join(" ") ||
    null;

  const campus = normalizeCampus(defaults.campus || authUser.user_metadata?.campus || "cavehill");
  const role = normalizeRole(defaults.role || authUser.user_metadata?.role || "viewer");

  const existing = await prisma.userProfile.findFirst({
    where: { OR: [{ authUserId: authUser.id }, { email }] }
  });

  if (existing) {
    return prisma.userProfile.update({
      where: { id: existing.id },
      data: {
        authUserId: existing.authUserId || authUser.id,
        email,
        fullName: existing.fullName || fullName,
        campus: existing.campus || campus,
        role: existing.role || role
      }
    });
  }

  return prisma.userProfile.create({
    data: {
      authUserId: authUser.id,
      email,
      fullName,
      campus,
      role,
      data: authUser.user_metadata || {}
    }
  });
}

/**
 * Authenticates API requests and attaches both identity and USH profile data.
 *
 * Routes should read `req.auth.profile` for role/campus decisions instead of
 * trusting client-provided campus or role values.
 */
export async function requireAuth(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const memorySession = sessionId ? memorySessions.get(sessionId) : null;
  if (memorySession && memorySession.expiresAt < Date.now()) {
    memorySessions.delete(sessionId);
  }

  const accessToken =
    (memorySession && memorySession.expiresAt >= Date.now() ? memorySession.accessToken : "") ||
    req.cookies?.[ACCESS_COOKIE] ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) return sendError(res, 401, "Authentication required");

  const { data, error } = await supabaseAuth.auth.getUser(accessToken);
  if (error || !data?.user) return sendError(res, 401, "Session expired");

  const profile = await findOrCreateProfile(data.user);
  req.auth = { user: data.user, profile };
  next();
}

/**
 * Mutation guard for records that can affect reports, leaderboards, and teams.
 */
export function requireManager(req, res, next) {
  if (!canManage(req.auth?.profile?.role)) {
    return sendError(res, 403, "Your role does not permit this action");
  }
  next();
}

export function currentCampus(req) {
  return normalizeCampus(req.auth?.profile?.campus || "cavehill");
}
