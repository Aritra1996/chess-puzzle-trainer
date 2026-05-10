# Phase 3.1 — Board UX: Cursor, Square Highlight & Auto-Orientation

## Overview

Three UX improvements to the puzzle board:

| # | Feature | Problem |
|---|---------|---------|
| 1 | **Arrow cursor** | Overlay forces `crosshair` — feels like drawing mode, not chess |
| 2 | **Square highlight** | No visual feedback after clicking a source square |
| 3 | **Auto-orientation + flip** | Board always shows white at bottom even when black to move; flip button (⇅) is wired to nothing |

---

## Feature 1 — Arrow Cursor

**File:** `web/src/app/globals.css` (line 258)

Change one property on `.click-overlay`:

```css
/* before */
cursor: crosshair;

/* after */
cursor: default;
```

---

## Feature 2 — Square Highlight

### CSS (`web/src/app/globals.css`)

Add immediately after `.click-overlay {}`:

```css
.sq-highlight {
  position: absolute;
  width: 12.5%;
  height: 12.5%;
  background: rgba(255, 210, 0, 0.45);
  pointer-events: none;
  z-index: 1;
}
```

### Component (`web/src/components/PuzzleBoard.tsx`)

Add a `squareStyle` helper above the component — converts a square name (`'f6'`) and orientation to `left` / `bottom` CSS percentages:

```ts
function squareStyle(sq: string, orientation: 'white' | 'black'): React.CSSProperties {
  const fileIdx = sq.charCodeAt(0) - 97;       // 'a'=0 … 'h'=7
  const rankIdx = parseInt(sq[1], 10) - 1;     // '1'=0 … '8'=7
  const file = orientation === 'black' ? 7 - fileIdx : fileIdx;
  const rank = orientation === 'black' ? 7 - rankIdx : rankIdx;
  return { left: `${file * 12.5}%`, bottom: `${rank * 12.5}%` };
}
```

Inside the existing overlay `<div>`, render the highlight when `pendingSquare` is set:

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

Also add a `useEffect` in `PuzzleBoard` to clear `pendingSquare` when orientation changes (prevents a stale first-click surviving a board flip):

```ts
useEffect(() => { setPendingSquare(null); }, [orientation]);
```

---

## Feature 3 — Auto-Orientation & Flip Button

### Logic (`web/src/components/PuzzleGame.tsx`)

- **Remove** `orientation` from `Props` interface (or keep as optional override — see below).
- Add internal state initialized from the FEN's side to move:

```ts
const derivedOrientation = parseFen(fen).turn as 'white' | 'black';
const [boardOrientation, setBoardOrientation] =
  useState<'white' | 'black'>(orientationProp ?? derivedOrientation);
```

- Keep `orientation?: 'white' | 'black'` as an optional prop so existing unit tests that pass `orientation="white"` continue to work as explicit overrides.

- Wire the existing ⇅ button (currently static):

```tsx
<button
  className="ico"
  title="flip board"
  onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')}
>
  ⇅
</button>
```

- Pass `boardOrientation` to `<PuzzleBoard>` instead of the prop directly.

### Page (`web/src/app/page.tsx`)

Remove `orientation="white"` from the `<PuzzleGame>` call so PuzzleGame auto-derives from the FEN:

```tsx
<PuzzleGame fen={SAMPLE_FEN} />
```

SAMPLE_FEN is black to move → board loads with black at the bottom. ✓

---

## Test Updates

### `web/src/app/__tests__/page.test.tsx`

The test `'passes orientation white to PuzzleGame'` checks `data-orientation="white"`. After removing the prop from page.tsx, the attribute will be absent (`null`). Replace it:

```ts
// Before:
it('passes orientation white to PuzzleGame', () => {
  expect(screen.getByTestId('puzzle-game')).toHaveAttribute('data-orientation', 'white')
})

// After:
it('does not pass orientation prop to PuzzleGame (board self-orients)', () => {
  render(<Home />)
  expect(screen.getByTestId('puzzle-game')).not.toHaveAttribute('data-orientation')
})
```

