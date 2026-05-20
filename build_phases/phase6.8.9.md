# Phase 6.8.9 — Fluid CSS: Replace `px` Layout Values with Relative Units

## Goal

Every layout-critical pixel value in `globals.css` is converted to a relative unit so the
interface **always fits the available screen** — whether it's a 375 px phone, a 768 px tablet,
or a 1440 px laptop — without needing extra breakpoint overrides.

This is a **CSS-only change**. No TypeScript, no component logic, no new tests beyond the ones
that already guard the layout.

---

## Why px is the problem

| Value type | px behaviour | Relative alternative |
|------------|-------------|----------------------|
| Font size | Fixed — ignores the user's browser font-size preference | `rem` — scales with root font size |
| Padding / gap / margin | Fixed — wastes space on small screens, looks sparse on large ones | `rem` — proportional to text |
| Fixed heights (header) | Fixed — may clip on short screens | `rem` (or `dvh` for full-viewport items) |
| Board size | Hardcoded — forces explicit overrides in every media query | `min()` + `dvh` + `vw` fluid formula |
| Media-query border sizes (1 px) | Fine to keep — hairline borders are the one px that should stay | keep `1px` |

---

## Unit reference table

At the browser's default root font size of **16 px**:

| px | rem |
|----|-----|
| 4  | 0.25rem  |
| 5  | 0.3125rem |
| 6  | 0.375rem |
| 8  | 0.5rem   |
| 10 | 0.625rem |
| 10.5 | 0.65625rem |
| 11 | 0.6875rem |
| 12 | 0.75rem  |
| 13 | 0.8125rem |
| 13.5 | 0.84375rem |
| 14 | 0.875rem |
| 15 | 0.9375rem |
| 16 | 1rem     |
| 18 | 1.125rem |
| 20 | 1.25rem  |
| 22 | 1.375rem |
| 24 | 1.5rem   |
| 26 | 1.625rem |
| 28 | 1.75rem  |
| 32 | 2rem     |
| 48 | 3rem     |
| 56 | 3.5rem   |
| 260 | 16.25rem |
| 320 | 20rem    |
| 380 | 23.75rem |
| 480 | 30rem    |

---

## The board-size overhaul (key change)

### Current approach — three separate breakpoint overrides

```css
/* Base */
.panel-board { --board-size: min(480px, calc(100dvh - 260px)); }

/* 960px breakpoint */
.board-container { width: min(480px, calc(100vw - 80px)); height: min(480px, calc(100vw - 80px)); }

/* 600px breakpoint */
.board-container { width: min(380px, calc(100vw - 52px)); height: min(380px, calc(100vw - 52px)); }
```

Problems:
- Explicit `px` cap values in three places
- `--board-size` is overridden at the `.board-container` level inside breakpoints, bypassing the
  variable — inconsistent
- New screen sizes or device categories require adding more breakpoints

### New approach — one variable, three formula slots

```css
/* Base (two-column desktop) */
.panel-board {
  --board-size: min(30rem, calc(100dvh - 16.25rem));
  /*            ^^^^^^     ^^^^^^^^^^^^^^^^^^^^^^^^
   *          480px cap    fits in available height
   */
}

/* Single-column (≤ 960px) */
@media (max-width: 960px) {
  .panel-board {
    --board-size: min(30rem, calc(100vw - 5.5rem));
    /*                       ^^^^^^^^^^^^^^^^^^^
     *                       5.5rem = 2×1.5rem panel + 2×1.25rem mat = 88px total margin
     */
  }
}

/* Phone (≤ 600px) */
@media (max-width: 600px) {
  .panel-board {
    --board-size: min(23.75rem, calc(100vw - 3.25rem));
    /*            ^^^^^^^^      ^^^^^^^^^^^^^^^^^^^^^^^
     *          380px phone cap  3.25rem = 2×1rem panel + 2×0.625rem mat = 52px
     */
  }
}
```

`.board-container` **never needs explicit width/height overrides** — it always uses the variable:

```css
.board-container {
  width:  var(--board-size, 30rem);
  height: var(--board-size, 30rem);
}
```

### Verification across common screen sizes

| Viewport | Formula active | `--board-size` result | Constraint |
|----------|---------------|-----------------------|------------|
| 1280 × 800 | base | `min(480, 800-260)` = **480 px** | dvh ✓ |
| 1280 × 600 | base | `min(480, 600-260)` = **340 px** | dvh shrinks board ✓ |
| 960 × 768 | 960px query | `min(480, 960-88)` = **480 px** | fits width ✓ |
| 700 × 900 | 960px query | `min(480, 700-88)` = **480 px** | fits width ✓ |
| 600 × 900 | 960px / 600px | `min(380, 600-52)` = **380 px** | phone cap ✓ |
| 375 × 667 | 600px query | `min(380, 375-52)` = **323 px** ≤ 375 | phone ✓ |
| 320 × 568 | 600px query | `min(380, 320-52)` = **268 px** ≤ 320 | narrow phone ✓ |

---

## Section-by-section changes

### `:root` — no changes

CSS custom properties are already unitless or colour values. Leave as-is.

---

### `.app-header`

```css
/* Before */
height: 56px;
padding: 0 28px;

/* After */
height: 3.5rem;
padding: 0 1.75rem;
```

---

### `.brand`, `.brand-logo`, `.brand-tagline`

```css
/* Before */
.brand        { gap: 14px; }
.brand-logo   { font-size: 22px; }
.brand-tagline{ font-size: 11px; }

/* After */
.brand        { gap: 0.875rem; }
.brand-logo   { font-size: 1.375rem; }
.brand-tagline{ font-size: 0.6875rem; }
```

---

### `.header-puzzle`, `.chip`, `.header-nav`, `.nav-link`, `.avatar`

```css
/* Before */
.header-puzzle { gap: 10px; font-size: 12px; }
.chip          { gap: 6px; padding: 3px 9px; font-size: 11px; }
.header-nav    { gap: 6px; }
.nav-link      { padding: 6px 10px; font-size: 13px; }
.avatar        { width: 28px; height: 28px; font-size: 13px; margin-left: 8px; }

/* After */
.header-puzzle { gap: 0.625rem; font-size: 0.75rem; }
.chip          { gap: 0.375rem; padding: 0.1875rem 0.5625rem; font-size: 0.6875rem; }
.header-nav    { gap: 0.375rem; }
.nav-link      { padding: 0.375rem 0.625rem; font-size: 0.8125rem; }
.avatar        { width: 1.75rem; height: 1.75rem; font-size: 0.8125rem; margin-left: 0.5rem; }
```

---

### `.panel-board`

```css
/* Before */
padding: 28px 32px;
gap: 18px;
--board-size: min(480px, calc(100dvh - 260px));

/* After */
padding: 1.75rem 2rem;
gap: 1.125rem;
--board-size: min(30rem, calc(100dvh - 16.25rem));
```

---

### `.turn-plate`, `.turn-pip`, `.turn-text`, `.turn-sub`

```css
/* Before */
.turn-plate { gap: 14px; padding: 8px 16px; }
.turn-pip   { width: 14px; height: 14px; }
.turn-text  { font-size: 15px; }
.turn-sub   { font-size: 10.5px; }

/* After */
.turn-plate { gap: 0.875rem; padding: 0.5rem 1rem; }
.turn-pip   { width: 0.875rem; height: 0.875rem; }
.turn-text  { font-size: 0.9375rem; }
.turn-sub   { font-size: 0.65625rem; }
```

---

### `.board-mat`, `.board-mat::after`, `.board-container`

```css
/* Before */
.board-mat        { padding: 20px; }
.board-mat::after { inset: 8px; }
.board-container  { width: var(--board-size, 480px); height: var(--board-size, 480px); }

/* After */
.board-mat        { padding: 1.25rem; }
.board-mat::after { inset: 0.5rem; }
.board-container  { width: var(--board-size, 30rem); height: var(--board-size, 30rem); }
```

