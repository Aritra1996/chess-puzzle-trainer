# Phase 6 — Solution Checking (Stockfish.js, Client-Side)

## Context

Phase 6 adds the core training loop: the user submits their move tree and each player node is
evaluated by Stockfish.js (WebAssembly, browser-only). No backend API calls.

**Single-mode checking — relative eval drop:**
- **Illegal nodes** → `'illegal'`, children skipped (sync, no engine)
- **Opponent moves** → `'correct'` always (valid lines the user is exploring, sync)
- **Player moves** → two Stockfish evals: position *before* the move and *after*. If the
  advantage dropped by more than `DROP_THRESHOLD_CP` (100cp = ~1 pawn), mark `'wrong'`;
  otherwise `'correct'`

**Why relative drop, not absolute threshold:**
A fixed threshold (e.g. "must be +1.5") breaks for small-advantage positions and misses blunders
in large-advantage positions. Relative drop correctly catches both:
- +5.0 → +0.6 : drop = 440cp > 100 → **wrong** ✓
- +1.6 → +1.2 : drop = 40cp  < 100 → **correct** ✓
- +0.3 → +1.8 : drop = -150cp (gained!) → **correct** ✓

**No two-mode split.** The former forced-line strict-matching is removed — Stockfish handles
those cases naturally (a wrong move in a forced position throws away the win → big eval drop).

**Timing:** batched at Submit — no live eval during recording.
**Hint button:** remains a no-op in Phase 6.

---

## Libraries

| Library | Role | Already in project? |
|---------|------|---------------------|
| `stockfish` (npm) | WASM Stockfish 16, Web Worker | ❌ Add (`npm install stockfish` in `web/`) |

`chess.js` is **not needed** — `parent.fen` and `node.fen` are already in the tree.

---

## Sub-phases

| Sub-phase | Scope |
|-----------|-------|
| 6.1 | Core checker logic in `shared/solutionChecker.ts` + unit tests |
| 6.2 | Stockfish.js engine wrapper `web/src/lib/chessEngine.ts` |
| 6.3 | Wire Submit to UI — flag correct/wrong/illegal tokens, loading state |
| 6.4 | Browser smoke test |

---

## Phase 6.1 — Core Checker Logic

**Goal:** Pure TypeScript — collect nodes from the tree, classify illegal/opponent nodes
synchronously, route player nodes to the engine. No chess.js, no FEN parsing needed here.

### Files

| File | Action |
|------|--------|
| `shared/solutionChecker.ts` | **CREATE** |
| `shared/__tests__/solutionChecker.test.ts` | **CREATE** — 11 tests |

### `shared/solutionChecker.ts`

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
- Opponent moves always `'correct'` — they are valid chess lines the user is exploring.
- All player moves go to Stockfish — no special-casing for forced lines.
- `parseSolutionMoves` retained for `PuzzleGame` prop parsing (used in Phase 7).
- `moveTree.ts` is **not modified**.

### `shared/__tests__/solutionChecker.test.ts` (11 tests)

Uses the same FEN constants and `addNode` helper pattern as `moveTree.test.ts`.

```
describe('parseSolutionMoves')
  ✓ splits space-separated UCI string into array
  ✓ returns [] for empty string

describe('collectNodesToCheck')
  ✓ returns [] for empty tree
  ✓ single node — fields: parentFen = parent.fen, fenAfterMove = node.fen, isPlayerMove
  ✓ skips children of illegal nodes
  ✓ does not skip children of wrong-but-legal nodes
  ✓ collects both branches of a branching tree

describe('classifyWithoutEngine')
  ✓ illegal node → 'illegal', not in needsEval
  ✓ opponent node → 'correct', not in needsEval
  ✓ player node → in needsEval, not in result map
  ✓ mixed tree — illegal, opponent, player all classified correctly
```

**Why RED:** `shared/solutionChecker.ts` doesn't exist — all 11 tests throw on import.

**GREEN:**
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/shared && npm test -- --reporter=verbose
# Expect: 66/66 green (55 existing + 11 new)
```

---

## Phase 6.2 — Stockfish.js Engine Wrapper

**Goal:** Pre-warm Stockfish on page mount (fire-and-forget) so the ~5MB WASM download
happens in the background while the user is recording moves. By the time Submit is clicked,
the engine is ready. `getEngine()` guards against double-init, so calling it at mount and
again at Submit is safe.

### File: `web/src/lib/chessEngine.ts` (new)

```typescript
import type { NodeToCheck, CheckResult } from '@/shared/solutionChecker';

const DROP_THRESHOLD_CP = 100;   // 1 pawn drop → wrong
const EVAL_DEPTH        = 15;

let worker: Worker | null = null;

async function getEngine(): Promise<Worker> {
  if (worker) return worker;
  worker = new Worker(new URL('stockfish/bin/stockfish-18-lite-single.js', import.meta.url));
  await new Promise<void>(resolve => {
    worker!.onmessage = (e: MessageEvent) => {
      if (e.data === 'uciok') resolve();
    };
    worker!.postMessage('uci');
  });
  return worker;
}

