# Phase 4 — Tree Navigation: TDD Test Plan (Red → Green → Refactor)

## Overview

Phase 4 adds tree navigation: click-to-navigate tokens, keyboard arrow keys (← → ↑ ↓),
dynamic breadcrumb, and dynamic depth counter.

28 new tests across 4 suites. The existing 111 tests must stay green throughout.

### Cumulative test count change

| Suite | Before | +new | After |
|---|---|---|---|
| `shared/__tests__/moveTree.test.ts` | 20 | +16 | **36** |
| `MoveTree.test.tsx` | 7 | +2 | **9** |
| `PuzzleGame.test.tsx` | 13 | +5 | **18** |
| `e2e/navigation.spec.ts` (new file) | 0 | +5 | **5** |
| All other suites | 71 | — | **71** |
| **Totals** | **111** | **+28** | **139** |

---

## Step 0 — Confirm baseline (all green before touching anything)

```bash
cd web && npm test           # 74 passed
cd web && npm run test:e2e   # 37 passed
```

---

## RED — Write failing tests first

### R1. `shared/__tests__/moveTree.test.ts`

Add 5 new `describe` blocks at the end of the file (after the existing `buildLines` block).
All 16 tests fail immediately with `navigateTo is not a function` etc.

```ts
import {
  createTree, addNode, buildLines, getCurrentFen,
  navigateTo, navigateParent, navigateFirstChild, navigateSibling,
  getDepth, getBreadcrumb,
} from '../moveTree'

// Re-use constants already in the file:
// START_FEN, AFTER_E4, AFTER_E4_E5, AFTER_D4

// Helper that builds a 2-move tree with cursor at the leaf (e5 node)
function twoMoveTree() {
  const t0 = createTree(START_FEN, 'white')
  const t1 = addNode(t0, { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
  return    addNode(t1, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
}

describe('navigateTo', () => {
  it('moves the cursor to the target node', () => {
    const t = twoMoveTree()
    const e4Id = t.root.children[0].id
    const result = navigateTo(t, e4Id)
    expect(result.currentNodeId).toBe(e4Id)
  })

  it('is a no-op when the id does not exist in the tree', () => {
    const t = twoMoveTree()
    const result = navigateTo(t, 'nonexistent-id')
    expect(result.currentNodeId).toBe(t.currentNodeId)
  })
})

describe('navigateParent', () => {
  it('moves the cursor to the parent node', () => {
    const t = twoMoveTree()
    const e4Id = t.root.children[0].id
    const result = navigateParent(t)  // cursor was at e5; parent is e4
    expect(result.currentNodeId).toBe(e4Id)
  })

  it('is a no-op when the cursor is already at the root sentinel', () => {
    const t = createTree(START_FEN, 'white')
    const result = navigateParent(t)
    expect(result.currentNodeId).toBe(t.root.id)
  })
})

describe('navigateFirstChild', () => {
  it('moves the cursor to the first child', () => {
    const t   = twoMoveTree()
    const atE4 = navigateTo(t, t.root.children[0].id)  // cursor at e4
    const e5Id = t.root.children[0].children[0].id
    expect(navigateFirstChild(atE4).currentNodeId).toBe(e5Id)
  })

  it('is a no-op when the current node has no children', () => {
    const t = twoMoveTree()  // cursor already at e5 (leaf)
    const result = navigateFirstChild(t)
    expect(result.currentNodeId).toBe(t.currentNodeId)
  })
})

describe('navigateSibling', () => {
  // Build a tree where e4 has two children: e5 and c5
  function branchTree() {
    const t0 = createTree(START_FEN, 'white')
    const t1 = addNode(t0, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4 = { ...t1, currentNodeId: t1.root.children[0].id }
    const t2   = addNode(atE4, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const backToE4 = { ...t2, currentNodeId: t2.root.children[0].id }
    const AFTER_E4_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
    return addNode(backToE4, { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    // cursor is now at c5 (second child of e4)
  }

  it('moves to next sibling', () => {
    const t   = branchTree()
    const e5Id = t.root.children[0].children[0].id
    const atE5 = { ...t, currentNodeId: e5Id }  // cursor at e5 (first child)
    const c5Id  = t.root.children[0].children[1].id
    expect(navigateSibling(atE5, 'next').currentNodeId).toBe(c5Id)
  })

  it('is a no-op when already at the last sibling', () => {
    const t = branchTree()  // cursor already at c5 (last child)
    expect(navigateSibling(t, 'next').currentNodeId).toBe(t.currentNodeId)
  })

  it('moves to previous sibling', () => {
    const t   = branchTree()  // cursor at c5 (second child)
    const e5Id = t.root.children[0].children[0].id
    expect(navigateSibling(t, 'prev').currentNodeId).toBe(e5Id)
  })

  it('is a no-op when already at the first sibling', () => {
    const t   = branchTree()
    const e5Id = t.root.children[0].children[0].id
    const atE5 = { ...t, currentNodeId: e5Id }
    expect(navigateSibling(atE5, 'prev').currentNodeId).toBe(e5Id)
  })
})

describe('getDepth', () => {
  it('returns 0 when the cursor is at the root sentinel', () => {
    const t = createTree(START_FEN, 'white')
    expect(getDepth(t)).toBe(0)
  })

  it('returns 1 when the cursor is at the first-move node', () => {
    const t0 = createTree(START_FEN, 'white')
    const t1 = addNode(t0, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(getDepth(t1)).toBe(1)
  })

  it('returns 2 at a grandchild node', () => {
    expect(getDepth(twoMoveTree())).toBe(2)
  })
})

describe('getBreadcrumb', () => {
  it('returns an empty array at the root sentinel', () => {
    const t = createTree(START_FEN, 'white')
    expect(getBreadcrumb(t)).toEqual([])
  })

  it('returns the single move SAN after one move', () => {
    const t0 = createTree(START_FEN, 'white')
    const t1 = addNode(t0, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(getBreadcrumb(t1)).toEqual(['e4'])
  })

  it('returns the full path SAN list after two moves', () => {
    expect(getBreadcrumb(twoMoveTree())).toEqual(['e4', 'e5'])
  })
})
```

