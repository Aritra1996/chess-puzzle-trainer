# Phase 6.5 — Move Tree UX: Context Token + Check Result Legend

## Goals

Three focused UI improvements to the move tree panel:

1. **Context token** — A fixed, non-editable stone-styled token at the start of the tree
   showing the opponent's last move (e.g. `8. Bc4`) or `▸ start` when that move is unknown.
   Always clickable; navigates to the root position. Visible even when the tree is empty.

2. **Visual semantics fix** — Swap the decoration between wrong and illegal:
   - **Illegal** → strikethrough (move cannot be played → cross it out)
   - **Wrong** → red bottom-border underline (move happened but was a mistake → highlight, don't erase)

3. **Check result legend** — Compact always-visible key near the tree explaining each visual state,
   including a note that the context token is fixed and cannot be modified.

---

## Design rationale

### Context token

The user currently has no visual "handle" to click back to the start position — only ←Arrow works.
Showing the opponent's last move before the puzzle began also gives the position context
("what did they just play that I need to respond to?").

If the last move is unknown (no `lastMove` prop supplied), `▸ start` is shown instead.
Either way the token is always present — even when the tree is empty — so the tree is never blank.

The token uses a **stone/charcoal** filled style: clearly distinct from the blue (player) and
red (opponent) move colours. Clicking it navigates to root; pressing Enter/Space also works.
When the cursor is at root the token highlights with a white glow instead of the yellow pulse
used by regular move tokens.

Format of the label:
```
Black to move  →  white just played  →  "8. Bc4"     (fullMoveNumber. SAN)
White to move  →  black just played  →  "7... Bc4"   ((fullMoveNumber-1)... SAN)
No lastMove    →  "▸ start"
```

### Wrong vs illegal decoration

| State | Decoration | Reasoning |
|-------|-----------|-----------|
| `correct` | green colour + bg + outline | Positive feedback, no change |
| `wrong` | red colour + bg + **bottom border** | Move happened — highlight it; don't erase it |
| `illegal` | orange colour + bg + **strikethrough** | Move didn't happen — cross it out |

### Legend

A compact single-row strip sits between the tree and the action buttons. Each entry is a
representative sample token + a short label. A `·` separator marks that the context token
"cannot be changed". Keeps the UI self-documenting without a tooltip or modal.

---

## Files

| File | Action |
|------|--------|
| `web/src/components/MoveTree.tsx` | **MODIFY** — context token + legend |
| `web/src/components/PuzzleGame.tsx` | **MODIFY** — `lastMove` prop + derive `isAtRoot` + `lastMoveLabel` |
| `web/src/app/globals.css` | **MODIFY** — `.fixed`, swap wrong/illegal decorations, legend styles |
| `web/src/app/page.tsx` | **MODIFY** — add `lastMove` prop |
| `web/src/components/__tests__/MoveTree.test.tsx` | **MODIFY** — 6 new tests |
| `web/src/components/__tests__/PuzzleGame.test.tsx` | **MODIFY** — 3 new tests |

---

## `web/src/components/MoveTree.tsx`

### New props

```typescript
interface Props {
  lines:          Line[];
  onTokenClick?:  (nodeId: string) => void;
  checkResult?:   CheckResult;
  rootNodeId:     string;         // root node ID for click-to-navigate
  isAtRoot:       boolean;        // true when cursor is at root
  lastMoveLabel?: string;         // e.g. "8. Bc4" — undefined → shows "▸ start"
}
```

### Context token JSX (render before `lines.map`)

```tsx
const contextLabel = lastMoveLabel ?? '▸ start';
const fixedCls = ['move-token', 'fixed', isAtRoot ? 'active' : '']
  .filter(Boolean).join(' ');

// Context token
<span
  className={fixedCls}
  role="button"
  tabIndex={0}
  title="Return to starting position"
  onClick={() => onTokenClick?.(rootNodeId)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTokenClick?.(rootNodeId);
    }
  }}
>
  {contextLabel}
</span>
```

The context token is rendered **outside** the `lines.map()` so it stays visible even when the
tree is empty (no moves recorded yet). It sits at the top of `.move-tree`.

### Legend JSX (render after `lines.map`)

```tsx
<div className="token-legend">
  <span className="tl-item">
    <span className="move-token fixed tl-sample">8. Bc4</span>
    <span className="tl-label">fixed</span>
  </span>
  <span className="tl-sep">·</span>
  <span className="tl-item">
    <span className="move-token player tl-sample">Nd5</span>
    <span className="tl-label">correct</span>
  </span>
  <span className="tl-sep">·</span>
  <span className="tl-item">
    <span className="move-token player wrong tl-sample">Nxe4</span>
    <span className="tl-label">mistake</span>
  </span>
  <span className="tl-sep">·</span>
  <span className="tl-item">
    <span className="move-token player illegal tl-sample">c4-d5</span>
    <span className="tl-label">illegal</span>
  </span>
</div>
```

---

## `web/src/components/PuzzleGame.tsx`

### New prop

```typescript
interface Props {
  fen:          string;
  orientation?: 'white' | 'black';
  solution?:    string;
  lastMove?:    string;   // SAN of opponent's last move, e.g. "Bc4"
}
```

### Derived values (inside the component)

```typescript
const isAtRoot = state.tree.currentNodeId === state.tree.root.id;

const { fullMoveNumber, turn } = parseFen(fen);
const lastMoveLabel = lastMove
  ? (turn === 'black'
      ? `${fullMoveNumber}. ${lastMove}`           // white's move N
      : `${fullMoveNumber - 1}... ${lastMove}`)    // black's move N-1
  : undefined;
```

### Updated MoveTree usage

```tsx
<MoveTree
  lines={lines}
  onTokenClick={(id) => dispatch({ type: 'NAVIGATE_TO', nodeId: id })}
  checkResult={checkResult ?? undefined}
  rootNodeId={state.tree.root.id}
  isAtRoot={isAtRoot}
  lastMoveLabel={lastMoveLabel}
/>
```

---

## `web/src/app/globals.css`

### Stone / fixed token

```css
.move-token.fixed {
  background: #2b2825;
  color: #d4cfc8;
  font-style: italic;
  outline: none;
  opacity: 0.90;
}
.move-token.fixed:hover {
  background: #3c3835;
  color: #f0ede8;
}
.move-token.fixed.active {
  background: #2b2825;
  color: #f0ede8;
  outline: 1.5px solid rgba(255,255,255,.22);
  outline-offset: 2px;
  animation: none;          /* suppress yellow pulse */
}
```

### Swap wrong ↔ illegal decorations

**Before (wrong):**
```css
.move-token.wrong { color: #b23a2a; background: rgba(178,58,42,.10); text-decoration-line: line-through; text-decoration-color: rgba(178,58,42,.45); }
```

**After (wrong) — bottom border, no strikethrough:**
```css
.move-token.wrong { color: #b23a2a; background: rgba(178,58,42,.12); border-bottom: 2px solid rgba(178,58,42,.60); }
```

**Before (illegal):**
```css
.move-token.illegal { color: #9a5700; background: rgba(154,87,0,.10); outline: 1px dashed rgba(154,87,0,.45); outline-offset: 1px; }
```

**After (illegal) — strikethrough replaces dashed outline:**
```css
.move-token.illegal { color: #9a5700; background: rgba(154,87,0,.10); text-decoration: line-through; text-decoration-color: rgba(154,87,0,.65); }
```

### Legend

```css
.token-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin-top: 6px;
  background: var(--paper-2);
  border: 1px solid var(--paper-3);
  border-radius: 4px;
  font-size: 11px;
  color: var(--ink-faint);
  flex-wrap: wrap;
}
.tl-item  { display: flex; align-items: center; gap: 4px; }
.tl-label { color: var(--ink-soft); }
.tl-sep   { color: var(--ink-faint); }
.tl-sample {
  font-size: 10px;
  padding: 1px 4px;
  pointer-events: none;  /* legend samples are decorative, not interactive */
}
```

---

## `web/src/app/page.tsx`

```tsx
const SAMPLE_SOLUTION = 'f6e4';
const LAST_MOVE       = 'Bc4';   // White's 8th move that led to SAMPLE_FEN

<PuzzleGame fen={SAMPLE_FEN} solution={SAMPLE_SOLUTION} lastMove={LAST_MOVE} />
```

Note: SAMPLE_FEN is black to move on move 8, so the context token will display `8. Bc4`.

---

## Tests

### `web/src/components/__tests__/MoveTree.test.tsx` — 6 new tests

Add these to the existing test file. The mock root ID must be threaded through.

```typescript
describe('MoveTree — context token', () => {
  it('renders "▸ start" when lastMoveLabel is not provided', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).toBeInTheDocument()
  })

  it('renders lastMoveLabel when provided', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} lastMoveLabel="8. Bc4" />)
    expect(screen.getByRole('button', { name: /8\. Bc4/i })).toBeInTheDocument()
  })

  it('context token is visible even when lines is empty', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).toBeInTheDocument()
  })

  it('context token has "active" class when isAtRoot is true', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={true} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).toHaveClass('active')
  })

  it('context token does not have "active" class when isAtRoot is false', () => {
    render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    expect(screen.getByRole('button', { name: /▸ start/i })).not.toHaveClass('active')
  })

  it('clicking context token calls onTokenClick with rootNodeId', () => {
    const spy = vi.fn()
    render(<MoveTree lines={[]} rootNodeId="root-42" isAtRoot={false} onTokenClick={spy} />)
    fireEvent.click(screen.getByRole('button', { name: /▸ start/i }))
    expect(spy).toHaveBeenCalledWith('root-42')
  })
})

describe('MoveTree — legend', () => {
  it('renders the legend with correct, mistake, illegal, and fixed labels', () => {
    const { container } = render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
    const legend = container.querySelector('.token-legend')
    expect(legend).not.toBeNull()
    expect(legend?.textContent).toMatch(/correct/i)
    expect(legend?.textContent).toMatch(/mistake/i)
    expect(legend?.textContent).toMatch(/illegal/i)
    expect(legend?.textContent).toMatch(/fixed/i)
  })
})
```

### `web/src/components/__tests__/PuzzleGame.test.tsx` — 3 new tests

Add a new describe block at the end. Requires updating the MoveTree mock to also capture
`isAtRoot` and `lastMoveLabel`.

Update mock variable declarations:
```typescript
let capturedIsAtRoot: boolean | undefined
let capturedLastMoveLabel: string | undefined
```

Update MoveTree mock to capture them:
```typescript
vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick, checkResult, rootNodeId, isAtRoot, lastMoveLabel }: { ... }) => {
    capturedOnTokenClick  = onTokenClick
    capturedCheckResult   = checkResult
    capturedIsAtRoot      = isAtRoot
    capturedLastMoveLabel = lastMoveLabel
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))
```

Tests:
```typescript
describe('PuzzleGame — context token props', () => {
  it('isAtRoot is true before any moves are recorded', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(capturedIsAtRoot).toBe(true)
  })

  it('isAtRoot is false after recording a move', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    expect(capturedIsAtRoot).toBe(false)
  })

  it('lastMoveLabel is derived correctly from lastMove prop and FEN', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} lastMove="Bc4" />)
    // SAMPLE_FEN: black to move, fullMoveNumber=8 → "8. Bc4"
    expect(capturedLastMoveLabel).toBe('8. Bc4')
  })
})
```

---

## TDD summary

| Phase | What changes | Expected |
|-------|-------------|----------|
| RED | Add 9 new tests | 9 fail — props not yet wired |
| GREEN | Implement all 4 source changes | All tests pass |
| YELLOW | `npm test` | 100/100 (91 + 9) green |

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `MoveTree.test.tsx` | existing | +7 | existing + 7 |
| `PuzzleGame.test.tsx` | 37 | +3 | 40 |
| All other Vitest | 54 | — | 54 |
| **Vitest total** | **91** | **+10** | **101** |

---

## Notes

- `parseFen` already returns `fullMoveNumber` and `turn` — no new parsing needed.
- The context token calls `onTokenClick(rootNodeId)` — PuzzleGame dispatches `NAVIGATE_TO` which
  already handles navigating to any node ID including root.
- `animation: none` on `.fixed.active` prevents the yellow cursor-pulse from firing on the stone
  token; the white outline is sufficient to signal "you are here".
- Legend sample tokens have `pointer-events: none` so they don't respond to hover/click.
- The `fullMoveNumber - 1` in the white-to-move case handles the edge case where black just
  played move N (displayed as `(N)... lastMove`).
