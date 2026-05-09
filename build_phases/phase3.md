# Phase 3 — Move Recording & Live Graph Updates

## Context

Phase 3 wires the frozen board to the move-graph panel. Clicking two squares records a move into a live tree immediately — no backend calls, no blocking. The chess engine is never consulted during recording; validation happens in batch only when the user clicks Submit (Phase 6). This trains pure visualization: the board stays frozen at the puzzle start position at all times.

The original Phase 3 spec in PROJECT.md said "send move to backend, validate with python-chess per move." That was superseded: recording is entirely local so there is zero latency and illegal moves are allowed (they get an `illegal: true` flag and are flagged on submit, not blocked live).

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Click detection | Transparent overlay `<div>` on top of Chessground | `viewOnly: true` kills every Chessground event listener. Overlay leaves the config unchanged — all 11 existing PuzzleBoard tests keep passing |
| SAN notation | `chess.js` installed in `web/` only | Proper algebraic notation ("Nf3", "O-O") requires board-state tracking. `chess.js` is ~35 KB, pure JS, no DOM deps. Kept out of `shared/` so that package stays zero-dependency |
| State management | `useReducer` inside new `PuzzleGame.tsx` | Zustand is planned but not yet installed. The reducer shape maps directly to a Zustand slice when added later |
| Illegal moves | Record with `illegal: true`; display as raw UCI ("g1-f3") | Never block; flag on Submit only (Phase 6) |
| Tree vs render split | Pure data ops in `shared/moveTree.ts`; rendering in `MoveTree.tsx` | Mirrors the existing `fen.ts` / component split; shared module stays usable by mobile |

---

## New Directory Layout (additions to Phase 2 state)

```
chess-puzzle-trainer/
├── shared/
│   ├── moveTree.ts                  ← NEW: MoveNode, MoveTree types + createTree / addNode /
│   │                                         buildLines / getCurrentFen / Segment / Line
│   └── __tests__/
│       └── moveTree.test.ts         ← NEW: unit tests for all shared tree functions
│
└── web/src/
    ├── lib/
    │   └── chess.ts                 ← NEW: chess.js wrapper → computeMove(fen, uci)
    ├── components/
    │   ├── PuzzleGame.tsx           ← NEW: 'use client' orchestrator with useReducer
    │   ├── PuzzleBoard.tsx          ← MODIFIED: add onMove? prop + transparent click overlay
    │   ├── MoveTree.tsx             ← MODIFIED: accept lines: Line[] prop; remove hardcoded sample
    │   └── __tests__/
    │       ├── PuzzleBoard.test.tsx ← MODIFIED: add overlay describe block (5 new tests)
    │       ├── MoveTree.test.tsx    ← NEW
    │       └── PuzzleGame.test.tsx  ← NEW
    └── app/
        ├── page.tsx                 ← MODIFIED: replace PuzzleBoard+MoveTree with <PuzzleGame>
        ├── globals.css              ← MODIFIED: add .click-overlay CSS rule
        └── __tests__/
            └── page.test.tsx        ← MODIFIED: mock PuzzleGame instead of PuzzleBoard
```

---

## Data Types (`shared/moveTree.ts`)

```typescript
export type PlayerColor = 'player' | 'opponent';

export type Segment =
  | { kind: 'connector'; text: string }
  | { kind: 'number';    text: string }
  | { kind: 'player';    text: string; active?: boolean }
  | { kind: 'opponent';  text: string; active?: boolean }
  | { kind: 'space';     text: string };

export type Line = { segments: Segment[]; isActivePath: boolean };

export interface MoveNode {
  id: string;
  uci: string;           // always stored, e.g. "e2e4"
  san: string;           // "e4" | "Nf3" | "O-O" — or "e2-e4" if illegal
  illegal: boolean;
  fen: string;           // board state AFTER this move
  moveNumber: number;    // chess full-move number
  isBlackMove: boolean;
  color: PlayerColor;    // 'player' (blue) | 'opponent' (red)
  parentId: string | null;
  children: MoveNode[];
}

export interface MoveTree {
  root: MoveNode;              // sentinel: uci='', san='', fen=startFen, children=first moves
  currentNodeId: string;       // cursor (root.id = no moves recorded yet)
  playerColor: 'white' | 'black';
}
```

`Segment` and `Line` move here from `MoveTree.tsx` so `buildLines` can return them and the component just imports them.

---

## Key Implementations

### Click overlay (`PuzzleBoard.tsx`)

Rendered as a sibling of `.cg-wrap` inside `.board-container` (which is `position: relative`). Only present when `onMove` prop is supplied — existing tests render `<PuzzleBoard fen={...} />` without `onMove`, so they see no overlay and the Chessground config is unchanged.

```
file = Math.floor(8 × (clientX − rect.left) / rect.width)      // 0=a … 7=h
rank = 7 − Math.floor(8 × (clientY − rect.top)  / rect.height) // 0=rank1 … 7=rank8
square = String.fromCharCode(97 + file) + (rank + 1)            // "a1"–"h8"
```

