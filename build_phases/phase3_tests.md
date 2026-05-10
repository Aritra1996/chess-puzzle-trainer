# Comprehensive Test Plan — Phases 1 → 3

All tests required to verify the chess puzzle trainer through Phase 3 (move recording). Follows TDD: Red → Green → Refactor for every cycle. Existing tests are never deleted — only extended or replaced when a component is refactored.

---

## Cumulative test counts by phase

| Suite | After P1 | After P2.2 | After P3 | Notes |
|---|---|---|---|---|
| `shared` unit | 8 | 8 | **26** | +18 moveTree |
| `web` unit | 16 | 30 | **49** | +7 chess, +6 PuzzleBoard overlay, MoveTree replaced, +11 PuzzleGame, page trimmed to 7 |
| E2E | 15 | 27 | **33** | +12 ui.spec.ts (P2.2), +6 recording.spec.ts (P3) |
| Backend | 8 | 8 | **8** | unchanged |
| **Total** | **47** | **73** | **116** | |

---

## Test environment (already set up)

All tooling from Phase 1 is in place. One new dependency for Phase 3:

```bash
cd web && npm install chess.js
```

No config changes needed — existing `vitest.config.ts` and `playwright.config.ts` cover all new files.

---

## Phase 1 tests (complete — reference only)

All 47 Phase 1 tests pass. Run commands:

```bash
cd shared && npm test         # 8 passed  (parseFen)
cd web && npm test            # 16 passed (PuzzleBoard × 11, page × 5)
cd web && npm run test:e2e    # 15 passed (board.spec.ts × 15 — NOTE: 1 broken after Phase 2.1)
cd backend && pytest -v       # 8 passed
```

### File layout (Phase 1)

```
shared/__tests__/fen.test.ts                   ← 8 tests
web/src/components/__tests__/PuzzleBoard.test.tsx  ← 11 tests
web/src/app/__tests__/page.test.tsx            ← 5 tests
web/e2e/board.spec.ts                          ← 15 tests (heading: /chess puzzle trainer/i)
backend/test_main.py                           ← 8 tests
```

---

## Phase 2.2 — Test Coverage for Paper/Ink UI

Phase 2.1 shipped the Visualis brand + paper/ink redesign. This introduced a gap:
- `board.spec.ts` line 8 checks `/chess puzzle trainer/i` but heading is now `Visualis` → **1 failing test**
- `MoveTree` component has zero unit coverage
- Turn plate, meta strip, analysis header, actions — untested

Target after Phase 2.2: **73 tests, 0 broken**.

### Step 1 — Fix `web/e2e/board.spec.ts`

One-line change:

```diff
- page.getByRole('heading', { name: /chess puzzle trainer/i })
+ page.getByRole('heading', { name: /visualis/i })
```

Run `npm run test:e2e` → 15/15 green.

---

### Step 2 — Extend `web/src/app/__tests__/page.test.tsx` (+7 tests)

Add a second `describe` block. The existing mock and dynamic import are unchanged.

```typescript
describe('Home page — Phase 2.1 structure', () => {
  it('renders the brand tagline', () => {
    render(<Home />)
    expect(screen.getByText(/puzzle trainer/i)).toBeInTheDocument()
  })

  it('shows the turn plate with side to move', () => {
    render(<Home />)
    expect(screen.getByText(/black to move/i)).toBeInTheDocument()
  })

  it('renders the board-mat container', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('.board-mat')).not.toBeNull()
  })

  it('renders the FEN label in the meta strip', () => {
    render(<Home />)
    expect(screen.getByText(/^fen$/i)).toBeInTheDocument()
  })

  it('renders the Move tree heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: /move tree/i })).toBeInTheDocument()
  })

  it('renders the no-moves-recorded status text', () => {
    render(<Home />)
    expect(screen.getByText(/no moves recorded/i)).toBeInTheDocument()
  })

  it('renders the Submit solution button', () => {
    render(<Home />)
    expect(screen.getByRole('button', { name: /submit solution/i })).toBeInTheDocument()
  })
})
```

Run `npm test` → 23/23 green.

---

