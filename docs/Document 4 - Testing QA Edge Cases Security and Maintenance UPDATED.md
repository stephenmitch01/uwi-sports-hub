# UWI Sports Hub (USH)
# Testing, QA, Edge Cases, Security & Maintenance
# UPDATED DOCUMENT

## 1. Full Testing Strategy

UWI Sports Hub must be tested as an interconnected operations platform rather than a set of isolated pages. A change made in one area must be verified wherever that data appears.

Testing must cover:

- Authentication and session persistence.
- Athlete creation, editing, filtering, viewing, reporting, and stat propagation.
- Coach creation, editing, assignment, viewing, and reporting.
- Team creation, roster/staff assignment, viewing, recent results, achievements, and leaderboards.
- Competition creation, editing, score sheet entry, results display, and leaderboard access.
- Sport-specific score sheets.
- Results archives.
- Detailed athlete stat pages.
- Reports.
- Audit logs.
- Archive behavior.
- Security middleware.

## 2. Workflow Testing Checklists

### Athlete Workflow

- Create athlete with all fields.
- Confirm DOB is saved.
- Confirm age is derived on athlete view only.
- Confirm Sex filter works.
- Confirm initials placeholder appears without headshot.
- Confirm team/squad association displays correctly.
- Confirm report includes entered athlete info.
- Confirm stats entered through score sheets appear in detailed stats and reports.

### Coach Workflow

- Create coach.
- Assign coach to team during create/edit.
- Confirm coach registry shows correct assignment once.
- Confirm coach view shows linked team.
- Confirm team staff roster shows coach.

### Team Workflow

- Create team.
- Assign multiple athletes.
- Confirm all appear in roster.
- Assign staff.
- Confirm recent results update after score sheet entry.
- Confirm team leaderboard aggregates sport-specific stats.

### Competition Workflow

- Create competition.
- Open competition view.
- Enter sport-specific score sheet.
- Confirm recent result appears.
- Confirm archive page includes result.
- Confirm leaderboard uses saved player stats.

## 3. Cross-Page Testing

Every write action must be checked across related pages.

Examples:

- Athlete team assignment must appear on athlete view, team roster, athlete report, and score sheet dropdowns.
- Coach assignment must appear on coach view, coach registry, team view, and reports.
- Basketball score sheet must appear in basketball results, competition recent results, team recent results, athlete basketball stats, reports, and leaderboards.
- Cricket catch must appear in fielding stats.

## 4. Competition/Stat Propagation Testing

Sport score sheets must be tested end-to-end:

- Cricket: batting, bowling, fielding, catches, wickets, formats, scorecard view, results archive.
- Football: goals, assists, saves, cards, match details, football stats, leaderboards.
- Basketball: points, rebounds, assists, steals, blocks, turnovers, 3PM, score sheet view, results archive, detailed stats.
- Track and field: track results, field results, ranks, points, personal bests, archive.

## 5. Data Integrity Testing

Test:

- Duplicate warnings.
- Archive visibility.
- Incomplete record filters.
- Profile completeness calculations.
- Recent searches.
- Search button behavior.
- Team/coach/athlete assignment consistency.
- Report completeness.

## 6. Edge Cases & Safeguards

The system must handle:

- Duplicate names.
- Similar competition names and dates.
- Athletes with no headshot.
- Athletes with missing DOB or sex.
- Coaches assigned to one team but displaying multiple times.
- Athletes assigned to a team but showing no squad.
- Score sheets with partial opponent data.
- Long score sheets.
- Refresh during unsaved entry.
- Multiple admins editing records.

## 7. Duplicate Detection Systems

Duplicate detection should prompt users when similar records exist.

Options:

- Use Existing.
- Create Anyway.
- Edit Existing.
- Cancel.

Competition duplicate detection should use name, teams, sport, and date.

## 8. Validation Rules

Validation should include:

- Required names.
- Required sport/team where context requires it.
- Valid email format.
- Valid date format.
- Reasonable numeric limits.
- Payload shape validation.
- Sport-specific unrealistic value warnings.

Hard validation blocks impossible values. Soft warnings allow unusual but possible values.

## 9. Error Handling

Errors must be clear and actionable. Backend errors should not expose sensitive internals in production. Frontend errors should preserve user progress where possible.

## 10. Security Assumptions

