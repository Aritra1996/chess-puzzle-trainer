'use client';
import { useEffect, useRef } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';

interface Props { fen: string; orientation?: 'white' | 'black'; }

export default function PuzzleBoard({ fen, orientation = 'white' }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const config: Config = {
      fen,
      orientation,
      viewOnly: true,
      animation: { enabled: false },
      highlight: { lastMove: false, check: false },
      drawable: { enabled: false },
    };
    cgRef.current = Chessground(boardRef.current, config);
    return () => { cgRef.current?.destroy(); };
  }, [fen, orientation]);

  return (
    <div className="board-container">
      <div ref={boardRef} className="cg-wrap" />
    </div>
  );
}
