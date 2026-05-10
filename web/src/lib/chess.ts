import { Chess } from 'chess.js';

export function computeMove(
  fen: string,
  uci: string
): { san: string; nextFen: string; illegal: boolean } {
  const chess = new Chess(fen);
  const from = uci.slice(0, 2);
  const to   = uci.slice(2, 4);
  const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;
  try {
    const move = chess.move({ from, to, promotion });
    return { san: move.san, nextFen: chess.fen(), illegal: false };
  } catch {
    return { san: `${from}-${to}`, nextFen: fen, illegal: true };
  }
}
