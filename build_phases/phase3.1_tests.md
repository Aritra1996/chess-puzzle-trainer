# Phase 3.1 — Test Plan (TDD: Red → Green → Refactor)

## Overview

Phase 3.1 adds three UX features to the board: arrow cursor, square highlight on click, and auto-orientation + flip button. This plan describes exactly which tests to write (RED), then which source files to change to make them pass (GREEN), then the clean-up pass (REFACTOR).

### Cumulative test count change

| Suite | Before | +new | =After |
|---|---|---|---|
| `PuzzleBoard.test.tsx` | 17 | +3 | **20** |
| `PuzzleGame.test.tsx` | 11 | +2 | **13** |
| `page.test.tsx` | 7 | 0 (1 replaced) | **7** |
| `recording.spec.ts` (E2E) | 6 | +2 | **8** |
| `ui.spec.ts` (E2E) | 12 | +2 | **14** |
| **Totals** | **116** | **+9** | **125** |

---

## Step 0 — Confirm baseline (all green before touching anything)

```bash
cd web && npm test           # 49 passed
cd web && npm run test:e2e   # 31 passed
```

---

## RED — Write failing tests

### R1. `web/src/components/__tests__/PuzzleBoard.test.tsx`

Add 3 tests at the end of the existing `describe('PuzzleBoard — click overlay', ...)` block.

```ts
it('shows .sq-highlight after the first click', () => {
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  const overlay = container.querySelector('[data-testid="click-overlay"]')!
  fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
  expect(container.querySelector('.sq-highlight')).not.toBeNull()
})

it('removes .sq-highlight after completing a two-square move', () => {
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  const overlay = container.querySelector('[data-testid="click-overlay"]')!
  fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
  fireEvent.click(overlay, { clientX: 90, clientY: 90, bubbles: true })
  expect(container.querySelector('.sq-highlight')).toBeNull()
})

it('clears .sq-highlight when the orientation prop changes', () => {
  const { container, rerender } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  const overlay = container.querySelector('[data-testid="click-overlay"]')!
  fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
  expect(container.querySelector('.sq-highlight')).not.toBeNull()
  rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
  expect(container.querySelector('.sq-highlight')).toBeNull()
})
```

**Expected:** 3 failures (`sq-highlight` does not exist yet).

---

### R2. `web/src/components/__tests__/PuzzleGame.test.tsx`

**First:** update the `vi.mock('../PuzzleBoard', ...)` factory at the top of the file to also capture `orientation`:

```ts
// Change from:
let capturedOnMove: ((uci: string) => void) | undefined
vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove }: { fen: string; orientation?: string; onMove?: (uci: string) => void }) => {
    capturedOnMove = onMove
    return <div data-testid="puzzle-board" />
  },
}))

// Change to:
let capturedOnMove: ((uci: string) => void) | undefined
let capturedOrientation: string | undefined
vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove, orientation }: { fen: string; orientation?: string; onMove?: (uci: string) => void }) => {
    capturedOnMove = onMove
    capturedOrientation = orientation
    return <div data-testid="puzzle-board" />
  },
}))
```

Then add 2 tests at the end of `describe('PuzzleGame', ...)`:

```ts
it('auto-derives black orientation from a black-to-move FEN', () => {
  render(<PuzzleGame fen={SAMPLE_FEN} />)   // no orientation prop — let it self-derive
  expect(capturedOrientation).toBe('black')
})

it('flip button toggles board orientation', () => {
  render(<PuzzleGame fen={SAMPLE_FEN} />)
  expect(capturedOrientation).toBe('black')
  act(() => {
    screen.getByTitle('flip board').click()
  })
  expect(capturedOrientation).toBe('white')
})
```

**Expected:** 2 failures (`PuzzleGame` has no auto-derive logic yet; `getByTitle` may not find the button since it has no `title` attribute yet).

---

### R3. `web/src/app/__tests__/page.test.tsx`

Replace the existing orientation test (no net change in count):

```ts
// Remove:
it('passes orientation white to PuzzleGame', () => {
  render(<Home />)
  expect(screen.getByTestId('puzzle-game')).toHaveAttribute('data-orientation', 'white')
})

// Add:
it('does not pass an orientation prop to PuzzleGame (board self-orients)', () => {
  render(<Home />)
  expect(screen.getByTestId('puzzle-game')).not.toHaveAttribute('data-orientation')
})
```

