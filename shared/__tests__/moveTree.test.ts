import { describe, it, expect } from 'vitest'
import { createTree, addNode, buildLines, getCurrentFen } from '../moveTree'
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
