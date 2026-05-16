# Phase 6.8.2 — Context Token: Dark Chip Style

## Problem

The context token (`8. Bc4`) looks like decorative muted text, not an interactive button:
- `opacity: 0.80` + `color: var(--ink-soft)` = too faint, reads as label
- No background, no border at rest = no visual affordance that it can be clicked
- On hover only a faint tint appears — invisible in practice

## Confirmed design

| State | Background | Text | Outline |
|-------|-----------|------|---------|
| Rest | `#2b2825` (dark warm) | `#d4cfc8` (light warm gray) | none — dark chip is the affordance |
| Hover | `#3c3835` (slightly lighter) | `#f0ede8` (warm white) | none |
| Active (cursor at root) | `#2b2825` stays | `#f0ede8` | `1.5px solid var(--yellow-edge)` — no animation |

Typography: italic kept — signals "given", not recorded.

---

## CSS-only change — `web/src/app/globals.css`

### `.move-token.fixed` (rest state)

```css
.move-token.fixed {
  display: inline;
  position: static;           /* CRITICAL — overrides Tailwind's .fixed { position: fixed } */
  font-style: italic;
  background: #2b2825;
  color: #d4cfc8;
  margin-right: 4px;
}
```

Changes vs. current:
- Remove `opacity: 0.80` — dark chip at full opacity
- Remove `outline: 1px solid rgba(31,29,26,.30)` — background chip is sufficient affordance
- Add `background: #2b2825` — dark warm chip
- Change `color: var(--ink-soft)` → `color: #d4cfc8` — light text readable on dark bg

### `.move-token.fixed:hover`

```css
.move-token.fixed:hover {
  background: #3c3835;
  color: #f0ede8;
}
```

Replaces current rule entirely — hover lightens the chip, making the affordance visible.

### `.move-token.fixed.active` — cascade patch (NEW rule)

**Why needed (CSS cascade):**

In `globals.css`, `.move-token.active` (line ~407) sets `background: var(--yellow)`.
`.move-token.fixed` (line ~439) sets `background: #2b2825`. Both are 2-class selectors
(equal specificity). The later rule wins, so when the fixed token is active, `.move-token.fixed`'s
dark background overrides `.move-token.active`'s yellow — dark bg is preserved. ✓

But `.move-token.active` also sets `animation: cursor-pulse`. Since `.move-token.fixed` doesn't
set `animation`, the cursor-pulse *does* apply. The pulse changes the outline/shadow; since we
want a static yellow outline instead, we suppress the animation explicitly.

A 3-class `.move-token.fixed.active` rule beats both, so it reliably governs the active state:

```css
.move-token.fixed.active {
  background: #2b2825;
  color: #f0ede8;
  outline: 1.5px solid var(--yellow-edge);
  outline-offset: 1px;
  animation: none;
}
```

---

## What does NOT change

- `web/src/components/MoveTree.tsx` — no component changes
- All other CSS rules — untouched

---

## Tests

### No new tests needed

Visual-only change. Existing guards remain valid:

| Test | Still passes? | Why |
|------|--------------|-----|
| `cssLayoutGuards` — `position: static` guard | ✓ | Still present |
| `cssLayoutGuards` — NOT `display: block` | ✓ | Still `display: inline` |
| `MoveTree` — structural tests | ✓ | No component changes |
| `ui-layout.spec.ts` — same-row assertion | ✓ | Layout unchanged |
| All other Vitest / Playwright | ✓ | Unaffected |

---

## TDD sequence

This phase has no failing tests before implementation (purely visual change).
The sequence is GREEN → YELLOW only.

### GREEN

1. Replace `.move-token.fixed` block — dark background, light text, no outline, no opacity
2. Replace `.move-token.fixed:hover` — lighter chip on hover
3. Add `.move-token.fixed.active` after the hover rule — static yellow outline, no animation

```bash
npm test -- --reporter=verbose
# Expect: 115/115
```

### YELLOW

```bash
npm test
npx playwright test --retries=1
# Expect: 115/115 Vitest, 14/14 Playwright
```
