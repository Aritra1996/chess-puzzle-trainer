import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// Mock Chessground before importing the component
const mockDestroy = vi.fn()
const mockChessground = vi.fn(() => ({ destroy: mockDestroy }))

vi.mock('@lichess-org/chessground', () => ({
  Chessground: mockChessground,
}))

// Dynamic import AFTER mock is registered
const { default: PuzzleBoard } = await import('../PuzzleBoard')

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

beforeEach(() => {
  mockChessground.mockClear()
  mockDestroy.mockClear()
})

describe('PuzzleBoard', () => {
  it('renders the board-container div', () => {
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} />)
    expect(container.querySelector('.board-container')).not.toBeNull()
  })

  it('renders the cg-wrap div inside the container', () => {
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} />)
    expect(container.querySelector('.cg-wrap')).not.toBeNull()
  })

  it('initialises Chessground on mount', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} />)
    expect(mockChessground).toHaveBeenCalledTimes(1)
  })

  it('passes the fen prop to Chessground', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.fen).toBe(SAMPLE_FEN)
  })

  it('sets viewOnly: true', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.viewOnly).toBe(true)
  })

  it('disables animation', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.animation?.enabled).toBe(false)
  })

  it('disables drawable', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.drawable?.enabled).toBe(false)
  })

  it('defaults orientation to white', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.orientation).toBe('white')
  })

  it('respects explicit orientation prop', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.orientation).toBe('black')
  })

  it('calls destroy() on unmount', () => {
    const { unmount } = render(<PuzzleBoard fen={SAMPLE_FEN} />)
    unmount()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('destroys and re-creates Chessground when fen prop changes', () => {
    const newFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const { rerender } = render(<PuzzleBoard fen={SAMPLE_FEN} />)
    rerender(<PuzzleBoard fen={newFen} />)
    expect(mockDestroy).toHaveBeenCalledTimes(1)
    expect(mockChessground).toHaveBeenCalledTimes(2)
    const secondCall = mockChessground.mock.calls[1][1]
    expect(secondCall.fen).toBe(newFen)
  })
})
