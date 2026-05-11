# Phase 4.3 — Preserve Highlight When Board Is Flipped

## Context

When a user clicks a square (setting `pendingSquare`), then flips the board, the yellow
Chessground-driven highlight disappears. This is caused by the orientation-change
`useEffect` in `PuzzleBoard.tsx` explicitly calling `cgRef.current?.set({ selected: undefined })`
and `setPendingSquare(null)`. The intended behavior is that the pending square persists
across flips — the square name (e.g. `e4`) is orientation-agnostic and Chessground draws
it correctly in either orientation.

---

## Root Cause

```typescript
// web/src/components/PuzzleBoard.tsx — lines 54–57
useEffect(() => {
  cgRef.current?.set({ selected: undefined });  // ← clears highlight
  setPendingSquare(null);                        // ← clears pending state
}, [orientation]);
```

When `orientation` changes:
1. Init effect (deps `[fen, orientation]`) fires → Chessground destroyed and recreated (no `selected`)
2. Orientation effect fires → explicitly clears `selected` and `pendingSquare`

The fix: the orientation effect should **re-apply** `pendingSquare` after recreation instead of clearing it.

---

## Files to change

| File | Change |
|------|--------|
| `web/src/components/PuzzleBoard.tsx` | Add `pendingRef`; change orientation effect to re-apply pending square |
| `web/src/components/__tests__/PuzzleBoard.test.tsx` | 2 tests updated, 1 new test added |

---

## Implementation

### `web/src/components/PuzzleBoard.tsx`

**Add** a ref to track `pendingSquare` without stale-closure risk:
```typescript
const pendingRef = useRef<string | null>(null);
```

**Keep all existing `setPendingSquare(x)` calls** but also update the ref at each site:

In `handleOverlayClick`:
```typescript
// after: setPendingSquare(square)
pendingRef.current = square;

// after: setPendingSquare(null)
pendingRef.current = null;
```

**Replace** the orientation-change effect:
```typescript
// Before:
useEffect(() => {
  cgRef.current?.set({ selected: undefined });
  setPendingSquare(null);
}, [orientation]);

// After:
useEffect(() => {
  if (pendingRef.current !== null) {
    cgRef.current?.set({ selected: pendingRef.current as Key });
  }
}, [orientation]);
```

Why a ref and not adding `pendingSquare` to deps:
Adding `pendingSquare` to the effect deps would cause the effect to re-fire on every click
(redundantly re-calling `set({ selected })`), and would also re-fire when the effect itself
clears the pending state, creating a loop. The ref gives us the value at effect-fire time
without the spurious re-runs.

---

## Tests (TDD: Red → Green → Refactor)

### RED phase

**UPDATE** (currently passing, assertion inverted → now fails):
```typescript
// 'clears data-pending when the orientation prop changes'
// → rename and invert assertion:
it('preserves data-pending when the orientation prop changes', () => {
  const { container, rerender } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  const overlay = container.querySelector('[data-testid="click-overlay"]')!
  fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
  rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
  expect(overlay).toHaveAttribute('data-pending')   // was: not.toHaveAttribute
})
```
**RED** — currently `setPendingSquare(null)` on flip removes the attribute.

**UPDATE** (currently passing, assertion changed → now fails):
```typescript
// 'calls cg.set with selected: undefined when orientation prop changes'
// → rename and change expected value:
it('calls cg.set with the pending square when orientation prop changes', () => {
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
    expect.objectContaining({ selected: expect.stringMatching(/^[a-h][1-8]$/) })
  )
})
```
**RED** — currently `set({ selected: undefined })` is called.

**ADD** (new coverage for the no-pending-square case):
```typescript
it('does not call cg.set when orientation changes and no square is pending', () => {
  const { rerender } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  mockSet.mockClear()
  rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
  // pendingRef.current is null — effect should not call set at all
  expect(mockSet).not.toHaveBeenCalled()
})
```
**RED** — currently the effect calls `set({ selected: undefined })` unconditionally.

### Summary of RED failures

| # | Test | Why it fails now |
|---|------|-----------------|
| 1 | preserves data-pending on flip | `setPendingSquare(null)` clears it |
| 2 | calls cg.set with pending square on flip | effect calls `set({ selected: undefined })` |
| 3 | does not call cg.set when no pending on flip | effect calls `set({ selected: undefined })` |

Minimum RED count: **3 tests fail**.

### GREEN phase

Apply the changes above to `PuzzleBoard.tsx`.

```bash
cd web && npm test -- --reporter=verbose
# Expect: 65/65 green  (64 − 2 updated + 2 updated + 1 new = 65)
```

### REFACTOR phase

```bash
cd web && npm test          # 65/65 green
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test  # 49/49 green
```

---

## Cumulative test count

| Suite | Before | Removed | Updated | +new | After |
|-------|--------|---------|---------|------|-------|
| `PuzzleBoard.test.tsx` | 64 | 0 | 2 | +1 | 65 |
| All others | unchanged | — | — | — | unchanged |
| **Total web** | **64** | **0** | **2** | **+1** | **65** |

---

## Manual smoke-test (post-GREEN)

1. Click a square — yellow highlight appears
2. Click the flip button — highlight remains on the **same square** (now drawn in flipped view)
3. Click the flip button again — highlight still present
4. Click the same square again — highlight clears (deselect still works)
5. Complete a two-square move — highlight clears normally
6. Start a new pending square, then load a new FEN — highlight clears (fen change still clears)
