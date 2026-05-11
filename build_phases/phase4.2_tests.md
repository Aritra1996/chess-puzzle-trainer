# Phase 4.2 Tests — Yellow Square Highlight via Chessground `selected`

## Context

Phase 4.2 removes the hand-rolled `.sq-highlight` div and drives the pending-square
highlight through `cgRef.current.set({ selected })` instead. Tests live entirely in
`web/src/components/__tests__/PuzzleBoard.test.tsx`.

---

## Mock update (prerequisite — do first)

The existing Chessground mock only stubs `destroy`. Add a `set` spy so new tests can
assert on `cg.set(...)` calls.

**Current** (lines 6–21):
```typescript
const mockDestroy = vi.fn()
const mockChessground = vi.fn(() => ({ destroy: mockDestroy }))
...
beforeEach(() => {
  mockChessground.mockClear()
  mockDestroy.mockClear()
})
```

**Replace with**:
```typescript
const mockSet     = vi.fn()
const mockDestroy = vi.fn()
const mockChessground = vi.fn(() => ({ destroy: mockDestroy, set: mockSet }))
...
beforeEach(() => {
  mockChessground.mockClear()
  mockDestroy.mockClear()
  mockSet.mockClear()
})
```

This change alone does not make any existing test fail — it only adds a new spy.

---

## RED phase — tests to write (before any source change)

All tests go inside a new `describe('PuzzleBoard — Chessground-driven highlight', ...)` block
appended after the existing `'PuzzleBoard — click overlay'` describe block.

### Test 1 — first click calls `cg.set` with a valid square as `selected`
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
**RED** — `mockSet` is never called in the current implementation.

### Test 2 — completing a move calls `cg.set({ selected: undefined })`
```typescript
it('calls cg.set with selected: undefined after a two-square move', () => {
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
**RED** — `mockSet` never called currently.

### Test 3 — orientation change calls `cg.set({ selected: undefined })`
```typescript
it('calls cg.set with selected: undefined when orientation prop changes', () => {
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
**RED** — `mockSet` never called in the orientation-change effect currently.

### Test 4 — `.sq-highlight` element is never rendered
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
**RED** — currently a `.sq-highlight` div IS rendered after the first click.

---

## Existing tests to modify during RED phase

### Delete
```
'removes .sq-highlight after completing a two-square move'
```
This test checks for the `.sq-highlight` element which will no longer exist.
Behaviour is covered by new Test 2.

### Update
Rename and rebody:
```
'shows .sq-highlight after the first click'
→ 'data-pending attribute is set after the first click'
```
Keep the `data-pending` assertion (which still works); the test body remains valid.
The old assertion `expect(container.querySelector('.sq-highlight')).not.toBeNull()`
becomes a RED failure before the fix, so remove it — the `data-pending` check is the
useful regression guard.

---

## Summary of RED failures

| # | Test | Why it fails now |
|---|------|-----------------|
| 1 | first click calls `cg.set` with `selected` | `mockSet` never called |
| 2 | completing move calls `cg.set({ selected: undefined })` | `mockSet` never called |
| 3 | orientation change calls `cg.set({ selected: undefined })` | `mockSet` never called |
| 4 | no `.sq-highlight` rendered | element IS rendered |

Minimum RED count: **4 tests fail**.

---

## GREEN phase — implement the fix

Apply changes from `build_phases/phase4.2.md` to `PuzzleBoard.tsx` and `globals.css`.

```bash
cd web && npm test -- --reporter=verbose
# Expect: 64/64 green  (61 existing − 1 deleted + 4 new = 64)
```

---

## REFACTOR / yellow phase — full regression check

```bash
cd web && npm test
# 64/64 green — all existing tests still pass

cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test
# 49/49 green — shared module unaffected
```

Existing tests that must remain green (directly related to overlay behaviour):
- `sets data-pending on the overlay after the first click`
- `calls onMove with a UCI string after two different square clicks`
- `does not call onMove when the same square is clicked twice`
- `clears .sq-highlight when the orientation prop changes` → this test is renamed but its `data-pending` assertion stays valid

---

## Cumulative test count

| Suite | Before | Removed | +new | After |
|-------|--------|---------|------|-------|
| `web/src/components/__tests__/PuzzleBoard.test.tsx` | 17 | −1 | +4 | 20 |
| All others | unchanged | — | — | unchanged |
| **Total web** | **61** | **−1** | **+4** | **64** |
