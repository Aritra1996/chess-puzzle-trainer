# Phase 6.8.4 — Test Plan: Remove Board Coordinates

## Overview

Phase 6.8.4 is a one-line Chessground config change (`coordinates: false`).
No component structure changes, no Vitest-visible side-effects.

One Playwright guard is added to `ui-layout.spec.ts` to prevent `coordinates: true`
from being accidentally re-introduced in future.

| File | Change | Delta |
|------|--------|-------|
| `ui-layout.spec.ts` | Add 1 test — coords element count = 0 | +1 Playwright |
| All other files | Unchanged | — |

**Total: 119 Vitest (unchanged), 15 → 16 Playwright (+1)**

---

## RED phase — test to write before touching source

### `web/e2e/ui-layout.spec.ts` — ADD 1 test

Append inside the existing `test.describe('Phase 6.6 — Tree Layout')` block, after
the `last-move squares` test and before the `same-row` test:

```typescript
test('board renders without coordinate labels', async ({ page }) => {
  await expect(page.locator('.cg-wrap coords')).toHaveCount(0)
})
```

No `page.goto('/')` needed — `test.beforeEach` on the describe block already navigates.

**Why RED:**

Chessground's default is `coordinates: true`. With the current config, it injects two
`<coords>` elements inside each `.cg-wrap`:
- `<coords class="ranks">` — the 1–8 labels
- `<coords class="files">` — the a–h labels

`toHaveCount(0)` fails because 2 elements are present → RED ✓.

**After GREEN:**

`coordinates: false` in the Chessground config prevents injection of both elements.
`toHaveCount(0)` passes → GREEN ✓.

---

## Existing tests — all stay GREEN throughout

### Vitest

No Vitest tests touch `PuzzleBoard` directly (Chessground is a DOM side-effect that
JSDOM doesn't run). All 119 tests are unaffected.

### Playwright

| Test | Why safe |
|------|----------|
| `last-move squares are rendered` | Checks `cg-board square.last-move` — different element, unrelated to `<coords>` |
| `context token and first recorded move are on the same row` | Board layout test; coordinates removal doesn't affect token positions |
| `navigation.spec.ts` — all 4 | Check move tokens and depth counter, not board DOM |
| `recording.spec.ts` — all 8 | Check move tokens, piece counts, square selection |
| `solution.spec.ts` — 1 | Stockfish eval flow |

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| All files | 119 | — | 119 |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| `ui-layout.spec.ts` | 2 | +1 | 3 |
| All other E2E files | 13 | — | 13 |
| **E2E total** | **15** | **+1** | **16** |

---

## TDD sequence

### RED
1. Add the `board renders without coordinate labels` test to `ui-layout.spec.ts`.
2. Verify:
   ```bash
   npx playwright test e2e/ui-layout.spec.ts --reporter=line
   # Expect: 1 failure — toHaveCount(0) fails (2 coords present)
   ```

### GREEN
3. Add `coordinates: false` to the Chessground config in `PuzzleBoard.tsx`.
4. Verify:
   ```bash
   npx playwright test e2e/ui-layout.spec.ts --reporter=line
   # Expect: 3/3
   ```

### YELLOW
5. Full suite:
   ```bash
   npm test
   npx playwright test --retries=1
   # Expect: 119/119 Vitest, 16/16 Playwright
   ```
