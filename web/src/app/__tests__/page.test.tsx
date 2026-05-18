import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/components/PuzzleGame', () => ({
  default: ({ fen, orientation }: { fen: string; orientation?: string }) => (
    <>
      <div data-testid="puzzle-game" data-fen={fen} data-orientation={orientation} />
      <p>{fen}</p>
    </>
  ),
}))

vi.mock('@/components/TourGuide', () => ({
  default: () => null,
}))

const { default: Home } = await import('../page')

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

describe('Home page', () => {
  it('renders the brand heading Visualis', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /visualis/i })).toBeInTheDocument()
  })

  it('renders the brand tagline', () => {
    render(<Home />)
    expect(screen.getByText(/puzzle trainer/i)).toBeInTheDocument()
  })

  it('renders PuzzleGame', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-game')).toBeInTheDocument()
  })

  it('passes SAMPLE_FEN to PuzzleGame', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-game')).toHaveAttribute('data-fen', SAMPLE_FEN)
  })

  it('does not pass an orientation prop to PuzzleGame (board self-orients)', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-game')).not.toHaveAttribute('data-orientation')
  })

  it('displays the FEN string visibly on the page', () => {
    render(<Home />)
    expect(screen.getByText(SAMPLE_FEN)).toBeInTheDocument()
  })

  it('renders nav links in the header', () => {
    render(<Home />)
    expect(screen.getByText(/library/i)).toBeInTheDocument()
  })
})
