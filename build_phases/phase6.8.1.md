# Phase 6.8.1 — Inline Context Token

## Problem

`.move-token.fixed` is a full-width dark block above the tree. It:
- Looks like a header, not a button (no clickability affordance)
- Takes the full width even though it's just one move label
- Sits on its own row instead of being the opening of the first tree line

User wants: `8. Bc4 Bxd1` on the same line — the fixed token is the puzzle's given move, the
player's first recorded move follows it naturally on the same line.

---

## Design Decisions (confirmed)

| Question | Decision |
|----------|----------|
| Empty tree | Context token alone on the first line; first recorded move joins it inline |
| Style | Muted / italic — clearly "given", not "recorded" |
| Click | Still navigates to root |

---

## Changes

### 1. `web/src/app/globals.css`

**`.move-token.fixed`** — replace the full-width dark block with an inline muted token:

```css
.move-token.fixed {
  display: inline;
  position: static;           /* CRITICAL — overrides Tailwind's .fixed { position: fixed } */
  font-style: italic;
  color: var(--ink-soft);
  opacity: 0.80;
  margin-right: 4px;
}
.move-token.fixed:hover {
  opacity: 1;
  background: rgba(31,29,26,.07);
}
.move-token.fixed.active {
  background: var(--yellow);
  color: var(--ink);
  font-weight: 700;
  outline: 1.5px solid var(--yellow-edge);
  outline-offset: 1px;
  animation: cursor-pulse 1.4s ease-in-out infinite;
  opacity: 1;
}
```

Remove: `background: #2b2825`, `color: #d4cfc8`, `margin-bottom: 6px`, overrides for `:hover`
and `.active` that fight the dark theme. The `.active` state now uses the same yellow cursor
as every other token — consistent and clearly clickable.

**Note on `position: static`:** This line must never be removed. Tailwind's `@layer utilities`
defines `.fixed { position: fixed }`. Because the element has class `fixed`, Tailwind's rule
would apply without this explicit override. The Phase 6.7 CSS layout guard test protects it.

### 2. `web/src/components/MoveTree.tsx`

Change from:
```
<span className="move-token fixed" ...>8. Bc4</span>   ← standalone block above tree
<div className="tree-line">8... Bxd1 …</div>
```

To:
```
<div className="tree-line">
  <span className="move-token fixed" ...>8. Bc4</span> Bxd1 …
</div>
```

**Rules:**

1. **Context token is ALWAYS the first element of the first `.tree-line`**, not a sibling element
   above the tree.
2. **Empty tree (lines = []):** Render one synthetic `.tree-line.is-active-path` containing only
   the context token. No move segments yet — user's first recorded move will populate `lines[0]`.
3. **Non-empty tree:** The context token is the first child of `lines[0]`'s `<div>`. The rest of
   `lines[0].segments` follow. Lines 1…N render normally.
4. **Skip the first `number` segment of `lines[0]`** when `lastMoveLabel` is a real label (not the
   `'▸ start'` fallback). Reason: "8. Bc4" already establishes the move number; "8. Bc4 8… Bxd1"
   is redundant. Showing "8. Bc4 Bxd1" matches standard chess notation. When `lastMoveLabel` is
   absent (`▸ start`), keep the number ("▸ start 1. Nd5" is clear).

**Implementation sketch:**

```tsx
export default function MoveTree({ lines, onTokenClick, checkResult, rootNodeId, isAtRoot, lastMoveLabel }: Props) {
  const contextLabel  = lastMoveLabel ?? '▸ start';
  const hasRealLabel  = !!lastMoveLabel;              // true  → skip line-0 number segment
  const fixedCls = ['move-token', 'fixed', isAtRoot ? 'active' : ''].filter(Boolean).join(' ');

  const contextToken = rootNodeId ? (
    <span
      className={fixedCls}
      role="button"
      tabIndex={0}
      title="Return to starting position"
      onClick={() => onTokenClick?.(rootNodeId)}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && rootNodeId) { e.preventDefault(); onTokenClick?.(rootNodeId); }}}
    >
      {contextLabel}
    </span>
  ) : null;

  // Helper to render segments (unchanged from before)
  function renderSegments(segments, skipFirstNumber = false) {
    const segs = (skipFirstNumber && segments[0]?.kind === 'number') ? segments.slice(1) : segments;
    return segs.map((seg, segIdx) => { /* … existing renderSegment logic … */ });
  }

  if (!rootNodeId) {
    // No context token — plain tree render
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
    // Context token alone; tree is empty
    return (
      <div className="move-tree">
        <div className="tree-line is-active-path">
          {contextToken}
        </div>
      </div>
    );
  }

  // Context token inline at start of first line
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
```

