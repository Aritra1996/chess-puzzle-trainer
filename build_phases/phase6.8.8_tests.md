# Phase 6.8.8 — Test Plan: Mobile Usability

## Overview

Phase 6.8.8 is a **CSS-only change** — a single new `@media (max-width: 600px)` block in
`globals.css`. No component logic, no TypeScript, no shared code changes.

Consequences for the test suite:

| Suite | Impact |
|-------|--------|
| **Vitest (127 tests)** | Zero — CSS changes are invisible to JSDOM unit tests |
| **Playwright desktop (53 tests)** | Zero — all run at 1280×800; the new ≤600px breakpoint never fires |
| **Playwright mobile (0 → 9 tests)** | New file `e2e/mobile.spec.ts` |

**Total: 53 → 62 Playwright (+9). 127 Vitest unchanged.**

---

## Why existing desktop tests are safe

Every existing spec uses the default Playwright viewport of **1280×800px** (set in
`playwright.config.ts`). The two custom-viewport tests in `board.spec.ts` use
`{ width: 1280, height: 600 }` — still 1280px wide. The phone breakpoint fires at ≤600px.
Zero overlap.

Specific tests that could theoretically be affected but are not:

| Test | Why safe |
|------|---------|
| `ui.spec.ts` — "shows the puzzle chip #4521" | 1280px → `.header-puzzle` visible |
| `ui.spec.ts` — "shows nav links" | 1280px → `.header-nav` visible |
| `board.spec.ts` — "board container is 480×480" | 1280px → full board size, mobile CSS inactive |
| `board.spec.ts` — "meta-strip bottom edge stays within viewport" | 1280×600 → wide enough, `.meta-strip` visible |
| `board.spec.ts` — "displays the FEN string on the page" | 1280px → `.meta-strip` visible |
| `recording.spec.ts` — sq() formula (assumes 480px) | 1280px → board is 480px, positions correct |
| `ui-layout.spec.ts` — sq() formula | Same |

---

## RED state — before implementing CSS

Run the new mobile spec against the **unmodified** CSS:

```bash
npx playwright test e2e/mobile.spec.ts --retries=0
# Expected: ≥ 4 failures
```

Tests that fail RED (before fix):

| Test | Why RED |
|------|--------|
| header nav is hidden | `.header-nav { display: none }` not yet present → visible |
| puzzle chips are hidden | `.header-puzzle { display: none }` not yet present → visible |
| keyboard hints are hidden | `.kb-hints { display: none }` not yet present → visible |
| action buttons not clipped | `.btn-primary` may overflow its row; footer partially below `overflow:hidden` clip |

Tests that may pass GREEN already in RED state (existing 960px breakpoint handles them):

| Test | Why already passes |
|------|-------------------|
| board is visible and not overflowing | 960px breakpoint already sets `width: min(480px, calc(100vw - 80px))` = 295px |
| board pieces render | Chessground renders at any viewport |
| submit button has adequate touch height | Button padding unchanged |
| move tree is visible | `.panel-analysis { min-height: 320px }` already in 960px block |

The minimum RED count is **4 failures**. This satisfies the TDD requirement.

---

## New file — `e2e/mobile.spec.ts`

Nine tests at `viewport: { width: 375, height: 667 }` (iPhone SE).

All tests suppress the tour popup with `addInitScript`.

