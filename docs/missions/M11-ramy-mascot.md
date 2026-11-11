# M11 — Ramy, your research guide buddy! (release v0.3.0)

| | |
|---|---|
| **Goal** | A mascot named Ramy gives the app character and tells the student, in one short sentence, the most useful thing about their research right now. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/ramy-mascot` |
| **Depends on** | M10 (v0.2.1 released) |
| **Status** | done |

## Context

The app shows a lot of data (roadmap, progress, next 30 days, research news). Ramy turns it into
one sentence: what is overdue, what is due soon, how far the student has come, or a tip. The
sprite sheet was created by the user with an AI image generator; the 19 transparent poses are
already cut and scaled in `public/mascot/mascot-*.png` (untracked until this mission commits them).
Do not edit or regenerate the images and do not add any library.

Ramy's logic lives in a pure function so it can be reused later for email reminders (backlog
US-08, design note only in this mission). This is a frontend-only mission: no backend change.

Agents: `devops-engineer` (version 0.3.0 only), `frontend-dev`, `test-writer`, `code-reviewer`,
`docs-writer`.

## Acceptance criteria

### Ramy's brain

- [x] A pure function `ramyMessage({ milestones, progress, upcoming, today })` in its own module (`public/ramy.js`) returns `{ pose, text }`. It uses no DOM, no `fetch`, no `Date.now()` / `new Date()` without arguments and no `Math.random()` inside (randomness, if any, is injected), so it can be reused later for email reminders.
- [x] Priority, first match wins:
  1. an overdue milestone (not `done`, date before `today`): `"<title> was due 3 days ago, want to update it?"` (`"1 day ago"` singular), pose `thinking`;
  2. a deadline within 7 days (an upcoming item, milestone or event, due today to today + 7): `"<title> is in 2 days!"` (`"is today!"`, `"is tomorrow!"`), pose `wave`;
  3. a progress step reached (25, 50, 75 or 100 %, the highest step at or below `progress.percent`): `"You're 50% through your roadmap!"`, pose `celebrate`;
  4. no milestones: `"Add your first milestone with the + on the line."`, pose `thinking`;
  5. otherwise a tip from a fixed list, pose `idle`.
- [x] Edge cases are defined and tested: several overdue or due-soon items (the most urgent one wins), done milestones are never overdue, missing or empty inputs, 0 % and 100 %, long titles (shortened, never cut mid-surrogate).

### Ramy in the UI

- [x] `public/mascot.js` exports `setMascot(pose, text)`, the only function that changes Ramy's image and bubble.
- [x] Above the roadmap band (the hero keeps only its title and subtitle): Ramy aligned left with the visible label "Ramy, your research guide buddy!" under him, and a floating speech bubble to his right (tail pointing at him) showing `ramyMessage`, updated after every data refresh (load, add milestone, status change, add event). One pop-in on load, then a gentle idle bob; the bubble floats gently.
- [x] Clicking Ramy cycles to the next useful message (the next matching rule in priority order), then the tips, and wraps around.
- [x] Reactions: a milestone set to `done` → `celebrate` for about 2 s, then back to the current message; the upcoming list is empty → a small `sleep` Ramy with "Nothing due in the next 30 days."; Research news → `tablet` while loading, `reading` next to the papers, `thinking` with a retry button on error, `shy` when hot topics are unavailable.
- [x] Size: display height about 96–128 px, `width` and `height` attributes set from each pose's real size, `loading="lazy"` on every Ramy image except the main one (above the roadmap). Under 600 px Ramy is smaller and the bubble stays beside him, with no horizontal scroll.
- [x] Accessibility: images are decorative (`alt=""`); the bubble text is in an `aria-live="polite"` region; the main Ramy is a `button` with `aria-label="Ramy, tips"` and a visible focus ring; under `prefers-reduced-motion` there is no bob, no pop-in and no floating bubble. All text is rendered with `textContent`.
- [x] Palette and pixel font follow the UI design rules in `CLAUDE.md`: bubble with navy text on `#cdd7d6` (no white: CLAUDE.md forbids it), 2px navy border, coral only as a fill, Pixelify Sans for the label.

### Tests

- [x] `ramyMessage`: every priority, the ordering between them, and the edge cases above, with a fixed `today` (`TODAY = '2026-11-12'`).
- [x] DOM tests for each reaction (main message after load and after a refresh, click cycling, celebrate then revert, empty upcoming sleep, news tablet / reading / thinking + retry / shy), the reduced-motion rule, and `aria` attributes.
- [x] A static test that every image referenced by the code exists in `public/mascot/`. No network.

### Docs and release