For black orientation: `file = 7 − file`, `rank = 7 − rank`.

`pendingSquare` state lives inside `PuzzleBoard`:
- First click → set `pendingSquare`
- Second click (different square) → call `onMove(pending + square)`, clear
- Same square twice → clear (cancel selection)

### `buildLines` rendering algorithm

Core rule (from PROJECT.md spec): **branches hang under the start column of the last move in the parent line.**

- Track `depthD` = column index where the current node's SAN text starts
- Single child → inline: append space + optional move number + move token; advance `depthD`
- Multiple children → flush current line, then for each child `i`:
  - Connector = `' '.repeat(depthD) + (isLast ? '└─ ' : '├─ ')`
  - Continuation bar for non-last branches in descendant lines: `' '.repeat(depthD) + '│' + spaces`
  - Recurse with updated `depthD`

Move number emission rules:
- Emit when starting a new line after a branch connector
- Emit `"N. "` before an opponent move that lacks a number on the current line
- Black-to-move first: root shows `"N... "` (e.g. `"15... "`), subsequent white moves show `"N. "`

### `PuzzleGame.tsx` reducer

```typescript
type State  = { tree: MoveTree }
type Action = { type: 'RECORD_MOVE'; uci: string }

function reducer(state: State, action: Action): State {
  if (action.type === 'RECORD_MOVE') {
    const fen       = getCurrentFen(state.tree)
    const { san, nextFen, illegal } = computeMove(fen, action.uci)   // chess.ts
    const turn      = parseFen(fen).turn                              // fen.ts
    const color     = turn === state.tree.playerColor ? 'player' : 'opponent'
    return { tree: addNode(state.tree, {
      uci: action.uci, san, fen: nextFen, illegal, color,
      moveNumber:  parseFen(fen).fullMoveNumber,
      isBlackMove: turn === 'black',
    }) }
  }
  return state
}
```

`PuzzleGame` initialises the tree from `parseFen(fen).turn`, passes `onMove` to `PuzzleBoard`, and renders `<MoveTree lines={buildLines(state.tree)} />` plus the status bar and Submit button.

---

## Build Order (TDD — Red → Green → Refactor)

1. `npm install chess.js` in `web/`
2. Write `shared/__tests__/moveTree.test.ts` — all failing (defines the contract)
3. Implement `shared/moveTree.ts` — shared tests green
4. Implement `web/src/lib/chess.ts` — chess.js wrapper
5. Add overlay describe block to `PuzzleBoard.test.tsx` — failing
6. Modify `PuzzleBoard.tsx` — add overlay; all PuzzleBoard tests green (11 old + 5 new)
7. Write `web/src/components/__tests__/MoveTree.test.tsx` — failing
8. Modify `MoveTree.tsx` — accept `lines` prop, import types from shared; MoveTree tests green
9. Write `web/src/components/__tests__/PuzzleGame.test.tsx` — failing
10. Create `PuzzleGame.tsx` — PuzzleGame tests green
11. Update `page.tsx` + `page.test.tsx` — mock PuzzleGame; all 5 page tests green
12. Add `.click-overlay` CSS to `globals.css`
13. Full suite: `npm test` (web) + `npm test` (shared) + `npm run test:e2e` — zero regressions

---

## Tests to Add

**`shared/__tests__/moveTree.test.ts`**
- `addNode` on empty tree creates root child with correct san/fen/color
- `addNode` twice at same parent with different UCIs creates two children (branch)
- `addNode` with illegal UCI stores `illegal: true` and raw notation
- `buildLines` on single move returns correct segments
- `buildLines` matches the 5-line sample from PROJECT.md spec exactly
- `getCurrentFen` returns startFen when no moves, node.fen when at a node
- Color alternates correctly from starting turn

**`PuzzleBoard.test.tsx` additions**
- Overlay present when `onMove` provided; absent without it
- First click sets `data-pending` on overlay
- Two different clicks call `onMove` with correct UCI
- Same-square twice does NOT call `onMove`
- `viewOnly: true` still in Chessground config when `onMove` provided (regression guard)

**`MoveTree.test.tsx`**
- Empty `lines` array renders an empty `.move-tree` container
- Player tokens get `.move-token.player`; opponent get `.move-token.opponent`
- Active token gets `.active` class
- `is-active-path` applied to active lines only

**`PuzzleGame.test.tsx`**
- Renders PuzzleBoard and MoveTree
- Two square clicks → move appears in rendered tree
- Status bar updates after first move

---

## Verification

```bash
# Unit tests
cd web   && npm test          # target: 30+ tests, 0 failures
cd shared && npm test         # target: 15+ tests, 0 failures

# E2E (board frozen constraint must still hold)
cd web && npm run test:e2e    # all 13 existing Playwright tests still green
```

Manual smoke test:
1. Open `localhost:3000`
2. Click a square → it is highlighted
3. Click a second square → move appears in the graph panel in algebraic notation
4. Board pieces never move
5. Clicking the same square twice clears the selection without recording