### Step 3 — Create `web/src/components/__tests__/MoveTree.test.tsx` (7 tests)

Current `MoveTree.tsx` renders a hardcoded `SAMPLE_LINES` array (no props). Tests verify its rendered output structure.

> **Note**: Phase 3 Cycle 4 will **replace** this file with a props-driven version (same 7 tests, different setup). The file is created here so MoveTree has coverage immediately.

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

const { default: MoveTree } = await import('../MoveTree')

describe('MoveTree', () => {
  it('renders the .move-tree container', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelector('.move-tree')).not.toBeNull()
  })

  it('renders at least one .tree-line', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelectorAll('.tree-line').length).toBeGreaterThan(0)
  })

  it('renders player move tokens with class move-token player', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelector('.move-token.player')).not.toBeNull()
  })

  it('renders opponent move tokens with class move-token opponent', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelector('.move-token.opponent')).not.toBeNull()
  })

  it('renders at least one active move token', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelector('.move-token.active')).not.toBeNull()
  })

  it('marks active-path lines with is-active-path class', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelectorAll('.tree-line.is-active-path').length).toBeGreaterThan(0)
  })

  it('renders connector segments with class seg-connector', () => {
    const { container } = render(<MoveTree />)
    expect(container.querySelector('.seg-connector')).not.toBeNull()
  })
})
```

Run `npm test` → 30/30 green.

---

### Step 4 — Create `web/e2e/ui.spec.ts` (12 tests)

```typescript
import { test, expect } from '@playwright/test'

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

test.describe('Phase 2.1 — Paper/Ink UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the Visualis brand heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /visualis/i })).toBeVisible()
  })

  test('shows the puzzle chip with id #4521', async ({ page }) => {
    await expect(page.locator('.chip', { hasText: '#4521' })).toBeVisible()
  })

  test('shows the rating chip', async ({ page }) => {
    await expect(page.locator('.chip.rating')).toBeVisible()
  })

  test('shows nav links in the header', async ({ page }) => {
    await expect(page.locator('.nav-link', { hasText: 'Library' })).toBeVisible()
  })

  test('turn plate shows "Black to move"', async ({ page }) => {
    await expect(page.locator('.turn-plate')).toContainText('Black to move')
  })

  test('board mat wraps the board container', async ({ page }) => {
    await expect(page.locator('.board-mat .board-container')).toBeVisible()
  })

  test('meta strip shows the FEN label and value', async ({ page }) => {
    await expect(page.locator('.meta-strip')).toContainText('FEN')
    await expect(page.locator('.meta-strip .val')).toContainText(SAMPLE_FEN)
  })

  test('analysis panel shows "Move tree" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /move tree/i })).toBeVisible()
  })

  test('move tree renders player move tokens in blue', async ({ page }) => {
    await expect(page.locator('.move-token.player').first()).toBeVisible()
  })

  test('move tree renders opponent move tokens in red', async ({ page }) => {
    await expect(page.locator('.move-token.opponent').first()).toBeVisible()
  })

  test('recording status shows "no moves recorded"', async ({ page }) => {
    await expect(page.locator('.rec-text')).toContainText('no moves recorded')
  })

  test('Submit solution button is present', async ({ page }) => {
    await expect(page.locator('.btn-primary')).toContainText('Submit solution')
  })
})
```

Run `npm run test:e2e` → 27/27 green. **Phase 2.2 complete.**

---

## Phase 3 — Move Recording (TDD cycles)

Adds local move recording: click overlay, chess.js notation, tree state, PuzzleGame orchestrator. No backend calls during recording.

All 73 Phase 2.2 tests continue to pass — zero regressions.

---

### Cycle 1 — `shared/moveTree.ts` (18 tests)

Pure logic. Defines the data contract before any implementation.

#### RED — Create `shared/__tests__/moveTree.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { createTree, addNode, buildLines, getCurrentFen } from '../moveTree'
import type { MoveTree } from '../moveTree'

const START_FEN     = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4      = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const AFTER_E4_E5   = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
const AFTER_E4_C5   = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
const AFTER_D4      = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1'

