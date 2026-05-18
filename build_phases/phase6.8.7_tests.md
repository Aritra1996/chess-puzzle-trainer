# Phase 6.8.7 — Test Plan: Fix Vercel Build TypeScript Errors

## Overview

Phase 6.8.7 is a pure type-correctness fix — no runtime behaviour changes, no new
component logic. The three edits are:

1. `PuzzleBoard.tsx` — import subpath fix (1 line)
2. `MoveTree.test.tsx` — type annotations on 3 `Map` variables
3. `PuzzleBoard.test.tsx` — one `vi.fn` generic

No new behavioural tests are needed. One regression guard is added to
`cssLayoutGuards.test.ts` to prevent the broken import path from being silently
re-introduced in future.

The primary success criterion for this phase is **`tsc --noEmit` reporting zero errors**
(down from 20 currently).

| File | Change | Delta |
|------|--------|-------|
| `cssLayoutGuards.test.ts` | +1 import-path guard | +1 Vitest |
| `MoveTree.test.tsx` | type-annotation fix (no logic change) | 0 |
| `PuzzleBoard.test.tsx` | `vi.fn` generic fix (no logic change) | 0 |
| All other files | Unchanged | — |

**Total: 126 → 127 Vitest (+1), 53 Playwright (unchanged)**

---

## New test — `cssLayoutGuards.test.ts`

Guard: `PuzzleBoard.tsx` must import `Key` from the correct Chessground subpath.

```typescript
it('PuzzleBoard imports Key from @lichess-org/chessground/types, not /dist/types', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../components/PuzzleBoard.tsx'),
    'utf8',
  )
  expect(src).toContain("from '@lichess-org/chessground/types'")
  expect(src).not.toContain("from '@lichess-org/chessground/dist/types'")
})
```

**Why RED (before fix):**
`PuzzleBoard.tsx` currently has `from '@lichess-org/chessground/dist/types'` → the
`not.toContain` assertion fails → RED ✓.

**Why GREEN (after fix):**
Import is changed to `from '@lichess-org/chessground/types'` → both assertions pass ✓.

**Why this guard is worthwhile:**
This import silently works in local dev (TypeScript falls back to filesystem resolution)
but fails on Vercel (strict `bundler` moduleResolution). Without a guard, the wrong path
could be re-introduced and not caught until the next production deploy.

---

## Changes to existing test files — type fixes only

### `MoveTree.test.tsx` — 3 lines

Changing `Map<string, string>` to `Map<string, CheckStatus>` is a type annotation
narrowing. The constructed `Map` values (`'wrong'`, `'correct'`, `'illegal'`) are already
valid `CheckStatus` literals — the test logic is identical.

**All existing MoveTree tests stay GREEN.**

### `PuzzleBoard.test.tsx` — mock generic

Adding `<[HTMLElement, Config]>` to `vi.fn(...)` tells TypeScript the mock receives two
arguments. This makes `mock.calls[0][1]` valid. The mock still behaves identically at
runtime — Vitest ignores the type parameter.

**All existing PuzzleBoard tests stay GREEN.**

---

## Existing tests — full impact assessment

### Vitest (126 existing)

| File | Reason safe |
|------|-------------|
| `cssLayoutGuards.test.ts` (5) | New guard is an addition; existing 5 rules unchanged |
| `MoveTree.test.tsx` (6+) | Type-only annotation change; test logic identical |
| `PuzzleBoard.test.tsx` | Generic on mock; runtime behaviour unchanged |
| `PuzzleGame.test.tsx` | Doesn't touch PuzzleBoard import or MoveTree types |
| `TourGuide.test.tsx` | Unrelated |
| All shared tests | Unrelated |

### Playwright (53)

No component behaviour changes — all 53 E2E tests unaffected.

---

## TDD sequence

### RED
1. Add the import-path guard to `cssLayoutGuards.test.ts`.
2. Verify:
   ```bash
   npx vitest run src/lib/__tests__/cssLayoutGuards.test.ts --reporter=verbose
   # Expect: 1 failure (the new guard), 5 passes
   ```
3. Also confirm the TS baseline:
   ```bash
   npx tsc --noEmit 2>&1 | grep -c "error TS"
   # Expect: 20
   ```

### GREEN
4. Apply the three source fixes (`PuzzleBoard.tsx`, `MoveTree.test.tsx`, `PuzzleBoard.test.tsx`).
5. Verify:
   ```bash
   npx vitest run src/lib/__tests__/cssLayoutGuards.test.ts --reporter=verbose
   # Expect: 6/6

   npx tsc --noEmit
   # Expect: 0 errors
   ```

### YELLOW
6. Full suite + deploy:
   ```bash
   npm test
   # Expect: 127/127

   npx playwright test --retries=1
   # Expect: 53/53

   vercel --prod --cwd /home/aritra/Claude/chess-puzzle-trainer
   # Expect: build READY, no TypeScript errors
   ```

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `cssLayoutGuards.test.ts` | 6 | +1 | 7 |
| All other files | 120 | — | 120 |
| **Total** | **126** | **+1** | **127** |

### Playwright

| Suite | Before | Delta | After |
|-------|--------|-------|-------|
| All specs | 53 | 0 | 53 |
