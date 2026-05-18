# Phase 6.8.8 — Mobile Usability

## Problem

The app is unusable on phones. Key failures at 375–430px viewport widths:

| Problem | Root cause |
|---------|-----------|
| Header overflows — brand, chips, nav squashed into 375px | Three sections side-by-side, no mobile hide |
| Board is too small or clipped | `board-mat` 20px padding eats ~40px on each axis |
| Action buttons overflow the footer | Four buttons in one `.actions` row |
| Keyboard hints row is irrelevant | Physical keyboard not present on phones |
| Page doesn't scroll naturally | `.app { overflow: hidden }` clips content below the fold |
| FEN strip wastes space | Long monospace string serves no purpose on a phone |

The existing 960px breakpoint collapses the two-column layout to one column, but stops there — no phone-specific tuning exists.

---

## Strategy

**CSS-only fix. No component changes, no new state.**

Add a second breakpoint at `≤ 600px` (phones). Changes:

1. Switch from viewport-locked layout (`overflow: hidden`) to page-scroll on mobile.
2. Simplify the header — keep only the brand.
3. Shrink board-mat frame padding so the board fills available width.
4. Wrap action buttons so Submit never overflows.
5. Hide keyboard hints (irrelevant without a physical keyboard).
6. Hide the FEN meta strip.
7. Increase move-token touch targets slightly.

---

## Layout model change

**Desktop/tablet (≥ 601px)** — unchanged:
- `.app` is `height: 100dvh; overflow: hidden`
- `.panels` scrolls internally via `overflow-y: auto` at 960px

**Phone (≤ 600px)**:
- `.app` becomes `height: auto; min-height: 100dvh; overflow: visible`
- Page itself scrolls (natural browser scroll)
- `.panels` and `.tree-wrap` have no overflow constraint — content drives height
- This is robust across Safari iOS, Chrome Android, and Samsung Internet

---

## Files

| File | Action |
|------|--------|
| `web/src/app/globals.css` | Add `@media (max-width: 600px)` block |
| `web/e2e/mobile.spec.ts` | **CREATE** — Playwright tests at 375×667 viewport |

No changes to TSX components, shared logic, or existing tests.

---

## CSS changes in detail

New block to append at end of `globals.css`:

```css
/* ── Phone layout (≤ 600px) ── */
@media (max-width: 600px) {

  /* Page-scroll model — remove viewport lock */
  .app {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  /* ── Header ── */
  .app-header {
    padding: 0 16px;
    height: 48px;
  }
  .header-puzzle { display: none; }   /* puzzle chips */
  .header-nav    { display: none; }   /* Library / History / Stats / avatar */
  .brand-tagline { display: none; }   /* "PUZZLE TRAINER" tag */

  /* ── Panels ── */
  .panels {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  /* ── Board panel ── */
  .panel-board {
    padding: 14px 16px;
    --board-size: min(380px, calc(100vw - 52px));  /* 16px side × 2 + 10px mat × 2 */
    justify-content: flex-start;
    gap: 12px;
  }
  .board-mat {
    padding: 10px;
  }
  .board-mat::after {
    inset: 5px;
  }
  .meta-strip { display: none; }   /* FEN strip — not useful on phone */
  .turn-plate {
    padding: 6px 12px;
    gap: 10px;
  }
  .turn-text { font-size: 14px; }
  .turn-sub  { font-size: 10px; }

  /* ── Analysis panel ── */
  .panel-analysis {
    display: block;          /* exit flex so tree-wrap expands naturally */
    min-height: 0;
  }
  .an-header {
    padding: 14px 16px 10px;
  }
  .tree-wrap {
    overflow: visible;       /* no internal scroll — page scrolls */
    padding: 16px;
    min-height: 120px;
  }
  .move-tree {
    font-size: 15px;
    line-height: 2.4;
  }
  .move-token {
    padding: 2px 5px;
    margin: 0 -2px;
  }

  /* ── Footer ── */
  .an-footer {
    padding: 12px 16px 20px;
    gap: 10px;
  }
  .kb-hints { display: none; }      /* no physical keyboard on phone */
  .actions  { flex-wrap: wrap; }
  .btn-primary {
    flex: 1 0 100%;                  /* submit takes its own full row */
    order: -1;                       /* submit button first */
  }
  .btn {
    flex: 1 1 auto;
  }
  .legend {
    gap: 8px;
    font-size: 9px;
  }
}
```