**Expected:** 1 failure (page.tsx still passes `orientation="white"`).

---

### R4. `web/e2e/recording.spec.ts`

**First:** update the `sq()` helper and its comment, because SAMPLE_FEN is black-to-move and the board will auto-orient to black at bottom:

```ts
// Board is 480×480px, BLACK orientation (black to move auto-orients).
// Black orientation: file h is left (x=0), file a is right. Rank 1 is top, rank 8 is bottom.
// Formula: x = (7 - file) * 60 + 30,  y = (rank - 1) * 60 + 30
const sq = (file: number, rank: number) => ({
  x: (7 - file) * 60 + 30,
  y: (rank - 1) * 60 + 30,
})
```

All existing `sq()` calls stay unchanged (same file/rank arguments — formula handles the flip).

Then add 2 new tests at the end of `describe('Phase 3 — Move Recording', ...)`:

```ts
test('sq-highlight appears after the first click', async ({ page }) => {
  const board = page.locator('.board-container')
  await board.click({ position: sq(5, 6) })   // f6 — first click only
  await expect(page.locator('.sq-highlight')).toBeVisible()
})

test('sq-highlight disappears after completing a move', async ({ page }) => {
  const board = page.locator('.board-container')
  await board.click({ position: sq(5, 6) })   // f6
  await board.click({ position: sq(3, 5) })   // d5 — completes move
  await expect(page.locator('.sq-highlight')).not.toBeVisible()
})
```

