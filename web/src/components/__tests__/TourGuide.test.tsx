import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { driver as mockDriverFn } from 'driver.js'

vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({
    drive:   vi.fn(),
    destroy: vi.fn(),
  })),
}))

const TOUR_KEY = 'visualis_tour_seen'

const { default: TourGuide } = await import('../TourGuide')

describe('TourGuide — welcome popup', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders the popup when the localStorage key is absent', () => {
    render(<TourGuide />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/welcome to visualis/i)).toBeInTheDocument()
  })

  it('does not render the popup when the localStorage key is already set', () => {
    localStorage.setItem(TOUR_KEY, '1')
    render(<TourGuide />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Skip button writes the localStorage key and removes the popup', () => {
    render(<TourGuide />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(localStorage.getItem(TOUR_KEY)).toBe('1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Take the tour" button writes the localStorage key and removes the popup', () => {
    vi.useFakeTimers()
    render(<TourGuide />)
    fireEvent.click(screen.getByRole('button', { name: /take the tour/i }))
    expect(localStorage.getItem(TOUR_KEY)).toBe('1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('scrim wrapper has position fixed as an inline style', () => {
    render(<TourGuide />)
    const scrim = screen.getByRole('dialog').parentElement!
    expect(scrim).toHaveStyle({ position: 'fixed' })
  })

  it('"Take the tour" button calls driver().drive() after the 300 ms delay', () => {
    vi.useFakeTimers()
    render(<TourGuide />)
    fireEvent.click(screen.getByRole('button', { name: /take the tour/i }))

    const instance = (mockDriverFn as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.drive).not.toHaveBeenCalled()   // delay not elapsed yet

    vi.advanceTimersByTime(300)
    expect(instance.drive).toHaveBeenCalledOnce()

    vi.useRealTimers()
  })
})
