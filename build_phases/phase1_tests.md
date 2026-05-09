# Phase 1 — TDD Test Plan (Red → Green → Refactor)

## Overview

Three test layers mirror the three independent codebases in Phase 1:

| Layer | Files under test | Framework |
|---|---|---|
| Shared logic | `shared/fen.ts`, `shared/types.ts` | Vitest (Node) |
| Frontend components | `web/src/components/PuzzleBoard.tsx`, `web/src/app/page.tsx` | Vitest + React Testing Library + jsdom |
| Backend API | `backend/main.py` | pytest + httpx |

Each layer follows its own Red → Green → Refactor cycle. Run them independently.

---

## Test Environment Setup

### A — Shared (`shared/`)

```bash
cd shared
npm init -y
npm install -D vitest typescript @types/node
```

Add to `shared/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `shared/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node' },
})
```

### B — Frontend (`web/`)

```bash
cd web
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Add to `web/package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    alias: {
      '@/components': path.resolve(__dirname, './src/components'),
      '@/shared': path.resolve(__dirname, '../shared'),
    },
  },
})
```

Create `web/src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

### C — Backend (`backend/`)

```bash
cd backend
source .venv/bin/activate
pip install pytest httpx pytest-asyncio
```

Create `backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
```

### D — E2E (`web/e2e/`)

```bash
cd web
npm install -D @playwright/test
npx playwright install chromium   # chromium only — sufficient for Phase 1
```

Create `web/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
```

Add to `web/package.json` scripts:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

---

## Cycle 1 — `parseFen()` in `shared/fen.ts`

### RED — Write failing tests first

Create `shared/__tests__/fen.test.ts` **before writing `fen.ts`**:

```typescript
import { describe, it, expect } from 'vitest'
import { parseFen } from '../fen'

const WHITE_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1'
const BLACK_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'
const BLACK_FIRST_PUZZLE = '2r3k1/5ppp/p7/1p1p4/3P4/PP3PPP/4r1K1/R7 b - - 0 15'

describe('parseFen', () => {
  it('identifies white to move', () => {
    expect(parseFen(WHITE_FEN).turn).toBe('white')
  })

  it('identifies black to move', () => {
    expect(parseFen(BLACK_FEN).turn).toBe('black')
  })

  it('extracts fullMoveNumber correctly', () => {
    expect(parseFen(BLACK_FEN).fullMoveNumber).toBe(8)
  })

  it('extracts move 15 for puzzle starting at move 15', () => {
    expect(parseFen(BLACK_FIRST_PUZZLE).fullMoveNumber).toBe(15)
  })

  it('preserves the original FEN string', () => {
    expect(parseFen(BLACK_FEN).fen).toBe(BLACK_FEN)
  })

  it('defaults fullMoveNumber to 1 when field is missing', () => {
    const shortFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    expect(parseFen(shortFen).fullMoveNumber).toBe(1)
  })

  it('defaults fullMoveNumber to 1 when field is not a number', () => {
    const badFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 notanumber'
    expect(parseFen(badFen).fullMoveNumber).toBe(1)
  })

  it('defaults turn to white for unknown active-color field', () => {
    const badFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'
    expect(parseFen(badFen).turn).toBe('white')
  })
})
```

Run `npm test` → **all 8 tests fail** (module not found). This is the RED state.

### GREEN — Implement `shared/fen.ts` to pass all tests

```typescript
import type { PuzzlePosition } from './types'

export function parseFen(fen: string): PuzzlePosition {
  const parts = fen.split(' ')
  const fullMoveNumber = parseInt(parts[5] ?? '1', 10)
  return {
    fen,
    turn: parts[1] === 'b' ? 'black' : 'white',
    fullMoveNumber: isNaN(fullMoveNumber) ? 1 : fullMoveNumber,
  }
}
```

Run `npm test` → **all 8 tests pass**. This is the GREEN state.

### REFACTOR

Check: is `parts[5] ?? '1'` sufficient? The `??` only catches `undefined`/`null`, not `''`. Since `split(' ')` on a valid-but-short FEN returns `undefined` for missing fields (not `''`), this is correct. No change needed.

---

## Cycle 2 — FastAPI backend (`backend/main.py`)

### RED — Write failing tests first

Create `backend/test_main.py` **before writing `main.py`**:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

async def test_health_returns_200(client):
    response = await client.get("/health")
    assert response.status_code == 200

async def test_health_returns_ok(client):
    assert response.json() == {"status": "ok"}
    response = await client.get("/health")
    assert response.json() == {"status": "ok"}

async def test_sample_puzzle_returns_200(client):
    response = await client.get("/puzzle/sample")
    assert response.status_code == 200

async def test_sample_puzzle_has_fen(client):
    response = await client.get("/puzzle/sample")
    data = response.json()
    assert "fen" in data
    assert data["fen"].count(" ") == 5  # valid FEN has 6 space-separated fields

async def test_sample_puzzle_turn_is_black(client):
    response = await client.get("/puzzle/sample")
    assert response.json()["turn"] == "black"  # SAMPLE_FEN has black to move

async def test_sample_puzzle_has_legal_moves(client):
    response = await client.get("/puzzle/sample")
    data = response.json()
    assert "legal_moves" in data
    assert len(data["legal_moves"]) > 0

async def test_sample_puzzle_legal_moves_are_uci(client):
    response = await client.get("/puzzle/sample")
    moves = response.json()["legal_moves"]
    for move in moves:
        assert len(move) in (4, 5), f"Expected UCI move (4-5 chars), got: {move}"

async def test_cors_header_present(client):
    response = await client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert "access-control-allow-origin" in response.headers
```