---

## Board sizing math

On a 375px wide phone:

| Component | Width consumed |
|-----------|---------------|
| `.panel-board` side padding | 2 × 16px = 32px |
| `.board-mat` padding | 2 × 10px = 20px |
| **Available for board** | **375 − 52 = 323px** |

Formula `min(380px, calc(100vw - 52px))` gives:
- 375px phone → 323px board
- 414px phone (iPhone Plus) → 362px board
- 430px phone (iPhone Pro Max) → 378px board

At 323px, each of the 8 squares is ≈ 40px — above the 44px ideal tap target but acceptable; square selection uses two sequential clicks (source + destination) so precision is less critical than single-tap targets.

---

## Playwright tests — `e2e/mobile.spec.ts`

New spec file, mobile-only viewport (375 × 667, iPhone SE profile):

```typescript
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
  await page.goto('/')
})

test('board is visible and not overflowing on mobile', async ({ page }) => {
  const board = page.locator('.board-container')
  await expect(board).toBeVisible()
  const box = await board.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(375)
  expect(box!.x).toBeGreaterThanOrEqual(0)
})

test('board pieces render on mobile', async ({ page }) => {
  await expect(page.locator('cg-board piece')).not.toHaveCount(0)
})

test('header nav is hidden on mobile', async ({ page }) => {
  await expect(page.locator('.header-nav')).toBeHidden()
})

test('puzzle chips are hidden on mobile', async ({ page }) => {
  await expect(page.locator('.header-puzzle')).toBeHidden()
})

test('keyboard hints are hidden on mobile', async ({ page }) => {
  await expect(page.locator('.kb-hints')).toBeHidden()
})

test('action buttons are visible and not clipped', async ({ page }) => {
  const submit = page.locator('.btn-primary')
  await expect(submit).toBeVisible()
  const box = await submit.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
})

test('submit button has adequate touch height (≥ 40px)', async ({ page }) => {
  const submit = page.locator('.btn-primary')
  const box = await submit.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(40)
})

test('move tree is visible', async ({ page }) => {
  await expect(page.locator('.move-tree')).toBeVisible()
})

test('can record a move by tapping on mobile', async ({ page }) => {
  const board = page.locator('.board-container')
  await expect(page.locator('cg-board piece')).not.toHaveCount(0)

  const box = await board.boundingBox()
  const sq = (file: number, rank: number) => ({
    x: box!.x + (file + 0.5) * box!.width  / 8,
    y: box!.y + (rank + 0.5) * box!.height / 8,
  })

  // Source → destination tap (same as desktop click test)
  await page.mouse.click(sq(5, 6).x, sq(5, 6).y)  // f6 (Nf6 square)
  await page.mouse.click(sq(3, 5).x, sq(3, 5).y)  // d5

  await expect(page.locator('.an-stats')).toContainText('nodes')
})
```

---

## TDD sequence

### RED
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web
npx playwright test e2e/mobile.spec.ts --retries=0
# Expect: several failures (hidden check, overflow check, etc.)
```

### GREEN
Apply the CSS block to `globals.css`.

```bash
npx playwright test e2e/mobile.spec.ts --retries=1
# Expect: 9/9 pass
```

### YELLOW — full regression
```bash
npm test
# Expect: 127/127 Vitest (no CSS/logic changes)

npx playwright test --retries=1
# Expect: 53 + 9 = 62/62

vercel --prod --cwd /home/aritra/Claude/chess-puzzle-trainer
# Expect: build READY
```

---

## What is NOT changed

| Concern | Decision |
|---------|----------|
| Touch events for board recording | Already work — React's `onClick` fires on touch tap |
| `viewport` meta tag | Next.js App Router adds it automatically |
| Two-column desktop layout | Unchanged |
| Tablet layout (601–960px) | Unchanged (960px breakpoint handles it) |
| Driver.js tour | Works as-is; user can skip it |
| Keyboard navigation arrows | Still wired; no-op on mobile, harmless |
| Component logic | Zero changes |
| Vitest tests | Zero changes |

---

## Test delta

| Suite | Before | Delta | After |
|-------|--------|-------|-------|
| Vitest | 127 | 0 | 127 |
| Playwright | 53 | +9 | 62 |
