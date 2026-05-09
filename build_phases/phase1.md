# Phase 1 — Static Board Implementation Plan

## Context

This implements Phase 1 of the chess puzzle trainer from `PROJECT.md`. The project root currently contains only `PROJECT.md` and an empty `build_phases/` directory. Phase 1's goal is minimal: render a frozen chessboard in the browser loaded from a FEN string, with no user interaction. This establishes the scaffolding (Next.js + Chessground + FastAPI skeleton) that Phases 2–6 build on.

---

## Final Directory Layout

All Phase 1 code lives in the project root:

```
/                                         ← project root
├── web/                                  ← Next.js App Router project (:3000)
│   ├── next.config.ts                    ← transpilePackages: Chessground is ESM-only
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  ← SAMPLE_FEN defined here; passes it to <PuzzleBoard fen={SAMPLE_FEN} />
│   │   │   └── globals.css               ← (1) imports 3 Chessground CSS files (base + brown theme + cburnett pieces)
│   │   │                                     (2) defines .board-container { width: 480px; height: 480px; }
│   │   └── components/
│   │       └── PuzzleBoard.tsx           ← "use client"; receives `fen` prop; mounts Chessground into a <div>
│   └── tsconfig.json                     ← path alias "@/shared/*" → "../shared/*"
│
├── backend/                              ← FastAPI + python-chess (:8000)
│   ├── main.py
│   └── requirements.txt
│
├── shared/                               ← TypeScript types/helpers (no framework)
│   ├── types.ts                          ← Puzzle, PuzzlePosition interfaces
│   └── fen.ts                            ← parseFen() — extracts turn + fullMoveNumber
│
└── build_phases/                         ← planning docs only
    └── phase1.md
```

**Data flow for the board:**
`page.tsx` (defines SAMPLE_FEN) → prop `fen` → `PuzzleBoard.tsx` (mounts Chessground) → styled by `globals.css` (CSS imports + container size)

---

## Testing Strategy

Phase 1 uses **Red → Green → Refactor** TDD. Full test plan: [`phase1_tests.md`](phase1_tests.md).

| Cycle | Target | Framework | Tests |
|---|---|---|---|
| 1 | `shared/fen.ts` | Vitest (Node) | 8 |
| 2 | `backend/main.py` | pytest + httpx | 8 |
| 3 | `PuzzleBoard.tsx` | Vitest + RTL + jsdom | 11 |
| 4 | `page.tsx` | Vitest + RTL + jsdom | 5 |
| 5 | `e2e/board.spec.ts` | Playwright (Chromium) | 13 |

**Write tests before each implementation step.** The order above matches the step order — implement Step 6 (shared) first, then Step 7 (backend), then Step 4 (PuzzleBoard), then Step 5 (page).

---

## Step-by-Step Implementation

### Step 1 — Bootstrap Next.js

```bash
npx create-next-app@latest web \
  --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd web
npm install @lichess-org/chessground
```

### Step 2 — Configure Chessground ESM transpilation

**`web/next.config.ts`** — add `transpilePackages` (required; Chessground is ESM-only):

```typescript
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  transpilePackages: ['@lichess-org/chessground'],
}
export default nextConfig
```

### Step 3 — Import Chessground CSS

**`web/src/app/globals.css`** — prepend these three imports (order matters):

```css
@import '@lichess-org/chessground/assets/chessground.base.css';
@import '@lichess-org/chessground/assets/chessground.brown.css';
@import '@lichess-org/chessground/assets/chessground.cburnett.css';

/* existing tailwind directives ... */

.board-container { width: 480px; height: 480px; }
```

All piece images are inline SVG base64 in the cburnett CSS — no image files needed.

### Step 4 — Create PuzzleBoard component

**`web/src/components/PuzzleBoard.tsx`**

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';

interface Props { fen: string; orientation?: 'white' | 'black'; }

