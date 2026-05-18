# Phase 6.8.7 — Fix Vercel Build TypeScript Errors

## Problem

`vercel --prod` failed during the TypeScript check step with:

```
Type error: Cannot find module '@lichess-org/chessground/dist/types'
or its corresponding type declarations.

./src/components/PuzzleBoard.tsx:6:26
> 6 | import type { Key } from '@lichess-org/chessground/dist/types';
```

Running `tsc --noEmit` locally reveals **three errors** total across two files.
Only the first blocks the Vercel build; the other two are in test files that `next build`
doesn't traverse — but all three should be fixed so `tsc --noEmit` is fully clean.

---

## Root Causes

### Error 1 — `PuzzleBoard.tsx` (BLOCKING)

```
Cannot find module '@lichess-org/chessground/dist/types'
```

`tsconfig.json` uses `"moduleResolution": "bundler"`, which enforces the package's
`exports` map strictly. The Chessground package exports:

```json
{ ".": "./dist/chessground.js", "./assets/*": "./assets/*", "./*": "./dist/*.js" }
```

`@lichess-org/chessground/dist/types` does not match any export entry (it would resolve
to `./dist/dist/types.js` — wrong path). Locally, TypeScript falls back to filesystem
resolution in some configurations and finds `dist/types.d.ts` directly — masking the
error. Vercel's stricter build environment surfaces it.

**Fix:** Use the correct subpath: `@lichess-org/chessground/types` → resolves to
`./dist/types.js` via the `./*` → `./dist/*.js` export rule.

---

### Error 2 — `MoveTree.test.tsx` lines 142, 148, 154 (non-blocking)

```
Type 'Map<string, string>' is not assignable to type 'Map<string, CheckStatus>'.
Type 'string' is not assignable to type '"correct" | "wrong" | "illegal"'.
```

The tests annotate the map as `Map<string, string>` but the `checkResult` prop on
`MoveTree` expects `Map<string, CheckStatus>`. TypeScript doesn't allow widening from
a narrower union type.

**Fix:** Replace `Map<string, string>` with the correct type:
```typescript
import type { CheckStatus } from '@/shared/solutionChecker'
// …
const result = new Map<string, CheckStatus>([['node-1', 'wrong']])
```

---

### Error 3 — `PuzzleBoard.test.tsx` — 7 occurrences (non-blocking)

```
Tuple type '[]' of length '0' has no element at index '1'.
'config' is possibly 'undefined'.
```

`vi.fn(() => ...)` with no explicit type parameter infers the mock's parameter list as
`[]` (zero args). TypeScript therefore types `mock.calls` as `[][]` — an array of empty
tuples — so accessing `mock.calls[0][1]` (the second argument, the Chessground config)
is a compile-time error.

**Fix:** Give the mock explicit arg-type generics so TypeScript knows it receives
`(element: HTMLElement, config: Config)`:

```typescript
import type { Config } from '@lichess-org/chessground/config'

const mockChessground = vi.fn<[HTMLElement, Config]>(() => ({
  destroy: mockDestroy,
  set: mockSet,
}))
```

`mock.calls[0][1]` is then typed as `Config` and all 7 sites resolve cleanly.

---

## Files

| File | Change | Errors fixed |
|------|--------|--------------|
| `src/components/PuzzleBoard.tsx` | Fix import subpath | 1 (blocking) |
| `src/components/__tests__/MoveTree.test.tsx` | Fix Map type annotation | 3 |
| `src/components/__tests__/PuzzleBoard.test.tsx` | Add generic to vi.fn mock | 7 |

---

## Changes in detail

### `PuzzleBoard.tsx` — 1-line fix

```diff
- import type { Key } from '@lichess-org/chessground/dist/types';
+ import type { Key } from '@lichess-org/chessground/types';
```

### `MoveTree.test.tsx` — 3 occurrences

```diff
+ import type { CheckStatus } from '@/shared/solutionChecker'

- const result: Map<string, string> = new Map([['node-1', 'wrong']])
+ const result = new Map<string, CheckStatus>([['node-1', 'wrong']])

- const result: Map<string, string> = new Map([['node-1', 'correct']])
+ const result = new Map<string, CheckStatus>([['node-1', 'correct']])

- const result: Map<string, string> = new Map([['node-1', 'illegal']])
+ const result = new Map<string, CheckStatus>([['node-1', 'illegal']])
```

### `PuzzleBoard.test.tsx` — mock generic

```diff
+ import type { Config } from '@lichess-org/chessground/config'

- const mockChessground = vi.fn(() => ({ destroy: mockDestroy, set: mockSet }))
+ const mockChessground = vi.fn<[HTMLElement, Config]>(() => ({
+   destroy: mockDestroy,
+   set: mockSet,
+ }))
```

No logic changes — all 7 `mock.calls[0][1]` access sites become valid automatically once
the mock has the correct parameter types.

---

## Tests

No new tests. No test logic changes. All 126 Vitest tests must stay GREEN.

**Verify before deploying:**

```bash
npx tsc --noEmit
# Expect: 0 errors

npm test
# Expect: 126/126

vercel --prod --cwd /home/aritra/Claude/chess-puzzle-trainer
# Expect: build succeeds, deployment READY
```

**Test delta: 0 new, 0 modified. 126/126 Vitest, 53/53 Playwright unchanged.**
