# Phase 6.7 — Fix: Context Token Block-Level Display

## Problem

The context token (`.move-token.fixed`) uses `display: inline-block`, which is **inline-level**
in the parent's formatting context. A CSS block container arranges its children vertically only
when they are block-level. An `inline-block` element is wrapped in an anonymous block box along
with any other adjacent inline-level content, meaning the legend div can appear on the same
rendered row as the context token.

**Visible symptom (screenshot):**
```
[8. Bc4]  Nd5 correct · Nxe4 mistake · c4-d5 illegal
```
Context token and legend share one row. The legend's own `8. Bc4 fixed ·` sample is hidden behind
the context token.

## Why the Phase 6.6 fix was insufficient

Phase 6.6 moved `white-space: pre` from `.move-tree` to `.tree-line` — correct — but then set
`display: inline-block` on `.move-token.fixed`. `inline-block` participates in **inline**
formatting. The parent (`.move-tree`) still sees the context token as inline-level and can place
the following block element (`.token-legend`) on the same "anonymous block row".

## Fix

Change `display: inline-block` → `display: block` on `.move-token.fixed`.

`display: block` makes the element block-level in the parent's formatting context. The parent
arranges all three children vertically:

```
[context token   — block]
[tree lines      — block]   (zero or more)
[.token-legend   — block]
```

---

## Files

| File | Action |
|------|--------|
| `web/src/app/globals.css` | Change `display: inline-block` → `display: block` in `.move-token.fixed` |

No JSX changes. No test file changes beyond adding the new guards (see `phase6.7_tests.md`).

---

## `web/src/app/globals.css`

```css
/* BEFORE */
.move-token.fixed {
  display: inline-block;
  margin-bottom: 6px;
  background: #2b2825;
  color: #d4cfc8;
  font-style: italic;
  outline: none;
  opacity: 0.90;
}

/* AFTER */
.move-token.fixed {
  display: block;
  margin-bottom: 6px;
  background: #2b2825;
  color: #d4cfc8;
  font-style: italic;
  outline: none;
  opacity: 0.90;
}
```

### Why `display: block` is safe for legend samples

The legend sample tokens also carry the class `move-token fixed tl-sample`. They live inside
`.tl-item { display: flex }` — a flex container. CSS spec blockifies all flex items regardless
of their own `display` declaration, so `display: block` on the sample tokens has no visual
effect inside the legend. The legend layout is unchanged.

---

## Verification

```bash
# Vitest — all 104 green (103 + 1 new CSS guard from phase6.7_tests.md)
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test

# Playwright — layout tests green
npx playwright test e2e/ui-layout.spec.ts
```

Visual check in browser:
- Empty tree: context token on its own row, legend on the row below it
- With moves: context token row, tree lines, legend row — all separate
