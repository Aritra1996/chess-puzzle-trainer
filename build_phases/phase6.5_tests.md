# Phase 6.5 Tests — Context Token + Check Result Legend

## Context

Phase 6.5 adds three things to the move tree UI:
1. A fixed stone-styled context token (always visible, clickable, navigates to root)
2. Swapped decorations: illegal → strikethrough, wrong → red bottom-border
3. A legend strip below the tree

**Files changed:**
- `web/src/components/MoveTree.tsx` — new props, context token JSX, legend JSX
- `web/src/components/PuzzleGame.tsx` — new `lastMove` prop, derive `isAtRoot` + `lastMoveLabel`
- `web/src/app/globals.css` — `.fixed`, swap wrong/illegal CSS, legend styles
- `web/src/app/page.tsx` — add `lastMove` prop

**Test files changed (Vitest):**
- `web/src/components/__tests__/MoveTree.test.tsx` — fix 2 existing + add 7 new
- `web/src/components/__tests__/PuzzleGame.test.tsx` — update mock + add 3 new

**Test files changed (Playwright E2E):**
- `web/e2e/recording.spec.ts` — fix 1 breaking selector
- `web/e2e/navigation.spec.ts` — fix 1 breaking selector
- `web/e2e/solution.spec.ts` — fix 6 breaking selectors across tests 4–7

No new test files created.

Follows **Red → Green → Yellow** TDD.

---

## Breaking change in existing tests

After implementation the context token is rendered as a `.move-token.fixed` element **before** any
tree-line tokens. Two existing MoveTree click tests use `document.querySelector('.move-token')!`
which will match the fixed token instead of the player token — breaking both tests at GREEN.

**Tests that need updating (handled in GREEN):**

| Test | Fix |
|------|-----|
| `calls onTokenClick with the nodeId when a token is clicked` | Change selector to `.move-token.player` |
| `calls onTokenClick when Enter is pressed on a token` | Change selector to `.move-token.player` |

These tests still pass at RED (context token not yet rendered), but must be fixed before the suite
can reach GREEN.

---

## Breaking changes in E2E tests (Playwright)

After implementation, the DOM always contains **5 `.move-token` elements** regardless of tree state:
- 1 context token (`.move-token.fixed`)
- 4 legend samples (`.move-token.tl-sample`)

Additionally, when cursor is at root the context token carries the `active` class.

Any Playwright selector that counted `.move-token` elements or assumed `.move-token.first()` is a
player token will break at GREEN. These must be fixed alongside the source changes.

### `web/e2e/recording.spec.ts`

| Line | Test | Selector | Why it breaks | Fix |
|------|------|----------|---------------|-----|
| 55 | `clicking the same square twice does not record a move` | `.move-token` count=0 | context + 4 legend = 5 always | `.move-token.player` count=0 |

Note: line 25 (`.move-token.first()` toBeVisible) is now trivially true — the context token is
always visible. The test still passes but verifies nothing meaningful. No change required; leave
a comment to strengthen it in a later phase.

### `web/e2e/navigation.spec.ts`

| Line | Test | Selector | Why it breaks | Fix |
|------|------|----------|---------------|-----|
| 50 | `ArrowLeft key moves cursor to parent (active token is lost)` | `.move-token.active` count=0 | context token gets `active` when at root → count=1 | `.move-token.player.active` count=0 |

### `web/e2e/solution.spec.ts`

All four breaks come from the same two root causes: `.move-token.first()` now returns the context
token (not a player token), and `.move-token` count=0 is impossible post-implementation.

| Line | Test | Selector | Why it breaks | Fix |
|------|------|----------|---------------|-----|
| 55 | test 4 — token gets status class | `.move-token.first()` class → `/correct\|wrong/` | first = context token (no status) | `.move-token.player.first()` |
| 71 | test 5 — illegal token class | `.move-token.first()` class → `/illegal/` | first = context token | `.move-token.player.first()` |
| 85 | test 6 — undo clears check state | `.move-token.first()` class → `/correct\|wrong/` | first = context token | `.move-token.player.first()` |
| 88 | test 6 — undo clears check state | `.move-token` count=0 | always 5 | `.move-token.player` count=0 |
| 101 | test 7 — reset clears check state | `.move-token.first()` class → `/correct\|wrong/` | first = context token | `.move-token.player.first()` |
| 102 | test 7 — reset clears check state | `.move-token` count=0 | always 5 | `.move-token.player` count=0 |

