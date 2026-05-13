# UWI Sports Hub (USH)
# UI/UX, Frontend Design System & User Experience
# UPDATED DOCUMENT

## 1. Public vs Signed-In Experience

UWI Sports Hub has two distinct user experiences: public access and signed-in internal access.

The public experience exists for sign in, invite-only account creation, and institutional explanation. It must be simple, professional, and clear. It should explain the platform without sounding like a marketing website or exposing backend/project-stage language.

The signed-in experience is the main operational system. It must provide persistent navigation to dashboard, athletes, coaches, teams, competitions, reports, audit logs, support, and account-level utility pages. Signed-in users should not lose internal navigation when opening About or Legal pages.

## 2. Full Page-by-Page UI Breakdown

### Homepage / Sign In

The homepage should explain the platform once, clearly, and avoid excessive pills or repeated tiles. The sign-in card should remain prominent. The explanatory hero content should use available space well and should not feel empty.

### Dashboard

The dashboard should summarize the signed-in account and operational state. The hero card should contain meaningful account and data summaries, not backend terms such as scope, retention, production status, or readiness. Duplicate account summary sections should be removed.

### Athletes

The athlete registry should be filter-first. A full list of all athletes should not automatically display because a campus may have hundreds of athletes. Users must apply at least one narrowing filter, preferably sport. The filter field should use Sex rather than Age/Gender. Age should only appear on athlete view and should be derived from date of birth.

Athlete create and edit workflows should open only when requested. The page should support recent searches, incomplete record filtering, profile completeness indicators, and multi-select actions such as assigning athletes to a team.

### Athlete View

Athlete view should show the athlete's profile, body information, athlete information, team/squad associations, personal bests, detailed stat access, and profile completeness. If no headshot exists, initials should display as a placeholder. The edit action should appear in the hero card and should not be duplicated lower on the page.

### Coaches

Coach registry should not have duplicate registry sections. Filters and search should live in one coherent registry area. Coach create/edit workflows should include team assignment. Registry overview should be compact and useful.

### Coach View

Coach view should show profile details, linked teams, staff assignments, profile completeness, and an edit action in the hero card. Team assignments must display accurately.

### Teams

Teams page should provide a useful registry and search experience without overwhelming the user. Team view should prioritize hero summary, performance summary, recent results, achievements, and access to rosters/staff. Roster and staff lists should be accessible but not always expanded if that causes clutter.

### Competitions

Competition pages should provide compact metadata, recent results for the specific competition, score sheet entry access, leaderboard access, and relevant activity. Repeated sections such as duplicate results or recorded score sheets should be removed when they overlap with recent results or archive pages.

### Reports

Reports should support filtered report generation. Report output must reflect the data entered elsewhere on the platform, including athlete info, team assignments, coach assignments, score sheets, and sport-specific stats.

### Audit Logs

Audit logs should be read-only, filterable, and automatically load recent records. The page should be useful for internal review without feeling like a developer console.

### Sport-Specific Pages

Large sport workflows such as cricket, football, basketball, and track and field should use dedicated pages. Score sheet view pages should clearly show the final result in the hero section, with player names linked to suitable athlete stat pages.

## 3. Navigation Architecture

The signed-in navigation must include the key operational areas:

- Dashboard.
- Athletes.
- Coaches.
- Teams.
- Competitions.
- Reports.
- Audit Logs.
- Support.
- Sign out.

The active nav item should use a clear underline rather than a heavy filled button. Navbar text should be readable, slightly larger than earlier versions, and consistent in weight with button text.

## 4. Campus-Specific Theming

Campus theming should differentiate accounts without creating visual noise. The navbar should use the campus color with a controlled professional finish. The campus pill should have a black background. Page backgrounds may use a very subtle campus tint, but not enough to distract from content.

Cave Hill should avoid overly bright or dirty yellow. Yellow should be used carefully, with sufficient contrast and only where it supports the campus identity.

## 5. Utility Bar, Navbar, and Footer Standards

The utility bar should show product identity and user/session context. About and Legal links should remain available.

The navbar should:

- Use current navigation content.
- Use campus color.
- Avoid transparency.
- Use active underline styling.
- Keep text weight consistent.

The footer should:

- Remain at the bottom on short pages.
- Avoid leaving empty space beneath it.
- Provide simple product identity and links.

## 6. Layout Principles

Pages should avoid two extremes: overcrowding and emptiness. The user should see enough meaningful content to understand the page, but long workflows and long lists should be hidden behind actions, details sections, or dedicated pages.

Important information should appear near the top. Recent results and performance summaries should not be buried below less important metadata.

## 7. Tables, Forms, Cards, Buttons, and Modals

Tables should be used for registry lists, reports, stat logs, and leaderboards. They should include profile completeness where suitable.

Forms should be organized into clear sections and should not be permanently visible unless they are the primary purpose of the page.

Cards should be used for meaningful grouped content, not decorative clutter.

Buttons should use consistent black/campus styling with white text where suitable. Text weight should match the preferred button style seen on the dashboard Manage Athletes button.

Confirmation prompts should be used for major actions, edits that affect reports, archive operations, and duplicate detection choices.

## 8. Empty States

Empty states should explain what is missing and what the user can do next. They should not imply development incompleteness. Avoid language such as "will appear here once added" if data should already exist and the issue might be linking.

## 9. Error Messaging

Error messages should be plain and actionable. They should avoid raw technical stack traces. API errors should tell the user what went wrong and what to correct.

## 10. Confirmation Prompts

Prompts are required for:

- Duplicate records.
- Archive actions.
- Edits affecting reports/standings.
- Unsaved score sheet data.
- Quick-add athlete notices.

## 11. Loading States

Pages should show loading or disabled states during API requests. Buttons should not allow duplicate submissions while saving.

## 12. First-Time User Experience

The system should guide new users by providing clear labels, helpful empty states, and obvious actions. It should not require knowledge of the database structure.

## 13. Learnability & Ease-of-Use Principles

The user should understand where to:

- Add athletes.
- Assign athletes to teams.
- Assign coaches.
- Enter score sheets.
- View results.
- Open leaderboards.
- Generate reports.
- Review audit logs.

Sport-specific workflows should resemble familiar paper score sheets while taking advantage of digital automation and linking.

## 14. Accessibility Considerations

The UI should maintain adequate contrast, avoid yellow text on white backgrounds, use readable font sizes, provide labels for form fields, and ensure buttons have visible text.

## 15. User Friction Prevention

Friction prevention includes:

- Recent searches.
- Filter-first registries.
- Quick-add athlete inside score workflows.
- Unsaved-change warnings.
- Derived totals.
- Roster-linked dropdowns.
- Profile completeness indicators.

## 16. Design Consistency Rules

The system should maintain consistent:

- Button styling.
- Navbar styling.
- Hero card structure.
- Registry search behavior.
- Table formatting.
- Score sheet entry/view patterns.
- Report sections.

## 17. Frontend Standards

Frontend pages should use shared helper logic where possible, avoid duplicating UI patterns unnecessarily, and ensure every sport-specific workflow connects back to shared data models and navigation.

---

## 18. Detailed Component Standards

## 18.1 Hero Cards

Hero cards should introduce the page and provide the most important contextual information. They should not become cluttered with decorative or redundant pills.

Hero cards may include:

- Page title.
- Short description.
- Key action buttons.
- Important statistical tiles.
- Entity edit action where the page displays an editable entity.
- Final score/result display for score sheet view pages.

Hero cards should avoid:

- Backend details.
- Scope/retention language.
- Production-stage labels.
- Repeated information already shown elsewhere.
- Too many chips or pills.

## 18.2 Registry Sections

Registry pages should have one clear registry section. Duplicate registry headings must be avoided.

Registry sections should include:

- Heading.
- Short explanation.
- Filters.
- Search button.
- Recent searches.
- Results table.

The search button should fit its label and should not stretch across the full grid on desktop.

## 18.3 Profile Completeness UI

Profile completeness should be visible but not visually dominant. A compact circular/pie indicator works well in registry rows. On view pages, profile completeness may appear in a hero card tile or a small summary card.

Completeness must support incomplete record workflows.

## 18.4 Operational Alerts

Operational alerts should be present but subtle. They should not dominate the page. Alerts should be clickable and should take the user to the workflow or filtered list that helps resolve the issue.

For example:

- Missing athlete body data should open incomplete athlete records.
- Missing coach contact information should open the edit coach workflow or relevant edit page.
- Missing team roster should guide the user to roster assignment.

## 18.5 Recent Activity

Recent activity cards should show a maximum of three recent items. This prevents the section from becoming a second audit log.

## 18.6 Setup Quality

Setup quality sections should summarize record quality, not overwhelm users. They should be compact and use practical signals.

---

## 19. Detailed Sport UI Standards

## 19.1 Cricket UI

Cricket scorecard entry must have enough horizontal and vertical space to resemble a proper scorecard. It should not be squeezed into competition view.

The workflow should clearly separate:

- Starting XI.
- Innings.
- Batting.
- Bowling.
- Extras.
- Totals.
- Fall of wickets.
- Declarations.
- Result.

## 19.2 Football UI

Football match detail view should resemble a match summary. It should show:

- Final score.
- Goalscorers with minute.
- Team match stats.
- Player stats.
- Cards and discipline.
- Link to detailed athlete football stats.

## 19.3 Basketball UI

Basketball score sheets should show:

- Quarter scores.
- Overtime.
- Player rows.
- Fouls.
- Points by quarter.
- Shooting fields.
- Rebounds.
- Assists.
- Steals.
- Blocks.
- Turnovers.
- Minutes.
- Team totals.

Basketball result cards should show score, outcome, and top performers.

## 19.4 Track and Field UI

Track and field must split track and field result entry after the user chooses add new track and field results.

Track event pages emphasize:

- Event.
- Heat/final.
- Time.
- Rank.
- Wind.

Field event pages emphasize:

- Attempts.
- Best mark.
- Rank.
- Final rank.
- Points.

---

## 20. Detailed Form Behavior

Forms should open only when needed unless the page is itself a form page.

Examples:

- Add athlete workflow opens after Add Athlete.
- Edit athlete workflow opens from athlete view.
- Add coach/edit coach workflows open after user action.
- Add team assignment opens after user action.
- Large score sheet workflows live on dedicated pages.

Forms should preserve user progress through unsaved-change warnings where loss would be costly.

---

## 21. Detailed Button Standards

Buttons should:

- Use consistent text size and weight.
- Avoid overly heavy font weight.
- Use black or campus-colored backgrounds where appropriate.
- Use white text on dark buttons.
- Avoid yellow text on white backgrounds.
- Avoid metallic effects on normal buttons.

Active nav indicators should be underlines, not filled 3D effects.

---

## 22. Detailed Table Standards

Tables must be readable on laptop screens.

Table guidance:

- Avoid unnecessary columns.
- Use compact but legible spacing.
- Keep action buttons visible.
- Use profile completeness where relevant.
- Link names to view pages.
- Use horizontal scroll only when unavoidable.

Leaderboards should be tables because users need comparison and sorting.

---

## 23. Detailed Search UX

Search-heavy pages must support recent searches. Recent searches reduce repeated filtering.

Search behavior:

- Filters do not auto-run.
- User clicks Search.
- Results render after Search.
- Recent search chips/buttons can restore previous search.

Athlete search must require a narrowing filter. Coach, team, and competition searches may allow all active records.

---

## 24. Detailed Score Sheet View UX

Score sheet view pages must be read-only. They should not look like editing pages.

They should include:

- Clear title.
- Date/opponent/context.
- Final result displayed prominently.
- Saved score sheet data.
- Player links.
- Back link to competition.

The final result should sit neatly to the right side of the hero card on larger screens rather than being squeezed into a small generic tile.

---

## 25. Detailed Accessibility and Readability Rules

The system should maintain:

- High contrast.
- Visible focus states where possible.
- Plain labels.
- Readable table headers.
- Avoidance of all-caps overuse.
- Reasonable line lengths.
- No text overflow in buttons or cards.

The design should feel mature and administrative, not playful or childish.

---

## 26. Detailed Layout Balance Rules

Pages should be evaluated for both clutter and emptiness.

If a page feels cluttered:

- Move long lists into collapsible sections.
- Move detailed stats to dedicated pages.
- Reduce hero card chips.
- Hide forms until requested.

If a page feels empty:

- Add meaningful summary cards.
- Add recent activity in compact form.
- Add recent results.
- Add operational next steps.

The goal is operational density without visual chaos.
