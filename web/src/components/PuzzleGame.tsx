'use client';
import { useReducer, useState, useEffect, Fragment } from 'react';
import { parseFen } from '@/shared/fen';
import {
  createTree, addNode, buildLines, getCurrentFen,
  navigateTo, navigateParent, navigateFirstChild, navigateSibling,
  getDepth, getBreadcrumb, removeNode,
} from '@/shared/moveTree';
import type { MoveTree as MoveTreeState } from '@/shared/moveTree';
import type { CheckResult } from '@/shared/solutionChecker';
import { collectNodesToCheck, classifyWithoutEngine, mergeResults } from '@/shared/solutionChecker';
import { computeMove } from '@/lib/chess';
import { evalNodes, warmUpEngine } from '@/lib/chessEngine';
import PuzzleBoard from './PuzzleBoard';
import MoveTree from './MoveTree';

function getResultSummary(result: CheckResult, tree: MoveTreeState) {
  const nodes     = collectNodesToCheck(tree);
  const playerIds = new Set(nodes.filter(n => n.isPlayerMove).map(n => n.nodeId));
  const wrongCount   = [...result.entries()].filter(([, s]) => s === 'wrong').length;
  const illegalCount = [...result.entries()].filter(([, s]) => s === 'illegal').length;
  const correctCount = [...result.entries()]
    .filter(([id, s]) => s === 'correct' && playerIds.has(id)).length;
  return { hasPlayerMoves: playerIds.size > 0, wrongCount, illegalCount, correctCount };
}

function ResultBar({ checkResult, tree }: { checkResult: CheckResult; tree: MoveTreeState }) {
  const { hasPlayerMoves, wrongCount, illegalCount, correctCount } =
    getResultSummary(checkResult, tree);

  let verdict: string;
  let cls: string;

  if (!hasPlayerMoves) {
    verdict = 'No player moves to evaluate';
    cls = 'rv-empty';
  } else if (wrongCount === 0 && illegalCount === 0) {
    verdict = 'Clean line';
    cls = 'rv-clean';
  } else if (wrongCount > 0 && illegalCount === 0) {
    verdict = `Not optimal — ${wrongCount} mistake${wrongCount > 1 ? 's' : ''} found`;
    cls = 'rv-wrong';
  } else if (wrongCount === 0 && illegalCount > 0) {
    verdict = `Invalid moves recorded — ${illegalCount} illegal`;
    cls = 'rv-illegal';
  } else {
    verdict = `Not optimal — ${wrongCount} mistake${wrongCount > 1 ? 's' : ''}, ${illegalCount} invalid`;
    cls = 'rv-mixed';
  }

  return (
    <div className="result-bar">
      <div className={`result-verdict ${cls}`}>{verdict}</div>
      {hasPlayerMoves && (
        <div className="result-counts">
          {correctCount > 0 && <span className="rc-correct">✓ {correctCount} correct</span>}
          {wrongCount   > 0 && <span className="rc-wrong">✗ {wrongCount} mistake{wrongCount > 1 ? 's' : ''}</span>}
          {illegalCount > 0 && <span className="rc-illegal">⊘ {illegalCount} illegal</span>}
        </div>
      )}
    </div>
  );
}

interface Props {
  fen:           string;
  orientation?:  'white' | 'black';
  solution?:     string;
  lastMove?:     string;
  lastMoveUci?:  string;
}

type State  = { tree: MoveTreeState; undoStack: string[] };
type Action =
  | { type: 'RECORD_MOVE';         uci: string }
  | { type: 'NAVIGATE_TO';         nodeId: string }
  | { type: 'NAVIGATE_PARENT' }
  | { type: 'NAVIGATE_FIRST_CHILD' }
  | { type: 'NAVIGATE_SIBLING';    dir: 'prev' | 'next' }
  | { type: 'UNDO_LAST' }
  | { type: 'RESET';               initialFen: string };

function reducer(state: State, action: Action): State {
  if (action.type === 'RECORD_MOVE') {
    const fen                      = getCurrentFen(state.tree);
    const { san, nextFen, illegal } = computeMove(fen, action.uci);
    const { turn, fullMoveNumber } = parseFen(fen);
    const newTree = addNode(state.tree, {
      uci: action.uci,
      san,
      fen: nextFen,
      illegal,
      color: turn === state.tree.playerColor ? 'player' : 'opponent',
      moveNumber: fullMoveNumber,
      isBlackMove: turn === 'black',
    });
    return { tree: newTree, undoStack: [...state.undoStack, newTree.currentNodeId] };
  }
  if (action.type === 'UNDO_LAST') {
    if (state.undoStack.length === 0) return state;
    const nodeId  = state.undoStack[state.undoStack.length - 1];
    const newTree = removeNode(state.tree, nodeId);
    return { tree: newTree, undoStack: state.undoStack.slice(0, -1) };
  }
  if (action.type === 'RESET') {
    return { tree: createTree(action.initialFen, state.tree.playerColor), undoStack: [] };
  }
  if (action.type === 'NAVIGATE_TO')          return { ...state, tree: navigateTo(state.tree, action.nodeId) };
  if (action.type === 'NAVIGATE_PARENT')      return { ...state, tree: navigateParent(state.tree) };
  if (action.type === 'NAVIGATE_FIRST_CHILD') return { ...state, tree: navigateFirstChild(state.tree) };
  if (action.type === 'NAVIGATE_SIBLING')     return { ...state, tree: navigateSibling(state.tree, action.dir) };
  return state;
}

