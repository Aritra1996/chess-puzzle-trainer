# Phase 5 Tests — Undo / Reset

## Context

Phase 5 adds two new operations:
- **Undo** (`⌫` / button): removes the most recently *recorded* move (time-based, not cursor-positional)
- **Reset** (button): clears the whole tree back to an empty state

Two test files are affected:
- `shared/__tests__/moveTree.test.ts` — new `describe('removeNode')` block (+6 tests)
- `web/src/components/__tests__/PuzzleGame.test.tsx` — new `describe('PuzzleGame — Undo / Reset')` block (+5 tests)

---

## No mock changes needed

Existing mocks in both test files are sufficient. No new setup required.

---

## RED phase — write tests before any source changes

### Part 1 — `shared/__tests__/moveTree.test.ts`

Add a new `describe('removeNode', ...)` block **after** the `getBreadcrumb` block and
**before** the `buildLines — isActivePath` block. Import `removeNode` alongside the other
imports at the top of the file.

```typescript
import {
  createTree, addNode, buildLines, getCurrentFen,
  navigateTo, navigateParent, navigateFirstChild, navigateSibling,
  getDepth, getBreadcrumb,
  removeNode,          // ← add this
} from '../moveTree'
```

**6 new tests:**

```typescript
describe('removeNode', () => {
  it('removes a leaf node from the tree', () => {
    const t = twoMoveTree()                          // cursor at e5 (leaf)
    const result = removeNode(t, t.currentNodeId)
    expect(getBreadcrumb(result)).toEqual(['e4'])    // e5 gone, e4 remains
  })

  it('sets currentNodeId to the removed node\'s parent', () => {
    const t      = twoMoveTree()                     // cursor at e5
    const e4Id   = t.root.children[0].id
    const result = removeNode(t, t.currentNodeId)
    expect(result.currentNodeId).toBe(e4Id)
  })

  it('removes a node with children and all its descendants', () => {
    const t    = twoMoveTree()                       // root → e4 → e5
    const e4Id = t.root.children[0].id
    const result = removeNode(t, e4Id)
    expect(result.root.children).toHaveLength(0)    // e4 and e5 both gone
    expect(result.currentNodeId).toBe(result.root.id)
  })

  it('is a no-op when nodeId is not found', () => {
    const t      = twoMoveTree()
    const result = removeNode(t, 'nonexistent-id')
    expect(result).toStrictEqual(t)
  })

  it('is a no-op when removing the root sentinel (parentId === null)', () => {
    const t      = twoMoveTree()
    const result = removeNode(t, t.root.id)
    expect(result).toStrictEqual(t)
  })

  it('removes one branch while leaving sibling branches intact', () => {
    const t          = branchTree()                  // two children from root
    const firstChild = t.root.children[0].id
    const result     = removeNode(t, firstChild)
    expect(result.root.children).toHaveLength(1)    // one branch remains
  })
})
```

**Why RED**: `removeNode` does not exist in `shared/moveTree.ts` yet —
the import will resolve as `undefined` and all 6 tests throw.

---

### Part 2 — `web/src/components/__tests__/PuzzleGame.test.tsx`

Add `import { act } from 'react'` to the imports at the top of the file.

Add a new `describe('PuzzleGame — Undo / Reset', ...)` block at the **end** of the file.

```typescript
describe('PuzzleGame — Undo / Reset', () => {
  it('renders the Undo button', () => {
    const { getByText } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(getByText(/Undo/i)).not.toBeNull()
  })

  it('pressing Undo after one recorded move reduces depth back to 0', () => {
    const { getByText } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => capturedOnMove('a7a5'))
    expect(getByText('1')).not.toBeNull()            // depth is 1
    fireEvent.click(getByText(/Undo/i))
    expect(getByText('0')).not.toBeNull()            // depth back to 0
  })

  it('pressing Undo when nothing is recorded is a no-op', () => {
    const { getByText } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(() => fireEvent.click(getByText(/Undo/i))).not.toThrow()
    expect(getByText('0')).not.toBeNull()            // depth stays 0
  })

  it('Backspace key triggers Undo (same effect as button)', () => {
    const { getByText } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => capturedOnMove('a7a5'))
    expect(getByText('1')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(getByText('0')).not.toBeNull()
  })

  it('Reset button clears the tree and depth returns to 0', () => {
    const { getByText } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => capturedOnMove('a7a5'))
    expect(getByText('1')).not.toBeNull()
    fireEvent.click(getByText(/Reset/i))
    expect(getByText('0')).not.toBeNull()
  })
})
```

**Why RED**:
- `UNDO_LAST` action does not exist in the reducer → clicking Undo does nothing → depth stays 1
- `RESET` action does not exist → clicking Reset does nothing → depth stays 1
- Backspace key not handled → no-op

Minimum RED count: **3 failures** (tests 2, 4, 5 — tests 1 and 3 may already pass).

---

## Summary of RED failures

| File | # | Test | Why it fails |
|------|---|------|-------------|
| `moveTree.test.ts` | 1–6 | all `removeNode` tests | function not exported yet |
| `PuzzleGame.test.tsx` | 2 | Undo reduces depth to 0 | action not wired |
| `PuzzleGame.test.tsx` | 4 | Backspace triggers Undo | key not handled |
| `PuzzleGame.test.tsx` | 5 | Reset clears tree | action not wired |

Minimum RED count: **9 tests fail**.

---

## GREEN phase — implement the fix

Apply changes from `build_phases/phase5.md`:
1. Add `removeNode` to `shared/moveTree.ts`
2. Add `undoStack: string[]` to `State` in `PuzzleGame.tsx`
3. Add `UNDO_LAST` and `RESET` action types + reducer cases
4. Add `Backspace` to the keydown handler
5. Wire `onClick` on Undo and Reset buttons

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test -- --reporter=verbose
# Expect: 55/55 green  (49 existing + 6 new)

cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 70/70 green  (65 existing + 5 new)
```

---

## REFACTOR / yellow phase

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test   # 55/55 green
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test      # 70/70 green
```

Existing tests that must remain green:
- `updates the move tree after a valid two-square click sequence`
- `depth counter updates to 1 after recording one move`
- `breadcrumb shows the recorded move SAN after recording one move`
- `ArrowLeft key moves cursor from depth 2 to depth 1`
- `ArrowRight key moves cursor to child after navigating to parent`

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `shared/__tests__/moveTree.test.ts` | 49 | +6 | 55 |
| `web/src/components/__tests__/PuzzleGame.test.tsx` | 65 (web total) | +5 | 70 |
| All others | unchanged | — | unchanged |
| **Total web** | **65** | **+5** | **70** |
| **Total shared** | **49** | **+6** | **55** |
