# UWI Sports Hub (USH)
# Product Requirements & Full System Specification

**Document status:** Updated master specification  
**Updated for current build state:** May 2026  
**Platform name:** UWI Sports Hub (USH)  
**Platform type:** Internal university sports operations, records, reporting, and decision-support system  

## Project Team

**Lead Designer / Product Architect / Primary Developer:** Stephen Mitchel  
**Independent Testing & Technical Review:** Kenneth James, Software Engineer  

## Important Project Context

UWI Sports Hub was not developed from a traditional client-provided requirements package. The product requirements were derived from operational reasoning, domain research, and iterative testing rather than a formal discovery process with institutional stakeholders.

The requirements were shaped by:

- Domain understanding of university sports administration.
- Known pain points in managing athlete, coach, team, competition, and performance data.
- Real-world sports scorebooks, scoresheets, match sheets, and competition record workflows.
- The need for a centralized internal system for campus sports operations.
- The expected needs of sports department staff, coaches, managers, administrators, and reviewers.
- Iterative interface testing and functional review during development.
- Independent testing and technical review feedback.

This document is the master system brain. It defines what the platform is intended to do, why those decisions exist, and what rules govern the system.

---

## 1. Vision & Purpose

UWI Sports Hub is intended to serve as a professional internal sports management platform for The University of the West Indies campus sports operations. Its purpose is to centralize and structure the management of athlete records, coach records, team rosters, staff assignments, competitions, score sheets, performance statistics, reports, audit logs, and operational quality indicators.

The platform exists to replace scattered, inconsistent, and manually maintained sports data with a single organized database-backed system. University sports programs often manage records across spreadsheets, PDFs, paper forms, emails, WhatsApp messages, scorebooks, and individual staff knowledge. That creates fragmentation. UWI Sports Hub is designed to reduce that fragmentation by making sports records structured, searchable, reportable, and linked across the platform.

The product vision is not merely to store data. The platform is intended to support better decision-making. A user should be able to understand who is registered, which team they belong to, which competitions they participated in, what their performance history looks like, what records are incomplete, which coaches are assigned, what score sheets have been entered, and what trends appear in reports.

The platform should feel like a finished internal operations system. Users should not see references to development stage, readiness, backend implementation details, production status, or technical scaffolding. As far as the user is concerned, the platform is complete and operational.

---

## 2. Problem Statement

University sports operations require accurate and accessible data, but the information is commonly spread across multiple sources and formats. This creates several problems:

- Athlete records may be incomplete or duplicated.
- Coaches may be assigned to teams but not reflected consistently across pages.
- Team rosters may not match athlete profile information.
- Competition records may exist without linked results or participants.
- Sport-specific statistics may be entered but fail to appear in reports, athlete profiles, team pages, or leaderboards.
- Historical score sheets may be difficult to retrieve.
- Staff may not know which records are incomplete or need attention.
- Manual reporting is time-consuming and error-prone.
- Deleting records could accidentally destroy historical context.
- Multiple users may edit overlapping records without awareness.

UWI Sports Hub addresses these problems by defining a structured, campus-scoped, internally authenticated platform where records are linked and propagated across all suitable views.

The core product problem is therefore:

**How can campus sports administrators manage athlete, coach, team, competition, and sport-specific performance data in a structured, searchable, secure, and reportable system without relying on disconnected spreadsheets and paper records?**

---

## 3. Stakeholders & Users

### 3.1 Primary Users

Primary users are internal authorized university sports operations personnel. These may include:

- Campus sports administrators.
- Sports officers.
- Team managers.
- Coaches.
- Approved support staff.
- Data entry personnel.
- Reporting or review personnel.

### 3.2 Secondary Users

Secondary users may include:

- Department heads who review reports.
- University officials who need summaries.
- Independent reviewers testing data integrity.
- Future administrators managing multiple sports.

### 3.3 User Needs

Users need to:

- Create and maintain athlete profiles.
- Create and maintain coach profiles.
- Create and maintain teams.
- Assign athletes to teams.
- Assign coaches/staff to teams.
- Create competitions.
- Enter sport-specific results and score sheets.
- View historical score sheets.
- View athlete, team, and competition leaderboards.
- Generate reports.
- Identify incomplete records.
- Archive records instead of permanently deleting them.
- Review audit logs.
- Search records efficiently.
- Avoid duplicate records.
- Avoid accidental data loss.

