# Phase 6.8.9 — Test Plan: Fluid CSS (px → rem)

## Overview

Phase 6.8.9 is a **CSS-only refactor** — no TypeScript, no component logic, no new behaviour.
The changes are:

1. Every layout `px` value → `rem` (font sizes, padding, gap, height, width)
2. `--board-size` variable now uses `rem` caps instead of `px` caps
3. Explicit `.board-container { width/height }` overrides **removed** from both media query
   blocks — the variable alone drives sizing

This has two consequences for testing:

| Suite | Impact |
|-------|--------|
| **Vitest (127 → 130)** | +3 new CSS source guard tests in `cssLayoutGuards.test.ts` |
| **Playwright desktop (53)** | Zero — board stays exactly 480 px at default viewport; all coordinates still valid |
| **Playwright mobile (9 → 10)** | +1 narrow-phone test (320 px) for edge-case coverage |
| **Total Playwright (62 → 63)** | +1 |

---

## Why existing tests are already safe

### Desktop Playwright — board stays 480 px

The critical test is:

```typescript
// board.spec.ts
test('board container is 480×480 pixels', async ({ page }) => {
  const box = await page.locator('.board-container').boundingBox()
  expect(box?.width).toBe(480)
  expect(box?.height).toBe(480)
})
```

Default Playwright viewport: **1280 × 800**.

New formula: `--board-size: min(30rem, calc(100dvh - 16.25rem))`

```
30rem        = 30 × 16px = 480px
16.25rem     = 16.25 × 16px = 260px
100dvh−260px = 800 − 260 = 540px
min(480, 540) = 480px   ✓  (exactly 480 — test passes)
```

At `1280 × 600` ("short viewport" test):
```
min(480, 600 − 260) = min(480, 340) = 340px  < 480  ✓
```

### Desktop coordinate formulas unchanged

All specs that use `(7 - file) * 60 + 30` assume a 480 px board (60 px/square).
Because the board is still 480 px at the 1280 × 800 default, these formulas remain correct
in every spec: `recording.spec.ts`, `navigation.spec.ts`, `solution.spec.ts`,
`ui.spec.ts`, `ui-layout.spec.ts`.

### Mobile Playwright (375 px) — board still 323 px

New formula at `max-width: 600px`:
`--board-size: min(23.75rem, calc(100vw - 3.25rem))`

```
23.75rem      = 23.75 × 16px = 380px
3.25rem       = 3.25 × 16px  = 52px
100vw − 52px  = 375 − 52     = 323px
min(380, 323) = 323px  ≤ 375  ✓
```

All 9 mobile tests pass without change.

---

## RED state — before implementing CSS