function totalNodes(tree: MoveTreeState): number {
  function count(node: typeof tree.root): number {
    if (node.san === '') return node.children.reduce((s, c) => s + count(c), 0);
    return 1 + node.children.reduce((s, c) => s + count(c), 0);
  }
  return count(tree.root);
}

export default function PuzzleGame({ fen, orientation: orientationProp, lastMove, lastMoveUci }: Props) {
  const playerColor = parseFen(fen).turn;
  const [state, dispatch] = useReducer(reducer, { tree: createTree(fen, playerColor), undoStack: [] });
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    orientationProp ?? (parseFen(fen).turn as 'white' | 'black')
  );
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [isChecking,  setIsChecking]  = useState(false);
  const [checkError,  setCheckError]  = useState<string | null>(null);

  const lines      = buildLines(state.tree);
  const nodeCount  = totalNodes(state.tree);
  const depth      = getDepth(state.tree);
  const breadcrumb = getBreadcrumb(state.tree);
  const { turn, fullMoveNumber } = parseFen(fen);
  const sideToMove = turn === 'white' ? 'White' : 'Black';

  const isAtRoot        = state.tree.currentNodeId === state.tree.root.id;
  const lastMoveSquares = lastMoveUci
    ? [lastMoveUci.slice(0, 2), lastMoveUci.slice(2, 4)] as [string, string]
    : undefined;
  const lastMoveLabel = lastMove
    ? (turn === 'black'
        ? `${fullMoveNumber}. ${lastMove}`
        : `${fullMoveNumber - 1}... ${lastMove}`)
    : undefined;

  useEffect(() => { warmUpEngine(); }, []);

  async function handleSubmit() {
    const nodes = collectNodesToCheck(state.tree);
    if (nodes.length === 0) return;
    setIsChecking(true);
    setCheckError(null);
    try {
      const { result: syncResult, needsEval } = classifyWithoutEngine(nodes);
      const engineResult = needsEval.length > 0 ? await evalNodes(needsEval) : new Map();
      setCheckResult(mergeResults(syncResult, engineResult));
    } catch {
      setCheckError('Engine error — try again.');
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); dispatch({ type: 'NAVIGATE_PARENT' }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); dispatch({ type: 'NAVIGATE_FIRST_CHILD' }); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); dispatch({ type: 'NAVIGATE_SIBLING', dir: 'prev' }); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); dispatch({ type: 'NAVIGATE_SIBLING', dir: 'next' }); }
      if (e.key === 'Backspace')  { e.preventDefault(); handleUndo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleMove(uci: string) {
    dispatch({ type: 'RECORD_MOVE', uci });
    setCheckResult(null);
    setCheckError(null);
  }

  function handleUndo() {
    dispatch({ type: 'UNDO_LAST' });
    setCheckResult(null);
    setCheckError(null);
  }

  function handleReset() {
    dispatch({ type: 'RESET', initialFen: fen });
    setCheckResult(null);
    setCheckError(null);
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
          <PuzzleBoard fen={fen} orientation={boardOrientation} onMove={handleMove} lastMove={lastMoveSquares} />
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
              <span>depth <span className="num">{depth}</span></span>
            </div>
          </div>
          <div className="breadcrumb">
            {breadcrumb.map((san, i) => (
              <Fragment key={i}>
                {i === 0 && <span className="sep">▸</span>}
                {i > 0  && <span className="sep"> → </span>}
                <span className="crumb">{san}</span>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="tree-wrap">
          <MoveTree
            lines={lines}
            onTokenClick={(id) => dispatch({ type: 'NAVIGATE_TO', nodeId: id })}
            checkResult={checkResult ?? undefined}
            rootNodeId={state.tree.root.id}
            isAtRoot={isAtRoot}
            lastMoveLabel={lastMoveLabel}
          />
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
            <button className="btn" onClick={handleUndo}>Undo <span className="kbd">⌫</span></button>
            <button className="btn" onClick={handleReset}>Reset</button>
            <button className="btn">Hint</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={isChecking}>
              {isChecking ? 'Checking…' : <>Submit solution <span className="kbd">↵</span></>}
            </button>
          </div>
          {checkResult && <ResultBar checkResult={checkResult} tree={state.tree} />}
          {checkError  && <div className="error-box">{checkError}</div>}

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
