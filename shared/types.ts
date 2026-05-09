export interface Puzzle {
  puzzleId: string;
  fen: string;
  moves: string;   // UCI: "e2e4 e7e5 ..."
  rating: number;
  themes: string;
}

export interface PuzzlePosition {
  fen: string;
  turn: 'white' | 'black';
  fullMoveNumber: number;
}