Run the **new** tests against the **unmodified** CSS:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web
npm test -- --reporter=verbose
# Expect: 3 new cssLayoutGuards tests FAIL
```

Tests that fail RED (CSS source guards fail against the old CSS):

| # | Test | Why RED |
|---|------|---------|
| G1 | `--board-size formula uses rem cap, not px` | Current CSS has `min(480px, ...)` — the `not.toMatch` assertion fires |
| G2 | `board-container has no explicit px width/height in @media blocks` | Current CSS has two `.board-container { width: min(480px/380px, ...) }` blocks — the `not.toMatch` assertions fire |
| G3 | `app-header height uses rem, not px` | Current CSS has `height: 56px` — the `not.toMatch('px')` assertion fires |

Tests that pass GREEN already in RED state (no CSS changes needed for these):

| Test | Why |
|------|-----|
| All 127 existing Vitest | CSS invisible to JSDOM |
| All 62 existing Playwright | Board still 480 px; rem identical to px at 16px root |
| New narrow-phone Playwright | Current formula `min(380px, 320−52)=268px ≤ 320px` already passes |

**Minimum RED count: 3 failures.**

---

## New file — additions to `web/src/lib/__tests__/cssLayoutGuards.test.ts`

Append three tests to the existing `describe('CSS layout guards', ...)` block.

### G1 — `--board-size formula uses rem cap, not px`

```typescript
it('--board-size formula uses rem cap, not px', () => {
  const src = fs.readFileSync(CSS, 'utf8')

  // Old form that must NOT appear after the refactor:
  //   --board-size: min(480px, ...)
  //   --board-size: min(380px, ...)
  expect(src).not.toMatch(/--board-size:\s*min\(\d+px/)

  // New form that MUST be present:
  //   --board-size: min(30rem, ...)  or  min(23.75rem, ...)
  expect(src).toMatch(/--board-size:\s*min\([\d.]+rem/)
})
```

**RED reason:** `--board-size: min(480px,` exists in current CSS → `not.toMatch` fails.
**GREEN reason:** After refactor only `min(30rem,` / `min(23.75rem,` forms remain.

---

### G2 — `board-container has no explicit px width/height in @media blocks`

```typescript
it('board-container has no explicit px width/height override inside @media blocks', () => {
  const src = fs.readFileSync(CSS, 'utf8')

  // Old pattern that must be gone:
  //   .board-container { width: min(480px, calc(100vw - 80px)); ... }   (960px block)
  //   .board-container { width: min(380px, calc(100vw - 52px)); ... }   (600px block)
  //
  // After the refactor, .board-container ONLY uses var(--board-size) — no direct min(px) override.
  expect(src).not.toMatch(/\.board-container\s*\{[^}]*width:\s*min\(\d+px/)
  expect(src).not.toMatch(/\.board-container\s*\{[^}]*height:\s*min\(\d+px/)
})
```

**RED reason:** Two `.board-container { width: min(480px/380px,...) }` blocks exist → both
`not.toMatch` assertions fire.
**GREEN reason:** Those blocks are deleted; `.board-container` only has `width: var(--board-size)`.

---

### G3 — `app-header height uses rem, not px`

```typescript
it('app-header height uses rem, not px', () => {
  const src = fs.readFileSync(CSS, 'utf8')

  const headerBlock = src.match(/\.app-header\s*\{[^}]*\}/)?.[0] ?? ''
  expect(headerBlock).not.toBe('')

  // Must not contain a raw-px height (e.g. height: 56px)
  expect(headerBlock).not.toMatch(/height:\s*\d+px/)

  // Must contain a rem height (e.g. height: 3.5rem)
  expect(headerBlock).toMatch(/height:\s*[\d.]+rem/)
})
```

**RED reason:** Current CSS has `height: 56px` inside `.app-header { … }`.
**GREEN reason:** After refactor it becomes `height: 3.5rem`.

---

## New Playwright test — narrow-phone coverage

Append to `web/e2e/mobile.spec.ts` using the `browser.newContext` pattern (same style as the
"short viewport" test in `board.spec.ts`).

```typescript
test('board fits and is visible on a 320px narrow phone', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 320, height: 568 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
  await page.goto('/')

  const board = page.locator('.board-container')
  await expect(board).toBeVisible()

  const box = await board.boundingBox()
  // Board must fit horizontally
  expect(box!.width).toBeLessThanOrEqual(320)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  // Board must be large enough to interact with (≥ 200px)
  expect(box!.width).toBeGreaterThan(200)

  await ctx.close()
})
```

**This test passes GREEN before AND after the implementation** — the current formula
`min(380px, calc(100vw − 52px))` already gives `min(380, 268) = 268px ≤ 320px` at 320 px width.
It is added for edge-case documentation and future regression protection, not to drive TDD.

---

## Test-by-test RED/GREEN table

| # | Test | Suite | RED (before CSS) | GREEN (after CSS) |
|---|------|-------|-------------------|-------------------|
| G1 | `--board-size uses rem cap` | Vitest cssLayoutGuards | **FAILS** | passes |
| G2 | `board-container no px override in @media` | Vitest cssLayoutGuards | **FAILS** | passes |
| G3 | `app-header height uses rem` | Vitest cssLayoutGuards | **FAILS** | passes |
| N1 | `board fits on 320px narrow phone` | Playwright mobile | passes already | passes |
| — | All 127 existing Vitest | Vitest | pass | pass |
| — | All 62 existing Playwright | Playwright | pass | pass |

**Minimum RED: 3 failures (G1, G2, G3).**

---

## Changes to existing test files

**None.** No existing test file is modified.

The coordinate formulas in `recording.spec.ts`, `navigation.spec.ts`, `solution.spec.ts`,
`ui-layout.spec.ts`, and `ui.spec.ts` all assume a 480 px board. That assumption remains
correct because the base `--board-size: min(30rem, calc(100dvh − 16.25rem))` still evaluates
to exactly 480 px at the default 1280 × 800 Playwright viewport.

---

## No new Vitest component tests

There are no TypeScript changes in Phase 6.8.9 — all changes are in `globals.css`.
CSS is invisible to JSDOM. The three CSS source guard tests are the correct regression
layer for this kind of refactor.

---

## TDD sequence

### RED

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web

# 1. Add three new tests to cssLayoutGuards.test.ts  (no CSS changes yet)
# 2. Add narrow-phone test to mobile.spec.ts           (no CSS changes yet)

npm test -- --reporter=verbose
# Expect: 3/130 FAIL (G1, G2, G3)

npx playwright test e2e/mobile.spec.ts --retries=0
# Expect: 10/10 pass (narrow-phone test already GREEN)
```

### GREEN

Apply the `globals.css` rewrite from Phase 6.8.9.

```bash
npm test -- --reporter=verbose
# Expect: 130/130 green
```

### YELLOW

```bash
npm test
# Expect: 130/130 Vitest

npx playwright test --retries=1
# Expect: 63/63 Playwright

vercel --prod --cwd /home/aritra/Claude/chess-puzzle-trainer
# Expect: READY
```

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `cssLayoutGuards.test.ts` | 6 | **+3** | 9 |
| All other Vitest files | 121 | 0 | 121 |
| **Total** | **127** | **+3** | **130** |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| `e2e/mobile.spec.ts` | 9 | **+1** | 10 |
| `e2e/board.spec.ts` | 12 | 0 | 12 |
| `e2e/recording.spec.ts` | 7 | 0 | 7 |
| `e2e/navigation.spec.ts` | 4 | 0 | 4 |
| `e2e/solution.spec.ts` | 8 | 0 | 8 |
| `e2e/ui-layout.spec.ts` | 3 | 0 | 3 |
| `e2e/ui.spec.ts` | 13 | 0 | 13 |
| `e2e/ui.spec.ts` (tour) | 6 | 0 | 6 |
| **Total** | **62** | **+1** | **63** |