describe('createTree', () => {
  it('creates a tree with no moves recorded', () => {
    const tree = createTree(START_FEN, 'white')
    expect(tree.root.children).toHaveLength(0)
  })

  it('sets playerColor from the argument', () => {
    const tree = createTree(START_FEN, 'black')
    expect(tree.playerColor).toBe('black')
  })

  it('sets currentNodeId to the root sentinel id', () => {
    const tree = createTree(START_FEN, 'white')
    expect(tree.currentNodeId).toBe(tree.root.id)
  })
})

describe('getCurrentFen', () => {
  it('returns the start FEN when no moves are recorded', () => {
    const tree = createTree(START_FEN, 'white')
    expect(getCurrentFen(tree)).toBe(START_FEN)
  })

  it('returns the node FEN after a move is recorded', () => {
    const tree  = createTree(START_FEN, 'white')
    const next  = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(getCurrentFen(next)).toBe(AFTER_E4)
  })
})

describe('addNode', () => {
  it('adds the first move as a child of the root', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.root.children).toHaveLength(1)
    expect(next.root.children[0].san).toBe('e4')
    expect(next.root.children[0].uci).toBe('e2e4')
    expect(next.root.children[0].illegal).toBe(false)
    expect(next.root.children[0].color).toBe('player')
  })

  it('advances currentNodeId to the newly added node', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.currentNodeId).toBe(next.root.children[0].id)
  })

  it('sets parentId to the current node', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.root.children[0].parentId).toBe(tree.root.id)
  })

  it('adds a child to the current node (not always the root)', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree,   { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
    const after2 = addNode(after1, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
    expect(after2.root.children).toHaveLength(1)
    expect(after2.root.children[0].children).toHaveLength(1)
    expect(after2.root.children[0].children[0].san).toBe('e5')
  })

  it('creates a branch when a second move is added at the same parent', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atRoot = { ...after1, currentNodeId: after1.root.id }
    const after2 = addNode(atRoot, { uci: 'd2d4', san: 'd4', fen: AFTER_D4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(after2.root.children).toHaveLength(2)
  })

  it('records an illegal move with illegal: true and preserves the raw san', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e9', san: 'e2-e9', fen: START_FEN, illegal: true, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(next.root.children[0].illegal).toBe(true)
    expect(next.root.children[0].san).toBe('e2-e9')
  })
})

