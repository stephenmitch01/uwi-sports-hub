# UWI Sports Hub (USH)
# Architecture, Workflows, Data Flow & API Logic

**Document status:** Updated engineering architecture document  
**Updated for current build state:** May 2026  
**Platform name:** UWI Sports Hub (USH)  
**Platform type:** Internal university sports operations, records, reporting, and decision-support system  

## Project Team

**Lead Designer / Product Architect / Primary Developer:** Stephen Mitchel  
**Independent Testing & Technical Review:** Kenneth James, Software Engineer  

## Engineering Context

UWI Sports Hub is structured as a frontend and backend web application with a database-backed data model. The frontend is built from HTML, CSS, and JavaScript files. The backend is an Express/Node service using Prisma for database access and Supabase for authentication/database hosting. The application is designed for internal campus sports operations and is scoped by authenticated campus context.

The platform has grown beyond a simple CRUD system. It now includes sport-specific score sheet workflows, score sheet views, athlete detailed stat pages, results archives, leaderboards, reports, audit logs, profile completeness, duplicate detection expectations, archive-only lifecycle rules, input validation, rate limiting, and data propagation across many pages.

This document explains how the system is expected to move data through the platform.

---

## 1. Frontend Architecture

The frontend is organized as page-specific HTML, CSS, and JavaScript files, supported by shared base files.

### 1.1 Shared Frontend Layers

Core shared frontend files include:

- `uwi-core-base.css`
- `uwi-public-base.css`
- `uwi-signed-base.css`
- `uwi-app.js`
- `config.js`

`uwi-app.js` functions as the shared frontend application helper layer. It is responsible for common logic such as:

- Mounting the signed-in shell.
- Loading session context.
- Managing sign-out behavior.
- API helper functions.
- Campus metadata.
- Sport registry metadata.
- Recent searches.
- Shared validation helpers.
- Unsaved-change tracking.
- Scorecard value warnings.
- Text escaping.
- Campus theme behavior.

The frontend follows a page-controller pattern. Each major page has its own JavaScript file that initializes on `DOMContentLoaded`, loads required data from the backend, stores temporary page state, and renders sections into the page.

### 1.2 Public Pages

Public pages include:

- `index.html`
- `about.html`
- `legal.html`
- `create-account.html`

The public view is used for sign in, account creation, and general platform information. The signed-in versions of About and Legal must preserve access to signed-in navigation where applicable.

### 1.3 Signed-In Pages

Signed-in pages include:

- `dashboard.html`
- `athletes.html`
- `athlete-view.html`
- `coaches.html`
- `coach-view.html`
- `teams.html`
- `team-view.html`
- `competitions.html`
- `competition-view.html`
- `reports.html`
- `audit-logs.html`
- `support.html`

Each signed-in page calls the shared shell mounting logic. If the session is missing or invalid, the user is redirected to sign in.

### 1.4 Sport-Specific Pages

Sport-specific pages include entry, view, detailed stats, and archive pages.

Examples:

- Cricket scorecard entry, view, results archive, and detailed athlete cricket stats.
- Football scorecard entry, match detail view, results archive, and detailed athlete football stats.
- Basketball score sheet entry, view, results archive, and detailed athlete basketball stats.
- Track and field results entry, results view, archive, and detailed athlete track and field stats.
- Volleyball, hockey, swimming, netball, badminton, table tennis, tennis, taekwondo, and chess score/result pages.

The frontend pattern for a sport-specific workflow is:

1. Open from a competition view.
2. Validate that the selected competition matches the sport.
3. Load roster, competition, team, and athlete data.
4. Render sport-specific score entry controls.
5. Link UWI players to athlete records using dropdowns.
6. Save the score sheet or result as a `competitionStatLine`.
7. View the saved score sheet through a dedicated view page.
8. Expand the score sheet into athlete stats through backend expansion logic.

---

## 2. Backend Architecture Assumptions

The backend uses:

- Node.js.
- Express.
- Prisma.
- Supabase authentication.
- Supabase/Postgres database.
- Cookie-based session handling.

The backend is responsible for:

- Authentication enforcement.
- Role checks.
- Campus scoping.
- Input validation and sanitization.
- Rate limiting.
- CRUD operations.
- Archive operations.
- Audit logging.
- Data expansion for athlete stats.
- Report and leaderboard support through API data.

### 2.1 Middleware Flow

Backend request flow generally follows:

1. Helmet security headers.
2. General rate limiter.
3. JSON body parser with payload size limit.
4. Malformed JSON handler.
5. Input sanitizer.
6. Cookie parser.
7. CORS handling.
8. Static frontend serving where applicable.
9. Authentication route handling.
10. `requireAuth` for protected routes.
11. Route-specific manager checks for write operations.

### 2.2 Rate Limiting

The backend includes:

- General endpoint rate limiting.
- Stricter authentication route rate limiting, with a maximum of five attempts per fifteen-minute window.

The purpose is to reduce brute force risk and accidental endpoint abuse.

### 2.3 Input Sanitization

The backend sanitizes:

- Request body.
- Query parameters.
- Route parameters.

Safeguards include:

- Maximum object depth.
- Maximum key count.
- Maximum string length.
- Maximum array length.
- Rejection of invalid numbers.
- Removal of control characters.
- Skipping prototype pollution keys such as `__proto__`, `prototype`, and `constructor`.

---

## 3. Data Models & Entity Relationships

The Prisma schema includes core models for:

- User profiles.
- Athletes.
- Coaches.
- Teams.
- Competitions.
- Competition units.
- Competition participants.
- Competition results.
- Competition stat lines.
- Athlete stat lines.
- Athlete personal bests.
- Team roster assignments.
- Team staff assignments.
- Support requests.
- Audit logs.

### 3.1 Athlete

An athlete record contains top-level searchable fields and a JSON data payload.

Important fields:

- `id`
- `campus`
- `sport`
- `firstName`
- `lastName`
- `status`
- `data`
- `createdAt`
- `updatedAt`

The JSON `data` object holds richer profile information such as:

- Full name.
- Contact details.
- Date of birth.
- Sex.
- Nationality.
- Hometown.
- Faculty.
- Program.
- Team assignment references.
- Profile/body data.
- Active roster assignment.
- Profile completeness.

### 3.2 Coach

Coach records follow a similar model:

- `id`
- `campus`
- `sport`
- `firstName`
- `lastName`
- `status`
- `data`

Coach assignment data may be represented directly on the coach profile and through `TeamStaffAssignment`.

### 3.3 Team

Team records include:

- `id`
- `campus`
- `sport`
- `name`
- `status`
- `data`

Teams connect to athletes through `TeamRosterAssignment`, and to coaches through `TeamStaffAssignment`.

### 3.4 Competition

Competition records include:

- `id`
- `campus`
- `sport`
- `name`
- `status`
- `startDate`
- `endDate`
- `data`

Competitions connect to score sheets and stat lines through `CompetitionStatLine`.

### 3.5 CompetitionStatLine

`CompetitionStatLine` is one of the most important models. It stores sport-specific results, score sheets, and competition performance data.

Important fields:

- `competitionId`
- `subjectId`
- `subjectType`
- `teamId`
- `athleteId`
- `campus`
- `sport`
- `data`

The `data` payload contains the actual sport-specific score sheet structure.

For example:

- Cricket scorecards store innings, batting, bowling, dismissals, totals, declarations, and result.
- Football match sheets store score, goals, player stats, match stats, and result.
- Basketball score sheets store quarter scoring, player stats, team totals, possession, and result.
- Track and field entries store event type, entries, marks, ranks, wind, attempts, and points.

### 3.6 AthleteStatLine

Athlete stat lines are direct athlete-specific stat entries. However, many athlete stat rows are generated virtually by expanding competition score sheets.

### 3.7 AthletePersonalBest

Personal best rows store notable athlete achievements. For some sports, personal bests are derived from score sheets. For others, they may be directly entered.

### 3.8 AuditLog

Audit logs store important backend actions.

Fields:

- `id`
- `campus`
- `actorId`
- `actorEmail`
- `action`
- `entityType`
- `entityId`
- `summary`
- `data`
- `createdAt`

Audit logs are read-only from the UI.

---

## 4. API Requirements & Endpoints

The backend exposes REST-style endpoints.

### 4.1 Authentication

Required endpoints include:

- Account creation.
- Login.
- Logout.
- Session retrieval.
- Debug/session support in local development.

Auth routes must use stricter rate limiting.

### 4.2 Athletes

Endpoints:

- `GET /athletes`
- `POST /athletes`
- `GET /athletes/:id`
- `PATCH /athletes/:id`
- `PATCH /athletes/:id/archive`
- `GET /athletes/:id/stats`
- `POST /athletes/:id/stats`
- `GET /athletes/:id/personal-bests`
- `POST /athletes/:id/personal-bests`

