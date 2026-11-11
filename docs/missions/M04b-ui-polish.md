# M04b — Wavy roadmap UI, pixel font and palette

| | |
|---|---|
| **Goal** | The roadmap is a fun, interactive wavy path with milestones on it, in a clean pixel-styled design using only the project palette |
| **Owner** | Agent team (`/mission`): frontend-dev for `public/**`, test-writer for `tests/**`, docs-writer for the "UI design rules" section of CLAUDE.md and the docs, devops-engineer for the happy-dom dev dependency and the ESLint config |
| **Branch** | `feature/ui-polish` |
| **Depends on** | M04 |
| **Status** | in review |

## Context

After M04 the roadmap worked but looked too basic. This mission changes only the look and the interaction of the page, not the API. M05 and M06 then follow the same design rules.

Visual reference, read only (ignore its status, progress and upcoming parts):
`../researchpath-reference/researchpath/public/` and its `docs/screenshot.png`.

## Acceptance criteria

- [x] CLAUDE.md has a "UI design rules" section (palette, fonts, style, status shapes, roadmap, interactions) that later missions follow; status shapes for M05: todo hollow navy square, in progress square half-filled coral, done navy square with a check, blocked coral square with navy "!"
- [x] Palette only: navy `#102542` (text, lines, borders), grey-blue `#cdd7d6` page background with card tint `#e6ebea`, coral `#f87060` accent; rgba tints of these only; no white, no purple or other hue anywhere (changed during review, user decision)
- [x] Pixelify Sans self-hosted in `public/fonts/` (with its OFL licence) for brand, headings, dates, numbers and buttons; `system-ui` for body text; the hero headline uses system-ui bold (changed during review, user decision); no external font request
- [x] Cards (popovers, later sections): 2px navy border, 10px radius, hard 4px navy offset shadow; sticky nav bar (brand "ResearchPath" without logo, section links, coral "+ Milestone" button with navy text); hero; full-bleed roadmap band with 2px navy borders, and a 1280px centred container below for Progress and Upcoming (changed during review, user decision)
- [x] Roadmap drawn as a wavy SVG path; milestones sit on crests and troughs in date order; labels (date, title, "in N days" / "N days overdue") alternate above and below
- [x] A "+" node at the end of the path opens a small popover form (title, date, notes) that creates a milestone; errors are shown at the top of the page
- [x] Clicking a milestone opens a popover with its date, title and notes; Esc, outside click and × close it
- [x] A TODAY marker between past and future milestones; overdue milestones have a coral halo and a bold navy date with a coral underline (changed during review, user decision)
- [x] Spacing fits the band; the path scrolls horizontally when there are too many milestones and starts with TODAY in view
- [x] Friendly empty state on the path ("Start your path")
- [x] Small pop and hover animations, `prefers-reduced-motion` respected, keyboard focus visible, user data still rendered with `textContent`
- [x] No change in `src/` or the API; all tests and lint still pass

## Out of scope

- Changing status, progress, events, upcoming (M05 and M06 add them, following the design rules)

## Prompt

```
/mission docs/missions/M04b-ui-polish.md
```

## How to verify (you)

1. `docker compose up --build` → the roadmap is a wavy path with your milestones on it
2. Click "+" → add a milestone → it appears on the path in date order
3. Click a milestone → its popover opens; press Esc → it closes
4. Resize the window to phone width → the path scrolls, TODAY is in view
5. Take a before/after screenshot for the README

## Result (filled by the agent)

- Files changed:
  - `public/index.html`, `public/styles.css`, `public/app.js`
  - `public/dates.js` (modified: `relativeLabel`, `isOverdue`, `formatShortDate` added; `daysLabel` unchanged)
  - `public/roadmap-layout.js` (new, pure wave layout maths)
  - `public/roadmap.js` (new, SVG rendering, popovers with Esc / outside click / × close, focus trap and focus return)
  - `public/fonts/` (new: Pixelify Sans 400/600/700 woff2 + OFL licence)
  - `CLAUDE.md` (new "UI design rules" section)
  - `package.json` / `package-lock.json` (happy-dom ^21.0.4 dev dependency, approved by the user)
  - `eslint.config.js` (browser globals for `tests/**/*.dom.test.js`)
  - `docs/missions/README.md`
  - No change in `src/`.
- Tests added:
  - `tests/roadmap-layout.test.js`: wave geometry, labels, relative dates (including month/year end and leap day), TODAY index, spacing and initial scroll.
  - `tests/ui-design.test.js`: palette-only scan, self-hosted fonts, card style, popover placement, reduced motion and focus-visible; sticky nav bar (brand without logo, "Roadmap" link, "+ Milestone" button, no Progress/Upcoming links yet, sticky + border, smooth scroll, nav overflow-x); hero (single h1, two-part headline, subtitle, clamp font size); layout (roadmap band not a card, 2px top/bottom borders, 1280px container). The header-logo test was replaced because the user removed the logo.
  - `tests/roadmap.dom.test.js`: 7 happy-dom tests (milestone popover opens; Esc, × and outside click close it and focus returns to the node; "+" opens the add form; "+ Milestone" opens the add popover; Escape closes it and focus returns to the button; empty state "Start your path").
  - Total: 95 new tests (suite went from 65 to 160), including the palette and contrast checks for the navy / grey-blue / coral palette.
- Review: `code-reviewer` found no security issue. The must-fix (no tests for the popover criterion) was fixed with the happy-dom tests. Should-fixes applied: focus after resize, network error closes the add popover, focus trap in popovers, 44px tap targets, contrast within the palette.
- UI feedback after review: sticky nav bar with section links and a "+ Milestone" button (logo removed), centered hero headline, full-bleed roadmap band.
- Palette replaced after review (user decision): navy / grey-blue / coral, navy hero band.
- Hero headline switched from the pixel font to system-ui bold for readability (user decision).
- Buttons are coral with navy text (~5.5:1).
- Known gaps / manual checks: Checked in Chrome at desktop width by the orchestrator (sample data): nav bar, hero, full-width band, TODAY marker, overdue halo and underline, "+" node, "+ Milestone" popover, Esc closing it with focus back on the button. Phone width not checked in a browser (window resize failed). Docker image not built locally (CI builds it).
- Lint / tests / build: `npm run lint` clean; `npm test` 10 files, 160 of 160 passing.
- Pull request: [TODO: link]

## Review notes (filled by you)

- What I checked: [TODO: what you checked in the browser and on a phone-width window]
- What I asked the agent to change: [TODO: your review requests, if any; the contrast change for overdue dates is already recorded above as a user decision]
- What was hard / what I learned: [TODO: your own experience of this mission]