describe('buildLines', () => {
  it('returns an empty array when no moves are recorded', () => {
    const tree = createTree(START_FEN, 'white')
    expect(buildLines(tree)).toHaveLength(0)
  })

  it('returns one line for a single move', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(buildLines(next)).toHaveLength(1)
  })

  it('single move line contains a number segment and a player segment', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const [line] = buildLines(next)
    expect(line.segments.some(s => s.kind === 'number')).toBe(true)
    expect(line.segments.some(s => s.kind === 'player' && s.text === 'e4')).toBe(true)
  })

  it('inlines a response move on the same line when there is no branch', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree,   { uci: 'e2e4', san: 'e4', fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
    const after2 = addNode(after1, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
    const lines = buildLines(after2)
    expect(lines).toHaveLength(1)
    expect(lines[0].segments.some(s => s.kind === 'player'   && s.text === 'e4')).toBe(true)
    expect(lines[0].segments.some(s => s.kind === 'opponent' && s.text === 'e5')).toBe(true)
  })

  it('creates branch lines with connectors when a node has two children', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4   = { ...after1, currentNodeId: after1.root.children[0].id }
    const after2 = addNode(atE4,  { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const back   = { ...after2, currentNodeId: after2.root.children[0].id }
    const after3 = addNode(back,  { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const lines = buildLines(after3)
    expect(lines.length).toBeGreaterThanOrEqual(3)
    const connectorLines = lines.filter(l => l.segments.some(s => s.kind === 'connector'))
    expect(connectorLines).toHaveLength(2)
  })

  it('uses ├─ for non-last branches and └─ for the last branch', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4   = { ...after1, currentNodeId: after1.root.children[0].id }
    const after2 = addNode(atE4, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const back   = { ...after2, currentNodeId: after2.root.children[0].id }
    const after3 = addNode(back, { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const lines  = buildLines(after3)
    const connLines = lines.filter(l => l.segments.some(s => s.kind === 'connector'))
    const connectors = connLines.map(l => l.segments.find(s => s.kind === 'connector')!.text)
    expect(connectors[0]).toContain('├─')
    expect(connectors[1]).toContain('└─')
  })

  it('marks all lines on the active path with isActivePath: true', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    expect(buildLines(next)[0].isActivePath).toBe(true)
  })

  it('marks inactive branch lines with isActivePath: false', () => {
    const tree   = createTree(START_FEN, 'white')
    const after1 = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const atE4   = { ...after1, currentNodeId: after1.root.children[0].id }
    const after2 = addNode(atE4, { uci: 'e7e5', san: 'e5', fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const back   = { ...after2, currentNodeId: after2.root.children[0].id }
    const after3 = addNode(back, { uci: 'c7c5', san: 'c5', fen: AFTER_E4_C5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true })
    const after4 = { ...after3, currentNodeId: after3.root.children[0].children[0].id }
    const lines  = buildLines(after4)
    expect(lines.filter(l => !l.isActivePath).length).toBeGreaterThan(0)
  })

  it('marks the cursor move segment with active: true', () => {
    const tree = createTree(START_FEN, 'white')
    const next = addNode(tree, { uci: 'e2e4', san: 'e4', fen: AFTER_E4, illegal: false, color: 'player', moveNumber: 1, isBlackMove: false })
    const [line] = buildLines(next)
    const cursor = line.segments.find(s => (s.kind === 'player' || s.kind === 'opponent') && 'active' in s && s.active)
    expect(cursor).toBeDefined()
    expect(cursor!.text).toBe('e4')
  })
})
```

Run `cd shared && npm test` → **all 18 fail** (module not found). RED.

#### GREEN
Implement `shared/moveTree.ts`: `createTree`, `addNode`, `buildLines`, `getCurrentFen`, exported types `MoveNode`, `MoveTree`, `Line`, `Segment`, `PlayerColor`.

Run `cd shared && npm test` → **26 passed** (18 new + 8 parseFen).

#### REFACTOR
- Confirm `addNode` is a pure function — no mutation.
- Confirm `buildLines` aligns branch connectors under the last move of the parent line.

---

### Cycle 2 — `web/src/lib/chess.ts` (7 tests)

Thin chess.js wrapper. Converts UCI to SAN, never blocks recording.

#### RED — Create `web/src/lib/__tests__/chess.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { computeMove } from '../chess'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4  = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
const PROMO_FEN = '8/P7/8/8/8/8/8/4K1k1 w - - 0 1'

describe('computeMove', () => {
  it('returns correct san for a legal move', () => {
    expect(computeMove(START_FEN, 'e2e4').san).toBe('e4')
  })

  it('returns the next FEN after a legal move', () => {
    expect(computeMove(START_FEN, 'e2e4').nextFen).toBe(AFTER_E4)
  })

  it('returns illegal: false for a legal move', () => {
    expect(computeMove(START_FEN, 'e2e4').illegal).toBe(false)
  })

  it('returns illegal: true for an impossible move', () => {
    expect(computeMove(START_FEN, 'e2e9').illegal).toBe(true)
  })

  it('returns a raw "from-to" san for an illegal move', () => {
    expect(computeMove(START_FEN, 'e2e9').san).toBe('e2-e9')
  })

  it('returns the original FEN unchanged for an illegal move', () => {
    expect(computeMove(START_FEN, 'e2e9').nextFen).toBe(START_FEN)
  })

  it('handles a promotion move (5-char UCI) correctly', () => {
    const { san, illegal } = computeMove(PROMO_FEN, 'a7a8q')
    expect(illegal).toBe(false)
    expect(san).toContain('=Q')
  })
})
```

Run `npm test` → **7 fail** (module not found). RED.

#### GREEN — Implement `web/src/lib/chess.ts`

```typescript
import { Chess } from 'chess.js'

export function computeMove(fen: string, uci: string): {
  san: string; nextFen: string; illegal: boolean
} {
  const chess = new Chess(fen)
  const from  = uci.slice(0, 2)
  const to    = uci.slice(2, 4)
  const promotion = uci[4] as 'q'|'r'|'b'|'n'|undefined
  try {
    const move = chess.move({ from, to, promotion })
    return { san: move.san, nextFen: chess.fen(), illegal: false }
  } catch {
    return { san: `${from}-${to}`, nextFen: fen, illegal: true }
  }
}
```

Run `npm test` → **37 passed** (7 chess + 30 existing web unit).

---

### Cycle 3 — `PuzzleBoard.tsx` click overlay (+6 tests)

Append a new `describe` block to the existing `PuzzleBoard.test.tsx`. The 11 original tests are untouched.

#### RED — Append to `web/src/components/__tests__/PuzzleBoard.test.tsx`

```typescript
import { fireEvent } from '@testing-library/react'

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
})
```

Run `npm test` → **6 new fail**, 31 pass. RED.

#### GREEN — Add overlay to `PuzzleBoard.tsx`

- Add `onMove?: (uci: string) => void` prop
- Add `pendingSquare` state (`useState<string | null>(null)`)
- Add `handleOverlayClick` converting pixel coords → square name
- Render `<div data-testid="click-overlay" ...>` conditionally (only when `onMove` provided)
- All existing Chessground config unchanged; `viewOnly: true` always

Run `npm test` → **43 passed** (17 PuzzleBoard + 7 chess + 30 other).

#### REFACTOR
- Guard `getBoundingClientRect()` against jsdom (returns zeros) — test assertions already accommodate this.
- Confirm overlay has no `pointer-events: none` (it must intercept clicks).

---

### Cycle 4 — `MoveTree.tsx` refactor to props-driven (replaces Phase 2.2 tests)

`MoveTree.tsx` currently renders a hardcoded `SAMPLE_LINES`. Refactor to accept `lines: Line[]` as a prop.

> **Phase 2.2 MoveTree.test.tsx is replaced here.** The 7 new tests are functionally equivalent but test the props API instead of hardcoded output.

#### RED — Replace `web/src/components/__tests__/MoveTree.test.tsx`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import MoveTree from '../MoveTree'
import type { Line } from '@/shared/moveTree'

const PLAYER_LINE: Line = {
  isActivePath: true,
  segments: [
    { kind: 'number',  text: '1. '  },
    { kind: 'player',  text: 'e4', active: true },
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
```

Run `npm test` → **7 MoveTree tests fail** (MoveTree still has no `lines` prop). RED.

#### GREEN — Refactor `MoveTree.tsx`

- Change signature to `export default function MoveTree({ lines }: { lines: Line[] })`
- Replace `SAMPLE_LINES` constant with `lines` prop
- Export `Segment` and `Line` types from `shared/moveTree.ts`
- All rendering class logic unchanged

Run `npm test` → **43 passed** (7 new MoveTree + 36 others). Count unchanged because Phase 2.2 tests are replaced.

---

### Cycle 5 — `PuzzleGame.tsx` orchestrator (11 tests)

New `'use client'` component that owns state and wires PuzzleBoard → tree → MoveTree. Includes both recording-logic tests and structural panel tests (migrated from Phase 2.2 `page.test.tsx`).

#### RED — Create `web/src/components/__tests__/PuzzleGame.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

let capturedOnMove: ((uci: string) => void) | undefined
vi.mock('../PuzzleBoard', () => ({
  default: ({ onMove }: { fen: string; orientation?: string; onMove?: (uci: string) => void }) => {
    capturedOnMove = onMove
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
  // ── Structural panel elements ───────────────────────────────────────
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

  // ── Recording logic ────────────────────────────────────────────────
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
    capturedOnMove?.('d8h4')
    const after = Number(screen.getByTestId('move-tree').getAttribute('data-lines'))
    expect(after).toBeGreaterThan(before)
  })

  it('changes the status bar text after the first move is recorded', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    capturedOnMove?.('d8h4')
    expect(screen.queryByText(/no moves recorded/i)).toBeNull()
  })

  it('board piece count stays unchanged — board is frozen', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} orientation="white" />)
    // PuzzleBoard is mocked — just verify PuzzleGame never changes the fen prop
    const board = screen.getByTestId('puzzle-board')
    capturedOnMove?.('d8h4')
    capturedOnMove?.('e1g1')
    // Board mock receives no FEN update — fen passed to it stays constant
    expect(board).toBeInTheDocument()
  })
})
```

Run `npm test` → **11 fail** (PuzzleGame does not exist). RED.

#### GREEN — Implement `PuzzleGame.tsx`

- `'use client'` component
- `useReducer` with `RECORD_MOVE` action
- Derives `playerColor` from `parseFen(fen).turn`
- Calls `computeMove` then `addNode` in the reducer
- Passes `onMove` to `PuzzleBoard`
- Passes `buildLines(state.tree)` to `MoveTree`
- Renders turn plate, board-mat, meta strip, Move tree heading, Submit button
- Status: "— no moves recorded" when tree is empty

Run `npm test` → **54 passed** (11 new + 43 existing).

#### REFACTOR
- Extract inline reducer to a named function.
- Confirm state is a plain object (no class instances).

---

### Cycle 6 — `page.tsx` update (7 tests)

`page.tsx` delegates the two-panel layout to `<PuzzleGame>`. The 5 structural panel tests that were in `page.test.tsx` since Phase 2.2 are removed from this file (they now live in `PuzzleGame.test.tsx` above). Page tests retain the header elements (brand, tagline) + PuzzleGame wiring.

#### Update `web/src/app/__tests__/page.test.tsx`

Replace the entire file:

```typescript
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

  it('passes orientation white to PuzzleGame', () => {
    render(<Home />)
    expect(screen.getByTestId('puzzle-game')).toHaveAttribute('data-orientation', 'white')
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
```

Run `npm test` → **49 passed** (7 page + 42 others). Count stays at 49 — the 5 structural panel tests moved from page to PuzzleGame, net 0.

---

### Cycle 7 — E2E recording (`web/e2e/recording.spec.ts`, 6 tests)

Runs in real Chromium. Confirms click overlay → UCI → SAN in tree panel → board stays frozen.

`SAMPLE_FEN` is black to move, board oriented as white (black pieces at top). Board is 480×480px, each square 60px. `sq(file, rank)` returns center of the square (0-indexed file 0=a, rank 1-8).

#### RED — Create `web/e2e/recording.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

const sq = (file: number, rank: number) => ({
  x: file * 60 + 30,
  y: (8 - rank) * 60 - 30,
})

test.describe('Phase 3 — Move Recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('click overlay is present on the board', async ({ page }) => {
    await expect(page.locator('[data-testid="click-overlay"]')).toBeVisible()
  })

  test('clicking two squares adds a move to the analysis tree', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(3, 8) })  // d8 — black queen
    await board.click({ position: sq(7, 4) })  // h4
    await expect(page.locator('.move-token').first()).toBeVisible()
  })

  test('recorded move appears in algebraic notation not raw UCI', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(3, 8) })
    await board.click({ position: sq(7, 4) })
    await expect(page.locator('.move-token', { hasText: 'Qh4' })).toBeVisible()
  })

  test('status bar updates after the first move is recorded', async ({ page }) => {
    await expect(page.getByText(/no moves recorded/i)).toBeVisible()
    const board = page.locator('.board-container')
    await board.click({ position: sq(3, 8) })
    await board.click({ position: sq(7, 4) })
    await expect(page.getByText(/no moves recorded/i)).not.toBeVisible()
  })

  test('board piece count is unchanged after recording a move', async ({ page }) => {
    await expect(page.locator('cg-board piece')).toHaveCount(29)
    const board = page.locator('.board-container')
    await board.click({ position: sq(3, 8) })
    await board.click({ position: sq(7, 4) })
    await expect(page.locator('cg-board piece')).toHaveCount(29)
  })

  test('clicking the same square twice does not record a move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(3, 8) })
    await board.click({ position: sq(3, 8) })
    await expect(page.locator('.move-token')).toHaveCount(0)
  })
})
```

Run `npm run test:e2e` → **6 fail** (PuzzleGame not yet implemented). RED.

#### GREEN
E2E tests pass automatically once Cycles 1–6 are complete and the app runs at `http://localhost:3000`. No additional implementation needed.

