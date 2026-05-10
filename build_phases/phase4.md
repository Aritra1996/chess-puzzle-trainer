# Phase 4 — Tree Navigation

## Context

Phase 3 left the move tree fully renderable and recording working. But there is no way to
navigate the recorded tree: breadcrumb is hardcoded `▸ start`, depth counter is hardcoded
`0`, click-on-token has `role="button"` but no `onClick`, and there are no keyboard
listeners. This phase wires up full tree navigation so the user can move the cursor
through the tree without the board changing.

---

## Files to change

| File | Change |
|------|--------|
| `shared/moveTree.ts` | Add `nodeId?` to Segment types; add `ancestorPath`; export 6 new functions |
| `web/src/components/PuzzleGame.tsx` | 4 new action types; keyboard listener; dynamic breadcrumb + depth; pass `onTokenClick` |
| `web/src/components/MoveTree.tsx` | Accept `onTokenClick?` prop; wire `onClick` + `onKeyDown` on tokens |

---

## 1. `shared/moveTree.ts`

### Segment type change (non-breaking — `nodeId` optional)
```ts
| { kind: 'player';   text: string; nodeId?: string; active?: boolean }
| { kind: 'opponent'; text: string; nodeId?: string; active?: boolean }
```
Making `nodeId` optional preserves all existing test fixtures in `MoveTree.test.tsx` that
construct `Line` objects directly without going through `buildLines`.

### Update `buildLines` to emit `nodeId`
```ts
const tok: Segment = node.color === 'player'
  ? { kind: 'player',   text: node.san, nodeId: node.id, ...(isActive ? { active: true } : {}) }
  : { kind: 'opponent', text: node.san, nodeId: node.id, ...(isActive ? { active: true } : {}) };
```

### New private helper
```ts
function ancestorPath(root: MoveNode, targetId: string): MoveNode[] {
  function collect(n: MoveNode, path: MoveNode[]): MoveNode[] | null {
    const next = [...path, n];
    if (n.id === targetId) return next;
    for (const c of n.children) {
      const found = collect(c, next);
      if (found) return found;
    }
    return null;
  }
  return collect(root, []) ?? [];
}
```

### 6 new exports
```ts
// Move cursor to a specific node (no-op if id not found)
export function navigateTo(tree: MoveTree, nodeId: string): MoveTree

// Move cursor to parent node (no-op at root sentinel)
export function navigateParent(tree: MoveTree): MoveTree

// Move cursor to first child (no-op at leaf)
export function navigateFirstChild(tree: MoveTree): MoveTree

// Move cursor to prev/next sibling (clamped — no-op at boundary)
export function navigateSibling(tree: MoveTree, dir: 'prev' | 'next'): MoveTree

// Depth: number of non-root nodes from root to current (0 at root)
export function getDepth(tree: MoveTree): number

// Breadcrumb: ordered SAN list from root to current (empty at root)
export function getBreadcrumb(tree: MoveTree): string[]
```

Implementation notes:
- `navigateTo`: `{ ...tree, currentNodeId: nodeId }` if `nodeById(root, nodeId)` is non-null
- `navigateParent`: find current node, use `current.parentId`; if null (root sentinel), no-op
- `navigateFirstChild`: find current node, go to `node.children[0]` if exists
- `navigateSibling`: find parent via `current.parentId`, find index in `parent.children`, clamp idx ± 1
- `getDepth`: `ancestorPath(root, currentNodeId).filter(n => n.san !== '').length`
- `getBreadcrumb`: `ancestorPath(root, currentNodeId).filter(n => n.san !== '').map(n => n.san)`

---

## 2. `web/src/components/PuzzleGame.tsx`

### Action types
```ts
type Action =
  | { type: 'RECORD_MOVE';         uci: string }
  | { type: 'NAVIGATE_TO';         nodeId: string }
  | { type: 'NAVIGATE_PARENT' }
  | { type: 'NAVIGATE_FIRST_CHILD' }
  | { type: 'NAVIGATE_SIBLING';    dir: 'prev' | 'next' };
```