// Evaluate a FEN from the side-to-move's perspective.
// 'mate+' = side to move has forced mate (best possible).
// 'mate-' = side to move is getting mated (worst possible).
// number  = centipawn score; positive = side to move is winning.
type RawScore = number | 'mate+' | 'mate-';

async function evalFen(engine: Worker, fen: string): Promise<RawScore> {
  return new Promise(resolve => {
    let last: RawScore = 0;

    function handler(e: MessageEvent) {
      const msg: string = e.data;
      if (msg.includes('score mate')) {
        const n = parseInt(msg.match(/score mate (-?\d+)/)?.[1] ?? '0');
        last = n > 0 ? 'mate+' : 'mate-';
      } else if (msg.includes('score cp')) {
        last = parseInt(msg.match(/score cp (-?\d+)/)?.[1] ?? '0');
      }
      if (msg.startsWith('bestmove')) {
        engine.removeEventListener('message', handler);
        resolve(last);
      }
    }

    engine.addEventListener('message', handler);
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go depth ${EVAL_DEPTH}`);
  });
}

function toNumber(s: RawScore): number {
  if (s === 'mate+') return  9999;
  if (s === 'mate-') return -9999;
  return s;
}

// Call on page mount to pre-warm the engine in the background.
// getEngine() guards against double-init — safe to call multiple times.
export function warmUpEngine(): void {
  getEngine().catch(() => {});
}

export async function evalNodes(nodes: NodeToCheck[]): Promise<CheckResult> {
  const engine = await getEngine();
  const result: CheckResult = new Map();

  for (const node of nodes) {
    // parentFen:    user is to move → positive score = user is winning (baseline)
    // fenAfterMove: opponent is to move → positive score = opponent winning
    //               negate to convert to user's perspective
    const parentScore = toNumber(await evalFen(engine, node.parentFen));
    const moveScore   = -toNumber(await evalFen(engine, node.fenAfterMove));

    // drop > 0  = user lost advantage
    // drop < 0  = user gained advantage
    const drop = parentScore - moveScore;

    result.set(node.nodeId, drop > DROP_THRESHOLD_CP ? 'wrong' : 'correct');
  }

  return result;
}
```

**Eval polarity table:**

| parentFen score | fenAfterMove score | moveScore (negated) | drop | result |
|---|---|---|---|---|
| +500cp (user winning by 5) | +60cp (opp up 0.6 from their view → user's view: -60) | -60cp → moveScore = -60 | 500-(-60) = **560cp** | **wrong** |
| +160cp | +120cp (opp's view) | moveScore = -120 | 160-(-120) = 280 | **wrong** |
| +160cp | -200cp (opp's view → user +200) | moveScore = 200 | 160-200 = -40 | **correct** |
| -9999 (mate-) → baseline losing | anything | any | N/A | **wrong** (or correct if gains mate) |

Wait — polarity re-check for the +160 → +1.2 case:
- `parentFen`: user to move, eval = +160cp ✓
- `fenAfterMove`: opponent to move, eval from *opponent's* view:
  - If position is +1.2 for user = -1.2 for opponent = **-120cp** from opponent's view
  - `toNumber(evalFen(fenAfterMove))` = -120
  - `moveScore = -(-120) = +120` ✓
- `drop = 160 - 120 = 40cp < 100` → **correct** ✓

And +5 → +0.6 case:
- `parentFen` eval = +500cp
- `fenAfterMove`: position is +0.6 for user = -0.6 for opponent = **-60cp**
- `moveScore = -(-60) = +60`
- `drop = 500 - 60 = 440cp > 100` → **wrong** ✓

**No unit tests** — requires real WASM. Covered by Phase 6.4 browser smoke test.

---

## Phase 6.3 — Wire Submit to UI

### Files

| File | Action |
|------|--------|
| `web/src/components/MoveTree.tsx` | **MODIFY** — add `checkResult` prop |
| `web/src/components/PuzzleGame.tsx` | **MODIFY** — solution prop, async submit, loading state |
| `web/src/app/globals.css` | **MODIFY** — `.correct`, `.wrong`, `.illegal` styles |
| `web/src/components/__tests__/PuzzleGame.test.tsx` | **MODIFY** — 8 new tests |

### `web/src/components/MoveTree.tsx`

```typescript
import type { CheckResult } from '@/shared/solutionChecker';

interface Props {
  lines:         Line[];
  onTokenClick?: (nodeId: string) => void;
  checkResult?:  CheckResult;
}
// status = seg.nodeId ? (checkResult?.get(seg.nodeId) ?? '') : ''
// Token class: ['move-token', seg.kind, isActive ? 'active' : '', status].filter(Boolean).join(' ')
```

### `web/src/components/PuzzleGame.tsx`

```typescript
interface Props {
  fen:          string;
  orientation?: 'white' | 'black';
  solution?:    string;   // kept for future Phase 7; not used in checking logic
}

const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
const [isChecking,  setIsChecking]  = useState(false);
const [checkError,  setCheckError]  = useState<string | null>(null);

// Pre-warm Stockfish on mount — starts the ~5MB WASM download in the background
// so Submit is snappy rather than waiting for a cold download.
useEffect(() => { warmUpEngine(); }, []);

async function handleSubmit() {
  setIsChecking(true); setCheckError(null);
  try {
    const nodes = collectNodesToCheck(state.tree);
    const { result: syncResult, needsEval } = classifyWithoutEngine(nodes);
    const engineResult = needsEval.length > 0 ? await evalNodes(needsEval) : new Map();
    setCheckResult(mergeResults(syncResult, engineResult));
  } catch {
    setCheckError('Engine error — try again.');
  } finally {
    setIsChecking(false);
  }
}
// Clear on record / undo / reset: setCheckResult(null); setCheckError(null);
```

Submit button:
```tsx
<button className="btn-primary" onClick={handleSubmit} disabled={isChecking}>
  {isChecking ? 'Checking…' : <>Submit solution <span className="kbd">↵</span></>}
</button>
{checkError && <div className="error-box">{checkError}</div>}
```

MoveTree:
```tsx
<MoveTree lines={lines} onTokenClick={...} checkResult={checkResult ?? undefined} />
```

### `web/src/app/globals.css`

```css
.move-token.correct { color: var(--green); background: rgba(90,122,62,.12); outline: 1px solid rgba(90,122,62,.30); outline-offset: 1px; }
.move-token.wrong   { color: #b23a2a; background: rgba(178,58,42,.10); text-decoration-line: line-through; text-decoration-color: rgba(178,58,42,.45); }
.move-token.illegal { color: #9a5700; background: rgba(154,87,0,.10); outline: 1px dashed rgba(154,87,0,.45); outline-offset: 1px; }
.error-box          { padding: 6px 10px; margin: 6px 0 0; background: rgba(168,51,31,.08); border: 1px solid var(--red-edge); border-radius: 4px; font-size: 13px; color: var(--red); }
```

### `web/src/components/__tests__/PuzzleGame.test.tsx` (8 new tests)

```typescript
vi.mock('@/lib/chessEngine', () => ({ evalNodes: vi.fn().mockResolvedValue(new Map()) }));
// Update MoveTree mock to also capture checkResult
let capturedCheckResult: Map<string, string> | null | undefined;
```

```
describe('PuzzleGame — Solution Checking')
  ✓ Submit Solution button renders
  ✓ Submit with empty tree is a no-op (evalNodes not called)
  ✓ Submit calls classifyWithoutEngine + evalNodes
  ✓ checkResult is passed to MoveTree after submit
  ✓ recording a new move after submit clears checkResult
  ✓ Undo after submit clears checkResult
  ✓ Reset after submit clears checkResult
  ✓ Submit button is disabled while isChecking
```

**Why RED:** `checkResult` not wired → tests 3–4 fail. Min RED: 4.

**GREEN:**
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 83/83 green (75 existing + 8 new)
```

---

## Phase 6.4 — Browser Smoke Test

### `web/src/app/page.tsx`

```tsx
const SAMPLE_SOLUTION = 'g4h3 g1h1 h3f1';  // confirm legal from SAMPLE_FEN before committing
<PuzzleGame fen={SAMPLE_FEN} solution={SAMPLE_SOLUTION} />
```

**Manual checklist:**
1. Record correct moves → Submit → "Checking…" → tokens go green
2. Record a move that throws away advantage → Submit → token goes red (strikethrough)
3. Record illegal move → Submit → token goes orange (dashed), children not evaluated
4. Record after submit → check state clears instantly
5. Undo after submit → check state clears
6. DevTools Network tab: **zero API calls** — all client-side

---

## TDD Summary

| Phase | Tests | Command |
|-------|-------|---------|
| 6.1 | 11 shared TS unit tests | `cd shared && npm test` → 66/66 |
| 6.2 | No unit tests (WASM) | browser smoke test only |
| 6.3 | 8 web component tests | `cd web && npm test` → 83/83 |
| 6.4 | browser manual | — |

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `shared/__tests__/solutionChecker.test.ts` | 0 | +11 | 11 |
| `shared/__tests__/moveTree.test.ts` | 55 | — | 55 |
| **shared total** | **55** | **+11** | **66** |
| `web/.../PuzzleGame.test.tsx` | 75 | +8 | 83 |
| All other web tests | unchanged | — | — |
| **web total** | **75** | **+8** | **83** |

---

## Constants (tunable in `chessEngine.ts`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `DROP_THRESHOLD_CP` | 100 | Eval drop > 1 pawn → wrong |
| `EVAL_DEPTH` | 15 | Stockfish search depth per position |

Each player node requires **2 Stockfish evals** (before + after). A tree with 4 player nodes
= 8 evals at depth 15 ≈ 2–4 seconds total. Acceptable for a Submit action.
