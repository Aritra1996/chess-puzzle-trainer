import { describe, it, expect } from 'vitest'
import { parseFen } from '../fen'

const WHITE_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1'
const BLACK_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'
const BLACK_FIRST_PUZZLE = '2r3k1/5ppp/p7/1p1p4/3P4/PP3PPP/4r1K1/R7 b - - 0 15'

describe('parseFen', () => {
  it('identifies white to move', () => {
    expect(parseFen(WHITE_FEN).turn).toBe('white')
  })

  it('identifies black to move', () => {
    expect(parseFen(BLACK_FEN).turn).toBe('black')
  })

  it('extracts fullMoveNumber correctly', () => {
    expect(parseFen(BLACK_FEN).fullMoveNumber).toBe(8)
  })

  it('extracts move 15 for puzzle starting at move 15', () => {
    expect(parseFen(BLACK_FIRST_PUZZLE).fullMoveNumber).toBe(15)
  })

  it('preserves the original FEN string', () => {
    expect(parseFen(BLACK_FEN).fen).toBe(BLACK_FEN)
  })

  it('defaults fullMoveNumber to 1 when field is missing', () => {
    const shortFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    expect(parseFen(shortFen).fullMoveNumber).toBe(1)
  })

  it('defaults fullMoveNumber to 1 when field is not a number', () => {
    const badFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 notanumber'
    expect(parseFen(badFen).fullMoveNumber).toBe(1)
  })

  it('defaults turn to white for unknown active-color field', () => {
    const badFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'
    expect(parseFen(badFen).turn).toBe('white')
  })
})