### R2. `web/src/components/__tests__/MoveTree.test.tsx`

**First**: add `nodeId: 'node-1'` to the existing `PLAYER_LINE` fixture so the two
new click tests have a nodeId to fire:

```ts
const PLAYER_LINE: Line = {
  isActivePath: true,
  segments: [
    { kind: 'number', text: '1. ' },
    { kind: 'player', text: 'e4', nodeId: 'node-1', active: true },
  ],
}
```

(This change is valid TypeScript even before the Segment type gains `nodeId?`; it compiles
fine because TypeScript allows extra properties on objects built inline — but the test
assertions below depend on the component reading that field.)

**Then** add two new tests at the end of `describe('MoveTree', ...)`:

```ts
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

it('calls onTokenClick with the nodeId when a token is clicked', async () => {
  const onTokenClick = vi.fn()
  render(<MoveTree lines={[PLAYER_LINE]} onTokenClick={onTokenClick} />)
  await userEvent.click(document.querySelector('.move-token')!)
  expect(onTokenClick).toHaveBeenCalledWith('node-1')
})

it('calls onTokenClick when Enter is pressed on a token', async () => {
  const onTokenClick = vi.fn()
  render(<MoveTree lines={[PLAYER_LINE]} onTokenClick={onTokenClick} />)
  document.querySelector<HTMLElement>('.move-token')!.focus()
  await userEvent.keyboard('{Enter}')
  expect(onTokenClick).toHaveBeenCalledWith('node-1')
})
```

These fail before implementation because MoveTree has no `onClick` / `onKeyDown` and
ignores `onTokenClick`.

### R3. `web/src/components/__tests__/PuzzleGame.test.tsx`

**First** update the MoveTree mock to also capture `onTokenClick`:

```ts
let capturedOnMove: ((uci: string) => void) | undefined
let capturedOrientation: string | undefined
let capturedOnTokenClick: ((id: string) => void) | undefined

vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick }: { lines: unknown[]; onTokenClick?: (id: string) => void }) => {
    capturedOnTokenClick = onTokenClick
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))
```

**Then** add five new tests inside `describe('PuzzleGame', ...)`:

```ts
import { fireEvent } from '@testing-library/react'

it('depth counter updates to 1 after recording one move', () => {
  const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
  act(() => { capturedOnMove?.('f6d5') })
  expect(container.querySelector('.an-stats')?.textContent).toContain('depth 1')
})

it('breadcrumb shows the recorded move SAN after recording one move', () => {
  const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
  act(() => { capturedOnMove?.('f6d5') })
  expect(container.querySelector('.breadcrumb')?.textContent).toContain('Nd5')
})

it('ArrowLeft key moves cursor to parent (depth decreases from 1 to 0)', () => {
  const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
  act(() => { capturedOnMove?.('f6d5') })
  act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })
  expect(container.querySelector('.an-stats')?.textContent).toContain('depth 0')
})

it('ArrowRight key moves cursor to child after navigating to parent', () => {
  const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
  act(() => { capturedOnMove?.('f6d5') })
  act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })   // back to root
  act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }) })  // forward to Nd5
  expect(container.querySelector('.an-stats')?.textContent).toContain('depth 1')
})

it('passes onTokenClick to MoveTree', () => {
  render(<PuzzleGame fen={SAMPLE_FEN} />)
  expect(typeof capturedOnTokenClick).toBe('function')
})
```

All five fail before implementation:
- Depth / breadcrumb tests fail because both are hardcoded (`0` / `▸ start`).
- Keyboard tests fail because there is no `keydown` listener.
- `onTokenClick` test fails because PuzzleGame doesn't pass the prop to MoveTree.

### R4. `web/e2e/navigation.spec.ts` (new file)

```ts
import { test, expect } from '@playwright/test'

// SAMPLE_FEN is black-to-move; board auto-orients to black.
// Black orientation formula: x = (7 - file_0idx) * 60 + 30,  y = (rank - 1) * 60 + 30
// f6 → d5  (Nd5 — legal black knight move)
// a2 → a3  (a3  — legal white pawn move)
const sq = (file: number, rank: number) => ({ x: (7 - file) * 60 + 30, y: (rank - 1) * 60 + 30 })

test.describe('Phase 4 — Tree Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('initial depth is 0 and breadcrumb shows "start"', async ({ page }) => {
    await expect(page.locator('.an-stats')).toContainText('depth 0')
    await expect(page.locator('.breadcrumb')).toContainText('start')
  })

  test('depth counter becomes 1 after recording one move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })  // f6
    await board.click({ position: sq(3, 5) })  // d5 → Nd5
    await expect(page.locator('.an-stats')).toContainText('depth 1')
  })

  test('breadcrumb shows the SAN of the recorded move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.locator('.breadcrumb')).toContainText('Nd5')
  })

  test('clicking a move token in the tree sets it as the active cursor', async ({ page }) => {
    const board = page.locator('.board-container')
    // Record two moves so we can navigate back to the first
    await board.click({ position: sq(5, 6) });  await board.click({ position: sq(3, 5) })  // Nd5
    await board.click({ position: sq(0, 1) });  await board.click({ position: sq(0, 2) })  // a3
    // cursor is now at a3; click the Nd5 token to navigate back
    await page.locator('.move-token', { hasText: 'Nd5' }).click()
    await expect(page.locator('.move-token.active')).toHaveText('Nd5')
  })

  test('ArrowLeft key moves cursor to parent (token loses active)', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })  // Nd5 is now active
    await expect(page.locator('.move-token.active')).toHaveText('Nd5')
    await page.keyboard.press('ArrowLeft')
    // cursor moved to root sentinel (no san) — no token is active
    await expect(page.locator('.move-token.active')).toHaveCount(0)
  })
})
```

### RED run check

```bash
cd web && npm test           # 74 passed + 23 new FAILED = 97 total, 23 failing
cd web && npm run test:e2e   # 37 passed + 5 new FAILED = 42 total, 5 failing
```

