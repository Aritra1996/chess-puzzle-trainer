import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import MoveTree from '../MoveTree'
import type { Line } from '@/shared/moveTree'
import type { CheckStatus } from '@/shared/solutionChecker'

const PLAYER_LINE: Line = {
  isActivePath: true,
  segments: [
    { kind: 'number', text: '1. ' },
    { kind: 'player', text: 'e4', nodeId: 'node-1', active: true },
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

  it('calls onTokenClick with the nodeId when a token is clicked', async () => {
    const onTokenClick = vi.fn()
    render(<MoveTree lines={[PLAYER_LINE]} onTokenClick={onTokenClick} />)
    await userEvent.click(document.querySelector('.move-token.player')!)
    expect(onTokenClick).toHaveBeenCalledWith('node-1')
  })

  it('calls onTokenClick when Enter is pressed on a token', async () => {
    const onTokenClick = vi.fn()
    render(<MoveTree lines={[PLAYER_LINE]} onTokenClick={onTokenClick} />)
    document.querySelector<HTMLElement>('.move-token.player')!.focus()
    await userEvent.keyboard('{Enter}')
    expect(onTokenClick).toHaveBeenCalledWith('node-1')
  })
})

describe('MoveTree — context token', () => {
  it('renders "▸ start" when lastMoveLabel is not provided', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).toBeInTheDocument()
  })

  it('renders lastMoveLabel when provided', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} lastMoveLabel="8. Bc4" />)
    expect(screen.getByRole('button', { name: /8\. Bc4/i })).toBeInTheDocument()
  })

  it('context token is visible even when lines is empty', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).toBeInTheDocument()
  })

  it('context token has "active" class when isAtRoot is true', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={true} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).toHaveClass('active')
  })

  it('context token does not have "active" class when isAtRoot is false', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).not.toHaveClass('active')
  })

  it('clicking context token calls onTokenClick with rootNodeId', () => {
    const spy = vi.fn()
    render(<MoveTree lines={[]} rootNodeId="root-42" isAtRoot={false} onTokenClick={spy} />)
    fireEvent.click(screen.getByRole('button', { name: /▸ start/i }))
    expect(spy).toHaveBeenCalledWith('root-42')
  })

  it('context token is the first child inside the first .tree-line, not a sibling above it', () => {
    render(<MoveTree lines={[PLAYER_LINE]} rootNodeId="root-1" isAtRoot={false} />)
    const firstLine = document.querySelector('.tree-line')
    expect(firstLine).not.toBeNull()
    const fixedInsideLine = firstLine!.querySelector('.move-token.fixed')
    expect(fixedInsideLine).not.toBeNull()
  })

  it('renders exactly one .tree-line when lines is empty and rootNodeId is set', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(document.querySelectorAll('.tree-line')).toHaveLength(1)
  })
})

describe('MoveTree — token titles', () => {
  it('does not render .token-legend', () => {
    const { container } = render(<MoveTree lines={[]} />)
    expect(container.querySelector('.token-legend')).toBeNull()
  })

  it('token has title "mistake" when checkResult marks it wrong', () => {
    const result = new Map<string, CheckStatus>([['node-1', 'wrong']])
    render(<MoveTree lines={[PLAYER_LINE]} checkResult={result} />)
    expect(document.querySelector('.move-token.player')).toHaveAttribute('title', 'mistake')
  })

  it('token has title "correct" when checkResult marks it correct', () => {
    const result = new Map<string, CheckStatus>([['node-1', 'correct']])
    render(<MoveTree lines={[PLAYER_LINE]} checkResult={result} />)
    expect(document.querySelector('.move-token.player')).toHaveAttribute('title', 'correct')
  })

  it('token has title "illegal" when checkResult marks it illegal', () => {
    const result = new Map<string, CheckStatus>([['node-1', 'illegal']])
    render(<MoveTree lines={[PLAYER_LINE]} checkResult={result} />)
    expect(document.querySelector('.move-token.player')).toHaveAttribute('title', 'illegal')
  })

  it('token has no title attribute when checkResult is not provided', () => {
    render(<MoveTree lines={[PLAYER_LINE]} />)
    expect(document.querySelector('.move-token.player')).not.toHaveAttribute('title')
  })
})
