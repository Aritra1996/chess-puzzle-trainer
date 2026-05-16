'use client';
import type { Line, Segment } from '@/shared/moveTree';
import type { CheckResult } from '@/shared/solutionChecker';

interface Props {
  lines:           Line[];
  onTokenClick?:   (nodeId: string) => void;
  checkResult?:    CheckResult;
  rootNodeId?:     string;
  isAtRoot?:       boolean;
  lastMoveLabel?:  string;
}

export default function MoveTree({ lines, onTokenClick, checkResult, rootNodeId, isAtRoot, lastMoveLabel }: Props) {
  const contextLabel = lastMoveLabel ?? '▸ start';
  const hasRealLabel = !!lastMoveLabel;  // when true, skip redundant move-number on line 0
  const fixedCls = ['move-token', 'fixed', isAtRoot ? 'active' : ''].filter(Boolean).join(' ');

  function renderSegment(seg: Segment, segIdx: number) {
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
    const status = seg.nodeId ? (checkResult?.get(seg.nodeId) ?? '') : '';
    const cls = ['move-token', seg.kind, isActive ? 'active' : '', status]
      .filter(Boolean).join(' ');
    const statusTitle = status
      ? ({ correct: 'correct', wrong: 'mistake', illegal: 'illegal' } as Record<string, string>)[status]
      : undefined;
    return (
      <span
        key={segIdx}
        className={cls}
        role="button"
        tabIndex={0}
        title={statusTitle}
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
  }

  function renderSegments(segments: Segment[], skipFirstNumber = false) {
    const segs = (skipFirstNumber && segments[0]?.kind === 'number')
      ? segments.slice(1)
      : segments;
    return segs.map((seg, i) => renderSegment(seg, i));
  }

  const contextToken = rootNodeId ? (
    <span
      className={fixedCls}
      role="button"
      tabIndex={0}
      title="Return to starting position"
      onClick={() => onTokenClick?.(rootNodeId)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && rootNodeId) {
          e.preventDefault();
          onTokenClick?.(rootNodeId);
        }
      }}
    >
      {contextLabel}
    </span>
  ) : null;

  if (!rootNodeId) {
    return (
      <div className="move-tree">
        {lines.map((line, i) => (
          <div key={i} className={`tree-line${line.isActivePath ? ' is-active-path' : ''}`}>
            {renderSegments(line.segments)}
          </div>
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="move-tree">
        <div className="tree-line is-active-path">
          {contextToken}
        </div>
      </div>
    );
  }

  return (
    <div className="move-tree">
      <div className={`tree-line${lines[0].isActivePath ? ' is-active-path' : ''}`}>
        {contextToken}
        {renderSegments(lines[0].segments, hasRealLabel)}
      </div>
      {lines.slice(1).map((line, i) => (
        <div key={i + 1} className={`tree-line${line.isActivePath ? ' is-active-path' : ''}`}>
          {renderSegments(line.segments)}
        </div>
      ))}
    </div>
  );
}
