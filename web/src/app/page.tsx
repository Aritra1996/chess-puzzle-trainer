import PuzzleGame from '@/components/PuzzleGame';

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8';

export default function Home() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1 className="brand-logo">Visualis</h1>
          <span className="brand-tagline">puzzle trainer</span>
        </div>

        <div className="header-puzzle">
          <span className="chip">#4521</span>
          <span className="chip rating">1850</span>
          <span className="chip theme">mate-in-3</span>
          <span className="chip theme">fork</span>
        </div>

        <nav className="header-nav">
          <a className="nav-link" href="#">Library</a>
          <a className="nav-link" href="#">History</a>
          <a className="nav-link" href="#">Stats</a>
          <div className="avatar">A</div>
        </nav>
      </header>

      <div className="panels">
        <PuzzleGame fen={SAMPLE_FEN} />
      </div>
    </div>
  );
}