Athlete create and update routes must synchronize roster assignment where team information is present.

### 4.3 Coaches

Endpoints:

- `GET /coaches`
- `POST /coaches`
- `GET /coaches/:id`
- `PATCH /coaches/:id`
- `PATCH /coaches/:id/archive`

Coach create and update routes must synchronize staff assignment where team information is present.

### 4.4 Teams

Endpoints:

- `GET /teams`
- `POST /teams`
- `GET /teams/:id`
- `PATCH /teams/:id`
- `PATCH /teams/:id/archive`
- `GET /team-roster-assignments`
- `POST /team-roster-assignments`
- `GET /team-staff-assignments`
- `POST /team-staff-assignments`

### 4.5 Competitions

Endpoints:

- `GET /competitions`
- `POST /competitions`
- `GET /competitions/:id`
- `PATCH /competitions/:id`
- `PATCH /competitions/:id/archive`
- `GET /competitions/:id/units`
- `GET /competitions/:id/participants`
- `GET /competitions/:id/results`
- `GET /competitions/:id/stat-lines`
- `GET /competitions/:id/audit`

### 4.6 Competition Stat Lines

Endpoints:

- `GET /competition-stat-lines`
- `GET /competition-stat-lines/:id`
- `POST /competition-stat-lines`

All sport score sheets ultimately save through this model.

### 4.7 Audit Logs

Endpoint:

- `GET /audit-logs`

Filters:

- Action.
- Entity type.
- Entity ID.
- Limit.

Audit logs must be sorted newest first.

### 4.8 Support Requests

Endpoint:

- `POST /support-requests`

Support requests must be saved and logged. If email delivery is required, a mail provider must be integrated.

---

## 5. Authentication & Session Logic

The platform uses authenticated sessions to protect internal routes.

Session behavior:

1. User signs in with email and password.
2. Backend authenticates using Supabase.
3. Backend sets secure session cookies.
4. Frontend calls session endpoint to confirm authentication.
5. Signed-in pages mount the internal shell.
6. API calls include credentials.
7. Unauthorized requests return authentication errors.

Session cookies are required for authenticated backend access. If cookies are missing, the frontend may briefly load a page and then redirect back to sign in.

---

## 6. Campus Scoping Logic

Campus scoping is enforced backend-side.

The backend uses the authenticated profile to determine the current campus. Most queries include a campus filter. Normal users should not manually select campus in workflows.

Campus scoping applies to:

- Athletes.
- Coaches.
- Teams.
- Competitions.
- Stat lines.
- Roster assignments.
- Staff assignments.
- Support requests.
- Audit logs.

This prevents records from different campus accounts from mixing.

---

## 7. Workflow Diagrams

### 7.1 Signed-In Page Load

1. User opens signed-in page.
2. Page calls `mountSignedInShell`.
3. Frontend checks session.
4. If authenticated, shell/nav/session UI loads.
5. Page-specific API calls run.
6. Data renders.
7. If unauthenticated, user returns to sign in.

### 7.2 Score Sheet Entry

1. User opens competition view.
2. User selects sport-specific score sheet entry.
3. Entry page loads competition, teams, and athletes.
4. User selects UWI team.
5. Roster dropdowns populate.
6. User enters score sheet.
7. Derived fields calculate live.
8. Unsaved-change tracking protects the workflow.
9. User saves.
10. Backend creates `CompetitionStatLine`.
11. Audit log records the action.
12. Results, reports, leaderboards, and athlete detailed stats can now use the saved data.

### 7.3 Detailed Athlete Stats

1. Athlete view loads athlete record.
2. Athlete stats endpoint retrieves direct athlete stat lines.
3. Backend retrieves competition stat lines.
4. Backend expands score sheets that include the athlete.
5. Frontend filters by sport, season, and competition.
6. Frontend aggregates stats.
7. Detailed stats page shows summary tables and collapsible logs.

---

## 8. Athlete Lifecycle

1. Athlete is created.
2. Duplicate detection should warn if similar athlete exists.
3. Athlete data is saved.
4. If team assignment exists, roster assignment is synchronized.
5. Audit log is written.
6. Athlete appears in filtered athlete registry.
7. Athlete view shows profile, body info, team/squad association, stats, personal bests, and completeness.
8. Athlete can be edited.
9. Edits update reports and linked displays.
10. Athlete can be archived.

