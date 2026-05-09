import type { PuzzlePosition } from './types';

export function parseFen(fen: string): PuzzlePosition {
  const parts = fen.split(' ');
  const fullMoveNumber = parseInt(parts[5] ?? '1', 10);
  return {
    fen,
    turn: parts[1] === 'b' ? 'black' : 'white',
    fullMoveNumber: isNaN(fullMoveNumber) ? 1 : fullMoveNumber,
  };
}