### Reducer additions
```ts
if (action.type === 'NAVIGATE_TO')          return { tree: navigateTo(state.tree, action.nodeId) };
if (action.type === 'NAVIGATE_PARENT')      return { tree: navigateParent(state.tree) };
if (action.type === 'NAVIGATE_FIRST_CHILD') return { tree: navigateFirstChild(state.tree) };
if (action.type === 'NAVIGATE_SIBLING')     return { tree: navigateSibling(state.tree, action.dir) };
```

### Keyboard listener (via useEffect)
```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); dispatch({ type: 'NAVIGATE_PARENT' }); }
    if (e.key === 'ArrowRight') { e.preventDefault(); dispatch({ type: 'NAVIGATE_FIRST_CHILD' }); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); dispatch({ type: 'NAVIGATE_SIBLING', dir: 'prev' }); }
    if (e.key === 'ArrowDown')  { e.preventDefault(); dispatch({ type: 'NAVIGATE_SIBLING', dir: 'next' }); }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

### Dynamic breadcrumb + depth
```ts
const depth      = getDepth(state.tree);
const breadcrumb = getBreadcrumb(state.tree);
```

Replace static `<span className="num">0</span>` with `<span className="num">{depth}</span>`.

Replace static breadcrumb span with:
```tsx
<div className="breadcrumb">
  <span className="here">▸ start</span>
  {breadcrumb.map((san, i) => (
    <React.Fragment key={i}>
      <span className="sep"> → </span>
      <span className="crumb">{san}</span>
    </React.Fragment>
  ))}
</div>
```

### Pass onTokenClick to MoveTree
```tsx
<MoveTree
  lines={lines}
  onTokenClick={(id) => dispatch({ type: 'NAVIGATE_TO', nodeId: id })}
/>
```

---

## 3. `web/src/components/MoveTree.tsx`

### Prop interface
```ts
interface Props {
  lines: Line[];
  onTokenClick?: (nodeId: string) => void;
}
```

### Token click + keyboard
```tsx
<span
  key={segIdx}
  className={`move-token ${seg.kind}${isActive ? ' active' : ''}`}
  role="button"
  tabIndex={0}
  onClick={() => seg.nodeId && onTokenClick?.(seg.nodeId)}
  onKeyDown={(e) => {
    if ((e.key === 'Enter' || e.key === ' ') && seg.nodeId) {
      e.preventDefault();
      onTokenClick?.(seg.nodeId);
    }
  }}
>
  {seg.text}
</span>
```

---

## Key design decisions

- **`nodeId` optional on Segment**: Existing test fixtures in `MoveTree.test.tsx` construct
  `Line` objects by hand without nodeId — making it optional avoids breaking changes.
- **Sibling navigation is clamped** (not wrapped): at first sibling, `prev` is a no-op;
  at last sibling, `next` is a no-op. Matches standard chess software convention.
- **Keyboard listener on `window`**: Arrow keys navigate the tree regardless of which
  element has focus. `preventDefault()` suppresses page scroll.
- **Board never changes**: All navigation only updates `currentNodeId`. The board still
  shows the original puzzle FEN throughout.

---

## Test plan (TDD: Red → Green → Refactor)

See `build_phases/phase4_tests.md` for full TDD test plan.

### Summary of new tests
| Suite | +new tests |
|---|---|
| `shared/__tests__/moveTree.test.ts` | +12 |
| `MoveTree.test.tsx` | +2 |
| `PuzzleGame.test.tsx` | +5 |
| `e2e/navigation.spec.ts` (new file) | +5 |
| **Total new** | **+24** |

---

## Verification

```bash
cd web && npm test           # all unit + component tests green
cd web && npm run test:e2e   # all E2E tests green (navigation.spec.ts included)
```

Manual: record `e4 e5` → breadcrumb shows `▸ start → e5`, depth `2`.
Click `e4` token → breadcrumb shows `▸ start → e4`, depth `1`.
Press → → breadcrumb `▸ start → e4 → e5`, depth `2`.
Press ← ← → `▸ start`, depth `0`. Board never changes.