Run `pytest` → **import error** (main.py doesn't exist). RED state.

### GREEN — Implement `backend/main.py`

Write `main.py` as specified in `phase1.md` Step 7. Run `pytest` → **all 8 tests pass**.

### REFACTOR

- Extract SAMPLE_FEN to a module-level constant (already done in plan).
- Confirm CORS `allow_origins` only includes what's needed — no `"*"` in production.

---

## Cycle 3 — `PuzzleBoard` component (`web/src/components/PuzzleBoard.tsx`)

Chessground manipulates the DOM directly. Tests mock it to stay in unit-test territory.

### RED — Write failing tests first

Create `web/src/components/__tests__/PuzzleBoard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

// Mock Chessground before importing the component
const mockDestroy = vi.fn()
const mockChessground = vi.fn(() => ({ destroy: mockDestroy }))

vi.mock('@lichess-org/chessground', () => ({
  Chessground: mockChessground,
}))

// Dynamic import AFTER mock is registered
const { default: PuzzleBoard } = await import('../PuzzleBoard')

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

beforeEach(() => {
  mockChessground.mockClear()
  mockDestroy.mockClear()
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
```

Run `npm test` → **component not found**. RED state.

### GREEN — Implement `web/src/components/PuzzleBoard.tsx`

Write PuzzleBoard as specified in `phase1.md` Step 4. Run `npm test` → **all 11 tests pass**.

### REFACTOR

Check: `cgRef.current?.destroy()` is called twice per FEN change (once in cleanup, once at top of effect). The effect cleanup runs on re-render before the new effect — so calling `destroy()` at the top is redundant. Remove the top-level call:

```typescript
// BEFORE
cgRef.current?.destroy();          // redundant — cleanup already destroyed it
cgRef.current = Chessground(...)

// AFTER
cgRef.current = Chessground(boardRef.current, config)
```

Re-run tests → still pass. The `destroy()` call count in `test_destroys_and_recreates` becomes 1 (from cleanup only), which is cleaner. Update the test expectation accordingly.

---

## Cycle 4 — Home page (`web/src/app/page.tsx`)

### RED — Write failing tests first

Create `web/src/app/__tests__/page.test.tsx`:

```typescript
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
```

Run `npm test` → **page.tsx not found**. RED state.

### GREEN — Implement `web/src/app/page.tsx`

Write page.tsx as specified in `phase1.md` Step 5. Run `npm test` → **all 5 tests pass**.

### REFACTOR

No structural changes needed for Phase 1. SAMPLE_FEN is defined at module scope — correct.

---

## Cycle 5 — Playwright E2E (`web/e2e/board.spec.ts`)

These tests run against a real browser with a live Next.js dev server. They verify what unit and component tests cannot: actual CSS rendering, piece visibility, and that `viewOnly` mode truly blocks interaction.

The SAMPLE_FEN (`r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8`) has **29 pieces** — 15 white, 14 black.

### RED — Write failing tests first

Create `web/e2e/board.spec.ts` **before the app exists**:

```typescript
import { test, expect } from '@playwright/test'

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

test.describe('Phase 1 — Static Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // ── Page content ─────────────────────────────────────────────────
  test('shows the page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /chess puzzle trainer/i })
    ).toBeVisible()
  })

  test('displays the FEN string on the page', async ({ page }) => {
    await expect(page.getByText(SAMPLE_FEN)).toBeVisible()
  })

  // ── Board structure ───────────────────────────────────────────────
  test('renders the board container', async ({ page }) => {
    await expect(page.locator('.board-container')).toBeVisible()
  })

  test('board container is 480×480 pixels', async ({ page }) => {
    const box = await page.locator('.board-container').boundingBox()
    expect(box?.width).toBe(480)
    expect(box?.height).toBe(480)
  })

  test('Chessground mounts cg-board inside cg-wrap', async ({ page }) => {
    await expect(page.locator('.cg-wrap cg-board')).toBeVisible()
  })

  // ── Piece rendering ───────────────────────────────────────────────
  test('renders pieces on the board', async ({ page }) => {
    await expect(page.locator('cg-board piece').first()).toBeVisible()
  })

  test('renders exactly 29 pieces for the sample FEN', async ({ page }) => {
    // FEN breakdown: 15 white (B+P+P+N+6P+R+B+Q+K+R) + 14 black (r+q+k+b+r+6p+p+n+b)
    await expect(page.locator('cg-board piece')).toHaveCount(29)
  })

  test('white pieces are present', async ({ page }) => {
    const whitePieces = page.locator('cg-board piece.white')
    await expect(whitePieces.first()).toBeVisible()
    expect(await whitePieces.count()).toBe(15)
  })

  test('black pieces are present', async ({ page }) => {
    const blackPieces = page.locator('cg-board piece.black')
    await expect(blackPieces.first()).toBeVisible()
    expect(await blackPieces.count()).toBe(14)
  })

  // ── viewOnly — no interaction ─────────────────────────────────────
  test('clicking a square does not select any piece', async ({ page }) => {
    // In viewOnly mode Chessground attaches no event listeners
    // — no piece ever gets the "selected" class
    await page.locator('cg-board').click({ position: { x: 60, y: 60 } })
    await expect(page.locator('cg-board piece.selected')).toHaveCount(0)
  })

  test('clicking two squares does not show move destinations', async ({ page }) => {
    // move-dest squares appear only in interactive mode
    await page.locator('cg-board').click({ position: { x: 60, y: 60 } })
    await page.locator('cg-board').click({ position: { x: 120, y: 60 } })
    await expect(page.locator('cg-board square.move-dest')).toHaveCount(0)
  })

  test('dragging a piece does not change the piece count', async ({ page }) => {
    const before = await page.locator('cg-board piece').count()
    await page.locator('cg-board').dragTo(page.locator('cg-board'), {
      sourcePosition: { x: 60, y: 420 },   // white rook area (rank 1)
      targetPosition: { x: 60, y: 360 },   // one square forward
    })
    const after = await page.locator('cg-board piece').count()
    expect(after).toBe(before)
  })

  test('piece positions do not change after clicking all over the board', async ({ page }) => {
    // Record initial piece transform/style snapshot
    const getPositions = () =>
      page.locator('cg-board piece').evaluateAll((pieces) =>
        pieces.map((p) => (p as HTMLElement).style.transform)
      )

    const before = await getPositions()

    // Click 4 different squares
    const board = page.locator('cg-board')
    for (const pos of [
      { x: 60, y: 60 }, { x: 180, y: 180 },
      { x: 300, y: 300 }, { x: 420, y: 420 },
    ]) {
      await board.click({ position: pos })
    }

    const after = await getPositions()
    expect(after).toEqual(before)
  })
})
```

Run `npm run test:e2e` → **server fails to start** (Next.js not bootstrapped yet). RED state.

### GREEN — Run after all other cycles are complete

The Playwright tests are the final verification. They pass once Cycles 1–4 are done and the app runs correctly at `http://localhost:3000`. No new implementation required for this cycle — the tests exercise existing code in a real browser.

Run `npm run test:e2e` → **all 13 tests pass**.

### REFACTOR

- Replace magic pixel positions (e.g. `{ x: 60, y: 420 }`) with named constants at the top of the spec file if they become brittle.
- If piece count assertion flakes (timing), add an explicit wait: `await expect(page.locator('cg-board piece')).toHaveCount(29)` already has a built-in retry — no manual wait needed.

---

## Running All Tests

```bash
# Shared logic (pure TS — no server needed)
cd shared && npm test

# Backend
cd backend && source .venv/bin/activate && pytest -v

# Frontend unit + component tests
cd web && npm test

# E2E — starts Next.js dev server automatically
cd web && npm run test:e2e

# E2E with Playwright UI (interactive trace viewer)
cd web && npm run test:e2e:ui
```

Expected output when all green:
```
shared:   8 passed
web:      16 passed  (unit + component)
backend:  8 passed
e2e:      13 passed  (Playwright / Chromium)
```

---

## Test File Layout

```
/
├── shared/
│   ├── __tests__/
│   │   └── fen.test.ts                    ← 8 unit tests for parseFen()
│   ├── vitest.config.ts
│   └── package.json                       ← vitest devDep + test script
│
├── web/
│   ├── e2e/
│   │   └── board.spec.ts                  ← 13 Playwright E2E tests
│   ├── src/
│   │   ├── test-setup.ts                  ← @testing-library/jest-dom import
│   │   ├── components/
│   │   │   └── __tests__/
│   │   │       └── PuzzleBoard.test.tsx   ← 11 component tests
│   │   └── app/
│   │       └── __tests__/
│   │           └── page.test.tsx          ← 5 page wiring tests
│   ├── playwright.config.ts
│   └── vitest.config.ts
│
└── backend/
    ├── test_main.py                        ← 8 pytest tests
    └── pytest.ini
```

---

## TDD Order Summary

| Cycle | File | Tests | Why this order |
|---|---|---|---|
| 1 | `shared/fen.ts` | 8 | Pure function, zero deps — fastest feedback |
| 2 | `backend/main.py` | 8 | No browser needed; validates chess logic layer |
| 3 | `PuzzleBoard.tsx` | 11 | Chessground mocked; tests props and lifecycle |
| 4 | `page.tsx` | 5 | PuzzleBoard mocked; tests wiring only |
| 5 | `e2e/board.spec.ts` | 13 | Real browser; confirms CSS + viewOnly in full stack |
| **Total** | | **45** | |

Pure logic first, then backend, then UI innermost, then UI outermost. Playwright runs last — it is the only cycle that requires all other cycles to be green first and both servers to be running.