Confirm that **only** the new 28 tests are failing before moving to GREEN.

---

## GREEN — Implement source to pass all tests

### G1. `shared/moveTree.ts`

**a) Update Segment types** (non-breaking — `nodeId` optional):
```ts
| { kind: 'player';   text: string; nodeId?: string; active?: boolean }
| { kind: 'opponent'; text: string; nodeId?: string; active?: boolean }
```

**b) Update `buildLines`** to emit nodeId on each token:
```ts
const tok: Segment = node.color === 'player'
  ? { kind: 'player',   text: node.san, nodeId: node.id, ...(isActive ? { active: true } : {}) }
  : { kind: 'opponent', text: node.san, nodeId: node.id, ...(isActive ? { active: true } : {}) };
```

**c) Add private `ancestorPath` helper**:
```ts
function ancestorPath(root: MoveNode, targetId: string): MoveNode[] {
  function collect(n: MoveNode, path: MoveNode[]): MoveNode[] | null {
    const next = [...path, n]
    if (n.id === targetId) return next
    for (const c of n.children) {
      const found = collect(c, next)
      if (found) return found
    }
    return null
  }
  return collect(root, []) ?? []
}
```

**d) Add 6 exported functions**:
```ts
export function navigateTo(tree: MoveTree, nodeId: string): MoveTree {
  if (!nodeById(tree.root, nodeId)) return tree
  return { ...tree, currentNodeId: nodeId }
}

export function navigateParent(tree: MoveTree): MoveTree {
  const current = nodeById(tree.root, tree.currentNodeId)
  if (!current || current.parentId === null) return tree
  return { ...tree, currentNodeId: current.parentId }
}

export function navigateFirstChild(tree: MoveTree): MoveTree {
  const current = nodeById(tree.root, tree.currentNodeId)
  if (!current || current.children.length === 0) return tree
  return { ...tree, currentNodeId: current.children[0].id }
}

export function navigateSibling(tree: MoveTree, dir: 'prev' | 'next'): MoveTree {
  const current = nodeById(tree.root, tree.currentNodeId)
  if (!current || current.parentId === null) return tree
  const parent = nodeById(tree.root, current.parentId)
  if (!parent) return tree
  const idx    = parent.children.findIndex(c => c.id === tree.currentNodeId)
  const newIdx = dir === 'next' ? idx + 1 : idx - 1
  if (newIdx < 0 || newIdx >= parent.children.length) return tree
  return { ...tree, currentNodeId: parent.children[newIdx].id }
}

export function getDepth(tree: MoveTree): number {
  return ancestorPath(tree.root, tree.currentNodeId).filter(n => n.san !== '').length
}

export function getBreadcrumb(tree: MoveTree): string[] {
  return ancestorPath(tree.root, tree.currentNodeId)
    .filter(n => n.san !== '')
    .map(n => n.san)
}
```

### G2. `web/src/components/MoveTree.tsx`

Accept the `onTokenClick?` prop and wire `onClick` / `onKeyDown` on move tokens:

```tsx
interface Props {
  lines: Line[]
  onTokenClick?: (nodeId: string) => void
}

export default function MoveTree({ lines, onTokenClick }: Props) {
  // …inside the player/opponent branch:
  return (
    <span
      key={segIdx}
      className={`move-token ${seg.kind}${isActive ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => seg.nodeId && onTokenClick?.(seg.nodeId)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && seg.nodeId) {
          e.preventDefault()
          onTokenClick?.(seg.nodeId)
        }
      }}
    >
      {seg.text}
    </span>
  )
}
```

### G3. `web/src/components/PuzzleGame.tsx`

**a) Expand imports**:
```ts
import { useReducer, useState, useEffect } from 'react'
import React from 'react'
import {
  createTree, addNode, buildLines, getCurrentFen,
  navigateTo, navigateParent, navigateFirstChild, navigateSibling,
  getDepth, getBreadcrumb,
} from '@/shared/moveTree'
```

**b) Expand action type**:
```ts
type Action =
  | { type: 'RECORD_MOVE';         uci: string }
  | { type: 'NAVIGATE_TO';         nodeId: string }
  | { type: 'NAVIGATE_PARENT' }
  | { type: 'NAVIGATE_FIRST_CHILD' }
  | { type: 'NAVIGATE_SIBLING';    dir: 'prev' | 'next' }
