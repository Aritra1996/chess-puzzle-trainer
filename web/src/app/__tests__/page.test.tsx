import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock PuzzleBoard — we only care that the page wires it up correctly
vi.mock('@/components/PuzzleBoard', () => ({
  default: ({ fen, orientation }: { fen: string; orientation?: string }) => (
    <div data-testid="puzzle-board" data-fen={fen} data-orientation={orientation} />
  ),
}))

const { default: Home } = await import('../page')

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

describe('Home page', () => {
  it('renders the page heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /chess puzzle trainer/i })).toBeInTheDocument()
  })

  it('renders PuzzleBoard', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-board')).toBeInTheDocument()
  })

  it('passes SAMPLE_FEN to PuzzleBoard', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-board')).toHaveAttribute('data-fen', SAMPLE_FEN)
  })

  it('passes orientation white to PuzzleBoard', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-board')).toHaveAttribute('data-orientation', 'white')
  })

  it('displays the FEN string visibly on the page', () => {
    render(<Home />)
    expect(screen.getByText(SAMPLE_FEN)).toBeInTheDocument()
  })
})
