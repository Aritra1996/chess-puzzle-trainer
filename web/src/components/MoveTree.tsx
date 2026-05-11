'use client';
import type { Line } from '@/shared/moveTree';

interface Props {
  lines: Line[];
  onTokenClick?: (nodeId: string) => void;
}

export default function MoveTree({ lines, onTokenClick }: Props) {
  return (
    <div className="move-tree">
      {lines.map((line, lineIdx) => (
        <div key={lineIdx} className={`tree-line${line.isActivePath ? ' is-active-path' : ''}`}>
          {line.segments.map((seg, segIdx) => {
            if (seg.kind === 'connector') {
              return <span key={segIdx} className="seg-connector">{seg.text}</span>;
            }
            if (seg.kind === 'number') {
              return <span key={segIdx} className="seg-number">{seg.text}</span>;
            }
            if (seg.kind === 'space') {
              return <span key={segIdx}>{seg.text}</span>;
            }
            const isActive = 'active' in seg && seg.active;
            return (
              <span
                key={segIdx}
                className={`move-token ${seg.kind}${isActive ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => seg.nodeId && onTokenClick?.(seg.nodeId)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && seg.nodeId) {
                    e.preventDefault();
                    onTokenClick?.(seg.nodeId);
                  }
                }}
              >
                {seg.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