```

**c) Add reducer cases**:
```ts
if (action.type === 'NAVIGATE_TO')          return { tree: navigateTo(state.tree, action.nodeId) }
if (action.type === 'NAVIGATE_PARENT')      return { tree: navigateParent(state.tree) }
if (action.type === 'NAVIGATE_FIRST_CHILD') return { tree: navigateFirstChild(state.tree) }
if (action.type === 'NAVIGATE_SIBLING')     return { tree: navigateSibling(state.tree, action.dir) }
```

**d) Add keyboard listener**:
```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); dispatch({ type: 'NAVIGATE_PARENT' }) }
    if (e.key === 'ArrowRight') { e.preventDefault(); dispatch({ type: 'NAVIGATE_FIRST_CHILD' }) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); dispatch({ type: 'NAVIGATE_SIBLING', dir: 'prev' }) }
    if (e.key === 'ArrowDown')  { e.preventDefault(); dispatch({ type: 'NAVIGATE_SIBLING', dir: 'next' }) }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

**e) Compute dynamic breadcrumb + depth**:
```ts
const depth      = getDepth(state.tree)
const breadcrumb = getBreadcrumb(state.tree)
```

Replace `<span className="num">0</span>` with `<span className="num">{depth}</span>`.

Replace static breadcrumb div with:
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

**f) Pass onTokenClick to MoveTree**:
```tsx
<MoveTree
  lines={lines}
  onTokenClick={(id) => dispatch({ type: 'NAVIGATE_TO', nodeId: id })}
/>
```

### G4 — GREEN run check

```bash
cd web && npm test           # 97 passed (74 existing + 23 new)
cd web && npm run test:e2e   # 42 passed (37 existing + 5 new)
```

---

## REFACTOR — Clean up (Yellow)

After all 139 tests are green:

1. Verify `ancestorPath` duplicates no logic from the existing private `ancestorIds`
   function — `ancestorPath` returns an ordered `MoveNode[]` while `ancestorIds` returns
   a `Set<string>`. Both are needed; no consolidation required.

2. Verify the keyboard `useEffect` has an empty dependency array `[]` — it closes over
   `dispatch` which is stable from `useReducer`, so this is correct.

3. Manual browser check:
   - Record `e4 e5 Nf3 Nc6` → depth `4`, breadcrumb shows full path.
   - Click `e5` token → depth `2`, breadcrumb shows `▸ start → e4 → e5`.
   - Press → → depth `3` (cursor at Nf3).
   - Press ← ← ← → depth `0`, breadcrumb shows only `▸ start`.
   - Board never changes throughout.

4. Manual check for sibling navigation:
   - From `e4`, record `e5` then navigate back to `e4` and record `c5` (branch).
   - Navigate to `e5` node, press ↓ → cursor jumps to `c5` (next sibling).

### Final counts

```bash
cd web && npm test           # 97 passed
cd web && npm run test:e2e   # 42 passed
```

---

## File → test mapping

| Source file changed | Tests that go RED | Test file |
|---|---|---|
| `shared/moveTree.ts` (navigate/depth/breadcrumb) | 16 navigate + depth + breadcrumb unit tests | `moveTree.test.ts` |
| `web/src/components/MoveTree.tsx` (onClick + onKeyDown) | token click and Enter key | `MoveTree.test.tsx` |
| `web/src/components/PuzzleGame.tsx` (actions + keyboard + dynamic UI) | depth counter, breadcrumb, keyboard nav, onTokenClick | `PuzzleGame.test.tsx` |
| All three files above | click token, depth, breadcrumb, keyboard ArrowLeft | `navigation.spec.ts` |
