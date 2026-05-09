# Chess Puzzle Trainer

A chess puzzle visualization trainer where you map out move trees **mentally** — the board stays frozen at the puzzle position at all times, forcing you to visualize in your head.

## How it works

- **Left panel** — static chessboard, never moves, always shows the puzzle starting position
- **Right panel** — move graph: a text tree of moves you've recorded
- Click two squares to record a move (source → destination)
- The backend validates legality with python-chess
- Submit to check your tree against the solution; incorrect moves are flagged, not blocked live

## Tech Stack

| Layer | Tool | Port |
|---|---|---|
| Backend | FastAPI + python-chess | :8000 |
| Database / Auth | PocketBase | :8090 |
| Web frontend | Next.js (App Router) + Chessground | :3000 |
| Mobile frontend | Expo (React Native) + react-native-chessboard | — |
| Shared logic | Plain TypeScript (`shared/`) | — |

## Prerequisites

- **Node.js** v18+ (tested on v24)
- **Python** 3.11+

## Project Structure

```
chess-puzzle-trainer/
├── backend/          ← FastAPI + python-chess
│   ├── main.py
│   ├── requirements.txt
│   └── .venv/
├── web/              ← Next.js App Router
│   ├── src/
│   │   ├── app/
│   │   └── components/
│   ├── e2e/          ← Playwright E2E tests
│   └── vitest.config.ts
├── shared/           ← TypeScript types + helpers (no framework)
│   ├── types.ts
│   └── fen.ts
└── build_phases/     ← Implementation plans per phase
```

## Running the App

### 1. Backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd web
npm install        # first time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see a frozen chessboard loaded from a sample FEN.

## Running Tests

Each layer has its own test suite. Run them independently:

```bash
# Shared TypeScript logic (pure functions, no server)
cd shared && npm test

# Backend API
cd backend && source .venv/bin/activate && pytest -v

# Frontend unit + component tests
cd web && npm test

# E2E tests — auto-starts the Next.js dev server
cd web && npm run test:e2e

# E2E with Playwright UI (interactive trace viewer)
cd web && npm run test:e2e:ui
```

Expected output when all green:

```
shared:   8 passed   (parseFen unit tests)
backend:  8 passed   (FastAPI /health + /puzzle/sample)
web:     16 passed   (PuzzleBoard component + page wiring)
e2e:     13 passed   (Playwright / Chromium)
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check — returns `{"status": "ok"}` |
| GET | `/puzzle/sample` | Sample puzzle: FEN, turn, legal moves |

```bash
curl http://localhost:8000/health
curl http://localhost:8000/puzzle/sample
```

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Done | Static frozen board rendered from FEN |
| 2 | Planned | Move recording (click source → destination) |
| 3 | Planned | Move graph rendered as text tree |
| 4 | Planned | Keyboard navigation through the graph |
| 5 | Planned | Solution checking + flagging |
| 6 | Planned | Puzzle library from Lichess CSV |

## Backend Setup (first time)

If the `.venv` is missing or packages need reinstalling:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
