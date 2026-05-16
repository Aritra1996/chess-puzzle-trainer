# Phase 6.4 — Browser Smoke Test

## Goal

Manually verify that the full solution-checking pipeline works end-to-end in the browser:
Stockfish loads, evals run, tokens are coloured correctly, and no backend calls are made.

## Context

Final sub-phase of Phase 6. Requires Phases 6.1, 6.2, and 6.3 to be complete and all
automated tests green.

---

## Setup: `web/src/app/page.tsx`

Add a hardcoded `solution` prop so the puzzle has known correct moves to test against.

```tsx
const SAMPLE_FEN      = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8';
const SAMPLE_SOLUTION = 'd8h4 d1d2 h4f2';  // verify these are legal from SAMPLE_FEN before committing

<PuzzleGame fen={SAMPLE_FEN} solution={SAMPLE_SOLUTION} />
```

Verify the solution moves are legal from `SAMPLE_FEN` before hardcoding. Use the chess.js
REPL or any FEN viewer.

---

## Manual Checklist

### 1 — Correct moves go green
- Record the exact solution moves from `SAMPLE_SOLUTION`
- Click **Submit solution**
- **"Checking…"** appears on the button while Stockfish evaluates
- All tokens turn green after evaluation

### 2 — Wrong move goes red
- Record a move that clearly throws away the advantage (e.g. move a rook to an irrelevant square)
- Click **Submit solution**
- That token shows red with strikethrough

### 3 — Illegal move goes orange
- Click two squares that form an illegal move (e.g. moving a king into check)
- Click **Submit solution**
- That token shows orange dashed outline
- Any children of that node are also shown but not evaluated (no colour)

### 4 — Record after submit clears check state
- Submit, see coloured tokens
- Record a new move
- All colour styling disappears immediately — tree is back to plain

### 5 — Undo after submit clears check state
- Submit, see coloured tokens
- Press **Undo** or `⌫`
- All colour styling disappears immediately

### 6 — Zero network calls
- Open DevTools → Network tab
- Filter by XHR / Fetch
- Submit the solution
- Confirm **no requests** are made — all evaluation is client-side

### 7 — Engine pre-warm
- Open DevTools → Network tab before interacting
- On page load, confirm the Stockfish WASM file (`stockfish-nnue-16.js` or `.wasm`) starts
  downloading in the background automatically, before Submit is clicked

---

## Pass criteria

All 7 checklist items pass with no console errors.
