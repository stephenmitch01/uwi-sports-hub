import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client for all API routes.
 *
 * Route handlers should use this singleton so campus-scoped reads/writes and
 * audit logging operate through the same connection pool.
 */
export const prisma = new PrismaClient();