**Expected:** ~5–6 failures (sq() coordinates are wrong for current white orientation; highlight tests fail since `.sq-highlight` doesn't exist).

---

### R5. `web/e2e/ui.spec.ts`

**First:** update the four hardcoded coordinates inside the two token tests:

| Square | Old (white orient) | New (black orient) |
|--------|-------------------|--------------------|
| f6 | `{x:330, y:150}` | `{x:150, y:330}` |
| d5 | `{x:210, y:210}` | `{x:270, y:270}` |
| a2 | `{x:30, y:390}` | `{x:450, y:90}` |
| a3 | `{x:30, y:330}` | `{x:450, y:150}` |

Then add 2 new tests at the end of `describe('Phase 2.1 — Paper/Ink UI', ...)`:

```ts
test('board starts with black pieces at the bottom for a black-to-move FEN', async ({ page }) => {
  const boardBox  = await page.locator('.board-container').boundingBox()
  const queenBox  = await page.locator('cg-board piece.black.queen').boundingBox()
  // In black orientation rank 8 (queen's home rank) is at the visual bottom
  expect(queenBox!.y).toBeGreaterThan(boardBox!.y + boardBox!.height * 0.6)
})

test('clicking the flip button shows white pieces at the bottom', async ({ page }) => {
  await page.locator('button[title="flip board"]').click()
  const boardBox  = await page.locator('.board-container').boundingBox()
  const queenBox  = await page.locator('cg-board piece.black.queen').boundingBox()
  // After flip (white orientation) rank 8 is at the visual top
  expect(queenBox!.y).toBeLessThan(boardBox!.y + boardBox!.height * 0.4)
})
```

**Expected:** several failures (auto-orient not implemented; button has no `title` attribute; token test clicks land on wrong squares).

---

### R1–R5 run check

```bash
cd web && npm test           # expect ~5 new failures (49 → some fail)
cd web && npm run test:e2e   # expect ~8 new failures (31 → some fail)
```

Confirm the failures are the expected ones before moving to GREEN.

---

## GREEN — Implement source to pass all tests

### G1. `web/src/app/globals.css`

```css
/* Change: */
.click-overlay {
  cursor: crosshair;     /* ← remove */
  cursor: default;       /* ← add */
}

/* Add after .click-overlay: */
.sq-highlight {
  position: absolute;
  width: 12.5%;
  height: 12.5%;
  background: rgba(255, 210, 0, 0.45);
  pointer-events: none;
  z-index: 1;
}
```

### G2. `web/src/components/PuzzleBoard.tsx`

Add `squareStyle` helper above the component (converts square name + orientation → CSS `left`/`bottom`):

```ts
function squareStyle(sq: string, orientation: 'white' | 'black'): React.CSSProperties {
  const fileIdx = sq.charCodeAt(0) - 97;
  const rankIdx = parseInt(sq[1], 10) - 1;
  const file = orientation === 'black' ? 7 - fileIdx : fileIdx;
  const rank = orientation === 'black' ? 7 - rankIdx : rankIdx;
  return { left: `${file * 12.5}%`, bottom: `${rank * 12.5}%` };
}
```

Add `useEffect` to clear `pendingSquare` when orientation changes:

```ts
useEffect(() => { setPendingSquare(null); }, [orientation]);
```

Update the overlay JSX to render `.sq-highlight` inside it:

```tsx
{onMove && (
  <div
    ref={overlayRef}
    data-testid="click-overlay"
    className="click-overlay"
    data-pending={pendingSquare ?? undefined}
    onClick={handleOverlayClick}
  >
    {pendingSquare && (
      <div className="sq-highlight" style={squareStyle(pendingSquare, orientation)} />
    )}
  </div>
)}
```

### G3. `web/src/components/PuzzleGame.tsx`

Keep `orientation` as an optional prop (existing unit tests pass it explicitly and still work). Add internal state derived from the FEN turn when no prop is given:

```ts
interface Props {
  fen: string;
  orientation?: 'white' | 'black';
}

export default function PuzzleGame({ fen, orientation: orientationProp }: Props) {
  const derivedOrientation = parseFen(fen).turn as 'white' | 'black';
  const [boardOrientation, setBoardOrientation] =
    useState<'white' | 'black'>(orientationProp ?? derivedOrientation);
  // ... rest of component
```

Wire the ⇅ button (add `title` attribute and `onClick`):

```tsx
<button
  className="ico"
  title="flip board"
  onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')}
>
  ⇅
</button>
```

Pass `boardOrientation` to `<PuzzleBoard>`:

```tsx
<PuzzleBoard fen={fen} orientation={boardOrientation} onMove={handleMove} />
```

### G4. `web/src/app/page.tsx`

Remove `orientation="white"` from the `<PuzzleGame>` call:

```tsx
<PuzzleGame fen={SAMPLE_FEN} />
```

### G5 — GREEN run check

```bash
cd web && npm test           # expect 51 passed (49 + 3 board + 2 game, page stays 7)
cd web && npm run test:e2e   # expect 35 passed (31 + 2 recording + 2 ui)
```

---

## REFACTOR — Clean up (Yellow)

After all 125 tests are green, do a quick cleanup pass:

1. Remove the dead comment `// Click overlay for Phase 3 move recording` in `globals.css` if it no longer accurately scopes the rules.
2. Verify no `console.warn` or `console.error` output during `npm test` (missing `act()` wrappers, etc.).
3. Manual browser check:
   - Load page → board shows black at bottom ✓
   - Click a square → yellow highlight appears ✓
   - Click second square → highlight disappears ✓
   - Click ⇅ → board flips, highlight cleared ✓
   - Hover over board → arrow cursor throughout ✓

### Final counts

```bash
cd web && npm test           # 51 passed
cd web && npm run test:e2e   # 35 passed
```

---

## File → test mapping

| Source file changed | Tests that go RED | Test file |
|---|---|---|
| `globals.css` (cursor) | — (CSS only, no unit test) | — |
| `globals.css` (.sq-highlight) | R1 highlights, R4 E2E highlights | PuzzleBoard.test, recording.spec |
| `PuzzleBoard.tsx` (highlight render) | R1 all 3 tests | PuzzleBoard.test |
| `PuzzleBoard.tsx` (clear on orient) | R1 test 3 | PuzzleBoard.test |
| `PuzzleGame.tsx` (auto-orient, flip) | R2 both tests | PuzzleGame.test |
| `page.tsx` (remove orient prop) | R3 | page.test |
| board now black-orient on load | R4 sq() coords, R5 coords | recording.spec, ui.spec |
| flip button `title` attr | R2, R5 flip E2E | PuzzleGame.test, ui.spec |
