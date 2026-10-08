# Y2K Savings Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Y2K-styled, browser-local savings checklist for 2026–2030 with custom categories and month/year/all schedule views.

**Architecture:** A dependency-free ES module app separates deterministic planning calculations from local-storage persistence and DOM rendering. `src/lib/planner.js` owns category validation, scheduling, and totals; `src/lib/storage.js` owns versioned persistence; `src/main.js` manages state and event-driven rendering.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript ES modules, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-08-savings-checklist-design.md`

## Global Constraints

- Store the first-release data only in browser `localStorage`; include no database or sign-in flow.
- Cover plan months from `2026-01` through `2030-12` inclusively.
- Preload ISA at 500,000 KRW/month for all plan months and 청년미래적금 at 500,000 KRW/month from `2026-10` through `2029-09`.
- Custom categories require a name and a deposit amount greater than zero; their account/product, dates, and target amount are optional.
- Categories with no dates apply across the full plan; a start month after an end month must be rejected.
- Preserve the Y2K visual direction while retaining responsive, keyboard-accessible native controls.

## Review Focus

- Corrupted or obsolete local-storage payload: load the default plan instead of failing to render (Task 2 test).
- Boundary periods: 청년미래적금 must include `2026-10` and `2029-09`, not adjacent months (Task 1 test).
- Partial optional date input: an open-ended category must schedule correctly from the supplied boundary (Task 1 test).
- Deleted category records: removing a category must remove all of its checked deposits (Task 1 test).
- Currency input edge cases: blank, zero, negative, and non-numeric deposit amounts must be rejected (Task 1 test).

---

### Task 1: Planning domain module and tests

**Files:**
- Create: `package.json`
- Create: `src/lib/planner.js`
- Create: `tests/planner.test.js`

**Interfaces:**
- Produces: `PLAN_START`, `PLAN_END`, `createDefaultState()`, `validateCategory(input)`, `createCategory(state, input)`, `updateCategory(state, categoryId, input)`, `monthKeysBetween(start, end)`, `isCategoryScheduled(category, monthKey)`, `toggleCheck(state, categoryId, monthKey)`, `deleteCategory(state, categoryId)`, and `getSummary(state, visibleMonths)`.
- Consumes: plain state `{ categories: Category[], checks: Record<string, boolean> }`, where check keys are `${categoryId}:${monthKey}`.

- [ ] **Step 1: Write failing tests for the default plan, inclusive month boundaries, totals, validation, and category deletion in `tests/planner.test.js`.**

  Assert that the default state has ISA in all 60 plan months, 청년미래적금 only in `2026-10` through `2029-09`, its scheduled total is 18,000,000 KRW, checked totals use only true records, open-ended periods are respected, invalid deposit amounts fail validation, and deleting a category removes its check keys.

- [ ] **Step 2: Run the planning tests to verify they fail.**

  Run: `node --test tests/planner.test.js`

  Expected: FAIL because `src/lib/planner.js` does not exist.

- [ ] **Step 3: Implement the planning interfaces in `src/lib/planner.js`.**

  Generate normalized `YYYY-MM` keys without relying on locale dates. Clamp schedule checks to the five-year plan, validate category input before `createCategory` / `updateCategory`, and return immutable state updates so the UI can replace its state safely.

- [ ] **Step 4: Add the Node ESM test command to `package.json` and run the planning tests.**

  Run: `npm test`

  Expected: PASS with all planner tests green.

- [ ] **Step 5: Commit the planning module and tests.**

  ```bash
  git add package.json src/lib/planner.js tests/planner.test.js
  git commit -m "feat: add savings planning domain"
  ```

### Task 2: Versioned browser persistence

**Files:**
- Create: `src/lib/storage.js`
- Create: `tests/storage.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createDefaultState()` from `src/lib/planner.js` and a Storage-compatible object with `getItem(key)` / `setItem(key, value)`.
- Produces: `loadState(storage) -> SavingsState` and `saveState(storage, state) -> void`.

- [ ] **Step 1: Write failing storage tests in `tests/storage.test.js`.**

  Use a small in-memory Storage stub. Assert a valid saved payload round-trips, an empty key loads `createDefaultState()`, and malformed JSON or an incompatible version returns the default state.

- [ ] **Step 2: Run the storage tests to verify they fail.**

  Run: `node --test tests/storage.test.js`

  Expected: FAIL because `src/lib/storage.js` does not exist.

- [ ] **Step 3: Implement `loadState` and `saveState` in `src/lib/storage.js`.**

  Use a single fixed key and an explicit `version: 1` wrapper. Treat storage parse/access errors as non-fatal and fall back to default data on load.

- [ ] **Step 4: Run all automated tests.**

  Run: `npm test`

  Expected: PASS with planner and storage tests green.

- [ ] **Step 5: Commit the persistence layer and tests.**

  ```bash
  git add package.json src/lib/storage.js tests/storage.test.js
  git commit -m "feat: persist savings checklist state"
  ```

### Task 3: Responsive Y2K application shell and renderer

**Files:**
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: planner and storage interfaces from Tasks 1–2.
- Produces: a browser UI with dashboard totals, a selected view, monthly schedule controls, and a category form dialog.

- [ ] **Step 1: Create `index.html` with accessible landmarks and renderer targets.**

  Include a `main` application landmark, live region for changing totals, native button controls for the three views, a schedule container, and a native `<dialog>` containing named inputs for category name, account/product, start month, end month, deposit amount, and target amount.

- [ ] **Step 2: Implement app initialization and pure render helpers in `src/main.js`.**

  Load the state through `loadState(localStorage)`, render total checked amount, scheduled amount, percentage, active-filter schedule, and each category's target progress. Default the selected view to the current plan month when applicable, otherwise `전체`.

- [ ] **Step 3: Implement interaction handlers in `src/main.js`.**

  Wire view selection, year/month navigation, check toggles, opening/closing the dialog, category creation, editing, and deletion. Show inline validation messages returned from `validateCategory`, persist each successful mutation using `saveState`, and rerender after state changes.

- [ ] **Step 4: Implement the Y2K responsive presentation in `src/styles.css`.**

  Define reusable color tokens for aqua, pink, lavender, and dark ink; use glossy gradients, soft borders, pronounced radii, and a legible system-font stack. At narrow widths, stack dashboard cards and keep the schedule controls at least 44px tall.

- [ ] **Step 5: Serve the site locally and manually verify the UI.**

  Run: `npx --yes serve .`

  Expected: the page loads; `이번 달` / `연도별` / `전체` switch the schedule; check changes alter totals; valid category creation persists after reload; invalid form inputs remain visible with an error; and the layout remains usable at a narrow viewport.

- [ ] **Step 6: Run automated tests and commit the application UI.**

  Run: `npm test`

  Expected: PASS with all tests green.

  ```bash
  git add index.html src/main.js src/styles.css
  git commit -m "feat: build y2k savings checklist UI"
  ```

### Task 4: Documentation and final validation

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: completed static application.
- Produces: concise local-run instructions and a disclosure that data is browser-local.

- [ ] **Step 1: Write `README.md` with usage, test, and persistence details.**

  State the `npm test` command, a local static-server command, the plan dates and default categories, and that clearing browser storage removes saved data.

- [ ] **Step 2: Run final automated validation.**

  Run: `npm test`

  Expected: PASS with every test green.

- [ ] **Step 3: Check the working tree and commit documentation.**

  Run: `git status --short`

  Expected: only `README.md` is uncommitted before staging.

  ```bash
  git add README.md
  git commit -m "docs: add savings planner usage"
  ```
