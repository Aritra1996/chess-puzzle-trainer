'use client';

type Segment =
  | { kind: 'connector'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'player'; text: string; active?: boolean }
  | { kind: 'opponent'; text: string; active?: boolean }
  | { kind: 'space'; text: string };

type Line = { segments: Segment[]; isActivePath: boolean };

// Sample tree (PROJECT.md spec, black to move first):
//
// 15... Qh5+
//       ├─ 16. g3 Qxf3
//       │         ├─ 17. Rxf3 Re1#   ← cursor here
//       │         └─ 17. Kh2 Qxf2#
//       └─ 16. Kh1 Qxf3 17. Ke2 Re1#
//
// Player = black (blue), Opponent = white (red)

const SAMPLE_LINES: Line[] = [
  {
    isActivePath: true,
    segments: [
      { kind: 'number',   text: '15... ' },
      { kind: 'player',   text: 'Qh5+' },
    ],
  },
  {
    isActivePath: true,
    segments: [
      { kind: 'connector', text: '      ├─ ' },
      { kind: 'number',    text: '16. ' },
      { kind: 'opponent',  text: 'g3' },
      { kind: 'space',     text: ' ' },
      { kind: 'player',    text: 'Qxf3' },
    ],
  },
  {
    isActivePath: true,
    segments: [
      { kind: 'connector', text: '      │         ├─ ' },
      { kind: 'number',    text: '17. ' },
      { kind: 'opponent',  text: 'Rxf3' },
      { kind: 'space',     text: ' ' },
      { kind: 'player',    text: 'Re1#', active: true },
    ],
  },
  {
    isActivePath: false,
    segments: [
      { kind: 'connector', text: '      │         └─ ' },
      { kind: 'number',    text: '17. ' },
      { kind: 'opponent',  text: 'Kh2' },
      { kind: 'space',     text: ' ' },
      { kind: 'player',    text: 'Qxf2#' },
    ],
  },
  {
    isActivePath: false,
    segments: [
      { kind: 'connector', text: '      └─ ' },
      { kind: 'number',    text: '16. ' },
      { kind: 'opponent',  text: 'Kh1' },
      { kind: 'space',     text: ' ' },
      { kind: 'player',    text: 'Qxf3' },
      { kind: 'space',     text: ' ' },
      { kind: 'number',    text: '17. ' },
      { kind: 'opponent',  text: 'Ke2' },
      { kind: 'space',     text: ' ' },
      { kind: 'player',    text: 'Re1#' },
    ],
  },
];

export default function MoveTree() {
  return (
    <div className="move-tree">
      {SAMPLE_LINES.map((line, lineIdx) => (
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