Important propagation points:

- Athlete registry.
- Athlete view.
- Team roster.
- Team view.
- Reports.
- Leaderboards.
- Sport-specific stat pages.
- Audit logs.

---

## 9. Coach Lifecycle

1. Coach is created.
2. Duplicate detection should warn if similar coach exists.
3. Coach profile is saved.
4. If team assignment exists, staff assignment is synchronized.
5. Audit log is written.
6. Coach appears in filtered coach registry.
7. Coach view shows assignments and linked teams.
8. Coach can be edited.
9. Coach can be assigned to teams.
10. Coach can be archived.

Assignment propagation:

- Coach registry.
- Coach view.
- Team staff roster.
- Team view.
- Reports.
- Audit logs.

---

## 10. Team Lifecycle

1. Team is created.
2. Duplicate detection should warn if similar team exists.
3. Team profile is saved.
4. Audit log is written.
5. Team appears in team registry.
6. Athletes can be assigned.
7. Coaches can be assigned.
8. Score sheets can link results to team.
9. Team view shows roster, staff, recent results, achievements, and performance summary.
10. Team leaderboards aggregate sport-specific stats.
11. Team can be edited or archived.

---

## 11. Competition Lifecycle

1. Competition is created.
2. Duplicate detection should check name, teams, sport, and date similarity.
3. Competition appears in competition registry.
4. Competition view loads details.
5. User enters sport-specific score sheets/results.
6. Score sheets save as competition stat lines.
7. Recent results update.
8. Results archive becomes available for relevant sports.
9. Leaderboards aggregate competition stats.
10. Reports include competition data.
11. Competition can be edited or archived.

---

## 12. Stat Entry Lifecycle

### 12.1 Cricket

Cricket uses a detailed scorecard with innings, batting, bowling, dismissals, fall of wickets, declarations, and derived totals. Scorecard data expands into batting, bowling, and fielding stat rows.

### 12.2 Football

Football uses match sheets with goals, assists, shots, possession-style metrics, cards, saves, tackles, interceptions, and minutes. Data expands into player match rows.

### 12.3 Basketball

Basketball uses score sheets with quarter scores, overtime, player points, fouls, 2PM, 3PM, FTM, rebounds, assists, steals, blocks, turnovers, and minutes. Data expands into player basketball rows and supports detailed athlete basketball stats.

### 12.4 Track and Field

Track and field has separate track and field result workflows. Track entries focus on time, rank, wind, heat/final, and points. Field entries focus on attempts, best marks, rank, and points.

### 12.5 Other Sports

Volleyball, hockey, swimming, netball, badminton, table tennis, tennis, taekwondo, and chess each use score/result workflows adapted to the logic of the sport.

---

## 13. Data Propagation Logic

Data propagation is central to the platform.

### 13.1 Profile Data

Profile data propagates to:

- Registry tables.
- View pages.
- Reports.
- Completeness calculations.
- Search and filters.

### 13.2 Roster Data

Roster data propagates to:

- Athlete view.
- Team roster.
- Team view.
- Score sheet dropdowns.
- Reports.

### 13.3 Staff Assignment Data

Staff assignment data propagates to:

- Coach view.
- Coach registry.
- Team staff roster.
- Team view.
- Reports.

### 13.4 Score Sheet Data

Score sheet data propagates to:

- Score sheet view.
- Competition recent results.
- Team recent results.
- Results archive.
- Athlete detailed stats.
- Leaderboards.
- Reports.
- Audit logs.

---

## 14. Report Generation Logic

Reports are generated from current backend data. They combine:

- Entity profile fields.
- Team/assignment context.
- Competition context.
- Stat lines.
- Expanded score sheet rows.
- Personal bests.
- Completeness indicators.

Athlete reports must include entered athlete information and linked stats. Team reports must reflect rosters, staff, results, and team-linked stat data. Competition reports must reflect sport, status, results, and linked score sheets.

---

## 15. Dashboard Data Logic

Dashboard data should be pulled from the signed-in account context and show meaningful operational summaries.

Dashboard should avoid:

- Backend language.
- Production-stage labels.
- Duplicate account summary sections.
- Unimportant tiles.

Dashboard should show:

- Account/campus summary.
- Record counts.
- Sports covered count.
- Useful operational indicators.
- Navigation to key workflows.

---

## 16. Error Handling

Frontend error handling must:

- Show clear messages.
- Avoid exposing raw technical traces to the user.
- Keep forms usable after errors.
- Explain validation problems.