---

## 4. Full Platform Overview

UWI Sports Hub consists of a public entry experience and an authenticated internal application.

### 4.1 Public Experience

The public-facing portion includes:

- Homepage and sign-in entry.
- About page.
- Legal page.
- Invite-only account creation.
- Support/contact access where appropriate.

The homepage must explain the system clearly without excessive decorative tiles or repetitive content. The hero section should state what the platform does in a professional, concise way. The platform is internal, so it should not feel like a marketing landing page for public customers.

### 4.2 Signed-In Experience

The signed-in application includes:

- Dashboard.
- Athlete registry and athlete view.
- Coach registry and coach view.
- Teams registry and team view.
- Competitions registry and competition view.
- Sport-specific score sheet entry pages.
- Score sheet view pages.
- Sport-specific detailed athlete stat pages.
- Results archive pages.
- Leaderboards.
- Reports.
- Audit logs.
- Support.
- About and legal pages that preserve signed-in navigation.

### 4.3 Campus-Scoped Model

All records belong to the signed-in user's campus context. Users should not manually select campus in normal workflows. Campus is inferred from the authenticated account. The system should not expose backend scoping language to end users, but it must enforce campus scoping internally.

### 4.4 Archive-Only Data Lifecycle

The platform should not permanently delete operational records through normal user workflows. Records should be archived instead. Archived records should not appear by default, but users may search archived records where suitable.

This protects historical integrity. A player, coach, team, competition, or score sheet may be referenced by reports or historical statistics. Permanent deletion risks breaking the data chain.

---

## 5. Functional Requirements

## 5.1 Authentication & Account Access

- The system must require authentication for internal pages.
- Accounts are invite-only.
- Account creation must use an approved invitation token or equivalent invitation flow.
- Users must sign in before accessing internal records.
- Signed-in users should retain access to signed-in navigation on internal versions of About and Legal pages.
- Session protection must prevent unauthorized access to internal API routes.
- The system must support sign out.

## 5.2 Dashboard

The dashboard must provide a central summary of the signed-in user's operational account. It should not display technical production-stage language.

The dashboard should show:

- Account/campus summary information.
- Aggregate counts of relevant records.
- Sports covered count rather than listing every sport in a crowded tile.
- Operational summaries.
- Useful navigation actions.

The dashboard should avoid duplicating the same account information in multiple sections. If information appears in the hero card, it should not be repeated lower down unless it serves a different purpose.

## 5.3 Athlete Management

The athlete module must support:

- Creating athletes.
- Editing athletes.
- Viewing athlete profiles.
- Assigning athletes to a team.
- Assigning athletes to a sport.
- Recording athlete type/status.
- Recording contact information.
- Recording student/academic information.
- Recording body information.
- Recording date of birth.
- Recording sex.
- Displaying derived age only on athlete view.
- Displaying initials as a placeholder if no headshot is uploaded.
- Displaying profile completeness.
- Filtering athletes by suitable fields.
- Preventing the full athlete list from automatically displaying without filtering.
- Supporting incomplete athlete record filters.
- Supporting recent searches.
- Supporting multi-select actions, especially assigning selected athletes to a team.
- Showing team and squad associations accurately.
- Linking athlete statistics to reports, leaderboards, score sheets, and detailed stat pages.

Athlete records should include, where applicable:

- Full name.
- First name.
- Last name.
- Email.
- Phone.
- Sport.
- Team.
- Squad/team group.
- Athlete type.
- Status.
- Position or event focus.
- Student ID.
- Faculty.
- Program.
- Year of study.
- Nationality.
- Hometown.
- Date of birth.
- Derived age.
- Sex.
- Height.
- Weight.
- Handedness.
- Dominant foot/leg.
- School or club.
- Profile completeness.
- Headshot or initials placeholder.

Age must be derived from date of birth. Users should not manually enter age.

## 5.4 Coach Management

The coach module must support:

- Creating coaches.
- Editing coaches.
- Viewing coach profiles.
- Assigning coaches to teams during create/edit workflows.
- Assigning coaches to teams from coach view where suitable.
- Displaying team/staff assignments accurately.
- Showing linked teams summary.
- Recording role, sport, contact, and status.
- Filtering/searching coaches.
- Showing profile completeness.
- Showing incomplete records.
- Avoiding duplicated team assignment display.
- Supporting recent searches.
- Archiving coaches instead of deleting them.

Coach assignment changes must propagate to:

- Coach registry.
- Coach view.
- Team staff roster.
- Team view.
- Reports.
- Audit logs.

## 5.5 Team Management

The team module must support:

- Creating teams.
- Editing teams.
- Viewing team pages.
- Assigning athletes to rosters.
- Assigning coaches/staff.
- Displaying team performance summary.
- Displaying recent results near the top of the team page.
- Showing team achievements.
- Showing leaderboards through a dedicated or accessible leaderboard page rather than overcrowding the team view.
- Filtering/searching teams.
- Supporting recent searches.
- Displaying profile/setup completeness.
- Archiving teams.

Team view must show:

- Hero summary.
- Important aggregate data.
- Team roster access.
- Staff roster access.
- Recent results.
- Achievements.
- Performance summary.
- Links to detailed sport-specific results and leaderboards.

Roster and staff lists should be accessible but not always expanded by default when doing so would make the page overwhelming.

## 5.6 Competition Management

The competition module must support:

- Creating competitions.
- Editing competitions.
- Viewing competition pages.
- Recording sport, dates, format, season, status, and related metadata.
- Showing compact competition metadata horizontally where possible.
- Supporting sport-specific score sheet entry from competition view.
- Showing recent results related only to that competition.
- Providing access to full results archive where applicable.
- Providing access to competition leaderboards.
- Filtering/searching competitions.
- Supporting recent searches.
- Showing profile/setup completeness.
- Archiving competitions.

Competition view should not show unrelated competition tabs in its recent results section. Competition-specific pages must focus on the competition being viewed.

Participants, recorded score sheet, and duplicate results sections that repeat other areas should be avoided if they create clutter. The competition page should prioritize:

- Competition summary.
- Recent results for that competition.
- Score sheet/result entry.
- Leaderboards access.
- Activity/history where useful.
- Relevant setup information.

## 5.7 Results & Score Sheet Management

The system must support sport-specific score sheet entry and viewing. Score sheets should resemble the logic of real sport scorebooks while adapting to digital workflows.

Score sheet workflows must:

- Be separate pages when the workflow is too large for competition view.
- Use roster-linked dropdowns for UWI athletes.
- Allow quick-add athletes only inside score/stat entry workflows where needed.
- Warn users that quick-added athletes require later profile completion.
- Allow opponent names to be entered or auto-filled where appropriate.
- Derive suitable totals where possible.
- Preserve user input against refresh/navigation loss.
- Save data in a way that propagates to athlete stats, team stats, competition stats, reports, and leaderboards.

Score sheet view pages must:

- Present saved score sheets in a readable view-only format.
- Show final result clearly in the hero area without squeezing it into a tiny tile.
- Link player names to appropriate athlete profiles or detailed sport stats.

## 5.8 Leaderboards

Leaderboards must exist for:

- Competition-level performance.
- Team-level performance.
- Sport-specific player rankings.

Leaderboards must:

- Be sortable by metric.
- Support highest-first and lowest-first order.
- Support competition filtering where relevant.
- Link player names to appropriate detailed athlete stat pages.
- Use metrics appropriate to the sport.
- Avoid being fully expanded on pages where it would make the page too long.

## 5.9 Reports

Reports must reflect data entered elsewhere on the platform. Reports must not be isolated from score sheets or profile data.

Reports must support:

- Athlete reports.
- Team reports.
- Coach reports.
- Competition reports.
- Sport-based report filtering.
- Team-based report filtering.
- Season filtering.
- Stat propagation from score sheets.
- Profile and completeness information.

Athlete reports must show all relevant entered athlete information and linked stats. Derived age should remain primarily a profile display item, while date of birth and other entered information may be included in reports.

## 5.10 Audit Logs

The platform must include a read-only audit log page for internal review.

Audit logs must track important backend actions, including:

- Account creation.
- Athlete creation/update/archive.
- Coach creation/update/archive.
- Team creation/update/archive.
- Competition creation/update/archive.
- Team roster assignment.
- Team staff assignment.
- Competition stat line and score sheet creation.
- Athlete stat line creation.
- Athlete personal best creation.
- Support request submission.

