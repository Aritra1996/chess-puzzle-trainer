# Phase 5 — Undo / Reset (Revised UX Design)

## Design Decision: Why "undo last move" not "delete current node"

The original spec said "delete the current node (and its entire subtree)". This is the
wrong model for an Undo button.

**Why "delete current node" is confusing:**
If a user records `e4 → e5 → Nf3`, then presses ← ← to navigate back to `e4` to review
the position, then presses Undo — the old behavior would delete `e4` AND its entire
subtree (`e5`, `Nf3`). The user loses everything. That's destructive and surprising.

**Why "undo last recorded move" is correct:**
- Undo is semantically a *time-based* operation ("reverse the last action"), not a
  *positional* one ("delete what I'm looking at")
- It matches every editor/tool the user has ever used (Ctrl+Z = undo last action)
- Navigation (← → ↑ ↓) should not affect what Undo targets — only recording does

**What "delete current node" should become:**
A separate "Cut branch" or "Delete move" action. Out of scope for Phase 5.

---

## Revised Behavior

```
Undo (⌫ key / Undo button):
  Remove the most recently RECORDED move from the tree.
  Cursor moves to that node's parent.
  Pressing Undo again removes the next-most-recently-recorded move, etc.
  No-op when nothing has been recorded.

Reset (button only):
  Clear the entire tree back to the initial empty state.
  Cursor returns to root.
```

---

## Root Cause: Why `currentNodeId` is not enough

After `addNode`, `currentNodeId` is the new node — so right after recording, the two
coincide. But after any navigation (← → ↑ ↓), `currentNodeId` drifts. MoveTree has no
field tracking "which node was most recently added" — we need to add that tracking.

---

## Files to change

| File | Change |
|------|--------|
| `shared/moveTree.ts` | Add `removeNode` export |
| `shared/__tests__/moveTree.test.ts` | Tests for `removeNode` (+5–6 tests) |
| `web/src/components/PuzzleGame.tsx` | Add `undoStack` to state; `UNDO_LAST` / `RESET` actions; keyboard ⌫; wire buttons |
| `web/src/components/__tests__/PuzzleGame.test.tsx` | Tests for undo/reset behaviour (+5 tests) |
| `PROJECT.md` | Phase 5 description updated ✅ |

---

## Implementation

### 1. New shared function: `removeNode` (`shared/moveTree.ts`)

```typescript
export function removeNode(tree: MoveTree, nodeId: string): MoveTree
```

- Removes the node with `nodeId` **and all its descendants** from the tree
- Returns a new tree with `currentNodeId` set to the removed node's `parentId`
- No-op if `nodeId` is not found or is the root sentinel (parentId === null)

Implementation:
```typescript
export function removeNode(tree: MoveTree, nodeId: string): MoveTree {
  const target = nodeById(tree.root, nodeId);
  if (!target || target.parentId === null) return tree;

  function strip(n: MoveNode): MoveNode {
    return { ...n, children: n.children.filter(c => c.id !== nodeId).map(strip) };
  }

  return { ...tree, root: strip(tree.root), currentNodeId: target.parentId };
}
```

### 2. `undoStack` in PuzzleGame reducer state

Keep a separate `undoStack: string[]` (ordered list of recorded node IDs, oldest first)
alongside the MoveTree. MoveTree stays clean — no undo metadata leaks into the shared
module.

```typescript
// web/src/components/PuzzleGame.tsx
type State = { tree: MoveTree; undoStack: string[] };
```

### 3. New action types

```typescript
type Action =
  | { type: 'RECORD_MOVE';         uci: string }
  | { type: 'NAVIGATE_TO';         nodeId: string }
  | { type: 'NAVIGATE_PARENT' }
  | { type: 'NAVIGATE_FIRST_CHILD' }
  | { type: 'NAVIGATE_SIBLING';    dir: 'prev' | 'next' }
  | { type: 'UNDO_LAST' }      // ← new
  | { type: 'RESET' };         // ← new
```

### 4. Reducer additions

On `RECORD_MOVE` — push new node ID onto the undo stack:
```typescript
// existing addNode call returns a tree with currentNodeId = newly added node
const newTree = addNode(state.tree, move);
return { tree: newTree, undoStack: [...state.undoStack, newTree.currentNodeId] };
```

On `UNDO_LAST`:
```typescript
if (state.undoStack.length === 0) return state;
const nodeId = state.undoStack[state.undoStack.length - 1];
const newTree = removeNode(state.tree, nodeId);
return { tree: newTree, undoStack: state.undoStack.slice(0, -1) };
```

On `RESET`:
```typescript
return { tree: createTree(initialFen, state.tree.playerColor), undoStack: [] };
```

### 5. Keyboard listener update (`PuzzleGame.tsx`)

Add ⌫ (Backspace) to the existing `keydown` handler:

```typescript
if (e.key === 'Backspace') { e.preventDefault(); dispatch({ type: 'UNDO_LAST' }); }
```

### 6. Wire up buttons

```tsx
<button className="btn" onClick={() => dispatch({ type: 'UNDO_LAST' })}>
  Undo <span className="kbd">⌫</span>
</button>
<button className="btn" onClick={() => dispatch({ type: 'RESET' })}>
  Reset
</button>
```

---

## Test plan (TDD: Red → Green → Refactor)

### `shared/__tests__/moveTree.test.ts` — new `removeNode` tests (~6)
- removes a leaf node; resulting tree no longer contains it
- cursor moves to the removed node's parent
- removing a node with children also removes all descendants
- no-op when nodeId is not found
- no-op when attempting to remove the root sentinel (parentId === null)

### `web/src/components/__tests__/PuzzleGame.test.tsx` — new Undo/Reset tests (~5)
- Undo button is present in the DOM
- pressing Undo after recording one move removes it from the tree display
- pressing Undo when nothing is recorded is a no-op (no crash, depth stays 0)
- pressing Backspace key triggers UNDO_LAST (same effect as button)
- Reset clears the entire tree and depth returns to 0

---

## Cumulative test count (estimate)

| Suite | Before | +new | After |
|---|---|---|---|
| `shared/__tests__/moveTree.test.ts` | 49 | +6 | 55 |
| `PuzzleGame.test.tsx` | 14 | +5 | 19 |
| **Total** | **~114** | **+11** | **~125** |
