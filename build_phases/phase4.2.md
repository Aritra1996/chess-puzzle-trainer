# Phase 4.2 — Fix Yellow Square Highlight (use Chessground `selected`)

## Context

The `.sq-highlight` div in `PuzzleBoard.tsx` is positioned via percentage CSS
(`bottom: rank * 12.5%`). Because Chessground uses `top: 0 + transform` internally,
the two coordinate systems diverge by up to 2px on board sizes not divisible by 8,
making the yellow square visibly straddle a square boundary.

The correct fix is to **stop fighting Chessground's coordinate system entirely** and
instead let Chessground highlight the square itself. Calling `cgRef.current.set({
selected: 'e4' })` applies Chessground's own `cg-board square.selected` class, which
is always pixel-perfect because Chessground positions its own elements.

This also removes ~15 lines of coordinate math and the entire `squareStyle` function.

---

## Files to change

| File | Change |
|------|--------|
| `web/src/components/PuzzleBoard.tsx` | Delete `squareStyle`; drive highlight via `cg.set({ selected })` |
| `web/src/app/globals.css` | Remove `.sq-highlight` rule; add `cg-board square.selected` override |

---

## Implementation

### `PuzzleBoard.tsx`

**Remove** the `squareStyle` function (lines 33–39) and the `CSSProperties` import.

**Update** `handleOverlayClick`:
```typescript
const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if (!onMove || !cgRef.current) return;
  const rect   = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
  const square = pixelToSquare(e.clientX, e.clientY, rect, orientation);

  if (pendingSquare === null) {
    cgRef.current.set({ selected: square as Key });
    setPendingSquare(square);
  } else if (pendingSquare === square) {
    cgRef.current.set({ selected: undefined });
    setPendingSquare(null);
  } else {
    cgRef.current.set({ selected: undefined });
    onMove(pendingSquare + square);
    setPendingSquare(null);
  }
}, [onMove, orientation, pendingSquare]);
```

**Update** the orientation-change effect:
```typescript
useEffect(() => {
  cgRef.current?.set({ selected: undefined });
  setPendingSquare(null);
}, [orientation]);
```

**Remove** the `.sq-highlight` div from the JSX — the overlay no longer needs a child:
```tsx
{onMove && (
  <div
    ref={overlayRef}
    data-testid="click-overlay"
    className="click-overlay"
    data-pending={pendingSquare ?? undefined}
    onClick={handleOverlayClick}
  />
)}
```

**Add** the `Key` import:
```typescript
import type { Key } from '@lichess-org/chessground/types';
```

### `globals.css`

**Remove** the `.sq-highlight` block (lines 261–268).

**Add** after the `.click-overlay` block:
```css
/* Pending-move square highlight — driven by Chessground's own selected state */
.board-container cg-board square.selected {
  background: rgba(255, 210, 0, 0.45);
}
```

---

## Test plan (TDD: Red → Green)

### Mock update — add `set` spy

The existing mock in `PuzzleBoard.test.tsx` only tracks `destroy`. Add `mockSet`:
```typescript
const mockSet     = vi.fn()
const mockDestroy = vi.fn()
const mockChessground = vi.fn(() => ({ destroy: mockDestroy, set: mockSet }))
```

Add `mockSet.mockClear()` to the existing `beforeEach`.

### RED — 3 new / 2 updated tests

**New Test 1** — first click calls `cg.set` with the clicked square as `selected`
```typescript
it('calls cg.set with selected square after the first click', () => {
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  mockSet.mockClear()
  fireEvent.click(
    container.querySelector('[data-testid="click-overlay"]')!,
    { clientX: 30, clientY: 30, bubbles: true }
  )
  expect(mockSet).toHaveBeenCalledWith(
    expect.objectContaining({ selected: expect.stringMatching(/^[a-h][1-8]$/) })
  )
})
```
**RED** — currently: no `set` is called (old code only calls `setPendingSquare`).

**New Test 2** — second click on a different square calls `cg.set({ selected: undefined })`
```typescript
it('calls cg.set with selected: undefined after completing a move', () => {
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  const overlay = container.querySelector('[data-testid="click-overlay"]')!
  fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
  mockSet.mockClear()
  fireEvent.click(overlay, { clientX: 90, clientY: 90, bubbles: true })
  expect(mockSet).toHaveBeenCalledWith(
    expect.objectContaining({ selected: undefined })
  )
})
```
**RED** — currently: `set` is never called.

**New Test 3** — orientation change calls `cg.set({ selected: undefined })`
```typescript
it('calls cg.set with selected: undefined when orientation changes', () => {
  const { container, rerender } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  fireEvent.click(
    container.querySelector('[data-testid="click-overlay"]')!,
    { clientX: 30, clientY: 30, bubbles: true }
  )
  mockSet.mockClear()
  rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
  expect(mockSet).toHaveBeenCalledWith(
    expect.objectContaining({ selected: undefined })
  )
})
```
**RED** — currently: `set` not called on orientation change.

**Update existing Test** — "shows .sq-highlight after the first click"
→ replace with: "no .sq-highlight element is rendered after the first click"
```typescript
it('does not render a .sq-highlight element (highlight is Chessground-driven)', () => {
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  fireEvent.click(
    container.querySelector('[data-testid="click-overlay"]')!,
    { clientX: 30, clientY: 30, bubbles: true }
  )
  expect(container.querySelector('.sq-highlight')).toBeNull()
})
```
**RED** — currently: `.sq-highlight` IS rendered.

**Update existing Test** — "removes .sq-highlight after completing a two-square move"
→ delete (`.sq-highlight` no longer exists; covered by new Test 2).

---

## GREEN phase

Apply the changes to `PuzzleBoard.tsx` and `globals.css`.

```bash
cd web && npm test -- --reporter=verbose
# Expect: 64/64 green  (61 - 1 deleted test + 4 new = 64)
```

---

## REFACTOR phase

```bash
cd web && npm test          # 64/64 green
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test   # 49/49 green
```

Manual smoke-test:
1. Click a square — Chessground yellow square appears, perfectly inside the board square
2. Flip the board and click — still exact alignment
3. Resize window to smaller viewport (responsive layout) — still exact
4. Click same square twice — highlight clears
5. Complete a two-square move — highlight clears

---

## Cumulative test count

| Suite | Before | Removed | +new | After |
|-------|--------|---------|------|-------|
| `web/src/components/__tests__/PuzzleBoard.test.tsx` | 17 | −1 | +4 | 20 |
| All others | unchanged | — | — | unchanged |
| **Total web** | **61** | **−1** | **+4** | **64** |