Audit logs must be:

- Read-only.
- Filterable by action.
- Filterable by record type.
- Filterable by record ID.
- Sorted by most recent.
- Automatically loaded on page open.

Audit logs are not intended to track every navigation click or frontend-only viewing action.

## 5.11 Support Requests

The support system must allow users to submit requests. The platform should clearly distinguish between saving a support request in the system and actually sending an email. If email delivery is expected, the backend must be connected to an email provider or SMTP service. Without that integration, a success message should not imply that an email was truly delivered externally.

---

## 6. Non-Functional Requirements

## 6.1 Usability

The platform must be clear, professional, and operationally efficient. It should reduce user friction rather than overwhelm users with every possible section expanded at once.

## 6.2 Performance

Pages should load efficiently for normal campus-scale datasets. Athlete lists may become large, so athlete registries should require meaningful filtering rather than displaying hundreds of records by default.

## 6.3 Reliability

The system must avoid data loss through:

- Unsaved-change warnings.
- Archive-only deletion behavior.
- Duplicate detection prompts.
- Validation warnings.
- Backend persistence for key workflows.

## 6.4 Security

The system must enforce authentication, campus scoping, input validation, rate limiting, and safe handling of secrets.

## 6.5 Maintainability

The platform should use consistent patterns for:

- API calls.
- Score sheet pages.
- Results archive pages.
- Detailed athlete stat pages.
- Leaderboard generation.
- Report generation.
- Audit logging.

---

## 7. Business Rules

### 7.1 Campus Scoping

All records are scoped to the signed-in account's campus. Users should not manually choose campus in normal workflows.

### 7.2 Archive Instead of Delete

Records with operational or historical value must be archived, not permanently deleted.

### 7.3 No Hidden Development Language

The UI must not mention development stage, backend state, production readiness, or technical scaffolding.

### 7.4 Duplicate Detection

The system should warn users when similar records already exist.

For athletes, teams, coaches, and competitions, duplicate detection should consider:

- Name similarity.
- Sport.
- Team.
- Relevant dates.
- Existing campus context, internally.

Warnings should avoid mentioning campus to the user.

### 7.5 Quick Add Athlete

Quick add is allowed inside stat and score sheet workflows only. It must collect:

- First name.
- Last name.

The system should automatically assign the quick-added athlete to the relevant team and sport, and warn the user that the profile must be completed later.

### 7.6 Editing Data That Affects Reports

When edits affect reports, standings, leaderboards, or historical records, the user should receive a warning.

### 7.7 Validation

The system must enforce hard validation for impossible or malformed input and soft warnings for unusual but possible values.

### 7.8 Refresh Protection

Long score sheet workflows must warn users before leaving with unsaved changes.

### 7.9 Recent Searches

Search-heavy pages should support recent searches to reduce repeated filtering effort.

---

## 8. Sport-by-Sport Requirements

The platform must support sport-specific stats and score entry. Each sport should use the real logic of the sport rather than forcing all sports into a generic stat model.

## 8.1 Cricket

Cricket is one of the deepest systems and serves as a reference standard.

Requirements:

- Dedicated cricket scorecard entry page.
- Dedicated cricket scorecard view page.
- Support up to four innings.
- Support starting XI selection.
- UWI players selected from roster dropdowns.
- Opponent players may be auto-filled and editable.
- Batting scorecard with runs, balls, 4s, 6s, strike rate, dismissal, fielder, bowler.
- Bowling scorecard with overs, maidens, runs, wickets, economy.
- Fall of wickets manually entered.
- Did-not-bat derived.
- Declarations supported.
- Team targets derived only when valid.
- Run rate, strike rate, result, and other totals derived.
- Catches credited to fielders.
- Wickets credited to bowlers where appropriate.
- Detailed cricket athlete stats by format.
- Format classification: T20, 40-over, 50-over, 3-day, other.
- Batting aggregate rows with matches, innings, runs, 30s, 50s, 100s, high score, average, strike rate.
- Bowling aggregate rows with wickets, average, strike rate, economy, best figures.
- Fielding aggregate stats.
- Competition and team cricket leaderboards.
- Results archive.