The platform is internal and authenticated. All internal endpoints must require a valid session. Manager-only write routes must enforce permission checks.

## 11. Authentication & Session Protection

Test:

- Login success.
- Login failure.
- Rate limit after repeated failed attempts.
- Session cookie presence.
- Protected route access.
- Sign out.
- Unauthorized API responses.

## 12. Backup Assumptions

Database backup should be handled by the hosting/database provider. The application should avoid permanent deletion through archive-only behavior.

## 13. Logging/Audit Recommendations

Audit logs should record important backend write actions. The audit page should auto-load recent logs and support filters.

Audit logs should include:

- Actor.
- Action.
- Entity type.
- Entity ID.
- Summary.
- Timestamp.
- Relevant metadata.

## 14. Deployment Expectations

Deployment should keep frontend and backend environment variables separate. Secrets must never be committed to frontend code.

## 15. Maintenance Expectations

Maintenance includes:

- Reviewing audit logs.
- Checking reports for propagation issues.
- Updating sport-specific stat logic.
- Rotating exposed credentials.
- Reviewing dependencies.
- Testing migrations.

## 16. Technical Risks

Risks include:

- Stats not propagating across pages.
- Archived records appearing in active lists.
- Duplicate records splitting stats.
- Large score sheet payloads.
- Missing environment variables.
- Email support requests being saved but not delivered externally.

## 17. Future Hardening Recommendations

Recommended hardening:

- More advanced role permissions.
- Server-side schema validation library.
- Version history.
- Edit locking.
- Automated test suite.
- Email provider integration.
- File upload validation for headshots.
- More advanced audit log export.

## 18. Independent Code Review Process

Independent review should verify:

- Security controls.
- Data propagation.
- API consistency.
- UI consistency.
- Sport-specific correctness.
- Edge case coverage.
- Deployment readiness.

## 19. Uncle Testing Phase Structure

Testing by non-developer users should focus on real workflows:

- Create athlete.
- Assign team.
- Enter score sheet.
- View result.
- Check athlete stats.
- Check team page.
- Generate report.
- Review audit log.

Feedback should be recorded as practical issue notes and converted into fixes.

---

## 20. Detailed Sport-Specific QA Matrix

## 20.1 Cricket QA

Cricket testing must verify:

- Starting XI selection controls all UWI player dropdowns.
- Opponent names can be autofilled and edited.
- Up to four innings can be entered.
- Did-not-bat derives correctly.
- Fall of wickets remains manual.
- Declarations are supported.
- Target logic works correctly for two-innings and multi-innings matches.
- Batting strike rate derives correctly.
- Bowling economy derives correctly.
- Wickets are credited correctly.
- Catches are credited to fielders.
- Detailed cricket stats classify formats correctly: T20, 40-over, 50-over, 3-day, other.
- 30s, 50s, and 100s show in separate columns.
- Scorecard view matches saved entry.
- Reports include cricket stats.

## 20.2 Football QA

Football testing must verify:

- Match score saves correctly.
- Goalscorers and minutes display.
- Player stats propagate to athlete football stats.
- Goals, assists, saves, cards, shots, tackles, and interceptions aggregate correctly.
- Personal bests show achievements, not raw stat event rows.
- Match log remains accessible but not always expanded.
- Results archive filters by season, outcome, and opponent.
- Team and competition leaderboards aggregate football score sheets.

## 20.3 Basketball QA

Basketball testing must verify:

- UWI team selection filters roster.
- Roster dropdowns link to athlete records.
- Quick add athlete assigns sport and team.
- Quarter scores calculate totals.
- Overtime is included.
- Result derives correctly.
- Player points derive from quarter scoring.
- Rebounds, assists, steals, blocks, turnovers, fouls, 3PM, 2PM, FTM, and minutes save.
- Detailed basketball stats show PPG, RPG, APG, AST/TO, and core totals.
- Results archive shows score and top performers.
- Basketball leaderboards work on team, competition, and global leaderboard pages.

## 20.4 Track and Field QA

Track and field testing must verify:

- User can choose track or field results workflow.
- Track times save correctly.
- Wind values save where relevant.
- Heat/final information saves.
- Field attempts save correctly.
- Best mark and rank derive or save correctly.
- Points aggregate.
- Athlete detailed track and field stats display correctly.
- Results archive includes saved events.

