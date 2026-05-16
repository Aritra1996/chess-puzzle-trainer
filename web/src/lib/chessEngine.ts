import type { NodeToCheck, CheckResult } from '@/shared/solutionChecker';

const DROP_THRESHOLD_CP = 100;   // 1 pawn drop → wrong
const EVAL_DEPTH        = 15;

let worker: Worker | null = null;

async function getEngine(): Promise<Worker> {
  if (worker) return worker;
  worker = new Worker('/stockfish-18-lite-single.js');
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