## 8.2 Football

Football must support:

- Dedicated football match sheet.
- Dedicated football match detail view.
- Team and opponent score.
- Match stats such as goals, assists, shots, shots on target, possession, fouls, corners, free kicks, passes completed, crosses, interceptions, tackles, saves, cards, and minutes.
- Goalscorers and minutes.
- Player-linked UWI stat rows.
- Detailed athlete football stats.
- Personal bests such as most goals in a match, most assists in a match, most saves in a match, highest scoring season, highest assisting season.
- Team and competition leaderboards.
- Results archive with match cards.
- Recent results adapted to football.

## 8.3 Track and Field

Track and field must support separate workflows for:

- Track event results.
- Field event results.

Track requirements:

- Event name/number.
- Heat, semi-final, final designation.
- Time.
- Wind where applicable.
- Lane/bib/athlete.
- Rank/place.
- Points.
- Records.

Field requirements:

- Throws/jumps attempts.
- Best marks.
- Ranks.
- Final ranks.
- Fouls/no marks where applicable.
- Points.

The system must support:

- Detailed athlete track and field stats.
- Separate track and field summaries.
- Personal bests.
- Results archive.
- Team and competition leaderboards.

## 8.4 Basketball

Basketball must now match the depth expected of cricket, football, and track and field.

Requirements:

- Dedicated basketball score sheet entry page.
- Dedicated basketball score sheet view page.
- Dedicated basketball results archive.
- Dedicated detailed athlete basketball stats page.
- UWI roster-linked player rows.
- Quick add athlete support inside score sheet workflow.
- Quarter scoring: Q1, Q2, Q3, Q4, overtime.
- Team totals.
- Opponent totals.
- Result derivation.
- Player stats including points, fouls, quarter points, 2PM, 3PM, free throws made, rebounds, assists, steals, blocks, turnovers, minutes.
- Team-level summaries.
- Possession sequence.
- Time-out and warning fields.
- Player stat propagation to athlete view, athlete detailed stats, reports, team view, competition view, and leaderboards.
- Leaderboards for points, points per game, rebounds, rebounds per game, assists, assists per game, steals, blocks, turnovers, assist-to-turnover ratio, and 3PM.
- Results cards showing score, outcome, top scorers/rebounders/assist leaders where available.

## 8.5 Volleyball

Volleyball must support:

- Dedicated volleyball scoresheet.
- Team and opponent details.
- Set number and final score.
- Serve order.
- Libero.
- First serve.
- Time-outs.
- Substitutions.
- Comments.
- Player-linked UWI rows where applicable.
- Results view.

## 8.6 Hockey

Hockey must support:

- Dedicated hockey score sheet.
- Home and visiting scoring.
- Period scoring.
- Goals.
- Assists.
- Penalties.
- Final score.
- Player-linked UWI stats where applicable.

## 8.7 Swimming

Swimming must support:

- Results sheet workflow.
- Event/session details.
- Lane.
- Athlete.
- Year/group.
- School/team.
- Seed time.
- Finals time.
- DQ/exhibition indicators.
- Points/rank where applicable.
- Athlete stat propagation.

## 8.8 Netball

Netball must support a refined scoresheet model rather than simply copying a generic sheet.

Requirements:

- Match metadata.
- Team and opponent.
- Quarter scoring.
- Shooting positions and scoring.
- Player positions.
- Substitution/rotation tracking where suitable.
- Goals, attempts, shooting percentage where suitable.
- Interceptions/turnovers where suitable.
- Player-linked UWI stats.

## 8.9 Badminton

Badminton must support:

- Singles and doubles mode.
- Player selection that adapts to singles or doubles.
- Sets/games scoring.
- Match winner.
- Court, date, umpire/service judge where applicable.
- UWI athlete links.
- Opponent entry.

## 8.10 Table Tennis

Table tennis must support:

- Singles and doubles/pairing style entries.
- Rubbers.
- Games.
- Points.
- Team match totals.
- Winning team.
- Player/pairing linkage where applicable.

## 8.11 Lawn Tennis

Tennis must support:

- Singles and doubles sections.
- Sets.
- Match winner.
- Date, time, place, weather, court conditions.
- Player and opponent records.
- Team totals where applicable.

