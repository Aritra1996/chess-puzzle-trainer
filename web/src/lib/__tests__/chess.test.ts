import { describe, it, expect } from 'vitest'
import { computeMove } from '../chess'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4  = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const PROMO_FEN = '8/P7/8/8/8/8/8/4K1k1 w - - 0 1'

describe('computeMove', () => {
  it('returns correct san for a legal move', () => {
    expect(computeMove(START_FEN, 'e2e4').san).toBe('e4')
  })

  it('returns the next FEN after a legal move', () => {
    expect(computeMove(START_FEN, 'e2e4').nextFen).toBe(AFTER_E4)
  })

  it('returns illegal: false for a legal move', () => {
    expect(computeMove(START_FEN, 'e2e4').illegal).toBe(false)
  })

  it('returns illegal: true for an impossible move', () => {
    expect(computeMove(START_FEN, 'e2e9').illegal).toBe(true)
  })

  it('returns a raw "from-to" san for an illegal move', () => {
    expect(computeMove(START_FEN, 'e2e9').san).toBe('e2-e9')
  })

  it('returns the original FEN unchanged for an illegal move', () => {
    expect(computeMove(START_FEN, 'e2e9').nextFen).toBe(START_FEN)
  })

  it('handles a promotion move (5-char UCI) correctly', () => {
    const { san, illegal } = computeMove(PROMO_FEN, 'a7a8q')
    expect(illegal).toBe(false)
    expect(san).toContain('=Q')
  })
})
