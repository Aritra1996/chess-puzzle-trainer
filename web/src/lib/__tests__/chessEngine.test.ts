import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import type { NodeToCheck } from '@/shared/solutionChecker'

// ─── Mock Worker ────────────────────────────────────────────────────────────
// Feeds Stockfish score responses from an array — one entry per 'go depth' call.
// Two entries per player node: [parentFen score, fenAfterMove score].

type Handler = (e: { data: string }) => void

let currentScores: string[] = []
let goIndex = 0

class MockWorker {
  private _onmessage: Handler | null = null
  private handlers = new Set<Handler>()

  set onmessage(fn: Handler) { this._onmessage = fn }
  get onmessage(): Handler | null { return this._onmessage }

  addEventListener(_: string, fn: Handler) { this.handlers.add(fn) }
  removeEventListener(_: string, fn: Handler) { this.handlers.delete(fn) }

  postMessage(msg: string) {
    if (msg === 'uci') {
      queueMicrotask(() => this._onmessage?.({ data: 'uciok' }))
    } else if (msg.startsWith('go')) {
      const score = currentScores[goIndex++] ?? 'score cp 0'
      queueMicrotask(() => {
        const info = `info depth 15 seldepth 20 multipv 1 ${score} nodes 12345 pv e2e4`
        this.handlers.forEach(h => h({ data: info }))
        this.handlers.forEach(h => h({ data: 'bestmove e2e4 ponder e7e5' }))
      })
    }
  }
}

vi.stubGlobal('Worker', MockWorker)
afterAll(() => vi.unstubAllGlobals())

// Reset module singleton between tests so each test gets a fresh worker.
beforeEach(() => {
  goIndex = 0
  vi.resetModules()
})

// Helper: re-import evalNodes with a fresh singleton, bound to the given scores.
async function makeEvalNodes(scores: string[]) {
  currentScores = scores
  const mod = await import('@/lib/chessEngine')
  return mod.evalNodes
}

// FEN values don't matter for classification — the mock ignores them.
const FEN_A = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FEN_B = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const FEN_C = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'

function playerNode(id: string, parentFen = FEN_A, fenAfterMove = FEN_B): NodeToCheck {
  return { nodeId: id, parentFen, fenAfterMove, illegal: false, isPlayerMove: true }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('evalNodes', () => {
  it('empty nodes array → returns empty Map', async () => {
    const evalNodes = await makeEvalNodes([])
    const result = await evalNodes([])
    expect(result.size).toBe(0)
  })

  it('drop < 100cp → correct  (parentScore=160, moveScore=120, drop=40)', async () => {
    // parentFen: +160cp user winning
    // fenAfterMove: −120cp from opp's view → moveScore = −(−120) = 120
    // drop = 160 − 120 = 40 < 100 → correct
    const evalNodes = await makeEvalNodes(['score cp 160', 'score cp -120'])
    const result = await evalNodes([playerNode('n1')])
    expect(result.get('n1')).toBe('correct')
  })

  it('drop > 100cp → wrong  (parentScore=500, moveScore=60, drop=440)', async () => {
    // parentFen: +500cp user winning by 5
    // fenAfterMove: −60cp from opp's view → moveScore = −(−60) = 60
    // drop = 500 − 60 = 440 > 100 → wrong
    const evalNodes = await makeEvalNodes(['score cp 500', 'score cp -60'])
    const result = await evalNodes([playerNode('n1')])
    expect(result.get('n1')).toBe('wrong')
  })

  it('drop exactly 100cp → correct  (boundary: condition is >, not ≥)', async () => {
    // fenAfterMove: −100cp → moveScore = 100; drop = 200 − 100 = 100, NOT > 100 → correct
    const evalNodes = await makeEvalNodes(['score cp 200', 'score cp -100'])
    const result = await evalNodes([playerNode('n1')])
    expect(result.get('n1')).toBe('correct')
  })

  it('user gains eval → correct  (parentScore=30, moveScore=180, drop=−150)', async () => {
    // fenAfterMove: −180cp from opp's view → moveScore = 180; drop = 30 − 180 = −150 → correct
    const evalNodes = await makeEvalNodes(['score cp 30', 'score cp -180'])
    const result = await evalNodes([playerNode('n1')])
    expect(result.get('n1')).toBe('correct')
  })

  it('opponent has forced mate after user move → wrong  (mate+)', async () => {
    // fenAfterMove: Stockfish says "score mate 3" → toNumber('mate+') = 9999
    // moveScore = −9999; drop = 100 − (−9999) = 10099 → wrong
    const evalNodes = await makeEvalNodes(['score cp 100', 'score mate 3'])
    const result = await evalNodes([playerNode('n1')])
    expect(result.get('n1')).toBe('wrong')
  })

  it('user delivers forced mate with their move → correct  (mate−)', async () => {
    // fenAfterMove: Stockfish says "score mate -3" → toNumber('mate-') = −9999
    // moveScore = −(−9999) = 9999; drop = 500 − 9999 = −9499 → correct
    const evalNodes = await makeEvalNodes(['score cp 500', 'score mate -3'])
    const result = await evalNodes([playerNode('n1')])
    expect(result.get('n1')).toBe('correct')
  })

  it('multiple nodes evaluated independently', async () => {
    // n1: parentScore=160, moveScore=120, drop=40  → correct
    // n2: parentScore=500, moveScore=60,  drop=440 → wrong
    const evalNodes = await makeEvalNodes([
      'score cp 160', 'score cp -120',   // n1: 2 evals
      'score cp 500', 'score cp -60',    // n2: 2 evals
    ])
    const result = await evalNodes([playerNode('n1'), playerNode('n2', FEN_B, FEN_C)])
    expect(result.get('n1')).toBe('correct')
    expect(result.get('n2')).toBe('wrong')
  })
})

describe('warmUpEngine', () => {
  it('does not throw', async () => {
    currentScores = []
    const { warmUpEngine } = await import('@/lib/chessEngine')
    expect(() => warmUpEngine()).not.toThrow()
  })
})
