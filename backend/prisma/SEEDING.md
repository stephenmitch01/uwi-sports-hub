# USH Demo Seeding

This seed system is for development and presentation databases only. It refuses to run unless the target database is explicitly identified with environment variables.

## Safety Guard

The script refuses to run when:

- `NODE_ENV=production`
- `DATABASE_URL` is missing
- `USH_DEMO_SEED_ALLOW` is not `true`
- `USH_DEMO_DATABASE_PURPOSE` is not `demo`, `development`, or `local`
- `USH_DEMO_DATABASE_REF` is missing
- `USH_DEMO_DATABASE_REF` does not match the Supabase project ref from `SUPABASE_URL` or `DATABASE_URL`
- a local database URL is used without `USH_DEMO_DATABASE_REF=local`
- `DATABASE_URL` contains production-like wording such as `prod` or `production`
- the requested dataset size is not `presentation` or `large`

The seed does not manage Supabase Auth users. It only writes to the Prisma application tables.

## Stephen Mitchel Preservation

Before deleting anything, the script searches the existing `Athlete` table for exactly one athlete named Stephen Mitchel or Stephen Mitchell. If it cannot identify exactly one record, it stops before changing data.

The preserved Stephen Mitchel row keeps its existing database ID and personal/profile information. The seed only updates relationship metadata needed to reconnect the record to seeded demo teams.

All other athlete records are removed and replaced with fictional demo athletes. All coaches created by the seed are fictional. Seeded scorecards may include fictional performance rows linked to Stephen Mitchel so his profile, teams, leaderboards, and reports demonstrate the full multi-sport flow while preserving his existing athlete identity.

## Commands

Run from `backend`.

Generate Prisma client:

```powershell
npm run prisma:generate
```

Presentation/demo seed and rebuild:

```powershell
$env:USH_DEMO_SEED_ALLOW="true"
$env:USH_DEMO_DATABASE_PURPOSE="demo"
$env:USH_DEMO_DATABASE_REF="nilkixdwqrnnnvhpgcgr"
npm run demo:seed
```

`demo:seed` and `demo:reset` both rebuild the normal presentation dataset. The separate `demo:reset` name exists for moments when you want the command to read clearly as a reset.

Reset and rebuild the presentation/demo dataset:

```powershell
$env:USH_DEMO_SEED_ALLOW="true"
$env:USH_DEMO_DATABASE_PURPOSE="demo"
$env:USH_DEMO_DATABASE_REF="nilkixdwqrnnnvhpgcgr"
npm run demo:reset
```

Larger performance-test dataset:

```powershell
$env:USH_DEMO_SEED_ALLOW="true"
$env:USH_DEMO_DATABASE_PURPOSE="demo"
$env:USH_DEMO_DATABASE_REF="nilkixdwqrnnnvhpgcgr"
npm run demo:perf
```

Dry-run safety check:

```powershell
$env:USH_DEMO_SEED_ALLOW="true"
$env:USH_DEMO_DATABASE_PURPOSE="demo"
$env:USH_DEMO_DATABASE_REF="nilkixdwqrnnnvhpgcgr"
node prisma/seed-demo.js --dry-run
```

Local-only database example:

```powershell
$env:USH_DEMO_SEED_ALLOW="true"
$env:USH_DEMO_DATABASE_PURPOSE="local"
$env:USH_DEMO_DATABASE_REF="local"
npm run demo:reset
```

## Data Shape

The seed uses the existing Prisma models only:

- `Athlete`
- `Coach`
- `Team`
- `Competition`
- `TeamRosterAssignment`
- `TeamStaffAssignment`
- `CompetitionUnit`
- `CompetitionParticipant`
- `CompetitionResult`
- `CompetitionStatLine`
- `AthleteStatLine`
- `AthletePersonalBest`
- `SupportRequest`
- `AuditLog`
- app-only fictional `UserProfile` rows

Scorecard data is stored in `CompetitionStatLine.data` using the same `statData`-style fields consumed by athlete reports, team views, competition views, leaderboards, result cards, and sport-specific scorecard views.
