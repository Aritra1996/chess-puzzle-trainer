'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import type { Key } from '@lichess-org/chessground/dist/types';

interface Props {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (uci: string) => void;
}

function pixelToSquare(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  orientation: 'white' | 'black'
): string {
  const w = rect.width  || 480;
  const h = rect.height || 480;
  let file = Math.floor(8 * (clientX - rect.left) / w);
  let rank = 7 - Math.floor(8 * (clientY - rect.top) / h);
  if (orientation === 'black') {
    file = 7 - file;
    rank = 7 - rank;
  }
  file = Math.max(0, Math.min(7, file));
  rank = Math.max(0, Math.min(7, rank));
  return String.fromCharCode(97 + file) + (rank + 1);
}


export default function PuzzleBoard({ fen, orientation = 'white', onMove }: Props) {
  const boardRef    = useRef<HTMLDivElement>(null);
  const cgRef       = useRef<Api | null>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const pendingRef  = useRef<string | null>(null);
  const [pendingSquare, setPendingSquare] = useState<string | null>(null);

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

  useEffect(() => {
    if (pendingRef.current !== null) {
      cgRef.current?.set({ selected: pendingRef.current as Key });
    }
  }, [orientation]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMove || !cgRef.current) return;
    const rect   = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const square = pixelToSquare(e.clientX, e.clientY, rect, orientation);

    if (pendingSquare === null) {
      cgRef.current.set({ selected: square as Key });
      pendingRef.current = square;
      setPendingSquare(square);
    } else if (pendingSquare === square) {
      cgRef.current.set({ selected: undefined });
      pendingRef.current = null;
      setPendingSquare(null);
    } else {
      cgRef.current.set({ selected: undefined });
      onMove(pendingSquare + square);
      pendingRef.current = null;
      setPendingSquare(null);
    }
  }, [onMove, orientation, pendingSquare]);

  return (
    <div className="board-container">
      <div ref={boardRef} className="cg-wrap" />
      {onMove && (
        <div
          ref={overlayRef}
          data-testid="click-overlay"
          className="click-overlay"
          data-pending={pendingSquare ?? undefined}
          onClick={handleOverlayClick}
        />
      )}
    </div>
  );
}
