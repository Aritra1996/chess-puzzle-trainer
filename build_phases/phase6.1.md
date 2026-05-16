# Phase 6.1 — Core Checker Logic

## Goal

Pure TypeScript — collect nodes from the tree, classify illegal/opponent nodes
synchronously, route player nodes to the engine. No chess.js, no FEN parsing needed here.

## Context

Part of Phase 6 (Solution Checking). This sub-phase creates the shared logic used by all
subsequent sub-phases. No browser or WASM code — plain TypeScript that works in both the
web and any future mobile client.

**Checking model:**
- **Illegal nodes** → `'illegal'`, children skipped
- **Opponent nodes** → `'correct'` (valid lines the user is exploring)
- **Player nodes** → deferred to Stockfish (Phase 6.2); returned in `needsEval`

## Files

| File | Action |
|------|--------|
| `shared/solutionChecker.ts` | **CREATE** |
| `shared/__tests__/solutionChecker.test.ts` | **CREATE** — 11 tests |

`shared/moveTree.ts` is **not modified**.

---

## 🔴 RED — Write tests first

Create `shared/__tests__/solutionChecker.test.ts` from `phase6.1_tests.md` before touching
any source file. All 11 tests fail immediately on import because `solutionChecker.ts` doesn't
exist yet.

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test -- --reporter=verbose
# Expect: 1 failed suite (ERR_MODULE_NOT_FOUND), 55/55 existing green
```

---

## 🟢 GREEN — Create the source file

Create `shared/solutionChecker.ts`:

```typescript
import type { MoveNode, MoveTree } from './moveTree';

export type CheckStatus = 'correct' | 'wrong' | 'illegal';
export type CheckResult = Map<string, CheckStatus>;

export interface NodeToCheck {
  nodeId:       string;
  parentFen:    string;    // parent.fen — position before this move; Stockfish baseline eval
  fenAfterMove: string;    // node.fen  — position after this move;  Stockfish move eval
  illegal:      boolean;
  isPlayerMove: boolean;
}

export function parseSolutionMoves(moves: string): string[] {
  return moves.trim() === '' ? [] : moves.trim().split(/\s+/);
}

// Walk the tree and collect all non-root nodes.
// Children of illegal nodes are skipped — their FENs are undefined.
export function collectNodesToCheck(tree: MoveTree): NodeToCheck[] {
  const result: NodeToCheck[] = [];

  function traverse(node: MoveNode, parent: MoveNode, skip: boolean): void {
    if (node.san === '') {
      node.children.forEach(c => traverse(c, node, false));
      return;
    }
    if (!skip) {
      result.push({
        nodeId:       node.id,
        parentFen:    parent.fen,
        fenAfterMove: node.fen,
        illegal:      node.illegal,
        isPlayerMove: node.color === 'player',
      });
    }
    node.children.forEach(c => traverse(c, node, skip || node.illegal));
  }

  traverse(tree.root, tree.root, false);
  return result;
}

// Synchronous pass: classify illegal and opponent nodes instantly.
// Returns player nodes in needsEval for Stockfish.
export function classifyWithoutEngine(nodes: NodeToCheck[]): {
  result:    CheckResult;
  needsEval: NodeToCheck[];
} {
  const result:    CheckResult   = new Map();
  const needsEval: NodeToCheck[] = [];

  for (const node of nodes) {
    if (node.illegal) {
      result.set(node.nodeId, 'illegal');
    } else if (!node.isPlayerMove) {
      result.set(node.nodeId, 'correct');  // opponent move — valid line to explore
    } else {
      needsEval.push(node);                // player move — needs relative eval
    }
  }

  return { result, needsEval };
}

export function mergeResults(syncResult: CheckResult, engineResult: CheckResult): CheckResult {
  return new Map([...syncResult, ...engineResult]);
}
```

**Key design decisions:**
- `node.illegal` checked first — illegal moves marked immediately, children skipped.
- Opponent moves always `'correct'` — valid chess lines the user is exploring.
- All player moves go to Stockfish — no special-casing for forced lines.
- `parseSolutionMoves` retained for `PuzzleGame` prop parsing (used in Phase 7).
- `moveTree.ts` is **not modified**.

Verify all 11 new tests pass:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test -- --reporter=verbose
# Expect: 66/66 green (55 existing + 11 new)
```

---

## 🟡 YELLOW — Refactor

No structural refactor needed. The implementation is a straightforward tree traversal.

Confirm no regressions:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test
# Expect: 66/66 green
```

Existing tests that must stay green:
- `createTree` / `addNode` / `getCurrentFen`
- `navigateTo` / `navigateParent` / `navigateFirstChild` / `navigateSibling`
- `getDepth` / `getBreadcrumb`
- `removeNode` (all 6)
- `buildLines` (all)

---

## Test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `shared/__tests__/solutionChecker.test.ts` | 0 | +11 | 11 |
| `shared/__tests__/moveTree.test.ts` | 55 | — | 55 |
| **shared total** | **55** | **+11** | **66** |
