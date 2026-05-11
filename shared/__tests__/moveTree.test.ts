import { describe, it, expect } from 'vitest'
import {
  createTree, addNode, buildLines, getCurrentFen,
  navigateTo, navigateParent, navigateFirstChild, navigateSibling,
  getDepth, getBreadcrumb, removeNode,
} from '../moveTree'
import type { MoveTree } from '../moveTree'

const START_FEN   = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4    = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
const AFTER_E4_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
const AFTER_D4    = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1'

describe('createTree', () => {
  it('creates a tree with no moves recorded', () => {
    const tree = createTree(START_FEN, 'white')
    expect(tree.root.children).toHaveLength(0)
  })

  it('sets playerColor from the argument', () => {
    const tree = createTree(START_FEN, 'black')
    expect(tree.playerColor).toBe('black')
  })

  it('sets currentNodeId to the root sentinel id', () => {
    const tree = createTree(START_FEN, 'white')
    expect(tree.currentNodeId).toBe(tree.root.id)
  })
})

describe('getCurrentFen', () => {
  it('returns the start FEN when no moves are recorded', () => {
    const tree = createTree(START_FEN, 'white')
    expect(getCurrentFen(tree)).toBe(START_FEN)
  })

  it('returns the node FEN after a move is recorded', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(getCurrentFen(next)).toBe(AFTER_E4)
  })
})

describe('addNode', () => {
  it('adds the first move as a child of the root', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.root.children).toHaveLength(1)
    expect(next.root.children[0].san).toBe('e4')
    expect(next.root.children[0].uci).toBe('e2e4')
    expect(next.root.children[0].illegal).toBe(false)
    expect(next.root.children[0].color).toBe('player')
  })

  it('advances currentNodeId to the newly added node', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.currentNodeId).toBe(next.root.children[0].id)
  })

  it('sets parentId to the current node', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.root.children[0].parentId).toBe(tree.root.id)
  })

  it('adds a child to the current node (not always the root)', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree,   { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
    const after2 = addNode(after1, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
    expect(after2.root.children).toHaveLength(1)
    expect(after2.root.children[0].children).toHaveLength(1)
    expect(after2.root.children[0].children[0].san).toBe('e5')
  })

  it('creates a branch when a second move is added at the same parent', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atRoot = { ...after1, currentNodeId: after1.root.id }
    const after2 = addNode(atRoot, { uci: 'd2d4', san: 'd4', fen: AFTER_D4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(after2.root.children).toHaveLength(2)
  })

  it('records an illegal move with illegal: true and preserves the raw san', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e9', san: 'e2-e9', fen: START_FEN, illegal: true, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.root.children[0].illegal).toBe(true)
    expect(next.root.children[0].san).toBe('e2-e9')
  })
})