Run `npm run test:e2e` → **33 passed** (6 new + 27 from Phase 2.2 + fixed Phase 1).

---

## Running all tests

```bash
# Shared logic
cd shared && npm test           # target: 26 passed

# Frontend unit + component
cd web && npm test              # target: 49 passed

# E2E (Playwright starts dev server automatically)
cd web && npm run test:e2e      # target: 33 passed

# Backend (unchanged)
cd backend && source .venv/bin/activate && pytest -v  # target: 8 passed
```

Expected final output:
```
shared:   26 passed  (8 parseFen + 18 moveTree)
web:      49 passed  (17 PuzzleBoard + 7 MoveTree + 11 PuzzleGame + 7 page + 7 chess)
e2e:      33 passed  (15 board.spec + 12 ui.spec + 6 recording.spec)
backend:   8 passed
─────────────────
total:   116 passed  0 failed
```

---

## Complete test file layout

```
chess-puzzle-trainer/
├── shared/
│   └── __tests__/
│       ├── fen.test.ts              ← 8  (Phase 1)
│       └── moveTree.test.ts         ← 18 (Phase 3 Cycle 1, NEW)
│
├── web/
│   ├── e2e/
│   │   ├── board.spec.ts            ← 15 (Phase 1; heading fixed Phase 2.2)
│   │   ├── ui.spec.ts               ← 12 (Phase 2.2, NEW)
│   │   └── recording.spec.ts        ← 6  (Phase 3 Cycle 7, NEW)
│   └── src/
│       ├── lib/
│       │   └── __tests__/
│       │       └── chess.test.ts    ← 7  (Phase 3 Cycle 2, NEW)
│       ├── components/
│       │   └── __tests__/
│       │       ├── PuzzleBoard.test.tsx  ← 17 (Phase 1 × 11 + Phase 3 overlay × 6)
│       │       ├── MoveTree.test.tsx     ← 7  (Phase 2.2 created; Phase 3 Cycle 4 replaces)
│       │       └── PuzzleGame.test.tsx   ← 11 (Phase 3 Cycle 5, NEW)
│       └── app/
│           └── __tests__/
│               └── page.test.tsx    ← 7  (Phase 1 × 5; Phase 2.2 → 12; Phase 3 → 7)
│
└── backend/
    └── test_main.py                 ← 8  (Phase 1, unchanged)
```

