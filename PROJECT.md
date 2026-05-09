# Chess Puzzle Trainer — Project Plan

## Goal

A chess puzzle visualization trainer where users map out move trees mentally,
without pieces moving on the board. The board stays frozen at the puzzle position
at all times — forcing the user to visualize in their head.

## Core Concept

- Left panel: static chessboard (never moves, always shows puzzle start position)
- Right panel: move graph (text tree of moves the user has recorded)
- User clicks two squares to record a move (source → destination)
- Chess engine validates if the move is legal
- Engine checks if the user's graph matches the correct solution tree
- Engine flags missing lines or incorrect moves

## Interaction Model

### Recording Moves
- Click square A → click square B = record a move (or capture)
- User records both their own moves and opponent responses
- Moves build a tree, not just a linear sequence
- A **Submit** button triggers solution checking — incorrect moves are not blocked live,
  they are flagged after submission so the user can retry

### Navigating the Graph
- Keyboard ← : go back to parent node
- Keyboard → : go forward to child node
- Keyboard ↑↓ : switch between sibling branches (alternate lines)
- Click any individual move in the graph : jump to the position after that move, record from there
- Each move token is a separate clickable element even though the tree looks like plain text
- No back button in the UI — keyboard-only navigation

### Key Constraint
The chessboard pieces NEVER move. Not during recording, not during navigation.
The board always shows the original puzzle position. This is intentional —
it trains the user's visualization ability.

## Graph Visualization (Finalized)

The move graph is rendered as a **text tree in monospace font** — no circles or SVG nodes.

### Move Notation
- Standard chess book notation: `N. white_move black_move` (one move number per pair)
- Black's move number is never repeated — `17. Rxf3 Re1#` not `17. Rxf3 17... Re1#`
- Uses **actual move numbers from the FEN** (not reset to 1 per puzzle)
- When the puzzle starts with black to move, the root shows `15... Qh5+` style

### Tree Layout
- ASCII connectors: `├─` for middle branches, `└─` for last branch, `│` for continuation
- Branches hang **under the last move** of the parent line, not under the move number
- Each deeper level's connector is indented to sit under the move text above it

### Example — white to move first:
```
1. e4 e5
     ├─ 2. Nf3 Nc6
     │         ├─ 3. Bb5 a6
     │         └─ 3. Bc4 Bc5
     └─ 2. Nc3 Nf6
```

### Example — black to move first (common in Lichess puzzles):
```
15... Qh5+
      ├─ 16. g3 Qxf3
      │         ├─ 17. Rxf3 Re1#
      │         └─ 17. Kh2 Qxf2#
      └─ 16. Kh1 Qxf3 17. Ke2 Re1#
```

### Color coding
- Player's moves: blue/white highlight
- Opponent's moves: dark/red highlight
- Currently active line: visually highlighted

## Puzzle Format

- Source: **Lichess puzzle database** (free CSV download, millions of puzzles)
- Format per puzzle: `FEN` (starting position) + `Moves` in UCI notation (e.g. `e2e4 e7e5`)
- The app reads FEN for the board and UCI moves for the solution tree
- No PGN needed — FEN + UCI covers everything required

## Tech Stack

| Layer | Tool |
|---|---|
| Backend (chess logic) | Python 3.11+ + FastAPI |
| Chess validation | python-chess |
| Auth + Database | PocketBase (SQLite + built-in auth + REST API) |
| Web frontend | Next.js (App Router) |
| Web board | Chessground |
| Mobile frontend | Expo (React Native) |
| Mobile board | react-native-chessboard |
| State management | Zustand (shared across web + mobile) |
| Shared logic | Plain TypeScript (`shared/`) — hooks, types, API calls, tree logic |
| Graph visualization | Text tree with styled `<span>` elements (web) / ScrollView + Text (mobile) |
| Puzzle source | Lichess puzzle CSV → imported into PocketBase `puzzles` collection |

### Why this stack
- **FastAPI + python-chess**: python-chess handles FEN + UCI natively (Lichess CSV format), full legal move generation. No JS library matches it.
- **PocketBase**: single Go binary — auth + SQLite DB + REST API + admin UI in one command. Free forever, zero vendor lock-in. SQLite is fine for thousands of users; migrate to Supabase if scale demands it.
- **Next.js + Expo**: same React mental model on both platforms — share custom hooks, Zustand stores, TypeScript types, and API service layer between web and mobile
- **Chessground**: Lichess's own board library — no jQuery, actively maintained, easy to freeze

### PocketBase schema
```
puzzles   — puzzle_id, fen, moves (UCI), rating, themes
attempts  — user, puzzle, move_tree (JSON), result, created
```

### Project structure
```
chess-puzzle-trainer/
├── backend/          ← FastAPI + python-chess  (:8000)
├── pocketbase/       ← PocketBase binary + data (:8090)
├── web/              ← Next.js (App Router)     (:3000)
├── mobile/           ← Expo (React Native)
└── shared/           ← Plain TypeScript
    ├── api.ts         ← fetch wrappers (FastAPI + PocketBase)
    ├── moveTree.ts    ← tree build/traverse/compare
    └── notation.ts    ← FEN parsing, move notation
```

## Build Phases

### Phase 1 — Static Board
- Render a chessboard in the browser
- Place pieces from a FEN string (puzzle position)
- No interaction yet

### Phase 2 — UI Design Polish (frontend-design skill)
- Run the `frontend-design` skill to redesign the full app layout
- Two-panel layout: static board left, move graph right — visually distinct and clean
- Typography: monospace move tree, clear move-number/piece-name contrast
- Color system: player moves (blue), opponent moves (red/dark), active line highlight
- Board panel: subtle border, no clutter, sizing that keeps board square at all breakpoints
- Graph panel: scrollable, readable at depth, ASCII connectors rendered crisply
- Submit button and status indicators styled for the chess aesthetic
- Responsive: desktop first, mobile-aware

### Phase 3 — Move Recording
- Click source square → highlight it; click destination square → record move instantly
- All recording is **local only** — no backend calls during recording
- Moves are stored regardless of legality; illegal moves flagged only on Submit (Phase 6)
- `chess.js` (frontend) generates algebraic notation ("Nf3", "O-O") from click pairs
- Transparent overlay div captures clicks while Chessground stays `viewOnly: true`
- New `PuzzleGame.tsx` client component owns state (`useReducer`) and wires board → tree
- `shared/moveTree.ts`: `MoveNode` / `MoveTree` types + `addNode` / `buildLines` / `getCurrentFen`
- See `build_phases/phase3.md` for full design decisions and build order

### Phase 4 — Graph Visualization
- Render move tree as text in the right panel
- Highlight currently active line
- Show branches with ASCII connectors, aligned under move text

### Phase 5 — Graph Navigation
- Keyboard arrow key navigation (←→ for depth, ↑↓ for siblings)
- Click any individual move in the graph to jump to that position
- All navigation only affects graph highlight — board never changes

### Phase 6 — Solution Checking
- Load a puzzle with a known solution tree
- Submit button triggers comparison of user's graph against solution
- Flag: wrong moves (red), missing lines, correct lines (green)
- User can retry incorrect moves after seeing the flags

### Phase 7 — Puzzle Library
- Load puzzles from Lichess puzzle CSV
- Puzzle metadata: rating, theme, solution moves

## Learning Goals (for the builder)
- Object-oriented design (board, move, graph, puzzle classes)
- Frontend-backend communication (REST API)
- Tree data structures (move graph)
- Chess rules and FEN notation
- Keyboard and mouse event handling
- Algorithm design (tree comparison for solution checking)
