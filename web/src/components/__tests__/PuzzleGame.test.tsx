import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

let capturedOnMove: ((uci: string) => void) | undefined
let capturedOrientation: string | undefined
vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove, orientation }: { fen: string; orientation?: string; onMove?: (uci: string) => void }) => {
    capturedOnMove = onMove
    capturedOrientation = orientation
    return <div data-testid="puzzle-board" />
  },
}))

vi.mock('../MoveTree', () => ({
  default: ({ lines }: { lines: unknown[] }) => (
    <div data-testid="move-tree" data-lines={lines.length} />
  ),
}))

const { default: PuzzleGame } = await import('../PuzzleGame')

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

describe('PuzzleGame', () => {
  it('renders the turn plate with side to move', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByText(/black to move/i)).toBeInTheDocument()
  })

  it('renders the board-mat container', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(container.querySelector('.board-mat')).not.toBeNull()
  })

  it('renders the FEN label in the meta strip', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByText(/^fen$/i)).toBeInTheDocument()
  })

  it('renders the Move tree heading', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByRole('heading', { name: /move tree/i })).toBeInTheDocument()
  })

  it('renders the Submit Solution button', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByRole('button', { name: /submit solution/i })).toBeInTheDocument()
  })

  it('renders a PuzzleBoard', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByTestId('puzzle-board')).toBeInTheDocument()
  })

  it('renders a MoveTree', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByTestId('move-tree')).toBeInTheDocument()
  })

  it('shows "no moves recorded" status initially', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    expect(screen.getByText(/no moves recorded/i)).toBeInTheDocument()
  })

  it('updates the move tree after a valid two-square click sequence', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    const before = Number(screen.getByTestId('move-tree').getAttribute('data-lines'))
    act(() => { capturedOnMove?.('d8h4') })
    const after = Number(screen.getByTestId('move-tree').getAttribute('data-lines'))
    expect(after).toBeGreaterThan(before)
  })

  it('changes the status bar text after the first move is recorded', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    act(() => { capturedOnMove?.('d8h4') })
    expect(screen.queryByText(/no moves recorded/i)).toBeNull()
  })

  it('board piece count stays unchanged — board is frozen', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    const board = screen.getByTestId('puzzle-board')
    act(() => { capturedOnMove?.('d8h4') })
    act(() => { capturedOnMove?.('e1g1') })
    expect(board).toBeInTheDocument()
  })

  it('auto-derives black orientation from a black-to-move FEN', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedOrientation).toBe('black')
  })

  it('flip button toggles board orientation', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedOrientation).toBe('black')
    act(() => { screen.getByTitle('flip board').click() })
    expect(capturedOrientation).toBe('white')
  })
})
