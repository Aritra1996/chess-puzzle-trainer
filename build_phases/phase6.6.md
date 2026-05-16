# Phase 6.6 — Layout Fix: Context Token Overlap

## Problem

Two visual bugs introduced in Phase 6.5:

### Bug 1 — Two "start" indicators (Image 1, empty tree)

The breadcrumb row already had a `.here` pill (`▸ START`, right-aligned via `margin-left: auto`).
Phase 6.5 added a second "start" indicator — the context token — inside the move tree.
Both are visible simultaneously, creating visual clutter.

**Root cause:** The breadcrumb `.here` element was left unchanged when the context token was added.
They now duplicate each other's role.

### Bug 2 — Context token flows inline with first tree line (Image 2, with moves)

The context token (`8. Bc4`) appears on the same line as the first tree-line content, producing
`8. Bc4xd1  9. Kxd1` instead of the intended two-row layout:

```
8. Bc4               ← context token (own row)
8...Bxd1  9. Kxd1   ← first tree line (own row)
```

**Root cause:** `.move-tree` has `white-space: pre`. The context token is a `<span>` (inline
element). In a block container with `white-space: pre`, an inline element followed by a block
element (`<div class="tree-line">`) sometimes shares the same formatted line rather than the
anonymous-block separation that normal block containers provide. Making the context token
block-level fixes this.

---

## Root cause summary

| Bug | File | Root cause |
|-----|------|------------|
| Duplicate "start" | `PuzzleGame.tsx` + `globals.css` | `.here` pill not removed when context token added |
| Inline flow | `globals.css` | `white-space: pre` on `.move-tree` + `<span>` context token |

---

## Files

| File | Action |
|------|--------|
| `web/src/app/globals.css` | Move `white-space: pre` from `.move-tree` to `.tree-line`; remove `.breadcrumb .here` rules |
| `web/src/components/PuzzleGame.tsx` | Remove `<span className="here">▸ start</span>` from breadcrumb |

No new files. No test changes (CSS-only behaviour — existing 101 Vitest + E2E tests cover the
affected components).

---

## `web/src/app/globals.css`

### 1 — Move `white-space: pre` from `.move-tree` to `.tree-line`

`white-space: pre` is needed to preserve the leading spaces in connector characters
(`      └─ `). It belongs on the element that contains those connectors (`.tree-line`),
not the whole `.move-tree` container. Moving it fixes the inline-flow bug without
removing any connector spacing.

```css
/* BEFORE */
.move-tree {
  font-family: var(--mono);
  font-size: 13.5px;
  line-height: 2.05;
  white-space: pre;       /* ← causes context token + tree-line to share a line */
  user-select: none;
  color: var(--ink);
}

.tree-line {
  position: relative;
  display: block;
  border-radius: 3px;
  padding: 0 4px;
  margin: 0 -4px;
}
```

```css
/* AFTER */
.move-tree {
  font-family: var(--mono);
  font-size: 13.5px;
  line-height: 2.05;
  user-select: none;
  color: var(--ink);
}

.tree-line {
  position: relative;
  display: block;
  white-space: pre;       /* ← moved here — only tree lines need it */
  border-radius: 3px;
  padding: 0 4px;
  margin: 0 -4px;
}
```

### 2 — Remove `.breadcrumb .here` rules

The `.here` pill is being removed from the template (see PuzzleGame change below).
Its CSS is no longer used.

```css
/* REMOVE the entire block */
.breadcrumb .here {
  margin-left: auto;
  display: inline-flex;
  ...
}
```

### 3 — Add bottom margin to context token

Adds a small gap between the context token and the first tree line.

```css
/* ADD to .move-token.fixed block */
.move-token.fixed {
  display: inline-block;  /* guard against any remaining inline-flow edge cases */
  margin-bottom: 6px;
  background: #2b2825;
  color: #d4cfc8;
  font-style: italic;
  outline: none;
  opacity: 0.90;
}
```

---

## `web/src/components/PuzzleGame.tsx`

Remove the `.here` span from the breadcrumb. The context token in the move tree now serves
as the sole "return to root" anchor.

```tsx
/* BEFORE */
<div className="breadcrumb">
  <span className="here">▸ start</span>
  {breadcrumb.map((san, i) => (
    <Fragment key={i}>
      <span className="sep"> → </span>
      <span className="crumb">{san}</span>
    </Fragment>
  ))}
</div>

/* AFTER */
<div className="breadcrumb">
  {breadcrumb.map((san, i) => (
    <Fragment key={i}>
      {i === 0 && <span className="sep">▸</span>}
      {i > 0  && <span className="sep"> → </span>}
      <span className="crumb">{san}</span>
    </Fragment>
  ))}
</div>
```

This keeps the breadcrumb useful when moves are recorded (shows `▸ Nd5 → a3`) without
duplicating the context token's "home" role. When the tree is empty the breadcrumb is blank,
which is correct — the context token in the tree is the visual anchor.

---

## What does NOT change

- Context token JSX in `MoveTree.tsx` — no changes needed
- Legend JSX — no changes needed
- All props (`rootNodeId`, `isAtRoot`, `lastMoveLabel`) — no changes needed
- Any test files — 101 Vitest tests cover MoveTree + PuzzleGame rendering

---

## Verification

```bash
# Vitest — all 101 still green
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test

# Visual check (dev server)
npm run dev
# Confirm in browser:
# 1. Empty tree: context token visible at top-left of tree area, no duplicate breadcrumb pill
# 2. Record moves: context token on its own row above the first tree line, not merged
# 3. Breadcrumb shows move path (▸ Nd5 → a3) when moves exist, blank when empty
# 4. Clicking context token navigates to root
```