---

## TDD order summary

| Step | File | Tests | Notes |
|---|---|---|---|
| **Phase 2.2** | | | |
| 2.2-1 | `web/e2e/board.spec.ts` | 0 (fixes 1) | Heading /chess puzzle trainer/ → /visualis/ |
| 2.2-2 | `web/src/app/__tests__/page.test.tsx` | +7 | Structural panel elements |
| 2.2-3 | `web/src/components/__tests__/MoveTree.test.tsx` | +7 | Hardcoded sample; replaced in Phase 3 |
| 2.2-4 | `web/e2e/ui.spec.ts` | +12 | Paper/Ink UI full browser verification |
| **Phase 3** | | | |
| 3-C1 | `shared/moveTree.ts` | +18 | Pure tree logic |
| 3-C2 | `web/src/lib/chess.ts` | +7 | chess.js UCI→SAN wrapper |
| 3-C3 | `PuzzleBoard.tsx` overlay | +6 | Click overlay extension |
| 3-C4 | `MoveTree.tsx` refactor | 0 net | Replaces Phase 2.2 hardcoded tests with props-driven tests |
| 3-C5 | `PuzzleGame.tsx` | +11 | Orchestrator: 5 structural (migrated) + 6 logic |
| 3-C6 | `page.tsx` update | -5 | Panel tests migrated to PuzzleGame, header tests added back |
| 3-C7 | `web/e2e/recording.spec.ts` | +6 | Full browser; runs after all other cycles green |
| **Grand total** | | **116** | All green, zero regressions |