---

### 3. Test changes

#### `web/src/lib/__tests__/cssLayoutGuards.test.ts`

The existing `display: block` guard will **fail** (we're intentionally changing to `display: inline`).
Update the test to guard the real invariant — `position: static`:

```typescript
it('move-token.fixed has position: static to override Tailwind position:fixed', () => {
  const src = fs.readFileSync(CSS, 'utf8')
  const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
  expect(fixedBlock).not.toBe('')
  expect(fixedBlock).toContain('position: static')
  expect(fixedBlock).not.toContain('display: block')  // must NOT revert to block
})
```

#### `web/src/components/__tests__/MoveTree.test.tsx`

The context-token tests still pass as-is (they check for a button with text, not its position in
the DOM). But one new structural test should be added:

```typescript
it('context token is inside the first .tree-line, not a sibling above it', () => {
  render(<MoveTree lines={[PLAYER_LINE]} rootNodeId="root-1" isAtRoot={false} />)
  const firstLine = document.querySelector('.tree-line')
  expect(firstLine).not.toBeNull()
  const fixedInsideLine = firstLine!.querySelector('.move-token.fixed')
  expect(fixedInsideLine).not.toBeNull()
})

it('single .tree-line rendered when tree is empty and rootNodeId is set', () => {
  render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
  expect(document.querySelectorAll('.tree-line')).toHaveLength(1)
})
```

#### `web/e2e/ui-layout.spec.ts`

The current test asserts `tokenBox.y + tokenBox.height <= lineBox.y` (token ABOVE line).
With inline layout, they share the same row, so this assertion will fail.

Replace with a same-row assertion:

```typescript
test('context token and first recorded move are on the same row', async ({ page }) => {
  const board = page.locator('.board-container')
  await board.click({ position: sq(5, 6) })  // f6
  await board.click({ position: sq(3, 5) })  // d5 → Nd5

  const contextToken   = page.locator('.move-token.fixed').first()
  const firstMoveToken = page.locator('.move-token.player').first()

  await expect(contextToken).toBeVisible()
  await expect(firstMoveToken).toBeVisible()

  const tokenBox = await contextToken.boundingBox()
  const moveBox  = await firstMoveToken.boundingBox()

  expect(tokenBox).not.toBeNull()
  expect(moveBox).not.toBeNull()

  // Same row: y coordinates overlap. Context token top must be within 8px of move token top.
  expect(Math.abs(tokenBox!.y - moveBox!.y)).toBeLessThanOrEqual(8)
})
```

#### `web/e2e/navigation.spec.ts`

`'initial depth is 0 and breadcrumb shows "start"'` checks `.move-token.fixed` is visible.
This still passes — the token is visible, just inline now. **No change needed.**

---

## TDD Sequence

| Step | Action | Expected |
|------|--------|----------|
| RED | Add new unit tests (structural), update CSS guard | Fail: `display: block` found, no `.tree-line` wrapping context token |
| GREEN | Apply CSS + MoveTree.tsx changes | All unit tests pass |
| YELLOW | Run full suite: `npm test` + `npx playwright test` | 115/115 Vitest, 14/14 Playwright |

**Test delta:**

| Suite | Before | Change | After |
|-------|--------|--------|-------|
| cssLayoutGuards | 2 | updated (1 replaced) | 2 |
| MoveTree.test.tsx | 19 | +2 structural tests | 21 |
| ui-layout.spec.ts | 1 | 1 replaced | 1 |
| Everything else | unchanged | — | — |

---

## What does NOT change

- `shared/moveTree.ts` — no changes to the tree data model
- `PuzzleGame.tsx` — props to `MoveTree` unchanged
- Breadcrumb / `.an-stats` — untouched
- All other E2E specs — untouched