---

### `.meta-strip`, `.ico`

```css
/* Before */
.meta-strip { gap: 14px; font-size: 10.5px; max-width: calc(var(--board-size, 480px) + 40px); }
.meta-strip .lbl { font-size: 9.5px; }
.ico        { width: 22px; height: 22px; font-size: 11px; }

/* After */
.meta-strip { gap: 0.875rem; font-size: 0.65625rem; max-width: calc(var(--board-size, 30rem) + 2.5rem); }
.meta-strip .lbl { font-size: 0.59375rem; }
.ico        { width: 1.375rem; height: 1.375rem; font-size: 0.6875rem; }
```

Note: `.meta-strip .val { max-width: 340px }` stays in `px` — this is a **content** limit on
FEN string display, not a layout size that needs to scale.

---

### `.an-header`, `.an-title-row`, `.an-title`, `.an-stats`, `.breadcrumb`

```css
/* Before */
.an-header     { padding: 18px 26px 14px; }
.an-title-row  { gap: 12px; margin-bottom: 10px; }
.an-title      { font-size: 22px; }
.an-stats      { gap: 12px; font-size: 11px; }
.an-stats .num { font-size: 13px; }
.breadcrumb    { gap: 5px; font-size: 12px; }
.breadcrumb .sep { padding: 0 2px; }

/* After */
.an-header     { padding: 1.125rem 1.625rem 0.875rem; }
.an-title-row  { gap: 0.75rem; margin-bottom: 0.625rem; }
.an-title      { font-size: 1.375rem; }
.an-stats      { gap: 0.75rem; font-size: 0.6875rem; }
.an-stats .num { font-size: 0.8125rem; }
.breadcrumb    { gap: 0.3125rem; font-size: 0.75rem; }
.breadcrumb .sep { padding: 0 0.125rem; }
```

---

### `.tree-wrap`, `.move-tree`, `.tree-line`, `.move-token`

```css
/* Before */
.tree-wrap  { padding: 22px 26px; }
.move-tree  { font-size: 13.5px; }
.tree-line  { padding: 0 4px; margin: 0 -4px; }
.move-token { padding: 0 3px; margin: 0 -3px; }
.move-token.active { padding: 0 4px; }

/* After */
.tree-wrap  { padding: 1.375rem 1.625rem; }
.move-tree  { font-size: 0.84375rem; }
.tree-line  { padding: 0 0.25rem; margin: 0 -0.25rem; }
.move-token { padding: 0 0.1875rem; margin: 0 -0.1875rem; }
.move-token.active { padding: 0 0.25rem; }
```

---

### `.error-box`, `.result-bar`, `.result-verdict`, `.result-counts`

```css
/* Before */
.error-box      { padding: 6px 10px; margin: 6px 0 0; font-size: 13px; }
.result-bar     { padding: 10px 12px; }
.result-verdict { font-size: 13px; margin-bottom: 5px; }
.result-counts  { gap: 12px; font-size: 12px; }

/* After */
.error-box      { padding: 0.375rem 0.625rem; margin: 0.375rem 0 0; font-size: 0.8125rem; }
.result-bar     { padding: 0.625rem 0.75rem; }
.result-verdict { font-size: 0.8125rem; margin-bottom: 0.3125rem; }
.result-counts  { gap: 0.75rem; font-size: 0.75rem; }
```

---

### `.move-token.fixed` (margin-right only)

```css
/* Before */
.move-token.fixed { margin-right: 4px; }

/* After */
.move-token.fixed { margin-right: 0.25rem; }
```

All other properties in `.move-token.fixed`, `.move-token.fixed:hover`, and
`.move-token.fixed.active` stay exactly the same — the CSS layout guards check these selectors.

---

### `.an-footer`, `.rec-status`, `.rec-left`, `.rec-text`, `.legend`

