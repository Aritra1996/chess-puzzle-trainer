# Phase 3.2 — Test Plan (TDD: Red → Green → Refactor)

## Overview

Phase 3.2 fixes the layout bug where the meta-strip (FEN + flip button) is hidden at short
viewport heights. The board gets a CSS `min()` formula so it shrinks when needed.

Two new E2E tests verify the responsive behaviour. All 54 unit tests and 35 E2E tests must
remain green after the fix.

### Cumulative test count change

| Suite | Before | +new | =After |
|---|---|---|---|
| `board.spec.ts` (E2E) | 13 | +2 | **15** |
| All other suites | unchanged | — | unchanged |
| **Totals** | **89** | **+2** | **91** |

---

## Step 0 — Confirm baseline (all green before touching anything)

```bash
cd web && npm test           # 54 passed
cd web && npm run test:e2e   # 35 passed
```

---

## RED — Write failing tests

Both new tests live at the end of `describe('Phase 1 — Static Board', ...)` in
**`web/e2e/board.spec.ts`**.

They each create their own browser context with a **600 px tall viewport** so they test
responsive layout regardless of the default Playwright viewport.

```ts
test('board shrinks below 480 px at a short viewport', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 600 } })
  const page = await ctx.newPage()
  await page.goto('/')
  const box = await page.locator('.board-container').boundingBox()
  expect(box!.width).toBeLessThan(480)
  expect(box!.width).toBeGreaterThan(200)
  await ctx.close()
})

test('meta-strip bottom edge stays within viewport at a short viewport', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 600 } })
  const page = await ctx.newPage()
  await page.goto('/')
  const strip    = await page.locator('.meta-strip').boundingBox()
  const viewport = page.viewportSize()
  expect(strip!.y + strip!.height).toBeLessThanOrEqual(viewport!.height)
  await ctx.close()
})
```

**Why these fail before the fix:**
- Board is hardcoded `480px` — never shrinks, so `box!.width < 480` fails.
- At 600 px viewport the meta-strip is pushed below the fold and clipped by
  `.app { overflow: hidden }`, so `toBeVisible()` fails.

### RED run check

```bash
cd web && npm run test:e2e   # 35 passed + 2 new FAILED = 37 total, 2 failing
```

Confirm only the two new tests fail before moving to GREEN.

---

## GREEN — Implement source to pass all tests

### G1. `web/src/app/globals.css`

Add `--board-size` variable to `.panel-board` and use it in `.board-container` and
`.meta-strip`:

```css
/* Add to .panel-board: */
--board-size: min(480px, calc(100dvh - 260px));

/* Replace in .board-container: */
width:  var(--board-size, 480px);
height: var(--board-size, 480px);

/* Replace in .meta-strip: */
max-width: calc(var(--board-size, 480px) + 40px);
```

The `260 px` constant covers all fixed vertical chrome (header 56 + panel padding 56 +
turn-plate 38 + 2×gap 36 + mat padding 40 + meta-strip 28 = 254, rounded up to 260 for
a 6 px safety margin).

At 600 px viewport: board = min(480, 340) = **340 px** — both new tests now pass. ✓

### G2. `web/playwright.config.ts`

The default `Desktop Chrome` device is **720 px tall**. After the CSS change, the board at
720 px would be `min(480, 460) = 460 px`, breaking the existing
`"board container is 480×480 pixels"` test.

Fix: set an explicit viewport large enough to keep the board at 480 px:

```ts
use: {
  baseURL: 'http://localhost:3000',
  trace: 'on-first-retry',
  viewport: { width: 1280, height: 800 },  // 800-260=540 → min(480,540)=480 ✓
},
```

### G3 — GREEN run check

```bash
cd web && npm test           # 54 passed (unchanged)
cd web && npm run test:e2e   # 37 passed (35 existing + 2 new)
```

---

## REFACTOR — Clean up (Yellow)

After all 91 tests are green:

1. Confirm the `"board container is 480×480 pixels"` test still asserts exactly 480 — no
   change needed.
2. Manual browser check: resize window to ~650 px tall → board shrinks, FEN label + flip
   button remain fully visible below the board.
3. Manual check: resize back to full height → board expands back to 480 px.

### Final counts

```bash
cd web && npm test           # 54 passed
cd web && npm run test:e2e   # 37 passed
```

---

## File → test mapping

| Source file changed | Tests that go RED | Test file |
|---|---|---|
| `globals.css` (responsive board) | `board shrinks below 480 px at a short viewport` | `board.spec.ts` |
| `globals.css` (meta-strip visible) | `meta-strip remains visible at a short viewport` | `board.spec.ts` |
| `playwright.config.ts` (viewport) | Prevents `board container is 480×480 pixels` from breaking | `board.spec.ts` |