describe('buildLines', () => {
  it('returns an empty array when no moves are recorded', () => {
    const tree = createTree(START_FEN, 'white')
    expect(buildLines(tree)).toHaveLength(0)
  })

  it('returns one line for a single move', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(buildLines(next)).toHaveLength(1)
  })

  it('single move line contains a number segment and a player segment', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const [line] = buildLines(next)
    expect(line.segments.some(s => s.kind === 'number')).toBe(true)
    expect(line.segments.some(s => s.kind === 'player' && s.text === 'e4')).toBe(true)
  })

  it('inlines a response move on the same line when there is no branch', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree,   { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
    const after2 = addNode(after1, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
    const lines = buildLines(after2)
    expect(lines).toHaveLength(1)
    expect(lines[0].segments.some(s => s.kind === 'player'   && s.text === 'e4')).toBe(true)
    expect(lines[0].segments.some(s => s.kind === 'opponent' && s.text === 'e5')).toBe(true)
  })

  it('creates branch lines with connectors when a node has two children', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4   = { ...after1, currentNodeId: after1.root.children[0].id }
    const after2 = addNode(atE4,  { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const back   = { ...after2, currentNodeId: after2.root.children[0].id }
    const after3 = addNode(back,  { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const lines = buildLines(after3)
    expect(lines.length).toBeGreaterThanOrEqual(3)
    const connectorLines = lines.filter(l => l.segments.some(s => s.kind === 'connector'))
    expect(connectorLines).toHaveLength(2)
  })

  it('uses ├─ for non-last branches and └─ for the last branch', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4   = { ...after1, currentNodeId: after1.root.children[0].id }
    const after2 = addNode(atE4, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const back   = { ...after2, currentNodeId: after2.root.children[0].id }
    const after3 = addNode(back, { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const lines  = buildLines(after3)
    const connLines = lines.filter(l => l.segments.some(s => s.kind === 'connector'))
    const connectors = connLines.map(l => l.segments.find(s => s.kind === 'connector')!.text)
    expect(connectors[0]).toContain('├─')
    expect(connectors[1]).toContain('└─')
  })

  it('marks all lines on the active path with isActivePath: true', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(buildLines(next)[0].isActivePath).toBe(true)
  })

  it('marks inactive branch lines with isActivePath: false', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4   = { ...after1, currentNodeId: after1.root.children[0].id }
    const after2 = addNode(atE4, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const back   = { ...after2, currentNodeId: after2.root.children[0].id }
    const after3 = addNode(back, { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const after4 = { ...after3, currentNodeId: after3.root.children[0].children[0].id }
    expect(buildLines(after4).filter(l => !l.isActivePath).length).toBeGreaterThan(0)
  })

  it('marks the cursor move segment with active: true', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const [line] = buildLines(next)
    const cursor = line.segments.find(s => (s.kind === 'player' || s.kind === 'opponent') && 'active' in s && s.active)
    expect(cursor).toBeDefined()
    expect(cursor!.text).toBe('e4')
  })
})

// ─── Phase 4 navigation helpers ──────────────────────────────────────────────

function twoMoveTree() {
  const t0 = createTree(START_FEN, 'white')
  const t1 = addNode(t0, { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
  return     addNode(t1, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
}

function branchTree() {
  const t0   = createTree(START_FEN, 'white')
  const t1   = addNode(t0,    { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
  const atE4 = { ...t1, currentNodeId: t1.root.children[0].id }
  const t2   = addNode(atE4,  { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
  const back = { ...t2, currentNodeId: t2.root.children[0].id }
  return       addNode(back,  { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
  // cursor is now at c5 (second child of e4)
}

// cursor placed at e4 (first inlined node, not the leaf)
function twoMoveAtFirst() {
  const t = twoMoveTree()
  return navigateTo(t, t.root.children[0].id)
}

// e4 → e5 → { Nf3, d4 }   (inline chain e4+e5, then branch at e5)
function inlineThenBranchTree() {
  const t0   = createTree(START_FEN, 'white')
  const t1   = addNode(t0,   { uci: 'e2e4', san: 'e4',  fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
  const t2   = addNode(t1,   { uci: 'e7e5', san: 'e5',  fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
  const atE5 = { ...t2, currentNodeId: t2.root.children[0].children[0].id }
  const t3   = addNode(atE5, { uci: 'g1f3', san: 'Nf3', fen: AFTER_E4_C5, illegal: false, color: 'player',   moveNumber: 2, isBlackMove: false })
  const back = { ...t3, currentNodeId: t3.root.children[0].children[0].id }
  return       addNode(back, { uci: 'd2d4', san: 'd4',  fen: AFTER_D4,    illegal: false, color: 'player',   moveNumber: 2, isBlackMove: false })
  // cursor = d4; tree shape: e4 → e5 → { Nf3, d4 }
}

describe('navigateTo', () => {
  it('moves the cursor to the target node', () => {
    const t    = twoMoveTree()
    const e4Id = t.root.children[0].id
    expect(navigateTo(t, e4Id).currentNodeId).toBe(e4Id)
  })

  it('is a no-op when the id does not exist in the tree', () => {
    const t = twoMoveTree()
    expect(navigateTo(t, 'nonexistent-id').currentNodeId).toBe(t.currentNodeId)
  })
})

describe('navigateParent', () => {
  it('moves the cursor to the parent node', () => {
    const t    = twoMoveTree()          // cursor at e5
    const e4Id = t.root.children[0].id
    expect(navigateParent(t).currentNodeId).toBe(e4Id)
  })

  it('is a no-op when the cursor is already at the root sentinel', () => {
    const t = createTree(START_FEN, 'white')
    expect(navigateParent(t).currentNodeId).toBe(t.root.id)
  })
})

describe('navigateFirstChild', () => {
  it('moves the cursor to the first child', () => {
    const t    = twoMoveTree()
    const atE4 = navigateTo(t, t.root.children[0].id)
    const e5Id = t.root.children[0].children[0].id
    expect(navigateFirstChild(atE4).currentNodeId).toBe(e5Id)
  })

  it('is a no-op when the current node has no children', () => {
    const t = twoMoveTree()  // cursor at e5 (leaf)
    expect(navigateFirstChild(t).currentNodeId).toBe(t.currentNodeId)
  })
})

describe('navigateSibling', () => {
  it('moves to the next sibling', () => {
    const t    = branchTree()                              // cursor at c5 (last child)
    const e5Id = t.root.children[0].children[0].id
    const atE5 = { ...t, currentNodeId: e5Id }            // cursor at e5 (first child)
    const c5Id = t.root.children[0].children[1].id
    expect(navigateSibling(atE5, 'next').currentNodeId).toBe(c5Id)
  })

  it('is a no-op when already at the last sibling', () => {
    const t = branchTree()  // cursor at c5 (last child)
    expect(navigateSibling(t, 'next').currentNodeId).toBe(t.currentNodeId)
  })

  it('moves to the previous sibling', () => {
    const t    = branchTree()                              // cursor at c5
    const e5Id = t.root.children[0].children[0].id
    expect(navigateSibling(t, 'prev').currentNodeId).toBe(e5Id)
  })

  it('is a no-op when already at the first sibling', () => {
    const t    = branchTree()
    const e5Id = t.root.children[0].children[0].id
    const atE5 = { ...t, currentNodeId: e5Id }
    expect(navigateSibling(atE5, 'prev').currentNodeId).toBe(e5Id)
  })
})

describe('getDepth', () => {
  it('returns 0 when the cursor is at the root sentinel', () => {
    expect(getDepth(createTree(START_FEN, 'white'))).toBe(0)
  })

  it('returns 1 when the cursor is at the first-move node', () => {
    const t1 = addNode(createTree(START_FEN, 'white'), { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(getDepth(t1)).toBe(1)
  })

  it('returns 2 at a grandchild node', () => {
    expect(getDepth(twoMoveTree())).toBe(2)
  })
})

describe('getBreadcrumb', () => {
  it('returns an empty array at the root sentinel', () => {
    expect(getBreadcrumb(createTree(START_FEN, 'white'))).toEqual([])
  })

  it('returns the single move SAN after one move', () => {
    const t1 = addNode(createTree(START_FEN, 'white'), { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(getBreadcrumb(t1)).toEqual(['e4'])
  })

  it('returns the full path SAN list after two moves', () => {
    expect(getBreadcrumb(twoMoveTree())).toEqual(['e4', 'e5'])
  })
})

// ─── Phase 5 removeNode ───────────────────────────────────────────────────────

describe('removeNode', () => {
  it('removes a leaf node from the tree', () => {
    const t      = twoMoveTree()                         // cursor at e5 (leaf)
    const result = removeNode(t, t.currentNodeId)
    expect(getBreadcrumb(result)).toEqual(['e4'])        // e5 gone, e4 remains
  })

  it('sets currentNodeId to the removed node\'s parent', () => {
    const t      = twoMoveTree()                         // cursor at e5
    const e4Id   = t.root.children[0].id
    const result = removeNode(t, t.currentNodeId)
    expect(result.currentNodeId).toBe(e4Id)
  })

  it('removes a node with children and all its descendants', () => {
    const t      = twoMoveTree()                         // root → e4 → e5
    const e4Id   = t.root.children[0].id
    const result = removeNode(t, e4Id)
    expect(result.root.children).toHaveLength(0)        // e4 and e5 both gone
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
    // Build a tree where root has two direct children: e4 and d4
    const t0     = createTree(START_FEN, 'white')
    const t1     = addNode(t0,     { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atRoot = { ...t1, currentNodeId: t1.root.id }
    const t2     = addNode(atRoot, { uci: 'd2d4', san: 'd4', fen: AFTER_D4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const e4Id   = t2.root.children[0].id
    const result = removeNode(t2, e4Id)
    expect(result.root.children).toHaveLength(1)        // d4 remains
  })
})

// ─── Phase 4.1 isActivePath across inline chains ─────────────────────────────

describe('buildLines — isActivePath across inline chains', () => {
  it('inline chain is not active when cursor is at root (regression guard)', () => {
    const t = { ...twoMoveTree(), currentNodeId: twoMoveTree().root.id }
    expect(buildLines(t)[0].isActivePath).toBe(false)
  })

  it('inline chain is active when cursor sits on the first inlined node', () => {
    // cursor = e4, leaf = e5; line is pushed at the leaf — must still be active
    expect(buildLines(twoMoveAtFirst())[0].isActivePath).toBe(true)
  })

  it('inline chain is active when cursor is at the leaf node (regression guard)', () => {
    // cursor = e5 (leaf)
    expect(buildLines(twoMoveTree())[0].isActivePath).toBe(true)
  })

  it('branch-flush line is active when cursor is on the first inlined node before the branch', () => {
    const t    = inlineThenBranchTree()
    const atE4 = navigateTo(t, t.root.children[0].id)
    // lines: [0] "1. e4 1... e5"  [1] "├─ 2. Nf3"  [2] "└─ 2. d4"
    const lines = buildLines(atE4)
    expect(lines[0].isActivePath).toBe(true)
    expect(lines[1].isActivePath).toBe(false)
    expect(lines[2].isActivePath).toBe(false)
  })

  it('correct lines are active when cursor is on a branch child', () => {
    const t     = inlineThenBranchTree()
    const nf3Id = t.root.children[0].children[0].children[0].id
    const lines = buildLines(navigateTo(t, nf3Id))
    // e4 and e5 are ancestors of Nf3 → lines[0] active; Nf3 branch → lines[1] active
    expect(lines[0].isActivePath).toBe(true)
    expect(lines[1].isActivePath).toBe(true)
    expect(lines[2].isActivePath).toBe(false)
  })
})