## 8.12 Taekwondo

Taekwondo must support:

- Judge score sheet logic.
- Category and sub-category.
- Accuracy.
- Presentation.
- Deductions.
- Total score.
- Judge metadata.
- Athlete/event linkage.

## 8.13 Chess

Chess must support:

- Chess score sheet.
- Event, date, round, board, section, opening.
- White and black player.
- Time control.
- Move log.
- Result: white won, black won, draw.
- Duration.
- Player linkage where applicable.

---

## 9. UI/UX Requirements

The platform should feel professional, calm, and operational. It should not feel childish, cartoonish, overly colorful, or cluttered.

UI principles:

- Use campus color theming without overwhelming the page.
- Navbar uses campus color with a controlled professional effect.
- Active navigation item is indicated with an underline rather than a heavy filled pill.
- Buttons are black or campus-appropriate with white text where suitable.
- Text weights should avoid overly heavy 700/900 styling.
- Hero cards should not contain excessive pills or performative tiles.
- Tiles should show important statistical or aggregate data only.
- Operational alerts, recent activity, and setup quality sections should be present but subtle.
- Large forms should be hidden behind clear actions until needed.
- Lists should be filter/search-driven and not always expanded.
- Footer should stick to the bottom on short pages.
- Score sheet workflows should have enough space and not be squeezed into competition view.

---

## 10. Security & Access Requirements

Security requirements include:

- Authenticated access for internal pages.
- Role-aware protected routes.
- Manager-only write routes where appropriate.
- Rate limiting on endpoints.
- Stricter rate limiting on authentication routes.
- Request payload size limits.
- Malformed JSON rejection.
- Input sanitization.
- Protection against prototype pollution keys.
- Maximum nesting depth for submitted objects.
- Maximum string lengths.
- Maximum array lengths.
- No hardcoded secrets in committed frontend code.
- Supabase secret/service keys must remain server-side only.
- Database password must remain in backend environment variables.
- Invitation code must be treated as sensitive and rotated if exposed.
- Audit logs for important changes.
- Archive-only record removal.

---

## 11. Data Management Requirements

The platform must maintain relational consistency between:

- Athletes.
- Coaches.
- Teams.
- Competitions.
- Team roster assignments.
- Team staff assignments.
- Competition stat lines.
- Athlete stat lines.
- Personal bests.
- Reports.
- Leaderboards.
- Audit logs.

Data entered once should propagate wherever relevant.

Examples:

- Assigning an athlete to a team should show on athlete view, team roster, reports, and filters.
- Assigning a coach to a team should show on coach view, coach registry, team staff roster, and reports.
- Entering a basketball score sheet should update player basketball stats, team recent results, competition recent results, leaderboards, reports, and score sheet archive.
- Entering cricket catches should update the fielder's personal fielding stats.

---

## 12. System Constraints & Assumptions

Key assumptions:

- The system is campus-scoped.
- The main device is likely a laptop or desktop.
- Mobile should remain usable, but operational users are expected to use larger screens for complex workflows.
- Historical stats are considered from 2026 onwards.
- Some opponent data may be optional because the platform primarily values UWI records.
- Email delivery requires an external email provider; saving a support request alone does not guarantee email delivery.
- Some records entered before newer features existed may not have complete audit logs or linked stats unless migrated/backfilled.

---

## 13. Future Scope & Expansion

Future enhancements may include:

- Full role-based permission tiers.
- Advanced import/export.
- CSV upload.
- Document attachments.
- Headshot uploads.
- Advanced analytics dashboards.
- Automated standings.
- Sport-specific charts.
- Notification system.
- Email integration for support requests.
- Version history.
- Concurrent editing lock indicators.
- More advanced duplicate detection using fuzzy matching.
- Bulk editing beyond team assignment.
- Historical data import from spreadsheets or paper records.

---

## 14. Risks & Mitigation

### Risk: Data entered but not propagated

Mitigation:

- Centralize stat expansion logic.
- Test each sport workflow end-to-end.
- Validate reports against score sheet entries.

### Risk: Duplicate records

Mitigation:

- Duplicate detection warnings.
- Use Existing / Create Anyway / Edit Existing / Cancel options.

### Risk: Accidental data loss

Mitigation:

- Archive instead of delete.
- Unsaved changes warnings.
- Confirmation prompts.

### Risk: Oversized or malformed payloads

Mitigation:

- Backend payload limits.
- Input sanitization.
- Validation rules.

### Risk: Sensitive keys exposed

Mitigation:

- Move secrets to environment variables.
- Keep service keys backend-only.
- Rotate exposed credentials.

### Risk: Pages becoming overwhelming

Mitigation:

- Hide long workflows until requested.
- Use collapsible sections.
- Move detailed stats and leaderboards to dedicated pages.

### Risk: Old records lacking newer metadata

Mitigation:

- Profile completeness indicators.
- Incomplete record filters.
- Edit workflows.
- Optional backfill/migration.

---

## 15. Master Requirement Summary

UWI Sports Hub must operate as a complete internal sports database and management platform. It must support structured records, sport-specific score entry, linked statistics, reports, leaderboards, results archives, audit logs, archive-only deletion, secure access, campus scoping, and a professional user experience.

The platform must prioritize data integrity, operational clarity, and sport-specific accuracy. Each sport should receive workflows that respect the way that sport is actually recorded. Pages should avoid clutter while still providing meaningful summaries, search, and access to detailed information.

The system is not merely a collection of forms. It is an interconnected sports operations platform where every major data entry should have a meaningful effect across the athlete, coach, team, competition, report, result, leaderboard, and audit experiences.

---

## 16. Detailed Entity Requirements

## 16.1 Athlete Entity Requirements

Athlete records are one of the central entities in the platform. The athlete entity must be capable of supporting administrative identity, contact records, academic context, body profile, sport context, team membership, score-sheet linkage, performance reporting, and profile completeness.

The athlete record must support:

- Personal identity fields.
- Contact information.
- Academic/institutional information.
- Sport and team assignment.
- Squad/team-group information.
- Body and physical attributes.
- Date of birth.
- Sex.
- Derived age.
- Headshot or initials placeholder.
- Roster metadata.
- Stat and result linkage.
- Report display.
- Archive status.

An athlete should never be treated as only a name in a score sheet. If a UWI athlete appears in a UWI score sheet, that athlete should be linked to an existing athlete record wherever possible. This is why UWI score sheet workflows use dropdowns for roster players instead of free text.

If an athlete is quick-added during a score sheet workflow, the system must create a minimal athlete record, assign the athlete to the relevant team and sport, and flag the athlete as incomplete until the full profile is completed.

## 16.2 Coach Entity Requirements

Coach records must support both identity management and operational assignment management. A coach may have one or more team assignments, but duplicate display of the same assignment must be avoided.

Coach records must support:

- Name.
- Role/title.
- Sport.
- Team assignment.
- Contact information.
- Status.
- Profile completeness.
- Linked team display.
- Staff roster display.
- Reports.
- Archive status.

If a coach is assigned to a team, that assignment must appear on the coach page, team page, coach registry, and reports. If the coach is edited, assignment information must remain consistent.

## 16.3 Team Entity Requirements

Teams are operational containers for athletes, coaches, results, and leaderboards. A team record must not only store a team name; it must provide the context needed for roster management, staff management, results review, and performance summaries.

Team records must support:

- Team name.
- Sport.
- Status.
- Season or active period where applicable.
- Roster.
- Staff assignments.
- Recent results.
- Achievements.
- Leaderboards.
- Team report data.
- Archive status.

The team view should prioritize information that supports operational decisions. Recent results and performance summaries should appear near the top because they are typically more important than secondary metadata.

## 16.4 Competition Entity Requirements

Competitions are the primary containers for sport-specific score sheets and results. A competition may include matches, events, fixtures, score sheets, result sheets, and stat lines depending on the sport.

Competition records must support:

- Name/title.
- Sport.
- Season.
- Start and end dates.
- Format.
- Status.
- Score sheet entry.
- Recent results.
- Results archive access.
- Leaderboard access.
- Competition report data.
- Archive status.

Competition pages must avoid showing unrelated competition filters in competition-specific result sections. A competition view focuses on the selected competition only.

---

## 17. Detailed Record Completeness Requirements

The platform must help users identify incomplete records. Profile completeness should be shown for athletes, coaches, teams, and competitions where suitable.

