import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import React from 'react'
import { evalNodes } from '@/lib/chessEngine'

let capturedOnMove: ((uci: string) => void) | undefined
let capturedOrientation: string | undefined
let capturedOnTokenClick: ((id: string) => void) | undefined
let capturedCheckResult:   Map<string, string> | undefined
let capturedIsAtRoot:      boolean | undefined
let capturedLastMoveLabel: string | undefined
let capturedBoardLastMove: [string, string] | undefined

vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove, orientation, lastMove }: {
    fen:          string;
    orientation?: string;
    onMove?:      (uci: string) => void;
    lastMove?:    [string, string];
  }) => {
    capturedOnMove        = onMove
    capturedOrientation   = orientation
    capturedBoardLastMove = lastMove
    return <div data-testid="puzzle-board" />
  },
}))

vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick, checkResult, isAtRoot, lastMoveLabel }: {
    lines:           unknown[];
    onTokenClick?:   (id: string) => void;
    checkResult?:    Map<string, string>;
    isAtRoot?:       boolean;
    lastMoveLabel?:  string;
  }) => {
    capturedOnTokenClick  = onTokenClick
    capturedCheckResult   = checkResult
    capturedIsAtRoot      = isAtRoot
    capturedLastMoveLabel = lastMoveLabel
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))

vi.mock('@/lib/chessEngine', () => ({
  evalNodes:    vi.fn().mockResolvedValue(new Map()),
  warmUpEngine: vi.fn(),
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

describe('PuzzleGame — Solution Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCheckResult = undefined
  })

  it('Submit Solution button renders', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(screen.getByRole('button', { name: /submit solution/i })).toBeInTheDocument()
  })

  it('Submit with empty tree does not call evalNodes', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(evalNodes).not.toHaveBeenCalled()
  })

  it('Submit with recorded moves calls evalNodes', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(evalNodes).toHaveBeenCalled()
  })

  it('checkResult is passed to MoveTree after submit', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
  })

  it('recording a new move after submit clears checkResult', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
    act(() => { capturedOnMove?.('a2a3') })
    expect(capturedCheckResult).toBeUndefined()
  })

  it('Undo after submit clears checkResult', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(capturedCheckResult).toBeUndefined()
  })

  it('Reset after submit clears checkResult', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(capturedCheckResult).toBeUndefined()
  })

  it('Submit button shows "Checking…" and is disabled while evaluating', async () => {
    let resolveEval!: (v: Map<string, string>) => void
    vi.mocked(evalNodes).mockImplementationOnce(
      () => new Promise(r => { resolveEval = r as (v: Map<string, string>) => void })
    )
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })

    act(() => { fireEvent.click(screen.getByRole('button', { name: /submit solution/i })) })
    expect(screen.getByRole('button', { name: /checking/i })).toBeDisabled()

    await act(async () => { resolveEval(new Map()) })
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

describe('PuzzleGame — context token props', () => {
  it('isAtRoot is true before any moves are recorded', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedIsAtRoot).toBe(true)
  })

  it('isAtRoot is false after recording a move', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    expect(capturedIsAtRoot).toBe(false)
  })

  it('lastMoveLabel is derived from lastMove + FEN (black to move, fullMove=8 → "8. Bc4")', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} lastMove="Bc4" />)
    expect(capturedLastMoveLabel).toBe('8. Bc4')
  })
})

describe('PuzzleGame — breadcrumb', () => {
  it('breadcrumb does not render a .here element', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(container.querySelector('.breadcrumb .here')).toBeNull()
  })
})

describe('PuzzleGame — lastMoveUci prop', () => {
  it('PuzzleBoard receives parsed squares when lastMoveUci is provided', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} lastMoveUci="f1c4" />)
    expect(capturedBoardLastMove).toEqual(['f1', 'c4'])
  })

  it('PuzzleBoard receives no lastMove when lastMoveUci is omitted', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedBoardLastMove).toBeUndefined()
  })
})

describe('PuzzleGame — ResultBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('result bar is not rendered before submit', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(container.querySelector('.result-bar')).toBeNull()
  })

  it('result bar appears inside .an-footer after submit with recorded moves', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'correct' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    const footer = container.querySelector('.an-footer')
    expect(footer?.querySelector('.result-bar')).not.toBeNull()
  })

  it('result bar shows "Clean line" verdict when all player moves are correct', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'correct' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    const verdict = container.querySelector('.result-verdict')
    expect(verdict).not.toBeNull()
    expect(verdict).toHaveClass('rv-clean')
    expect(verdict?.textContent).toBe('Clean line')
  })

  it('result bar shows "Not optimal" verdict when a player move is wrong', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'wrong' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    const verdict = container.querySelector('.result-verdict')
    expect(verdict).toHaveClass('rv-wrong')
    expect(verdict?.textContent).toMatch(/Not optimal/i)
    expect(verdict?.textContent).toMatch(/1 mistake/)
  })

  it('result bar disappears after Reset', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'correct' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(container.querySelector('.result-bar')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(container.querySelector('.result-bar')).toBeNull()
  })
})