```typescript
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
  await page.goto('/')
})

// 1 — Board fits within the 375px viewport
test('board is visible and not overflowing on mobile', async ({ page }) => {
  const board = page.locator('.board-container')
  await expect(board).toBeVisible()
  const box = await board.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(375)
  expect(box!.x).toBeGreaterThanOrEqual(0)
})

// 2 — Chessground renders pieces at mobile viewport
test('board pieces render on mobile', async ({ page }) => {
  await expect(page.locator('cg-board piece')).not.toHaveCount(0)
})

// 3 — Nav links hidden on phone
test('header nav is hidden on mobile', async ({ page }) => {
  await expect(page.locator('.header-nav')).toBeHidden()
})

// 4 — Puzzle chips hidden on phone
test('puzzle chips are hidden on mobile', async ({ page }) => {
  await expect(page.locator('.header-puzzle')).toBeHidden()
})

// 5 — Keyboard hints row hidden on phone (irrelevant without physical keyboard)
test('keyboard hints are hidden on mobile', async ({ page }) => {
  await expect(page.locator('.kb-hints')).toBeHidden()
})

// 6 — Submit button visible and not clipped horizontally
test('action buttons are visible and not clipped', async ({ page }) => {
  const submit = page.locator('.btn-primary')
  await expect(submit).toBeVisible()
  const box = await submit.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
})

// 7 — Submit button meets minimum touch target height (44px guideline; we accept ≥ 40px)
test('submit button has adequate touch height (≥ 40px)', async ({ page }) => {
  const submit = page.locator('.btn-primary')
  await expect(submit).toBeVisible()
  const box = await submit.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(40)
})

// 8 — Move tree is visible (page scrolls so analysis panel is reachable)
test('move tree is visible', async ({ page }) => {
  await expect(page.locator('.move-tree')).toBeVisible()
})

// 9 — Move recording works via tap (click events fire on mobile touch)
test('can record a move by tapping on mobile', async ({ page }) => {
  const board = page.locator('.board-container')
  await expect(page.locator('cg-board piece')).not.toHaveCount(0)

  // Derive square centres from live bounding box — robust at any board size
  const box = await board.boundingBox()
  const sq  = (file: number, rank: number) => ({
    x: box!.x + ((7 - file) + 0.5) * box!.width  / 8,  // black orientation
    y: box!.y + ((rank - 1) + 0.5) * box!.height / 8,
  })

  // f6 → d5 (Nd5 — legal black knight move from SAMPLE_FEN)
  const from = sq(5, 6)
  const to   = sq(3, 5)
  await page.mouse.click(from.x, from.y)
  await page.mouse.click(to.x,   to.y)

  await expect(page.locator('.an-stats')).toContainText('nodes')
})
```

---

## Test-by-test RED/GREEN table

| # | Test | RED (before CSS) | GREEN (after CSS) |
|---|------|-------------------|-------------------|
| 1 | board not overflowing | may pass (960px query fires) | passes |
| 2 | board pieces render | passes | passes |
| 3 | header nav hidden | **FAILS** — nav visible | passes |
| 4 | puzzle chips hidden | **FAILS** — chips visible | passes |
| 5 | kb-hints hidden | **FAILS** — hints visible | passes |
| 6 | submit not clipped | **FAILS** — footer may overflow `.app { overflow:hidden }` | passes |
| 7 | submit height ≥ 40px | passes (button unchanged) | passes |
| 8 | move tree visible | may fail (analysis clipped) | passes |
| 9 | can record by tap | passes (recording logic unchanged) | passes |

Minimum RED: 4 failures (tests 3, 4, 5, 6).

---

## Changes to existing test files

**None.** No existing file is touched.

The sq() formula in existing specs (`(7 - file) * 60 + 30`) is only correct at 480px board
width (60px per square). Mobile spec uses `board.boundingBox()` to derive positions
dynamically — the mobile board is ~323px wide (≈40px per square), so the hardcoded formula
would be wrong and must not be copied.

---

## No new Vitest tests

CSS media queries are not testable in JSDOM (it ignores viewport rules). The
`cssLayoutGuards.test.ts` pattern (read the CSS source and assert on its text) could verify
the media-query block exists, but adds little value over reading the file. The Playwright mobile
spec is the correct regression layer for layout behaviour.

---

## TDD sequence

### RED
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web

# Add the mobile.spec.ts file (tests only, no CSS yet)
npx playwright test e2e/mobile.spec.ts --retries=0
# Expect: ≥ 4 failures (tests 3, 4, 5, 6 at minimum)
```

### GREEN
Apply the `@media (max-width: 600px)` block to `globals.css`.

```bash
npx playwright test e2e/mobile.spec.ts --retries=1
# Expect: 9/9 pass
```

### YELLOW
```bash
npm test
# Expect: 127/127 Vitest

npx playwright test --retries=1
# Expect: 62/62 (53 existing + 9 new)

vercel --prod --cwd /home/aritra/Claude/chess-puzzle-trainer
# Expect: build READY
```

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| All files | 127 | 0 | 127 |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| `e2e/mobile.spec.ts` | 0 | **+9** | 9 |
| `e2e/board.spec.ts` | 12 | 0 | 12 |
| `e2e/recording.spec.ts` | 7 | 0 | 7 |
| `e2e/navigation.spec.ts` | 4 | 0 | 4 |
| `e2e/solution.spec.ts` | 8 | 0 | 8 |
| `e2e/ui-layout.spec.ts` | 3 | 0 | 3 |
| `e2e/ui.spec.ts` | 13 | 0 | 13 |
| `e2e/ui.spec.ts` (tour) | 6 | 0 | 6 |
| **Total** | **53** | **+9** | **62** |
