'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';

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

function squareStyle(sq: string, orientation: 'white' | 'black'): CSSProperties {
  const fileIdx = sq.charCodeAt(0) - 97;
  const rankIdx = parseInt(sq[1], 10) - 1;
  const file = orientation === 'black' ? 7 - fileIdx : fileIdx;
  const rank = orientation === 'black' ? 7 - rankIdx : rankIdx;
  return { left: `${file * 12.5}%`, bottom: `${rank * 12.5}%` };
}

export default function PuzzleBoard({ fen, orientation = 'white', onMove }: Props) {
  const boardRef    = useRef<HTMLDivElement>(null);
  const cgRef       = useRef<Api | null>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
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

  useEffect(() => { setPendingSquare(null); }, [orientation]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMove) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const square = pixelToSquare(e.clientX, e.clientY, rect, orientation);

    if (pendingSquare === null) {
      setPendingSquare(square);
    } else if (pendingSquare === square) {
      setPendingSquare(null);
    } else {
      onMove(pendingSquare + square);
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
        >
          {pendingSquare && (
            <div className="sq-highlight" style={squareStyle(pendingSquare, orientation)} />
          )}
        </div>
      )}
    </div>
  );
}
