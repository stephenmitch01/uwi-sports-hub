-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "name" TEXT,
    "status" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "name" TEXT,
    "status" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRosterAssignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRosterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStaffAssignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "coachId" TEXT,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionUnit" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionParticipant" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectType" TEXT,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionResult" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "teamId" TEXT,
    "athleteId" TEXT,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionStatLine" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "subjectId" TEXT,
    "subjectType" TEXT,
    "teamId" TEXT,
    "athleteId" TEXT,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionStatLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteStatLine" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "season" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteStatLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthletePersonalBest" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "sport" TEXT,
    "eventName" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthletePersonalBest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'cavehill',
    "email" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_authUserId_key" ON "UserProfile"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "Athlete_campus_idx" ON "Athlete"("campus");

-- CreateIndex
CREATE INDEX "Athlete_sport_idx" ON "Athlete"("sport");

-- CreateIndex
CREATE INDEX "Coach_campus_idx" ON "Coach"("campus");

-- CreateIndex
CREATE INDEX "Coach_sport_idx" ON "Coach"("sport");

-- CreateIndex
CREATE INDEX "Team_campus_idx" ON "Team"("campus");

-- CreateIndex
CREATE INDEX "Team_sport_idx" ON "Team"("sport");

-- CreateIndex
CREATE INDEX "Competition_campus_idx" ON "Competition"("campus");

-- CreateIndex
CREATE INDEX "Competition_sport_idx" ON "Competition"("sport");

-- CreateIndex
CREATE INDEX "TeamRosterAssignment_teamId_idx" ON "TeamRosterAssignment"("teamId");

-- CreateIndex
CREATE INDEX "TeamRosterAssignment_athleteId_idx" ON "TeamRosterAssignment"("athleteId");

-- CreateIndex
CREATE INDEX "TeamStaffAssignment_teamId_idx" ON "TeamStaffAssignment"("teamId");

-- CreateIndex
CREATE INDEX "TeamStaffAssignment_coachId_idx" ON "TeamStaffAssignment"("coachId");

-- CreateIndex
CREATE INDEX "CompetitionUnit_competitionId_idx" ON "CompetitionUnit"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionParticipant_competitionId_idx" ON "CompetitionParticipant"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionParticipant_subjectId_idx" ON "CompetitionParticipant"("subjectId");

-- CreateIndex
CREATE INDEX "CompetitionResult_competitionId_idx" ON "CompetitionResult"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionResult_teamId_idx" ON "CompetitionResult"("teamId");

-- CreateIndex
CREATE INDEX "CompetitionResult_athleteId_idx" ON "CompetitionResult"("athleteId");

-- CreateIndex
CREATE INDEX "CompetitionStatLine_competitionId_idx" ON "CompetitionStatLine"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionStatLine_subjectId_idx" ON "CompetitionStatLine"("subjectId");

-- CreateIndex
CREATE INDEX "CompetitionStatLine_teamId_idx" ON "CompetitionStatLine"("teamId");

-- CreateIndex
CREATE INDEX "CompetitionStatLine_athleteId_idx" ON "CompetitionStatLine"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteStatLine_athleteId_idx" ON "AthleteStatLine"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteStatLine_sport_idx" ON "AthleteStatLine"("sport");

-- CreateIndex
CREATE INDEX "AthletePersonalBest_athleteId_idx" ON "AthletePersonalBest"("athleteId");

-- CreateIndex
CREATE INDEX "AthletePersonalBest_sport_idx" ON "AthletePersonalBest"("sport");

-- CreateIndex
CREATE INDEX "SupportRequest_campus_idx" ON "SupportRequest"("campus");

-- CreateIndex
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");