Count stays at 7.

### `web/src/components/__tests__/PuzzleBoard.test.tsx`

Add 2 tests in the existing `'PuzzleBoard — click overlay'` block:

```ts
it('shows a sq-highlight after first click', () => {
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  fireEvent.click(container.querySelector('[data-testid="click-overlay"]')!, {
    clientX: 330, clientY: 150,   // f6, white orientation
  })
  expect(container.querySelector('.sq-highlight')).not.toBeNull()
})

it('removes sq-highlight after second (different) click', () => {
  const onMove = vi.fn()
  const { container } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={onMove} />
  )
  const overlay = container.querySelector('[data-testid="click-overlay"]')!
  fireEvent.click(overlay, { clientX: 330, clientY: 150 })   // f6
  fireEvent.click(overlay, { clientX: 210, clientY: 210 })   // d5
  expect(container.querySelector('.sq-highlight')).toBeNull()
})
```

Total PuzzleBoard tests: 17 → **19**.

### E2E tests — coordinates update for black orientation

SAMPLE_FEN is black to move → auto-orientation loads with black at bottom. All click coordinates must be recalculated.

**Black orientation formula** (derived from `pixelToSquare` flip logic):
```
x = (7 - file_0idx) * 60 + 30    // file a=0…h=7
y = (rank - 1) * 60 + 30         // rank 1…8
```

**`web/e2e/recording.spec.ts`** — update `sq()` helper and comment:

```ts
// Board is 480×480px, BLACK orientation (black-to-move auto-orient). Each square = 60×60px.
// file 0=a…7=h appears right→left; rank 1-8 appears top→bottom.
const sq = (file: number, rank: number) => ({
  x: (7 - file) * 60 + 30,
  y: (rank - 1) * 60 + 30,
})
```

Move clicks f6→d5 become:
- `sq(5, 6)` → `{x: 150, y: 330}`
- `sq(3, 5)` → `{x: 270, y: 270}`

Same-square test `sq(5, 6)` → same. ✓

**`web/e2e/ui.spec.ts`** — update hardcoded coordinates:

| Square | Old (white) | New (black) |
|--------|-------------|-------------|
| f6     | `{x:330, y:150}` | `{x:150, y:330}` |
| d5     | `{x:210, y:210}` | `{x:270, y:270}` |
| a2     | `{x:30, y:390}`  | `{x:450, y:90}`  |
| a3     | `{x:30, y:330}`  | `{x:450, y:150}` |

---

## Files Touched

| File | Change |
|------|--------|
| `web/src/app/globals.css` | `cursor: default`; add `.sq-highlight` rule |
| `web/src/components/PuzzleBoard.tsx` | `squareStyle` helper; `.sq-highlight` render; `useEffect` to clear on orientation change |
| `web/src/components/PuzzleGame.tsx` | Internal `boardOrientation` state; wire ⇅ button; pass `boardOrientation` to PuzzleBoard |
| `web/src/app/page.tsx` | Remove `orientation="white"` from `<PuzzleGame>` |
| `web/src/app/__tests__/page.test.tsx` | Replace orientation-white test with no-orientation-prop test |
| `web/src/components/__tests__/PuzzleBoard.test.tsx` | +2 highlight tests |
| `web/e2e/recording.spec.ts` | Update `sq()` for black orientation |
| `web/e2e/ui.spec.ts` | Update click coordinates for black orientation |

---

## Verification

```bash
cd web && npm test            # expect 51 passed (49 + 2 new highlight tests)
cd web && npm run test:e2e    # expect 31 passed
```

Manual: load the page → board shows black at bottom → click a square → yellow highlight appears → click second square → highlight disappears → click ⇅ → board flips to white at bottom.
