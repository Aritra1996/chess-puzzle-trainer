import PuzzleBoard from '@/components/PuzzleBoard';
import MoveTree from '@/components/MoveTree';

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8';

export default function Home() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="header-title">Chess Puzzle Trainer</h1>
        <div className="header-meta">
          <span>Puzzle #4521</span>
          <span className="header-badge rating">1850</span>
          <span className="header-badge">Fork</span>
        </div>
      </header>

      <div className="app-panels">
        <div className="panel-board">
          <PuzzleBoard fen={SAMPLE_FEN} orientation="white" />
          <p className="board-fen">{SAMPLE_FEN}</p>
        </div>

        <div className="panel-analysis">
          <div className="analysis-header">
            <div className="analysis-header-left">
              <span className="analysis-label">Analysis</span>
              <span className="sample-badge">sample</span>
            </div>
            <div className="keyboard-hints">
              <kbd className="key-hint">&#8592;</kbd>
              <kbd className="key-hint">&#8594;</kbd>
              <kbd className="key-hint">&#8593;</kbd>
              <kbd className="key-hint">&#8595;</kbd>
            </div>
          </div>

          <div className="analysis-tree">
            <MoveTree />
          </div>

          <div className="analysis-footer">
            <div className="status-bar">&#8212; no moves recorded</div>
            <button className="submit-btn">Submit Solution</button>
          </div>
        </div>
      </div>
    </div>
  );
}
