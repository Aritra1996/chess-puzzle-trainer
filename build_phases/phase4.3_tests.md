# Phase 4.3 Tests — Preserve Highlight When Board Is Flipped

## Context

Phase 4.3 changes the orientation-change `useEffect` in `PuzzleBoard.tsx` so the
pending/selected square is **re-applied** to Chessground after a flip, rather than cleared.
Tests live entirely in `web/src/components/__tests__/PuzzleBoard.test.tsx`.

---

## No mock changes needed

The existing `mockSet` spy (added in phase 4.2) is sufficient. No new mock setup required.

---

## RED phase — tests to write/update (before any source change)

All changes are inside the existing `'PuzzleBoard — click overlay'` and
`'PuzzleBoard — Chessground-driven highlight'` describe blocks.

### Test 1 — UPDATE existing: `'clears data-pending when the orientation prop changes'`

Rename and invert the assertion:

```typescript
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
**RED** — currently `setPendingSquare(null)` on flip removes `data-pending`.

---

### Test 2 — UPDATE existing: `'calls cg.set with selected: undefined when orientation prop changes'`

Rename and change the expected value:

```typescript
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
**RED** — currently the effect calls `set({ selected: undefined })`, not a square string.

---

### Test 3 — ADD new: no-pending case on flip

Place in the `'PuzzleBoard — Chessground-driven highlight'` describe block:

```typescript
it('does not call cg.set when orientation changes and no square is pending', () => {
  const { rerender } = render(
    <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
  )
  mockSet.mockClear()
  rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
  expect(mockSet).not.toHaveBeenCalled()
})
```
**RED** — currently the effect calls `set({ selected: undefined })` unconditionally.

---

## Summary of RED failures

| # | Test | Why it fails now |
|---|------|-----------------|
| 1 | preserves data-pending on flip | `setPendingSquare(null)` clears it |
| 2 | calls cg.set with pending square on flip | effect calls `set({ selected: undefined })` |
| 3 | does not call cg.set when no pending on flip | effect calls `set({ selected: undefined })` |

Minimum RED count: **3 tests fail**.

---

## GREEN phase — implement the fix

Apply changes from `build_phases/phase4.3.md` to `PuzzleBoard.tsx`.

```bash
cd web && npm test -- --reporter=verbose
# Expect: 65/65 green  (64 existing − 2 updated + 2 updated + 1 new = 65)
```

---

## REFACTOR / yellow phase — full regression check

```bash
cd web && npm test
# 65/65 green — all existing tests still pass

cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test
# 49/49 green — shared module unaffected
```

Existing tests that must remain green (directly related to overlay/flip behaviour):
- `sets data-pending on the overlay after the first click`
- `calls onMove with a UCI string after two different square clicks`
- `does not call onMove when the same square is clicked twice`
- `calls cg.set with selected square after the first click`
- `calls cg.set with selected: undefined after a two-square move`
- `does not render a .sq-highlight element (highlight is Chessground-driven)`

---

## Cumulative test count

| Suite | Before | Removed | Updated | +new | After |
|-------|--------|---------|---------|------|-------|
| `web/src/components/__tests__/PuzzleBoard.test.tsx` | 64 | 0 | 2 | +1 | 65 |
| All others | unchanged | — | — | — | unchanged |
| **Total web** | **64** | **0** | **2** | **+1** | **65** |
