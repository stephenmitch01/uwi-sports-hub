-- Security/performance hardening indexes for campus-scoped operational queries.
CREATE INDEX IF NOT EXISTS "Athlete_campus_sport_idx" ON "Athlete"("campus", "sport");
CREATE INDEX IF NOT EXISTS "Athlete_campus_updatedAt_idx" ON "Athlete"("campus", "updatedAt");

CREATE INDEX IF NOT EXISTS "Coach_campus_sport_idx" ON "Coach"("campus", "sport");
CREATE INDEX IF NOT EXISTS "Coach_campus_updatedAt_idx" ON "Coach"("campus", "updatedAt");

CREATE INDEX IF NOT EXISTS "Team_campus_sport_idx" ON "Team"("campus", "sport");
CREATE INDEX IF NOT EXISTS "Team_campus_updatedAt_idx" ON "Team"("campus", "updatedAt");

CREATE INDEX IF NOT EXISTS "Competition_campus_sport_idx" ON "Competition"("campus", "sport");
CREATE INDEX IF NOT EXISTS "Competition_campus_updatedAt_idx" ON "Competition"("campus", "updatedAt");
CREATE INDEX IF NOT EXISTS "Competition_campus_startDate_idx" ON "Competition"("campus", "startDate");

CREATE INDEX IF NOT EXISTS "TeamRosterAssignment_campus_teamId_idx" ON "TeamRosterAssignment"("campus", "teamId");
CREATE INDEX IF NOT EXISTS "TeamRosterAssignment_campus_athleteId_idx" ON "TeamRosterAssignment"("campus", "athleteId");

CREATE INDEX IF NOT EXISTS "TeamStaffAssignment_campus_teamId_idx" ON "TeamStaffAssignment"("campus", "teamId");
CREATE INDEX IF NOT EXISTS "TeamStaffAssignment_campus_coachId_idx" ON "TeamStaffAssignment"("campus", "coachId");

CREATE INDEX IF NOT EXISTS "CompetitionUnit_campus_competitionId_idx" ON "CompetitionUnit"("campus", "competitionId");

CREATE INDEX IF NOT EXISTS "CompetitionParticipant_campus_competitionId_idx" ON "CompetitionParticipant"("campus", "competitionId");
CREATE INDEX IF NOT EXISTS "CompetitionParticipant_campus_subjectId_idx" ON "CompetitionParticipant"("campus", "subjectId");

CREATE INDEX IF NOT EXISTS "CompetitionResult_campus_competitionId_idx" ON "CompetitionResult"("campus", "competitionId");
CREATE INDEX IF NOT EXISTS "CompetitionResult_campus_teamId_idx" ON "CompetitionResult"("campus", "teamId");
CREATE INDEX IF NOT EXISTS "CompetitionResult_campus_athleteId_idx" ON "CompetitionResult"("campus", "athleteId");

CREATE INDEX IF NOT EXISTS "CompetitionStatLine_campus_competitionId_idx" ON "CompetitionStatLine"("campus", "competitionId");
CREATE INDEX IF NOT EXISTS "CompetitionStatLine_campus_teamId_idx" ON "CompetitionStatLine"("campus", "teamId");
CREATE INDEX IF NOT EXISTS "CompetitionStatLine_campus_athleteId_idx" ON "CompetitionStatLine"("campus", "athleteId");
CREATE INDEX IF NOT EXISTS "CompetitionStatLine_campus_sport_idx" ON "CompetitionStatLine"("campus", "sport");

CREATE INDEX IF NOT EXISTS "AthleteStatLine_campus_athleteId_idx" ON "AthleteStatLine"("campus", "athleteId");
CREATE INDEX IF NOT EXISTS "AthleteStatLine_campus_sport_idx" ON "AthleteStatLine"("campus", "sport");
CREATE INDEX IF NOT EXISTS "AthleteStatLine_athleteId_sport_idx" ON "AthleteStatLine"("athleteId", "sport");

CREATE INDEX IF NOT EXISTS "AthletePersonalBest_campus_athleteId_idx" ON "AthletePersonalBest"("campus", "athleteId");
CREATE INDEX IF NOT EXISTS "AthletePersonalBest_campus_sport_idx" ON "AthletePersonalBest"("campus", "sport");

CREATE INDEX IF NOT EXISTS "SupportRequest_campus_status_idx" ON "SupportRequest"("campus", "status");
CREATE INDEX IF NOT EXISTS "SupportRequest_campus_updatedAt_idx" ON "SupportRequest"("campus", "updatedAt");