Backend error handling must:

- Return suitable status codes.
- Reject unauthorized requests.
- Reject malformed JSON.
- Reject oversized payloads.
- Reject invalid data.
- Return conflict errors on stale edits.

---

## 17. Data Integrity Rules

Data integrity rules include:

- Campus scoping on all records.
- Archive instead of delete.
- Duplicate detection warnings.
- Quick-add athletes must be completed later.
- Stat rows must link to existing athletes when UWI player data is involved.
- Score sheets must preserve original historical data.
- Reports must derive from saved data, not disconnected frontend-only state.
- Audit logs must record important write actions.
- Edits affecting reports must warn users.
- Recent searches should not change results until Search is clicked.

---

## 18. Architecture Summary

UWI Sports Hub is architected as an interconnected internal records platform. The frontend provides page-specific workflows and sport-specific interfaces. The backend enforces authentication, campus scope, validation, rate limits, persistence, audit logging, and data expansion. The database stores structured core entities with flexible JSON payloads for sport-specific and profile-specific detail.

The most important architectural principle is propagation: a record entered in one workflow must appear everywhere it logically belongs. A score sheet is not merely a saved form. It is a source of athlete stats, team results, competition history, reports, leaderboards, and audit history.

---

## 19. Detailed API Behavior Matrix

## 19.1 Athlete API Behavior

When `POST /athletes` is called, the backend must:

- Validate the authenticated session.
- Confirm the user has permission to create records.
- Sanitize the request body.
- Infer campus from the session.
- Store searchable fields at top level.
- Store extended profile fields in JSON data.
- Synchronize roster assignment if team data is present.
- Write an audit log.
- Return the flattened athlete record.

When `PATCH /athletes/:id` is called, the backend must:

- Confirm the record belongs to the current campus.
- Check version freshness if an updated timestamp is provided.
- Merge new profile data with existing data.
- Update searchable fields.
- Synchronize roster assignment if team data is present.
- Write an audit log.
- Return the updated flattened record.

When `GET /athletes/:id/stats` is called, the backend must:

- Retrieve direct athlete stat lines.
- Retrieve competition stat lines for supported sports.
- Expand competition score sheets that include the athlete.
- Return a combined list of direct and expanded stat rows.

## 19.2 Coach API Behavior

Coach create/update routes must:

- Store basic searchable fields.
- Preserve extended JSON data.
- Synchronize staff assignments if team data is present.
- Write audit logs.
- Return flattened records.

Coach assignment data must be available to coach pages, team pages, and reports.

## 19.3 Team API Behavior

Team APIs must support:

- Listing active teams.
- Creating teams.
- Updating teams.
- Archiving teams.
- Listing roster assignments.
- Saving roster assignments.
- Listing staff assignments.
- Saving staff assignments.

Roster assignment endpoints must deduplicate assignments by team and athlete. Staff assignment endpoints must deduplicate by team, coach, and role where relevant.

## 19.4 Competition API Behavior

Competition APIs must support:

- Listing competitions.
- Filtering competitions by team where suitable.
- Creating competitions.
- Updating competitions.
- Archiving competitions.
- Loading competition units, participants, results, stat lines, and audit records.

Competition view depends heavily on `/competitions/:id/stat-lines` and `/competition-stat-lines`.

## 19.5 Competition Stat Line API Behavior

`POST /competition-stat-lines` is the main save route for sport score sheets and results.

The route must store:

- Competition ID.
- Subject ID and subject type.
- Team ID.
- Athlete ID where direct athlete context exists.
- Sport.
- Campus.
- Full sport-specific JSON payload.

The route must also write an audit log identifying the created score sheet/stat line.

---

## 20. Detailed Data Expansion Logic

The backend uses expansion functions to convert saved score sheets into athlete-facing stat rows. This prevents the frontend from needing to understand every raw score sheet structure in every context.

Expansion examples:

### Cricket Expansion

Cricket scorecard expansion reads innings. It extracts:

- Batting rows.
- Bowling rows.
- Fielding dismissals.
- Runs.
- Balls.
- 4s.
- 6s.
- Wickets.
- Overs.
- Catches.

### Football Expansion

Football expansion reads `playerStats` and extracts:

- Goals.
- Assists.
- Shots.
- Shots on target.
- Saves.
- Fouls.
- Offsides.
- Cards.
- Minutes.
- Tackles.
- Interceptions.