```css
/* Before */
.an-footer  { padding: 14px 26px 18px; gap: 12px; }
.rec-status { gap: 12px; }
.rec-left   { gap: 10px; }
.rec-text   { font-size: 13px; }
.rec-text .src { font-size: 13px; padding: 1px 6px; }
.rec-text .arrow { padding: 0 4px; }
.legend     { gap: 12px; font-size: 10px; }
.legend .swatch { gap: 5px; }
.legend .dot    { width: 8px; height: 8px; }

/* After */
.an-footer  { padding: 0.875rem 1.625rem 1.125rem; gap: 0.75rem; }
.rec-status { gap: 0.75rem; }
.rec-left   { gap: 0.625rem; }
.rec-text   { font-size: 0.8125rem; }
.rec-text .src { font-size: 0.8125rem; padding: 1px 0.375rem; }
.rec-text .arrow { padding: 0 0.25rem; }
.legend     { gap: 0.75rem; font-size: 0.625rem; }
.legend .swatch { gap: 0.3125rem; }
.legend .dot    { width: 0.5rem; height: 0.5rem; }
```

---

### `.actions`, `.btn`, `.btn-primary`, `.kb-hints`, `.k`

```css
/* Before */
.actions    { gap: 10px; }
.btn        { padding: 11px 16px; font-size: 13px; gap: 7px; }
.btn .kbd   { font-size: 10px; padding: 1px 5px; }
.btn-primary { padding: 13px 20px; font-size: 13.5px; gap: 10px; }
.btn-primary .kbd { font-size: 10px; padding: 1px 5px; }
.kb-hints   { gap: 4px; }
.k          { min-width: 22px; height: 20px; padding: 0 5px; font-size: 10px; }
.kb-hints .lbl { font-size: 11px; margin-left: 6px; }

/* After */
.actions    { gap: 0.625rem; }
.btn        { padding: 0.6875rem 1rem; font-size: 0.8125rem; gap: 0.4375rem; }
.btn .kbd   { font-size: 0.625rem; padding: 1px 0.3125rem; }
.btn-primary { padding: 0.8125rem 1.25rem; font-size: 0.84375rem; gap: 0.625rem; }
.btn-primary .kbd { font-size: 0.625rem; padding: 1px 0.3125rem; }
.kb-hints   { gap: 0.25rem; }
.k          { min-width: 1.375rem; height: 1.25rem; padding: 0 0.3125rem; font-size: 0.625rem; }
.kb-hints .lbl { font-size: 0.6875rem; margin-left: 0.375rem; }
```

---

### `driver.js` overrides — **leave in `px`**

The `!important` driver.js overrides target a third-party component.
Their values are fine as-is; converting them to rem adds no value and risks confusion.

---

### `@media (max-width: 960px)` — simplified

```css
@media (max-width: 960px) {
  .panels {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .panel-board {
    padding: 1.5rem;
    --board-size: min(30rem, calc(100vw - 5.5rem));
    border-right: none;
    border-bottom: 1px solid rgba(31,29,26,.08);
  }
  /* board-container inherits --board-size — NO explicit width/height override */
  .panel-analysis { min-height: 20rem; }
}
```

Deleted lines:
```css
/* DELETED — no longer needed */
.board-container {
  width:  min(480px, calc(100vw - 80px));
  height: min(480px, calc(100vw - 80px));
}
```

---

### `@media (max-width: 600px)` — converted

