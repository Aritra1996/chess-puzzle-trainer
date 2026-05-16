import type { MoveNode, MoveTree } from './moveTree';

export type CheckStatus = 'correct' | 'wrong' | 'illegal';
export type CheckResult = Map<string, CheckStatus>;

export interface NodeToCheck {
  nodeId:       string;
  parentFen:    string;
  fenAfterMove: string;
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
      result.set(node.nodeId, 'correct');
    } else {
      needsEval.push(node);
    }
  }

  return { result, needsEval };
}

export function mergeResults(syncResult: CheckResult, engineResult: CheckResult): CheckResult {
  return new Map([...syncResult, ...engineResult]);
}
