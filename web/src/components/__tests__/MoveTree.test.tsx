import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import MoveTree from '../MoveTree'
import type { Line } from '@/shared/moveTree'

const PLAYER_LINE: Line = {
  isActivePath: true,
  segments: [
    { kind: 'number', text: '1. ' },
    { kind: 'player', text: 'e4', active: true },
  ],
}

const OPPONENT_LINE: Line = {
  isActivePath: true,
  segments: [
    { kind: 'number',   text: '1. ' },
    { kind: 'opponent', text: 'e5'  },
  ],
}

const INACTIVE_LINE: Line = {
  isActivePath: false,
  segments: [
    { kind: 'connector', text: '      └─ ' },
    { kind: 'number',    text: '1. '       },
    { kind: 'opponent',  text: 'd5'        },
  ],
}

describe('MoveTree', () => {
  it('renders an empty .move-tree container when lines is empty', () => {
    const { container } = render(<MoveTree lines={[]} />)
    expect(container.querySelector('.move-tree')).not.toBeNull()
    expect(container.querySelectorAll('.tree-line')).toHaveLength(0)
  })

  it('renders a player move token with class move-token player', () => {
    render(<MoveTree lines={[PLAYER_LINE]} />)
    expect(document.querySelector('.move-token.player')).not.toBeNull()
  })

  it('renders an opponent move token with class move-token opponent', () => {
    render(<MoveTree lines={[OPPONENT_LINE]} />)
    expect(document.querySelector('.move-token.opponent')).not.toBeNull()
  })

  it('adds the active class to a move token marked active: true', () => {
    render(<MoveTree lines={[PLAYER_LINE]} />)
    expect(document.querySelector('.move-token.active')).not.toBeNull()
  })

  it('applies is-active-path class to lines where isActivePath is true', () => {
    render(<MoveTree lines={[PLAYER_LINE, INACTIVE_LINE]} />)
    expect(document.querySelectorAll('.tree-line.is-active-path')).toHaveLength(1)
  })

  it('does not apply is-active-path to lines where isActivePath is false', () => {
    render(<MoveTree lines={[INACTIVE_LINE]} />)
    expect(document.querySelectorAll('.tree-line.is-active-path')).toHaveLength(0)
  })

  it('renders connector text inside a span with class seg-connector', () => {
    render(<MoveTree lines={[INACTIVE_LINE]} />)
    const connector = document.querySelector('.seg-connector')
    expect(connector).not.toBeNull()
    expect(connector!.textContent).toBe('      └─ ')
  })
})
