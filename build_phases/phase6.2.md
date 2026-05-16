# Phase 6.2 — Stockfish.js Engine Wrapper

## Goal

Create `web/src/lib/chessEngine.ts` — a browser-only async wrapper around Stockfish 16 WASM.
Evaluates player nodes using a relative eval drop (position before vs after the move) and
returns `correct` / `wrong` per node.

Pre-warms the engine on page mount so the ~5MB WASM download happens in the background while
the user records moves, not when they click Submit.

## Context

Part of Phase 6 (Solution Checking). Depends on Phase 6.1 types (`NodeToCheck`, `CheckResult`).
No backend calls — Stockfish runs entirely in a Web Worker in the browser.

**Relative eval drop approach:**

After the user's move it is the opponent's turn. `evalFen(fenAfterMove)` returns a score from
the *opponent's* perspective. Negating it gives the user's perspective. Compare with the
baseline (`evalFen(parentFen)`, user to move, positive = user winning):

```
drop = parentScore - moveScore          (moveScore = -evalFen(fenAfterMove))
drop > DROP_THRESHOLD_CP (100) → wrong
drop ≤ 100                            → correct
```

Examples:
- +5.0 → +0.6 : drop = 440cp → **wrong** ✓
- +1.6 → +1.2 : drop =  40cp → **correct** ✓
- +0.3 → +1.8 : drop = -150cp (gained!) → **correct** ✓

## Dependency

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web
npm install stockfish
```

`chess.js` is **not needed** — `parent.fen` and `node.fen` are already stored in the tree.

---

## File: `web/src/lib/chessEngine.ts` (new)

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

// 'mate+' = side to move has forced mate.
// 'mate-' = side to move is getting mated.
// number  = centipawn score from side-to-move's perspective.
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
    // parentFen:    user is to move → positive = user winning (baseline)
    // fenAfterMove: opponent is to move → negate to get user's perspective
    const parentScore = toNumber(await evalFen(engine, node.parentFen));
    const moveScore   = -toNumber(await evalFen(engine, node.fenAfterMove));

    const drop = parentScore - moveScore;
    result.set(node.nodeId, drop > DROP_THRESHOLD_CP ? 'wrong' : 'correct');
  }

  return result;
}
```

---

## Eval polarity table

| parentFen score | fenAfterMove (opp's view) | moveScore (negated) | drop | result |
|---|---|---|---|---|
| +500cp | +60cp | −60cp | 500−(−60) = **560** | **wrong** |
| +160cp | −120cp | +120cp | 160−120 = **40** | **correct** |
| +160cp | −200cp | +200cp | 160−200 = **−40** | **correct** |
| mate+ (user) | anything | any | N/A | **correct** |

## Constants (tunable)

| Constant | Value | Meaning |
|----------|-------|---------|
| `DROP_THRESHOLD_CP` | 100 | Eval drop > 1 pawn → wrong |
| `EVAL_DEPTH` | 15 | Stockfish search depth per position |

Each player node = 2 evals. A tree with 4 player nodes = 8 evals at depth 15 ≈ 2–4 seconds.

## Tests

No unit tests — requires real WASM. Covered by Phase 6.4 browser smoke test.
