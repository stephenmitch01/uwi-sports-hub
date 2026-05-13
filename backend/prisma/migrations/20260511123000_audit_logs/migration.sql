CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "campus" TEXT NOT NULL DEFAULT 'cavehill',
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "summary" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_campus_idx" ON "AuditLog"("campus");
CREATE INDEX IF NOT EXISTS "AuditLog_campus_action_idx" ON "AuditLog"("campus", "action");
CREATE INDEX IF NOT EXISTS "AuditLog_campus_entityType_idx" ON "AuditLog"("campus", "entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_campus_entityId_idx" ON "AuditLog"("campus", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_campus_createdAt_idx" ON "AuditLog"("campus", "createdAt");
