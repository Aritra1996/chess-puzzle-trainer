import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock Chessground before importing the component
const mockSet     = vi.fn()
const mockDestroy = vi.fn()
const mockChessground = vi.fn(() => ({ destroy: mockDestroy, set: mockSet }))

vi.mock('@lichess-org/chessground', () => ({
  Chessground: mockChessground,
}))

// Dynamic import AFTER mock is registered
const { default: PuzzleBoard } = await import('../PuzzleBoard')

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

beforeEach(() => {
  mockChessground.mockClear()
  mockDestroy.mockClear()
  mockSet.mockClear()
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

describe('PuzzleBoard — click overlay', () => {
  it('does not render the overlay when onMove is not provided', () => {
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} />)
    expect(container.querySelector('[data-testid="click-overlay"]')).toBeNull()
  })

  it('renders the overlay when onMove prop is provided', () => {
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} onMove={() => {}} />)
    expect(container.querySelector('[data-testid="click-overlay"]')).not.toBeNull()
  })

  it('still sets viewOnly: true in Chessground config when onMove is provided', () => {
    render(<PuzzleBoard fen={SAMPLE_FEN} onMove={() => {}} />)
    const config = mockChessground.mock.calls[0][1]
    expect(config.viewOnly).toBe(true)
  })

  it('sets data-pending on the overlay after the first click', () => {
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} onMove={() => {}} />)
    const overlay = container.querySelector('[data-testid="click-overlay"]')!
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    expect(overlay).toHaveAttribute('data-pending')
  })

  it('calls onMove with a UCI string after two different square clicks', () => {
    const onMove = vi.fn()
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} onMove={onMove} />)
    const overlay = container.querySelector('[data-testid="click-overlay"]')!
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    fireEvent.click(overlay, { clientX: 90, clientY: 90, bubbles: true })
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove.mock.calls[0][0]).toMatch(/^[a-h][1-8][a-h][1-8]$/)
  })

  it('does not call onMove when the same square is clicked twice', () => {
    const onMove = vi.fn()
    const { container } = render(<PuzzleBoard fen={SAMPLE_FEN} onMove={onMove} />)
    const overlay = container.querySelector('[data-testid="click-overlay"]')!
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('data-pending attribute is set after the first click', () => {
    const { container } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    const overlay = container.querySelector('[data-testid="click-overlay"]')!
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    expect(overlay).toHaveAttribute('data-pending')
  })

  it('preserves data-pending when the orientation prop changes', () => {
    const { container, rerender } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    const overlay = container.querySelector('[data-testid="click-overlay"]')!
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
    expect(overlay).toHaveAttribute('data-pending')
  })
})

describe('PuzzleBoard — Chessground-driven highlight', () => {
  it('calls cg.set with selected square after the first click', () => {
    const { container } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    mockSet.mockClear()
    fireEvent.click(
      container.querySelector('[data-testid="click-overlay"]')!,
      { clientX: 30, clientY: 30, bubbles: true }
    )
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ selected: expect.stringMatching(/^[a-h][1-8]$/) })
    )
  })

  it('calls cg.set with selected: undefined after a two-square move', () => {
    const { container } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    const overlay = container.querySelector('[data-testid="click-overlay"]')!
    fireEvent.click(overlay, { clientX: 30, clientY: 30, bubbles: true })
    mockSet.mockClear()
    fireEvent.click(overlay, { clientX: 90, clientY: 90, bubbles: true })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ selected: undefined })
    )
  })

  it('calls cg.set with the pending square when orientation prop changes', () => {
    const { container, rerender } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    fireEvent.click(
      container.querySelector('[data-testid="click-overlay"]')!,
      { clientX: 30, clientY: 30, bubbles: true }
    )
    mockSet.mockClear()
    rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ selected: expect.stringMatching(/^[a-h][1-8]$/) })
    )
  })

  it('does not call cg.set when orientation changes and no square is pending', () => {
    const { rerender } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    mockSet.mockClear()
    rerender(<PuzzleBoard fen={SAMPLE_FEN} orientation="black" onMove={vi.fn()} />)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('does not render a .sq-highlight element (highlight is Chessground-driven)', () => {
    const { container } = render(
      <PuzzleBoard fen={SAMPLE_FEN} orientation="white" onMove={vi.fn()} />
    )
    fireEvent.click(
      container.querySelector('[data-testid="click-overlay"]')!,
      { clientX: 30, clientY: 30, bubbles: true }
    )
    expect(container.querySelector('.sq-highlight')).toBeNull()
  })
})
