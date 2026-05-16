# Phase 6.8.3 — Last-Move Highlight on Board

## Context

The puzzle board always shows the initial FEN (it doesn't update when navigating the analysis
tree). The "last move" in scope is the puzzle setup move — the move White played that created
the puzzle position. For the sample, `Bc4` came from f1 → c4 (UCI: `f1c4`).

Chessground has built-in support for last-move highlighting via:
- `highlight: { lastMove: true }` in config
- `lastMove: Key[]` in config (e.g. `['f1', 'c4']`)

Currently `PuzzleBoard.tsx` has `highlight: { lastMove: false }` — the feature is explicitly
disabled. This phase enables it when the caller supplies the UCI move.

---

## Scope

Highlight the from-square and to-square of the setup move when `lastMoveUci` is provided.
No change to navigation behavior (board stays at initial FEN throughout).

---

## Changes

### 1. `web/src/components/PuzzleBoard.tsx`

Add a `lastMove?: [string, string]` prop. Pass it to the Chessground config.

```typescript
interface Props {
  fen:         string;
  orientation?: 'white' | 'black';
  onMove?:     (uci: string) => void;
  lastMove?:   [string, string];         // ← NEW: from/to squares e.g. ['f1', 'c4']
}

// In the Chessground useEffect:
const config: Config = {
  fen,
  orientation,
  viewOnly: true,
  animation:  { enabled: false },
  highlight:  { lastMove: !!lastMove, check: false },  // ← enable when prop provided
  drawable:   { enabled: false },
  ...(lastMove && { lastMove: lastMove as Key[] }),     // ← pass squares
};
// Dependency array: [fen, orientation, lastMove]
```

### 2. `web/src/components/PuzzleGame.tsx`

Add `lastMoveUci?: string` prop. Parse to squares and forward to `PuzzleBoard`.

```typescript
interface Props {
  fen:          string;
  orientation?: 'white' | 'black';
  solution?:    string;
  lastMove?:    string;      // SAN — for context token label (unchanged)
  lastMoveUci?: string;      // UCI — for board highlight e.g. 'f1c4'
}

// Derive highlight squares (at render time, zero cost):
const lastMoveSquares = lastMoveUci
  ? [lastMoveUci.slice(0, 2), lastMoveUci.slice(2, 4)] as [string, string]
  : undefined;

// Pass to PuzzleBoard:
<PuzzleBoard
  fen={fen}
  orientation={boardOrientation}
  onMove={handleMove}
  lastMove={lastMoveSquares}
/>
```

### 3. `web/src/app/page.tsx`

Add the UCI for the sample puzzle's setup move.

```typescript
const LAST_MOVE_UCI = 'f1c4';  // bishop f1→c4 = Bc4 (dark-sq bishop stays on c1 in SAMPLE_FEN)

<PuzzleGame
  fen={SAMPLE_FEN}
  solution={SAMPLE_SOLUTION}
  lastMove={LAST_MOVE}
  lastMoveUci={LAST_MOVE_UCI}
/>
```

**Verification:** In `SAMPLE_FEN`, rank-1 reads `R1BQK2R`:
- c1 = bishop (dark-squared, still there)
- f1 = empty (light-squared bishop has moved away → to c4)

So `f1c4` is correct.

### 4. `web/src/app/globals.css` (optional but recommended)

Chessground's brown theme colours `.last-move` squares with a greenish tint. Override to match
the paper/amber palette:

```css
cg-board square.last-move {
  background-color: rgba(196,170,40,.35);   /* warm gold, matches --yellow-edge */
}
```

---

## What does NOT change

- `shared/moveTree.ts` — tree data model unchanged
- Navigation behaviour — board still shows initial FEN throughout
- Context token (`lastMove` SAN prop) — unchanged
- All other components

---

## Tests

### Unit tests — `web/src/components/__tests__/PuzzleGame.test.tsx`

The existing `PuzzleBoard` mock in this file captures props. Add 2 tests:

```typescript
describe('PuzzleGame — lastMoveUci prop')
  ✓ PuzzleBoard receives lastMove=[from,to] when lastMoveUci is provided
  ✓ PuzzleBoard receives lastMove=undefined when lastMoveUci is omitted
```

**Why RED:**
- Before change, `PuzzleBoard` mock never receives a `lastMove` prop → first test fails.
- The second test passes immediately (prop is absent = undefined).

**Approximate test code:**
```typescript
describe('PuzzleGame — lastMoveUci prop', () => {
  it('PuzzleBoard receives parsed lastMove squares when lastMoveUci is provided', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} lastMoveUci="f1c4" />)
    expect(capturedBoardProps?.lastMove).toEqual(['f1', 'c4'])
  })

  it('PuzzleBoard receives no lastMove when lastMoveUci is omitted', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedBoardProps?.lastMove).toBeUndefined()
  })
})
```

`capturedBoardProps` is captured via the existing `PuzzleBoard` mock — update the mock to
also capture `lastMove`.

### E2E — `web/e2e/ui-layout.spec.ts`

Add one Playwright test to verify the `.last-move` squares appear on the board:

```typescript
test('last-move squares are rendered on the board when lastMoveUci is provided', async ({ page }) => {
  await page.goto('/')
  // SAMPLE_FEN has lastMoveUci='f1c4' wired in page.tsx
  const lastMoveSquares = page.locator('cg-board square.last-move')
  await expect(lastMoveSquares).toHaveCount(2)  // from-square + to-square
})
```

**Why RED:** Currently `highlight: { lastMove: false }` → no `.last-move` squares rendered →
count is 0, assertion fails.

---

## TDD sequence

| Step | Action | Expected |
|------|--------|----------|
| RED | Write unit tests + E2E test | 2 unit fails, 1 E2E fail |
| GREEN | Update PuzzleBoard + PuzzleGame + page.tsx (+ optional CSS) | All pass |
| YELLOW | `npm test` + `npx playwright test --retries=1` | 119/119 Vitest, 15/15 Playwright |

**Test delta:**

| Suite | Before | Delta | After |
|-------|--------|-------|-------|
| `PuzzleGame.test.tsx` | 37 | +2 | 39 |
| `ui-layout.spec.ts` | 1 | +1 | 2 |
| Everything else | unchanged | — | — |
| **Vitest total** | 117 | +2 | 119 |
| **Playwright total** | 14 | +1 | 15 |
