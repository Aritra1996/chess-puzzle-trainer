import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import React from 'react'

let capturedOnMove: ((uci: string) => void) | undefined
let capturedOrientation: string | undefined
let capturedOnTokenClick: ((id: string) => void) | undefined

vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove, orientation }: { fen: string; orientation?: string; onMove?: (uci: string) => void }) => {
    capturedOnMove = onMove
    capturedOrientation = orientation
    return <div data-testid="puzzle-board" />
  },
}))

vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick }: { lines: unknown[]; onTokenClick?: (id: string) => void }) => {
    capturedOnTokenClick = onTokenClick
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
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

  it('ArrowLeft key moves cursor from depth 2 to depth 1', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })  // Nd5 — depth 1
    act(() => { capturedOnMove?.('a2a3') })  // a3  — depth 2
    act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 1')
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
})

describe('PuzzleGame — Undo / Reset', () => {
  it('renders the Undo button', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument()
  })

  it('pressing Undo after one recorded move reduces depth back to 0', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 1')
    fireEvent.click(screen.getByRole('button', { name: /Undo/i }))
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 0')
  })

  it('pressing Undo when nothing is recorded is a no-op', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Undo/i }))).not.toThrow()
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 0')
  })

  it('Backspace key triggers Undo (same effect as button)', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 1')
    act(() => { fireEvent.keyDown(window, { key: 'Backspace' }) })
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 0')
  })

  it('Reset button clears the tree and depth returns to 0', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 1')
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }))
    expect(container.querySelector('.an-stats')?.textContent).toContain('depth 0')
  })
})
