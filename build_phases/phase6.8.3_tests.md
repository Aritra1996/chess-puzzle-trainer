# Phase 6.8.3 — Test Plan: Last-Move Highlight

## Overview

Two test files change:

| File | Change | Net delta |
|------|--------|-----------|
| `PuzzleGame.test.tsx` | Update `PuzzleBoard` mock to capture `lastMove` prop; add 1 new describe block with 2 tests | +2 Vitest |
| `ui-layout.spec.ts` | Add 1 E2E test checking `.last-move` squares are rendered | +1 Playwright |

**Total: 117 → 119 Vitest, 14 → 15 Playwright**

---

## RED phase

### 1. `web/src/components/__tests__/PuzzleGame.test.tsx`

Two changes are needed in this file:

#### A. Add captured variable (top of file, alongside existing captured* declarations)

Add at line 11 (after the last existing `let captured…`):

```typescript
let capturedBoardLastMove: [string, string] | undefined
```

#### B. Update the `PuzzleBoard` mock to also capture `lastMove`

Current mock (lines 13–19):
```typescript
vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove, orientation }: { fen: string; orientation?: string; onMove?: (uci: string) => void }) => {
    capturedOnMove = onMove
    capturedOrientation = orientation
    return <div data-testid="puzzle-board" />
  },
}))
```

Replace with:
```typescript
vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove, orientation, lastMove }: {
    fen:          string;
    orientation?: string;
    onMove?:      (uci: string) => void;
    lastMove?:    [string, string];
  }) => {
    capturedOnMove        = onMove
    capturedOrientation   = orientation
    capturedBoardLastMove = lastMove
    return <div data-testid="puzzle-board" />
  },
}))
```

#### C. Add new describe block (append after the final `describe('PuzzleGame — ResultBar')` block)

```typescript
describe('PuzzleGame — lastMoveUci prop', () => {
  it('PuzzleBoard receives parsed squares when lastMoveUci is provided', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} lastMoveUci="f1c4" />)
    expect(capturedBoardLastMove).toEqual(['f1', 'c4'])
  })

  it('PuzzleBoard receives no lastMove when lastMoveUci is omitted', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedBoardLastMove).toBeUndefined()
  })
})
```

**RED analysis:**

| Test | Before implementation | After implementation |
|------|----------------------|---------------------|
| `PuzzleBoard receives parsed squares` | **FAIL** — `PuzzleGame` doesn't yet pass `lastMove` to `PuzzleBoard`, so `capturedBoardLastMove` stays `undefined`, not `['f1', 'c4']` | PASS |
| `PuzzleBoard receives no lastMove when omitted` | PASS (variable is `undefined`, assertion is `toBeUndefined`) | PASS |

Net RED failures from Vitest: **1** (first test).

---

### 2. `web/e2e/ui-layout.spec.ts`

Append one test to the existing `test.describe('Phase 6.6 — Tree Layout')` block, after the
same-row test:

```typescript
test('last-move squares are rendered on the board when lastMoveUci is wired in page.tsx', async ({ page }) => {
  await page.goto('/')
  const lastMoveSquares = page.locator('cg-board square.last-move')
  await expect(lastMoveSquares).toHaveCount(2)  // from-square (f1) + to-square (c4)
})
```

**Why RED:** `PuzzleBoard` currently has `highlight: { lastMove: false }` — Chessground never
renders `.last-move` squares, so the count is 0. `toHaveCount(2)` fails → RED ✓.

**After GREEN:** `PuzzleBoard` enables `highlight.lastMove` and passes `['f1', 'c4']`; Chessground
renders 2 squares with class `last-move` → PASS ✓.

---

## Existing tests — all stay GREEN throughout

### Vitest

| File | Tests | Why safe |
|------|-------|----------|
| All existing `PuzzleGame.test.tsx` describes | 37 tests | Mock shape changes (adds `lastMove` capture) but existing tests don't assert on `capturedBoardLastMove` — no breakage |
| `MoveTree.test.tsx` | 21 tests | Unrelated to board or UCI |
| `cssLayoutGuards.test.ts` | 4 tests | CSS-only guards |
| All other Vitest | 55 tests | Unrelated |

**Specific mock-change safety check:**
The `PuzzleBoard` mock's destructuring changes from `{ onMove, orientation }` to
`{ onMove, orientation, lastMove }`. The added `lastMove` destructure is safe because:
- Existing tests don't pass `lastMoveUci` to `PuzzleGame`, so `lastMove` is `undefined`
- `capturedBoardLastMove` is set to `undefined` each render — no side effect on existing assertions

### Playwright

| File | Tests | Why safe |
|------|-------|----------|
| `ui-layout.spec.ts` | same-row test | No shared state; new test is additive |
| `navigation.spec.ts` | 4 tests | Don't check `.last-move` squares |
| `recording.spec.ts` | 8 tests | Don't check `.last-move` squares |
| `solution.spec.ts` | 1 test | Unrelated |

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `PuzzleGame.test.tsx` | 37 | +2 | 39 |
| `cssLayoutGuards.test.ts` | 4 | — | 4 |
| `MoveTree.test.tsx` | 21 | — | 21 |
| All other web Vitest | 55 | — | 55 |
| **Web total** | **117** | **+2** | **119** |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| `ui-layout.spec.ts` | 1 | +1 | 2 |
| `navigation.spec.ts` | 4 | — | 4 |
| `recording.spec.ts` | 8 | — | 8 |
| `solution.spec.ts` | 1 | — | 1 |
| **E2E total** | **14** | **+1** | **15** |

---

## TDD sequence

### RED
1. Add `capturedBoardLastMove` variable to `PuzzleGame.test.tsx`.
2. Update the `PuzzleBoard` mock to capture `lastMove`.
3. Add `describe('PuzzleGame — lastMoveUci prop')` block.
4. Add the `last-move squares` test to `ui-layout.spec.ts`.
5. Verify:
   ```bash
   npm test -- --reporter=verbose 2>&1 | grep -E 'FAIL|×'
   # Expect: 1 Vitest failure — "PuzzleBoard receives parsed squares"
   npx playwright test e2e/ui-layout.spec.ts --reporter=line
   # Expect: 1 failure — "last-move squares are rendered"
   ```

### GREEN
6. Add `lastMove?: [string, string]` to `PuzzleBoard` props + pass to Chessground config.
7. Add `lastMoveUci?: string` to `PuzzleGame` props + derive squares + forward to `PuzzleBoard`.
8. Add `LAST_MOVE_UCI = 'f1c4'` to `page.tsx` + pass prop.
9. (Optional) Add `cg-board square.last-move` color override to `globals.css`.
10. Verify:
    ```bash
    npm test -- --reporter=verbose
    # Expect: 119/119
    npx playwright test e2e/ui-layout.spec.ts --reporter=line
    # Expect: 2/2
    ```

### YELLOW
11. Full suite:
    ```bash
    npm test
    npx playwright test --retries=1
    # Expect: 119/119 Vitest, 15/15 Playwright
    ```