export default function PuzzleBoard({ fen, orientation = 'white' }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const config: Config = {
      fen,
      orientation,
      viewOnly: true,           // disables ALL event listeners — board truly frozen
      animation: { enabled: false },
      highlight: { lastMove: false, check: false },
      drawable: { enabled: false },
    };
    cgRef.current?.destroy();
    cgRef.current = Chessground(boardRef.current, config);
    return () => { cgRef.current?.destroy(); };
  }, [fen, orientation]);

  return (
    <div className="board-container">
      <div ref={boardRef} className="cg-wrap" />
    </div>
  );
}
```

Key: `viewOnly: true` is the single correct flag to freeze the board (not `movable: { color: undefined }`). `cg-wrap` class is required by Chessground's base CSS.

### Step 5 — Wire up the page

**`web/src/app/page.tsx`**

```typescript
import PuzzleBoard from '@/components/PuzzleBoard';

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Chess Puzzle Trainer</h1>
        <PuzzleBoard fen={SAMPLE_FEN} orientation="white" />
        <p className="text-sm text-gray-400 font-mono">{SAMPLE_FEN}</p>
      </div>
    </main>
  );
}
```

### Step 6 — Shared TypeScript types

**`shared/types.ts`**

```typescript
export interface Puzzle {
  puzzleId: string;
  fen: string;
  moves: string;   // UCI: "e2e4 e7e5 ..."
  rating: number;
  themes: string;
}

export interface PuzzlePosition {
  fen: string;
  turn: 'white' | 'black';
  fullMoveNumber: number;
}
```

**`shared/fen.ts`**

```typescript
import type { PuzzlePosition } from './types';

export function parseFen(fen: string): PuzzlePosition {
  const parts = fen.split(' ');
  const fullMoveNumber = parseInt(parts[5] ?? '1', 10);
  return {
    fen,
    turn: parts[1] === 'b' ? 'black' : 'white',
    fullMoveNumber: isNaN(fullMoveNumber) ? 1 : fullMoveNumber,
  };
}
```

Add path alias to **`web/tsconfig.json`** under `compilerOptions.paths`:
```json
"@/shared/*": ["../shared/*"]
```

### Step 7 — FastAPI backend skeleton

**`backend/requirements.txt`**
```
fastapi==0.115.12
uvicorn[standard]==0.34.3
python-chess==1.999
```

**`backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import chess

app = FastAPI(title="Chess Puzzle Trainer API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SAMPLE_FEN = "r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/puzzle/sample")
def get_sample_puzzle():
    board = chess.Board(SAMPLE_FEN)
    return {
        "fen": SAMPLE_FEN,
        "turn": "black" if board.turn == chess.BLACK else "white",
        "full_move_number": board.fullmove_number,
        "legal_moves": [m.uci() for m in board.legal_moves],
    }
```

Setup:
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" python-chess
pip freeze > requirements.txt
```

---

## Running Tests

```bash
# Shared logic (pure TS — no server needed)
cd shared && npm test

# Backend
cd backend && source .venv/bin/activate && pytest -v

# Frontend unit + component tests
cd web && npm test

# E2E — auto-starts the Next.js dev server
cd web && npm run test:e2e
```

All four suites must be green before proceeding to Phase 2.

## Running the App

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd web
npm run dev
```

Open `http://localhost:3000` — frozen board with the sample puzzle position.

---

## Critical Files

| File | Purpose |
|---|---|
| `web/next.config.ts` | ESM transpile for Chessground |
| `web/src/app/globals.css` | 3 Chessground CSS imports + board size |
| `web/src/components/PuzzleBoard.tsx` | Frozen Chessground wrapper |
| `web/src/app/page.tsx` | Entry page with sample FEN |
| `web/tsconfig.json` | `@/shared/*` path alias |
| `shared/types.ts` | Puzzle + PuzzlePosition types |
| `shared/fen.ts` | parseFen() helper |
| `backend/main.py` | FastAPI with /health + /puzzle/sample |
| `backend/requirements.txt` | Python deps |

---

## Known Pitfalls

| Pitfall | Fix |
|---|---|
| ES module error from Chessground | `transpilePackages` in `next.config.ts` |
| Board renders but pieces invisible | All 3 CSS files must be imported in order |
| Board is 0×0 pixels | `.board-container` must have explicit `width`/`height` |
| Board re-creates on every render | `useEffect` deps `[fen, orientation]` + `destroy()` before re-create |

---

## Verification

1. `curl http://localhost:8000/health` returns `{"status":"ok"}`
2. `curl http://localhost:8000/puzzle/sample` returns FEN + legal moves
3. `http://localhost:3000` shows a chessboard with pieces from the sample FEN
4. Clicking/dragging on the board does nothing (viewOnly mode)
5. Board position never changes regardless of any UI interaction