### Basketball Expansion

Basketball expansion reads `playerStats` and extracts:

- Points.
- Rebounds.
- Assists.
- Steals.
- Blocks.
- Turnovers.
- Fouls.
- Minutes.
- 2PM.
- 3PM.
- Free throws made.

### Track and Field Expansion

Track and field expansion reads event entries and extracts:

- Rank/place.
- Time or mark.
- Points.
- Event type.
- Track/field distinction.
- Personal best context where applicable.

---

## 21. Detailed Leaderboard Data Flow

Leaderboards may be opened from team or competition pages. They aggregate stat lines according to sport-specific metrics.

Leaderboard flow:

1. User opens leaderboard page from team or competition.
2. Frontend loads relevant stat lines.
3. Frontend determines sport.
4. Frontend chooses metric set.
5. Frontend expands score-sheet structures if needed.
6. Frontend groups stats by athlete.
7. Frontend computes derived metrics.
8. User sorts by metric and order.
9. Player links open detailed athlete stat pages where available.

Cricket derived metrics include batting average, batting strike rate, bowling average, and bowling strike rate.

Football derived metrics include goal contributions and shot accuracy.

Basketball derived metrics include points per game, rebounds per game, assists per game, and assist-to-turnover ratio.

Track and field metrics include points, wins, top-three finishes, track events, field events, and entries.

---

## 22. Detailed Results Archive Flow

Results archive pages exist for sports where saved match/event records benefit from browsing outside a single competition page.

Archive pages must:

- Load score sheets/stat lines.
- Filter by sport.
- Optionally filter by team.
- Show competition tabs where appropriate.
- Support season filters.
- Support outcome filters.
- Support opponent/search filters.
- Require the user to click Search before displaying filtered results.
- Save recent searches.
- Link each result to its view page.

Football and basketball use match-style result cards. Cricket uses cricket scorecard result cards. Track and field uses event result archive logic.

---

## 23. Detailed Report Data Flow

Report pages load entity records and stat rows. The report logic must not depend solely on top-level database fields because much of the platform stores extended data in JSON payloads.

Report generation must:

- Flatten entity data.
- Resolve team names.
- Resolve sport names.
- Pull profile data from top-level fields and JSON fields.
- Include linked stats.
- Include expanded score sheet rows.
- Respect filters.
- Avoid showing stale or missing fields when data exists under another supported key.

Because iterative development introduced multiple equivalent field names in some places, report logic should be defensive. For example, team may appear as `teamId`, `teamName`, `activeRosterAssignment.teamId`, or roster assignment data.

---

## 24. Detailed Audit Data Flow

Audit logs are written from backend routes after successful write operations. The audit write should not block the main operation if logging fails, but failures should be visible in backend logs.

Audit log write flow:

1. Route completes the main record create/update/archive.
2. Route calls audit log helper.
3. Helper resolves campus and actor.
4. Helper stores action, entity type, entity ID, summary, and details.
5. Audit page retrieves logs through `/audit-logs`.

Audit logs cannot retroactively capture actions performed before the audit log table or audit code existed unless a backfill is performed.

---

## 25. Detailed Archive Data Flow

Archive routes update a record's status/data rather than deleting it. Active list routes hide archived records by default. If the user searches archived records, the backend may include them through query flags.

Archive flow:

1. User chooses archive.
2. UI asks for confirmation.
3. Backend checks permissions.
4. Backend checks linked data where necessary.
5. Record is marked archived.
6. Audit log is written.
7. Active lists no longer show the record.

---

## 26. Detailed Error and Conflict Flow

The backend supports stale edit detection through updated timestamp checks. If the frontend sends a known updated timestamp and the database version differs, the backend returns a conflict error.

This protects against concurrent edits overwriting newer changes.

Conflict handling should:

- Tell the user the record was updated elsewhere.
- Ask the user to refresh before saving.
- Avoid silent overwrites.

---

## 27. Detailed Security Middleware Flow

Security middleware is applied before protected routes.

Security flow:

1. Helmet sets headers.
2. General rate limiter counts requests.
3. JSON body parser enforces size limit.
4. Malformed JSON handler rejects invalid JSON.
5. Sanitizer checks shape, depth, keys, strings, arrays, and numbers.
6. Cookie parser loads cookies.
7. CORS validates origins.
8. Authentication middleware verifies session.
9. Manager middleware protects write routes.

This sequence ensures that malformed or abusive requests are rejected early.