```css
@media (max-width: 600px) {
  .app { height: auto; min-height: 100dvh; overflow: visible; }

  .app-header { padding: 0 1rem; height: 3rem; }
  .header-puzzle { display: none; }
  .header-nav    { display: none; }
  .brand-tagline { display: none; }

  .panels { grid-template-columns: 1fr; overflow: visible; }

  .panel-board {
    padding: 0.875rem 1rem;
    --board-size: min(23.75rem, calc(100vw - 3.25rem));
    justify-content: flex-start;
    gap: 0.75rem;
  }
  .board-mat        { padding: 0.625rem; }
  .board-mat::after { inset: 0.3125rem; }
  /* board-container inherits --board-size — NO explicit width/height override */
  .meta-strip { display: none; }
  .turn-plate { padding: 0.375rem 0.75rem; gap: 0.625rem; }
  .turn-text  { font-size: 0.875rem; }
  .turn-sub   { font-size: 0.625rem; }

  .panel-analysis { display: block; min-height: 0; }
  .an-header  { padding: 0.875rem 1rem 0.625rem; }
  .tree-wrap  { overflow: visible; padding: 1rem; min-height: 7.5rem; }
  .move-tree  { font-size: 0.9375rem; line-height: 2.4; }
  .move-token { padding: 2px 0.3125rem; margin: 0 -0.125rem; }
  /* 2px vertical kept as px — minimum touch-target height, avoids sub-pixel rounding */

  .an-footer  { padding: 0.75rem 1rem 1.25rem; gap: 0.625rem; }
  .kb-hints   { display: none; }
  .actions    { flex-wrap: wrap; }
  .btn-primary { flex: 1 0 100%; order: -1; }
  .btn         { flex: 1 1 auto; }
  .legend      { gap: 0.5rem; font-size: 0.5625rem; }
}
```

Deleted lines:
```css
/* DELETED — no longer needed */
.board-container {
  width:  min(380px, calc(100vw - 52px));
  height: min(380px, calc(100vw - 52px));
}
```

---

## What stays in `px`

| Value | Reason |
|-------|--------|
| `1px` border / outline widths | Physical hairline — converting to rem would make it 0 on low-DPI |
| `max-width: 340px` on `.meta-strip .val` | Content limit on FEN text — not a layout size |
| `box-shadow` offsets | Aesthetic detail; sub-pixel doesn't matter |
| `0 0 0 8px` in `@keyframes pulse` | Animation shimmer — physical feel, fine in px |
| `5px; height: 5px` on `.chip.theme::before` | Decorative dot — tiny, px is fine |
| `7px; height: 7px` on `.pulse` | Decorative dot — tiny, px is fine |
| `2px` vertical on `.move-token` in mobile | Touch-target minimum — prevents sub-pixel rounding artefacts |
| `driver.js !important` overrides | Third-party component — leave alone |

---

## Files changed

| File | Change |
|------|--------|
| `web/src/app/globals.css` | Rewrite layout `px` → `rem`, fluid `--board-size`, remove redundant `.board-container` overrides |

No TypeScript changes. No new tests.

---

## Test compatibility

| Suite | Impact |
|-------|--------|
| `cssLayoutGuards.test.ts` (6 tests) | None — guards check selector content / structure, not unit values |
| Vitest (127 tests) | None — CSS invisible to JSDOM |
| Playwright desktop (53 tests) | Safe — `30rem = 480px` at 16px root, so "board is 480×480" passes exactly |
| Playwright "short viewport" test (1280×600) | Safe — `min(30rem, calc(100dvh-16.25rem))` = `min(480, 340)` = 340px < 480 ✓ |
| Playwright mobile (9 tests) | Safe — `min(23.75rem, calc(100vw-3.25rem))` at 375px = 323px ≤ 375 ✓ |

**Total: 62/62 Playwright + 127/127 Vitest expected GREEN with zero test changes.**

---

## TDD sequence

### RED
Not applicable — no test changes. Run existing suite to confirm baseline before editing:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web
npx playwright test --retries=0
# Expect: 62/62
```

### GREEN
Apply CSS changes (full rewrite of `globals.css`):

```bash
npx playwright test --retries=1
# Expect: 62/62
npm test
# Expect: 127/127
```

### YELLOW
```bash
vercel --prod --cwd /home/aritra/Claude/chess-puzzle-trainer
# Expect: READY
```

---

## Summary

After this phase:
- **Zero layout `px` in the main CSS sections** (all converted to `rem`)
- **One fluid `--board-size` formula per breakpoint tier** — no scattered `.board-container`
  overrides in multiple media queries
- **The app fits every screen size automatically**, from a 320 px narrow phone to a 4K monitor,
  with no pixel arithmetic required
