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
  uci: string;
  san: string;
  illegal: boolean;
  fen: string;
  moveNumber: number;
  isBlackMove: boolean;
  color: PlayerColor;
  parentId: string | null;
  children: MoveNode[];
}

export interface MoveTree {
  root: MoveNode;
  currentNodeId: string;
  playerColor: 'white' | 'black';
}

let _nextId = 1;
function newId(): string {
  return `node-${_nextId++}`;
}

export function createTree(startFen: string, playerColor: 'white' | 'black'): MoveTree {
  const root: MoveNode = {
    id: newId(),
    uci: '',
    san: '',
    illegal: false,
    fen: startFen,
    moveNumber: 0,
    isBlackMove: false,
    color: 'player',
    parentId: null,
    children: [],
  };
  return { root, currentNodeId: root.id, playerColor };
}

export function addNode(
  tree: MoveTree,
  move: {
    uci: string;
    san: string;
    fen: string;
    illegal: boolean;
    color: PlayerColor;
    moveNumber: number;
    isBlackMove: boolean;
  }
): MoveTree {
  const node: MoveNode = {
    id: newId(),
    ...move,
    parentId: tree.currentNodeId,
    children: [],
  };

  function insertInto(n: MoveNode): MoveNode {
    if (n.id === tree.currentNodeId) {
      return { ...n, children: [...n.children, node] };
    }
    return { ...n, children: n.children.map(insertInto) };
  }

  const newRoot = insertInto(tree.root);
  return { ...tree, root: newRoot, currentNodeId: node.id };
}

export function getCurrentFen(tree: MoveTree): string {
  function find(n: MoveNode): MoveNode | null {
    if (n.id === tree.currentNodeId) return n;
    for (const c of n.children) {
      const found = find(c);
      if (found) return found;
    }
    return null;
  }
  return find(tree.root)?.fen ?? tree.root.fen;
}

function nodeById(root: MoveNode, id: string): MoveNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const found = nodeById(c, id);
    if (found) return found;
  }
  return null;
}

function ancestorIds(root: MoveNode, targetId: string): Set<string> {
  function collect(n: MoveNode, path: string[]): string[] | null {
    const next = [...path, n.id];
    if (n.id === targetId) return next;
    for (const c of n.children) {
      const found = collect(c, next);
      if (found) return found;
    }
    return null;
  }
  return new Set(collect(root, []) ?? []);
}

export function buildLines(tree: MoveTree): Line[] {
  if (tree.root.children.length === 0) return [];

  const activePath = ancestorIds(tree.root, tree.currentNodeId);
  const lines: Line[] = [];

  function renderNode(node: MoveNode, depthD: number, lineSegs: Segment[], isFirst: boolean): void {
    // Emit the move token for this node (the root/sentinel has no san)
    if (node.san === '') return;

    const isActive = node.id === tree.currentNodeId;
    const isOnActivePath = activePath.has(node.id);

    // Emit move number if needed
    const segs: Segment[] = [...lineSegs];

    if (isFirst || lineSegs.length === 0) {
      // Number already prepended by caller when creating branch lines
    }

    const tok: Segment = node.color === 'player'
      ? { kind: 'player',   text: node.san, ...(isActive ? { active: true } : {}) }
      : { kind: 'opponent', text: node.san, ...(isActive ? { active: true } : {}) };
    segs.push(tok);

    const newDepthD = depthD + node.san.length;

    if (node.children.length === 0) {
      lines.push({ segments: segs, isActivePath: isOnActivePath });
    } else if (node.children.length === 1) {
      // Inline: append space (+ optional number) then recurse
      const child = node.children[0];
      const nextSegs: Segment[] = [...segs, { kind: 'space', text: ' ' }];
      if (child.isBlackMove && !node.isBlackMove) {
        // white move followed by black — no extra number needed (same pair)
      }
      if (!child.isBlackMove) {
        // new move number
        nextSegs.push({ kind: 'number', text: `${child.moveNumber}. ` });
      } else if (node.san === '' || node.children[0].isBlackMove !== node.isBlackMove) {
        // same pair, just space
      }
      renderNode(child, newDepthD + 1, nextSegs, false);
    } else {
      // Branch: flush current line, then one sub-line per child
      lines.push({ segments: segs, isActivePath: isOnActivePath });
      node.children.forEach((child, i) => {
        const isLast = i === node.children.length - 1;
        const connector = ' '.repeat(depthD) + (isLast ? '└─ ' : '├─ ');
        const childIsOnActivePath = activePath.has(child.id);
        const numSeg: Segment = { kind: 'number', text: child.isBlackMove ? `${child.moveNumber}... ` : `${child.moveNumber}. ` };
        const branchSegs: Segment[] = [
          { kind: 'connector', text: connector },
          numSeg,
        ];
        renderNode(child, connector.length, branchSegs, true);
      });
    }
  }

  // Handle root children — the first move(s)
  const firstChildren = tree.root.children;

  if (firstChildren.length === 1) {
    const child = firstChildren[0];
    const isOnActivePath = activePath.has(child.id);
    const numText = child.isBlackMove ? `${child.moveNumber}... ` : `${child.moveNumber}. `;
    const initSegs: Segment[] = [{ kind: 'number', text: numText }];
    renderNode(child, numText.length, initSegs, true);
  } else {
    firstChildren.forEach((child, i) => {
      const isLast = i === firstChildren.length - 1;
      const connector = isLast ? '└─ ' : '├─ ';
      const numText = child.isBlackMove ? `${child.moveNumber}... ` : `${child.moveNumber}. `;
      const branchSegs: Segment[] = [
        { kind: 'connector', text: connector },
        { kind: 'number', text: numText },
      ];
      renderNode(child, connector.length, branchSegs, true);
    });
  }

  return lines;
}