- [x] `package.json` version is `0.3.0`; the 19 PNG files are committed unchanged.
- [x] `docs/missions/README.md` lists M11. README: Ramy in Features, and the credit "sprite sheet created by me with an AI image generator" in "How it was built with AI".
- [x] `docs/mvp-scope.md` gets backlog story **US-08 "Email reminders from Ramy"** as a design note (no code): depends on US-07 accounts; opt-in email; a daily scheduled job (a Render cron job, since the free web service sleeps) that reuses `ramyMessage` and the upcoming query; the email provider API key in environment variables only; an unsubscribe link in every email.

## Out of scope

- Login, sending email, any backend change (`src/**` untouched).
- Editing, regenerating or optimising the images; any new library.

## Prompt

```
/mission docs/missions/M11-ramy-mascot.md
```

## How to verify (you)

1. `npm run dev`: Ramy pops in above the roadmap and his floating bubble says the most useful thing (add an overdue milestone to see "… was due N days ago"). Click him: the message changes.
2. Set a milestone to done: Ramy celebrates for about 2 s. Open "Research news": he holds a tablet while loading, then reads next to the papers.
3. Turn on "reduce motion" in your OS: no bob, no pop-in, no floating. Narrow the window under 600 px: Ramy shrinks and the bubble stays beside him.

## Result (filled by the agent)

- Files changed: `public/ramy.js` (new), `public/mascot.js` (new), `public/app.js`, `public/upcoming.js`,
  `public/news.js`, `public/dates.js` (`dayDiff` exported), `public/index.html`, `public/styles.css`,
  `public/mascot/*.png` (19 images, committed unchanged), `package.json` and `package-lock.json` (version
  0.3.0), the tests listed below, `README.md`, `docs/mvp-scope.md` (US-08 design note) and
  `docs/missions/README.md`. `src/**` is unchanged.
- Tests added: `tests/ramy.test.js`, `tests/ramy.dom.test.js`, `tests/ramy-static.test.js`. Existing tests
  changed because the version changed: `tests/news-ui.test.js`, `tests/hardening-config.test.js`.
  Suite: 33 files, 648 tests passing (was 547 in 30 files after M10).
- Lint / tests / build: lint clean; `npm test` 648 passing in 33 files. `docker build --target prod` OK; the
  container answers `/api/health` with version 0.3.0, serves `/mascot/mascot-idle.png` (200), and the page
  contains the Ramy button.
- Decisions: the tip texts (6 tips), "Well done, one more milestone finished!", the news lines "Fetching the
  latest papers...", "Here are the latest papers for you.", "I couldn't load the papers. Try again?" and
  "Hot topics are unavailable right now.", "Untitled" for a milestone without a title, and a 40-character
  title limit. Ramy shows the first tip before data loads. Days are computed on the client from the dates
  (the server's `daysLeft` is ignored). No white (per CLAUDE.md).
- Design change after review (user): Ramy moved from the hero to just above the roadmap band, with a
  floating speech bubble beside him (`#e6ebea` card tint, tail pointing at him, gentle float, off under
  reduced motion); the hero keeps only its title and subtitle. +10 tests (648 in total).
- Review: no must fix. Should fix, applied: no "add your first milestone" message when loading milestones
  fails; the bubble is re-announced only when its text changes; retry keeps keyboard focus (it moves to the
  papers heading); focus after adding a milestone returns as before; release labels in the docs fixed. Extra
  tests for the tie-break, a stale news response and fetch counts; a flaky news retry test made deterministic.
- Deferred from the M11 review: two announcements while news loads (`#news-loading` and the news bubble); the
  pose swap downloads a second PNG on first view, and `celebrate` may flash on first use (no preload);
  `shortTitle` can cut a ZWJ emoji sequence or flag (`Intl.Segmenter` would fix it); Ramy keeps the last good
  progress and upcoming data after a failed refresh.
- Pull request: [#20](https://github.com/Pluto2k2/ResearchPath/pull/20); release [#21](https://github.com/Pluto2k2/ResearchPath/pull/21), tag [v0.3.0](https://github.com/Pluto2k2/ResearchPath/releases/tag/v0.3.0) on `696dc4a`.
- Live check: `/api/health` returns version `0.3.0` with commit `696dc4a`, and `/mascot/mascot-idle.png` answers 200 on https://researchpath.onrender.com.

## Review notes (filled by you)

- What I checked: Ramy's messages (empty roadmap, deadline within 7 days, celebration on done, the news states), a narrow window and reduced motion.
- What I asked the agent to change: Move Ramy above the roadmap with a floating speech bubble.
- What was hard / what I learned: Keeping Ramy's logic in a pure function (`ramyMessage`) made it easy to test and reusable for the planned email reminders (US-08).