**Summary of E2E selector pattern replacements:**
```
// Count checks (no player moves in tree)
BEFORE: page.locator('.move-token').toHaveCount(0)
AFTER:  page.locator('.move-token.player').toHaveCount(0)

// First-token class checks
BEFORE: page.locator('.move-token').first()
AFTER:  page.locator('.move-token.player').first()

// Active count checks (at root)
BEFORE: page.locator('.move-token.active').toHaveCount(0)
AFTER:  page.locator('.move-token.player.active').toHaveCount(0)
```

---

## Changes needed to test files

### 1 — `MoveTree.test.tsx`: new imports

Add `screen` and `fireEvent` to the existing import:

```typescript
// BEFORE
import { render } from '@testing-library/react'

// AFTER
import { render, screen, fireEvent } from '@testing-library/react'
```

### 2 — `MoveTree.test.tsx`: fix two existing click tests

```typescript
// BEFORE (both tests)
document.querySelector('.move-token')!

// AFTER
document.querySelector('.move-token.player')!
```

### 3 — `PuzzleGame.test.tsx`: two new captured variables

Add alongside the existing `capturedCheckResult`:
```typescript
let capturedIsAtRoot:      boolean | undefined
let capturedLastMoveLabel: string | undefined
```

### 4 — `PuzzleGame.test.tsx`: update MoveTree mock

```typescript
// BEFORE
vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick, checkResult }: {
    lines:          unknown[];
    onTokenClick?:  (id: string) => void;
    checkResult?:   Map<string, string>;
  }) => {
    capturedOnTokenClick = onTokenClick
    capturedCheckResult  = checkResult
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))

// AFTER
vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick, checkResult, isAtRoot, lastMoveLabel }: {
    lines:           unknown[];
    onTokenClick?:   (id: string) => void;
    checkResult?:    Map<string, string>;
    isAtRoot?:       boolean;
    lastMoveLabel?:  string;
  }) => {
    capturedOnTokenClick  = onTokenClick
    capturedCheckResult   = checkResult
    capturedIsAtRoot      = isAtRoot
    capturedLastMoveLabel = lastMoveLabel
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))
```

---

## 🔴 RED — Write tests before source changes

Apply all four changes above (new imports, fixed selectors, new variables, updated mock), then
add the two new describe blocks below.

### New tests for `MoveTree.test.tsx`

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
  it('renders legend with correct, mistake, illegal, and fixed labels', () => {
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

### New tests for `PuzzleGame.test.tsx`

Add at the end of the file:

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

  it('lastMoveLabel is derived from lastMove + FEN (black to move, fullMove=8 → "8. Bc4")', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} lastMove="Bc4" />)
    expect(capturedLastMoveLabel).toBe('8. Bc4')
  })
})
```

### Why RED

| Test | Fails because |
|------|---------------|
| `renders "▸ start"…` | `rootNodeId` / `isAtRoot` props don't exist in component; no context token rendered |
| `renders lastMoveLabel when provided` | Context token not rendered |
| `context token visible when lines empty` | Context token not rendered |
| `active class when isAtRoot=true` | Context token not rendered |
| `no active class when isAtRoot=false` | Context token not rendered (`getByRole` throws) |
| `clicking calls onTokenClick with rootNodeId` | Context token not rendered |
| `legend renders with all labels` | `.token-legend` not in DOM |
| `isAtRoot is true before moves` | PuzzleGame doesn't pass `isAtRoot` to MoveTree; `capturedIsAtRoot` is `undefined` |
| `isAtRoot is false after move` | Same as above |
| `lastMoveLabel derived correctly` | PuzzleGame doesn't compute or pass `lastMoveLabel`; `capturedLastMoveLabel` is `undefined` |

**Minimum RED: 10 failures.** All 91 existing tests remain green.

Confirm:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 10 failed | 91 passed
```

---

## 🟢 GREEN — Implement source changes

Apply all changes from `phase6.5.md` in this order:

### 1 — `web/src/components/MoveTree.tsx`

