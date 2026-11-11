# MVP Scope & Requirements

## 1. Clarify your idea

**What specific problem does it solve?**
A PhD student juggles a multi-year plan (literature review, experiments, papers) and a stream of outside dates (conference deadlines, seminars, funding calls). The plan lives in their head, a spreadsheet and their inbox, so they lose sight of where they stand and miss deadlines.

**For whom, exactly?**
A PhD student in the first years of their doctorate (one person, on their own laptop or phone), starting with computer science labs.

**What's the minimum moment of value?**
The student adds their first milestones and immediately sees their research laid out as a roadmap, in date order.

## 2. User stories

| # | User story | MVP / Backlog |
|---|---|---|
| US-01 | **As a** PhD student, **I want** to build my research roadmap with milestones (title, target date, notes), **so that** I see my whole path at a glance. | MVP |
| US-02 | **As a** PhD student, **I want** to update each milestone's status (to do, in progress, done, blocked) and see my overall progress, **so that** my roadmap shows where I really stand. | MVP |
| US-03 | **As a** PhD student, **I want** to add conferences, seminars, submission deadlines and funding calls, and see everything due in the next 30 days with my milestones, **so that** I never miss a date. | MVP |
| US-04 | **As a** PhD student, **I want** a daily digest of new papers on my topics (from arXiv / OpenAlex), **so that** I keep up with my field without searching every day. | Backlog (v0.2) |
| US-05 | **As a** PhD student, **I want** a board of events and opportunities (funding, positions, visibility) picked by my interests, **so that** I find chances I would otherwise miss. | Backlog (v0.2) |
| US-06 | **As a** PhD student, **I want** to share a paper draft with peers I invite and be notified when they leave feedback, **so that** I get feedback in days, not weeks. | Backlog (v0.3, needs accounts) |
| US-07 | **As a** PhD student, **I want** my own account, **so that** my roadmap is private and available on any device. | Backlog (v0.3) |

## 3. Initial prompt for Claude

```
I want to build this feature:
As a PhD student, I want to build my research roadmap with milestones (title, target
date, notes), so that I see my whole path at a glance.

Acceptance criteria:
- POST /api/milestones creates a milestone with title (required, max 120 chars),
  targetDate (required, real YYYY-MM-DD date) and optional notes; status is "todo".
- Invalid input returns 400 with a clear message; invalid JSON returns 400.
- GET /api/milestones returns the roadmap, earliest target date first.
- The web page shows the roadmap as a vertical timeline (title, date, days left or
  overdue, notes) and has a form to add a milestone.

Create a feature/roadmap-milestones branch from develop. Before writing any code,
explain your plan and which files you will touch, and wait for my approval.
Follow the conventions in CLAUDE.md and don't add anything that is not in the criteria.
```