Profile completeness should consider the fields that matter for the entity type. For example:

Athlete completeness may consider:

- Name.
- Sport.
- Team.
- Status.
- Contact information.
- Date of birth.
- Sex.
- Faculty/program.
- Body data.
- Position/event focus.

Coach completeness may consider:

- Name.
- Sport.
- Role.
- Team assignment.
- Contact information.
- Status.

Team completeness may consider:

- Name.
- Sport.
- Status.
- Roster presence.
- Staff assignment.

Competition completeness may consider:

- Name.
- Sport.
- Dates.
- Format.
- Status.
- Result/score sheet presence where applicable.

Completeness indicators must be helpful without becoming visual clutter. Small circular completeness graphics are appropriate in registries, while fuller completeness context may appear on detail pages.

---

## 18. Detailed Search and Filter Requirements

Search and filter behavior must be consistent across registry and archive pages.

General rules:

- Search results should not appear immediately just because a filter changed.
- The user should choose filters and then click Search.
- Recent searches should be available on search-heavy pages.
- Search buttons should be appropriately sized and should not stretch unnecessarily on desktop.
- Filters should be compact enough to fit in one row where practical on laptop screens.

Athlete-specific rule:

- The system should not display the full athlete list by default.
- The user should apply at least one meaningful narrowing filter, preferably sport.
- This rule exists because athlete records may scale to hundreds of records.

Coach, team, and competition searches:

- Users may click Search with no filters to see all active records.
- This is acceptable because these datasets are expected to be smaller than athlete records.

---

## 19. Detailed Reporting Requirements

Reports must serve as a reliable output layer for the database. A report should not merely repeat profile cards; it should combine relevant information from multiple parts of the platform.

Athlete reports must include:

- Identity information.
- Contact information.
- DOB and sex.
- Academic context.
- Sport/team/squad context.
- Body profile.
- Linked stat rows.
- Best performances.
- Competition history.

Team reports must include:

- Team identity.
- Sport.
- Roster summary.
- Staff summary.
- Recent results.
- Leaderboard context.
- Competition participation.

Coach reports must include:

- Identity.
- Role.
- Sport.
- Team assignments.
- Contact information.
- Assignment history where available.

Competition reports must include:

- Competition identity.
- Sport.
- Dates/format.
- Results.
- Score sheet/stat line summary.
- Leaderboard access or summary.

Reports must respect filters such as season, sport, team, and competition where applicable.

---

## 20. Detailed Audit Requirements

Audit logging exists to support internal accountability and operational review. It is not intended to track every page view, but it must track important changes.

Audit logs must record:

- Who performed the action.
- What action was performed.
- Which record type was affected.
- Which record ID was affected.
- A readable summary.
- Relevant metadata.
- Timestamp.

Audited actions include:

- Athlete create/update/archive.
- Coach create/update/archive.
- Team create/update/archive.
- Competition create/update/archive.
- Roster assignment.
- Staff assignment.
- Score sheet/stat line creation.
- Personal best creation.
- Support request submission.
- Account creation.

Audit logs should help answer operational questions such as:

- Who created this athlete?
- When was this coach updated?
- Who entered this score sheet?
- When was this team assignment saved?
- Which support requests were submitted?

---

## 21. Detailed Archive Requirements

Archive behavior protects historical data.

Archived records:

- Should not appear in normal active lists.
- Should remain retrievable through archived searches where suitable.
- Should remain available for historical reports if linked to past stats.
- Should not break score sheets, results, or audit history.

Permanent deletion is outside the normal user workflow. If permanent deletion is ever added, it should be restricted to exceptional administrative maintenance and must include backups and confirmations.

---

## 22. Detailed Sport Depth Standard

The depth standard established by cricket, football, basketball, and track and field should guide all sports.

For a sport to be considered fully implemented, it should ideally have:

- Sport-specific score/result entry.
- Sport-specific score/result view.
- Proper UWI athlete linkage.
- Results archive where the sport uses match/event results.
- Detailed athlete stat page where repeated stats are meaningful.
- Team leaderboard support.
- Competition leaderboard support.
- Report propagation.
- Recent results support.
- Appropriate derived stats.

Not every sport requires the exact same level of statistical complexity, but every sport should be modeled according to the real logic of the sport.
