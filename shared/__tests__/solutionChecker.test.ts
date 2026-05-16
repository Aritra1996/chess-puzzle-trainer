import { describe, it, expect } from 'vitest'
import {
  parseSolutionMoves,
  collectNodesToCheck,
  classifyWithoutEngine,
} from '../solutionChecker'
import { createTree, addNode } from '../moveTree'
import type { NodeToCheck } from '../solutionChecker'

const START_FEN   = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4    = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
const AFTER_E4_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'

describe('parseSolutionMoves', () => {
  it('splits space-separated UCI string into array', () => {
    expect(parseSolutionMoves('e2e4 e7e5 g1f3')).toEqual(['e2e4', 'e7e5', 'g1f3'])
  })

  it('returns [] for empty string', () => {
    expect(parseSolutionMoves('')).toEqual([])
    expect(parseSolutionMoves('   ')).toEqual([])
  })
})

describe('collectNodesToCheck', () => {
  it('returns [] for empty tree', () => {
    const tree = createTree(START_FEN, 'white')
    expect(collectNodesToCheck(tree)).toHaveLength(0)
  })

  it('single node — parentFen = root.fen, fenAfterMove = node.fen, isPlayerMove true', () => {
    let tree = createTree(START_FEN, 'white')
    tree = addNode(tree, {
      uci: 'e2e4', san: 'e4', fen: AFTER_E4,
      illegal: false, color: 'player', moveNumber: 1, isBlackMove: false,
    })
    const nodes = collectNodesToCheck(tree)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].parentFen).toBe(START_FEN)
    expect(nodes[0].fenAfterMove).toBe(AFTER_E4)
    expect(nodes[0].illegal).toBe(false)
    expect(nodes[0].isPlayerMove).toBe(true)
  })

  it('skips children of illegal nodes', () => {
    let tree = createTree(START_FEN, 'white')
    // Illegal player move — fen stays at START_FEN (matches computeMove behaviour)
    tree = addNode(tree, {
      uci: 'e1e4', san: 'e1-e4', fen: START_FEN,
      illegal: true, color: 'player', moveNumber: 1, isBlackMove: false,
    })
    // Child of the illegal node — must be skipped
    tree = addNode(tree, {
      uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5,
      illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true,
    })
    const nodes = collectNodesToCheck(tree)
    expect(nodes).toHaveLength(1)       // only the illegal node itself
    expect(nodes[0].illegal).toBe(true)
  })

  it('does not skip children of wrong-but-legal nodes', () => {
    let tree = createTree(START_FEN, 'white')
    tree = addNode(tree, {
      uci: 'e2e4', san: 'e4', fen: AFTER_E4,
      illegal: false, color: 'player', moveNumber: 1, isBlackMove: false,
    })
    tree = addNode(tree, {
      uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5,
      illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true,
    })
    const nodes = collectNodesToCheck(tree)
    expect(nodes).toHaveLength(2)       // e4 (player) + e5 (opponent)
  })

  it('collects both branches of a branching tree', () => {
    let tree = createTree(START_FEN, 'white')
    tree = addNode(tree, {
      uci: 'e2e4', san: 'e4', fen: AFTER_E4,
      illegal: false, color: 'player', moveNumber: 1, isBlackMove: false,
    })
    const e4NodeId = tree.currentNodeId

    // Branch A: e5 response
    tree = addNode(tree, {
      uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5,
      illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true,
    })

    // Navigate back to e4, add branch B: c5 response
    tree = { ...tree, currentNodeId: e4NodeId }
    tree = addNode(tree, {
      uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5,
      illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true,
    })

    const nodes = collectNodesToCheck(tree)
    expect(nodes).toHaveLength(3)       // e4 + e5 + c5
    const fens = nodes.map(n => n.fenAfterMove)
    expect(fens).toContain(AFTER_E4)
    expect(fens).toContain(AFTER_E4_E5)
    expect(fens).toContain(AFTER_E4_C5)
  })
})

describe('classifyWithoutEngine', () => {
  it('illegal node → "illegal", not in needsEval', () => {
    const nodes: NodeToCheck[] = [
      { nodeId: 'n1', parentFen: START_FEN, fenAfterMove: START_FEN, illegal: true, isPlayerMove: true },
    ]
    const { result, needsEval } = classifyWithoutEngine(nodes)
    expect(result.get('n1')).toBe('illegal')
    expect(needsEval).toHaveLength(0)
  })

  it('opponent node → "correct", not in needsEval', () => {
    const nodes: NodeToCheck[] = [
      { nodeId: 'n1', parentFen: AFTER_E4, fenAfterMove: AFTER_E4_E5, illegal: false, isPlayerMove: false },
    ]
    const { result, needsEval } = classifyWithoutEngine(nodes)
    expect(result.get('n1')).toBe('correct')
    expect(needsEval).toHaveLength(0)
  })

  it('player node → in needsEval, not in result map', () => {
    const nodes: NodeToCheck[] = [
      { nodeId: 'n1', parentFen: START_FEN, fenAfterMove: AFTER_E4, illegal: false, isPlayerMove: true },
    ]
    const { result, needsEval } = classifyWithoutEngine(nodes)
    expect(result.has('n1')).toBe(false)
    expect(needsEval).toHaveLength(1)
    expect(needsEval[0].nodeId).toBe('n1')
  })

  it('mixed tree — illegal, opponent, player all classified correctly', () => {
    const nodes: NodeToCheck[] = [
      { nodeId: 'ill',  parentFen: START_FEN, fenAfterMove: START_FEN,   illegal: true,  isPlayerMove: true  },
      { nodeId: 'opp',  parentFen: AFTER_E4,  fenAfterMove: AFTER_E4_E5, illegal: false, isPlayerMove: false },
      { nodeId: 'play', parentFen: START_FEN, fenAfterMove: AFTER_E4,    illegal: false, isPlayerMove: true  },
    ]
    const { result, needsEval } = classifyWithoutEngine(nodes)
    expect(result.get('ill')).toBe('illegal')
    expect(result.get('opp')).toBe('correct')
    expect(result.has('play')).toBe(false)
    expect(needsEval).toHaveLength(1)
    expect(needsEval[0].nodeId).toBe('play')
  })
})