- Add `rootNodeId: string`, `isAtRoot: boolean`, `lastMoveLabel?: string` to Props interface
- Add `screen` import if needed (none — it's the component, not the test)
- Render context token before `lines.map(...)`:

```tsx
const contextLabel = lastMoveLabel ?? '▸ start';
const fixedCls = ['move-token', 'fixed', isAtRoot ? 'active' : '']
  .filter(Boolean).join(' ');
```

```tsx
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

- Render legend after `lines.map(...)`:

```tsx
<div className="token-legend">
  <span className="tl-item">
    <span className="move-token fixed tl-sample">8. Bc4</span>
    <span className="tl-label">fixed</span>
  </span>
  <span className="tl-sep">·</span>
  <span className="tl-item">
    <span className="move-token player correct tl-sample">Nd5</span>
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

### 2 — `web/src/components/PuzzleGame.tsx`

- Add `lastMove?: string` to Props interface
- Derive `isAtRoot` and `lastMoveLabel` from tree state + FEN:

```typescript
const isAtRoot = state.tree.currentNodeId === state.tree.root.id;

const { fullMoveNumber, turn } = parseFen(fen);
const lastMoveLabel = lastMove
  ? (turn === 'black'
      ? `${fullMoveNumber}. ${lastMove}`
      : `${fullMoveNumber - 1}... ${lastMove}`)
  : undefined;
```

- Pass new props to MoveTree:

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

### 3 — `web/src/app/globals.css`

Add `.move-token.fixed`, `.move-token.fixed:hover`, `.move-token.fixed.active`, update `.wrong`
and `.illegal`, add `.token-legend`, `.tl-item`, `.tl-label`, `.tl-sep`, `.tl-sample` styles.
(Full CSS in `phase6.5.md`.)

### 4 — `web/src/app/page.tsx`

```tsx
const LAST_MOVE = 'Bc4';
<PuzzleGame fen={SAMPLE_FEN} solution={SAMPLE_SOLUTION} lastMove={LAST_MOVE} />
```

### 5 — Fix two existing MoveTree click tests

```typescript
// Both existing click tests: change selector
// BEFORE:  document.querySelector('.move-token')!
// AFTER:   document.querySelector('.move-token.player')!
```

### 6 — Fix E2E selectors in three Playwright files

**`web/e2e/recording.spec.ts` line 55:**
```typescript
// BEFORE
await expect(page.locator('.move-token')).toHaveCount(0)
// AFTER
await expect(page.locator('.move-token.player')).toHaveCount(0)
```

**`web/e2e/navigation.spec.ts` line 50:**
```typescript
// BEFORE
await expect(page.locator('.move-token.active')).toHaveCount(0)
// AFTER
await expect(page.locator('.move-token.player.active')).toHaveCount(0)
```

**`web/e2e/solution.spec.ts` lines 55, 71, 85, 88, 101, 102:**
```typescript
// Lines 55, 71, 85, 101 — first-token class check
// BEFORE
page.locator('.move-token').first()
// AFTER
page.locator('.move-token.player').first()

// Lines 88, 102 — count=0 check
// BEFORE
await expect(page.locator('.move-token')).toHaveCount(0)
// AFTER
await expect(page.locator('.move-token.player')).toHaveCount(0)
```

### Verify GREEN

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 101/101 green (91 existing + 10 new)
```

---

## 🟡 YELLOW — Regression guard

**Vitest (unit tests):**
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 101/101 green
```

Vitest tests that must stay green:

| Suite | Count |
|-------|-------|
| `MoveTree.test.tsx` — existing | 9 |
| `MoveTree.test.tsx` — new | 7 |
| `PuzzleGame.test.tsx` — existing | 37 |
| `PuzzleGame.test.tsx` — new | 3 |
| All other web tests | 54 |
| **Total** | **101** (was 91) |

**Playwright (E2E tests):**

All 3 updated E2E files must pass. The 8 `solution.spec.ts` tests require a running dev server
and Stockfish WASM. Run selectively to confirm:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npx playwright test e2e/recording.spec.ts e2e/navigation.spec.ts
# fast — no engine needed

npx playwright test e2e/solution.spec.ts --timeout=90000
# slow — Stockfish WASM eval
```

---

## Cumulative test count

| Suite | Before | Fix existing | +new | After |
|-------|--------|-------------|------|-------|
| `MoveTree.test.tsx` | 9 | 2 updated (not added) | +7 | 16 |
| `PuzzleGame.test.tsx` | 37 | mock updated | +3 | 40 |
| All other web tests | 45 | — | — | 45 |
| **Web total** | **91** | — | **+10** | **101** |
