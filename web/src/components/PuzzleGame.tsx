'use client';
import { useReducer, useState } from 'react';
import { parseFen } from '@/shared/fen';
import { createTree, addNode, buildLines, getCurrentFen } from '@/shared/moveTree';
import type { MoveTree as MoveTreeState } from '@/shared/moveTree';
import { computeMove } from '@/lib/chess';
import PuzzleBoard from './PuzzleBoard';
import MoveTree from './MoveTree';

interface Props {
  fen: string;
  orientation?: 'white' | 'black';
}

type State  = { tree: MoveTreeState };
type Action = { type: 'RECORD_MOVE'; uci: string };

function reducer(state: State, action: Action): State {
  if (action.type === 'RECORD_MOVE') {
    const fen                      = getCurrentFen(state.tree);
    const { san, nextFen, illegal } = computeMove(fen, action.uci);
    const { turn, fullMoveNumber } = parseFen(fen);
    return {
      tree: addNode(state.tree, {
        uci: action.uci,
        san,
        fen: nextFen,
        illegal,
        color: turn === state.tree.playerColor ? 'player' : 'opponent',
        moveNumber: fullMoveNumber,
        isBlackMove: turn === 'black',
      }),
    };
  }
  return state;
}

function totalNodes(tree: MoveTreeState): number {
  function count(node: typeof tree.root): number {
    if (node.san === '') return node.children.reduce((s, c) => s + count(c), 0);
    return 1 + node.children.reduce((s, c) => s + count(c), 0);
  }
  return count(tree.root);
}

export default function PuzzleGame({ fen, orientation: orientationProp }: Props) {
  const playerColor = parseFen(fen).turn;
  const [state, dispatch] = useReducer(reducer, { tree: createTree(fen, playerColor) });
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    orientationProp ?? (parseFen(fen).turn as 'white' | 'black')
  );

  const lines     = buildLines(state.tree);
  const nodeCount = totalNodes(state.tree);
  const { turn }  = parseFen(fen);
  const sideToMove = turn === 'white' ? 'White' : 'Black';

  function handleMove(uci: string) {
    dispatch({ type: 'RECORD_MOVE', uci });
  }

  return (
    <>
      <section className="panel-board">
        <div className="turn-plate">
          <div className="turn-pip"></div>
          <div>
            <div className="turn-text">{sideToMove} to move</div>
          </div>
          <div className="turn-sub">find the best move</div>
        </div>

        <div className="board-mat">
          <PuzzleBoard fen={fen} orientation={boardOrientation} onMove={handleMove} />
        </div>

        <div className="meta-strip">
          <span className="lbl">FEN</span>
          <span className="val">{fen}</span>
          <button className="ico" title="copy fen">⧉</button>
          <button className="ico" title="flip board" onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')}>⇅</button>
        </div>
      </section>

      <section className="panel-analysis">
        <div className="an-header">
          <div className="an-title-row">
            <h2 className="an-title">Move tree</h2>
            <div className="an-stats">
              <span><span className="num">{nodeCount}</span> nodes</span>
              <span className="sep">·</span>
              <span>depth <span className="num">0</span></span>
            </div>
          </div>
          <div className="breadcrumb">
            <span className="here">▸ start</span>
          </div>
        </div>

        <div className="tree-wrap">
          <MoveTree lines={lines} />
        </div>

        <div className="an-footer">
          <div className="rec-status">
            <div className="rec-left">
              <span className="pulse"></span>
              <span className="rec-text">
                {nodeCount === 0 ? '— no moves recorded' : `${nodeCount} move${nodeCount === 1 ? '' : 's'} recorded`}
              </span>
            </div>
            <div className="legend">
              <span className="swatch"><span className="dot you"></span>you</span>
              <span className="swatch"><span className="dot them"></span>them</span>
              <span className="swatch"><span className="dot cur"></span>cursor</span>
            </div>
          </div>

          <div className="actions">
            <button className="btn">Undo <span className="kbd">⌫</span></button>
            <button className="btn">Reset</button>
            <button className="btn">Hint</button>
            <button className="btn-primary">Submit solution <span className="kbd">↵</span></button>
          </div>

          <div className="kb-hints">
            <span className="k">←</span><span className="k">→</span>
            <span className="lbl">walk depth</span>
            <span className="k" style={{marginLeft:'14px'}}>↑</span><span className="k">↓</span>
            <span className="lbl">switch sibling</span>
            <span className="k" style={{marginLeft:'14px'}}>click</span>
            <span className="lbl">jump to move</span>
          </div>
        </div>
      </section>
    </>
  );
}