## 20.5 Other Sports QA

Other sport workflows must be tested for correct entry, view, athlete linkage, and report propagation.

Sports include:

- Volleyball.
- Hockey.
- Swimming.
- Netball.
- Badminton.
- Table tennis.
- Tennis.
- Taekwondo.
- Chess.

Each sport must be tested against its real scoring logic.

---

## 21. Detailed Security QA

Security testing must verify:

- Protected routes reject unauthenticated users.
- Manager-only routes reject users without permission.
- Auth routes rate-limit failed attempts.
- General API routes rate-limit repeated requests.
- Oversized payloads are rejected.
- Malformed JSON is rejected.
- Deeply nested payloads are rejected.
- Payloads with too many keys are rejected.
- Overly long strings are rejected.
- Prototype pollution keys are ignored.
- Secrets are not bundled into frontend files.
- `.env` is not committed.

If secrets were ever committed, rotate:

- Supabase service/secret key.
- Supabase database password.
- Invite code.

---

## 22. Detailed Audit Log Testing

Audit log testing must verify that the following actions produce logs:

- Account creation.
- Athlete create.
- Athlete update.
- Athlete archive.
- Coach create.
- Coach update.
- Coach archive.
- Team create.
- Team update.
- Team archive.
- Competition create.
- Competition update.
- Competition archive.
- Roster assignment save.
- Staff assignment save.
- Score sheet/stat line creation.
- Athlete stat line creation.
- Personal best creation.
- Support request submission.

The audit page must:

- Auto-load recent logs.
- Filter by action.
- Filter by entity type.
- Filter by entity ID.
- Sort newest first.
- Display actor information.

Actions performed before audit logging existed cannot appear unless backfilled.

---

## 23. Detailed Report QA

Report testing must verify:

- Athlete report includes all entered identity fields.
- Athlete report includes DOB and sex.
- Athlete report includes team/squad context.
- Athlete report includes body data.
- Athlete report includes linked stats.
- Team report includes roster and staff.
- Team report includes score sheet-derived stats.
- Competition report includes results and stat lines.
- Coach report includes team assignment.

Any stat entered through a score sheet must be traceable in reports if it belongs there.

---

## 24. Detailed Archive QA

Archive testing must verify:

- Archived athletes disappear from active athlete searches.
- Archived coaches disappear from active coach searches.
- Archived teams disappear from active team searches.
- Archived competitions disappear from active competition searches.
- Archived records can be found when archived search is selected.
- Linked historical stats do not break.
- Audit log records archive action.

---

## 25. Detailed Duplicate Detection QA

Duplicate detection testing must verify:

- Similar athlete names trigger warning.
- Similar coach names trigger warning.
- Similar team names trigger warning.
- Similar competition names/dates trigger warning.
- User can use existing record.
- User can create anyway.
- User can edit existing.
- User can cancel.

Warnings should not mention campus because campus is implied by the signed-in account.

---

## 26. Detailed Data Propagation QA

Data propagation must be tested in chains.

Example basketball chain:

1. Create basketball athlete.
2. Assign athlete to basketball team.
3. Create basketball competition.
4. Enter basketball score sheet.
5. Open athlete view.
6. Open detailed basketball stats.
7. Open team view.
8. Open team leaderboard.
9. Open competition view.
10. Open competition leaderboard.
11. Open basketball results archive.
12. Generate athlete report.
13. Verify audit log.

Every major sport should have an equivalent test chain.

---

## 27. Maintenance Checklist

Regular maintenance should include:

- Review audit logs.
- Review incomplete records.
- Check archived records.
- Test sign-in.
- Test one score sheet per major sport.
- Run syntax checks after frontend changes.
- Run Prisma validation after schema changes.
- Review dependency audit.
- Confirm environment variables.
- Confirm support request behavior.
- Back up database before major migrations.

---

## 28. Known Limitations and Mitigation

Potential limitations:

- Old records may not include newer fields.
- Audit logs do not exist retroactively.
- Email support requires external provider integration.
- Some sport systems may be less detailed than cricket/football/basketball/track until further refined.
- JSON data flexibility can create multiple equivalent field names.

Mitigation:

- Use defensive field resolution.
- Provide edit workflows.
- Use profile completeness.
- Add backfill scripts where necessary.
- Continue sport-by-sport QA.
