# Phase 2.1 — UI Redesign: Paper/Ink Hi-fi

## Context

Phase 2 shipped a dark "Tournament Analysis Room" aesthetic (bg-void `#08080b`, Cormorant Garamond + Fira Code). The hi-fi mockup in `designs/Hifi - Standard Split.html` defines a completely different direction: warm cream paper (`#faf7f0`), Lichess-brown board, Fraunces serif + JetBrains Mono + Inter, and a richer analysis panel (breadcrumb, recording status, Undo/Reset/Hint buttons, legend).

This plan migrates the Next.js app to exactly match that mockup. No new functionality — pure structure + style.

---

## Design tokens (new → old mapping)

| Token | New value | Old value |
|---|---|---|
| body bg | `#faf7f0` (--paper) | `#08080b` (dark) |
| player move | `#2a4f9b` (--blue) | `#5baee0` |
| opp move | `#a8331f` (--red) | `#d95f5f` |
| cursor/active | `#f0e07a` bg, `#1f1d1a` text | rgba(255,255,255,.06) bg |
| primary font | Fraunces (--serif) | Cormorant Garamond |
| mono font | JetBrains Mono (--mono) | Fira Code |
| body font | Inter (--sans) | — |

---

## Files changed

### `web/src/app/layout.tsx`
Replaced `Cormorant_Garamond` + `Fira_Code` with `Fraunces` + `JetBrains_Mono` + `Inter`. CSS variables: `--font-fraunces`, `--font-jetbrains`, `--font-inter`.

### `web/src/app/globals.css`
Full replacement. Kept chessground + tailwind imports. New paper/ink design tokens. All layout classes from mockup. Phase 3 class names preserved unchanged.

### `web/src/app/page.tsx`
Full structural replacement. New structure: brand header (Visualis), turn plate, board-mat frame, meta strip, analysis header with breadcrumb, recording status + legend, Undo/Reset/Hint/Submit actions, keyboard hints row.

### `web/src/app/__tests__/page.test.tsx`
Updated heading assertion from `/chess puzzle trainer/i` → `/visualis/i`.

---

## Class name stability guarantee (Phase 3 safety)

These class names must NOT change — Phase 3 tests use them:

| Class | Used in Phase 3 tests | Status |
|---|---|---|
| `.move-tree` | MoveTree.test.tsx | ✓ unchanged |
| `.tree-line` | MoveTree.test.tsx | ✓ unchanged |
| `.is-active-path` | MoveTree.test.tsx | ✓ unchanged |
| `.move-token.player` | MoveTree.test.tsx | ✓ unchanged |
| `.move-token.opponent` | MoveTree.test.tsx | ✓ unchanged |
| `.move-token.active` | MoveTree.test.tsx | ✓ unchanged |
| `.seg-connector` | MoveTree.test.tsx | ✓ unchanged |
| `.board-container` | PuzzleBoard + E2E | ✓ unchanged |
| `[data-testid="click-overlay"]` | PuzzleBoard.test.tsx | ✓ CSS added |
| `Submit Solution` button text | PuzzleGame.test.tsx | ✓ in btn-primary |
| `/no moves recorded/i` text | PuzzleGame.test.tsx | ✓ in rec-text |

---

## Verification

```bash
cd web && npm test         # all 16 unit tests green
cd web && npm run test:e2e # all 13 E2E tests green
```

All 45 existing tests pass (16 unit + 13 E2E + 8 backend + 8 shared).
