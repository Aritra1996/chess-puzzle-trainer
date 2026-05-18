# Phase 6.8.6 — Test Plan: Fix Tour Popup Overlay

## Overview

Phase 6.8.6 is a CSS-to-inline-style refactor:
- **`TourGuide.tsx`**: adds `style` props to the scrim and popup elements
- **`globals.css`**: removes the `.tour-scrim` / `.tour-popup*` selector blocks

The existing 5 `TourGuide.test.tsx` tests cover behaviour only (localStorage, button clicks,
`driver().drive()` timing) — none of them test how styles are applied — so they all stay
GREEN without modification.

Two new tests form a regression guard: one confirms the CSS selector was removed, the other
confirms the inline style is present. Together they prevent the broken CSS-based approach from
being silently re-introduced.

| File | Change | Delta |
|------|--------|-------|
| `cssLayoutGuards.test.ts` | +1 guard — `.tour-scrim` absent from globals.css | +1 Vitest |
| `TourGuide.test.tsx` | +1 guard — scrim has `position: fixed` as inline style | +1 Vitest |
| All other test files | Unchanged | — |

**Total: 124 → 126 Vitest (+2), 53 Playwright (unchanged)**

---

## Why these two tests and not just one

A single CSS-absence guard (`expect(src).not.toMatch(/\.tour-scrim/)`) would pass even if
someone removed the CSS rule but forgot to add the inline style. A single inline-style guard
would pass even if someone left the CSS rule in and *also* added the inline style (doubled-up
approach, fragile). Together they enforce the correct end state:

> CSS rule absent **AND** inline style present.

---

## New test 1 — `cssLayoutGuards.test.ts`

**Guard:** `.tour-scrim` selector must not exist in `globals.css`.

```typescript
it('.tour-scrim overlay uses inline styles — selector must not exist in globals.css', () => {
  const src = fs.readFileSync(CSS, 'utf8')
  // The scrim is positioned via React inline style props (TourGuide.tsx).
  // If a CSS selector is added here it silently fails in Next.js dev mode.
  expect(src).not.toMatch(/\.tour-scrim\s*\{/)
})
```

**Why RED (before fix):**
`globals.css` currently contains `.tour-scrim { position: fixed; ... }` — the regex matches
→ `not.toMatch` fails → RED ✓.

**Why GREEN (after fix):**
The selector block is deleted from `globals.css` → no match → passes ✓.

---

## New test 2 — `TourGuide.test.tsx`

**Guard:** The scrim wrapper element has `position: fixed` as an **inline** style.

```typescript
it('scrim wrapper has position fixed as an inline style', () => {
  render(<TourGuide />)
  const scrim = screen.getByRole('dialog').parentElement!
  expect(scrim).toHaveStyle({ position: 'fixed' })
})
```

`toHaveStyle` from `@testing-library/jest-dom` checks the element's `style` attribute
(inline styles), not computed styles from stylesheets. jsdom does not apply CSS class rules,
so this assertion only passes when `position: fixed` is set via a `style` prop.

**Why RED (before fix):**
The current scrim div has no `style` prop — `position: fixed` comes from the CSS class that
jsdom ignores → `toHaveStyle({ position: 'fixed' })` fails → RED ✓.

**Why GREEN (after fix):**
The scrim div gets `style={{ position: 'fixed', ... }}` → inline style is present →
`toHaveStyle` passes ✓.

---

## Existing tests — all stay GREEN

### `TourGuide.test.tsx` (5 existing)

| Test | Why unaffected |
|------|----------------|
| popup renders when key absent | Checks `role="dialog"` — stays on the popup div |
| popup hidden when key is set | Same selector |
| Skip writes localStorage + removes popup | Tests click + state, not styles |
| "Take the tour" writes localStorage + removes popup | Same |
| `driver().drive()` called after 300 ms | Tests setTimeout + mock call, not styles |

### `cssLayoutGuards.test.ts` (4 existing)

| Test | Why unaffected |
|------|----------------|
| white-space: pre on .tree-line | Checks `.tree-line` block — unrelated |
| position: static on .move-token.fixed | Checks `.move-token.fixed` block — unrelated |
| background on .move-token.fixed | Same |
| animation: none on .move-token.fixed.active | Same |

The removed tour CSS blocks don't overlap with any of these selectors.

### Playwright (53 tests)

All 53 tests already suppress the popup via `addInitScript` (set in Phase 6.8.5). The visual
fix in 6.8.6 doesn't change any Playwright-visible DOM structure — `role="dialog"` remains on
the popup div, localStorage behaviour is identical.

---

## TDD sequence

### RED
1. Add both new tests to their respective files.
2. Verify:
   ```bash
   npx vitest run src/lib/__tests__/cssLayoutGuards.test.ts src/components/__tests__/TourGuide.test.tsx --reporter=verbose
   # Expect: 2 failures (1 in each file), 9 passes
   ```

### GREEN
3. Implement `TourGuide.tsx` with inline styles and remove CSS selectors from `globals.css`.
4. Verify:
   ```bash
   npx vitest run src/lib/__tests__/cssLayoutGuards.test.ts src/components/__tests__/TourGuide.test.tsx --reporter=verbose
   # Expect: 11/11 passes
   ```

### YELLOW
5. Full suite:
   ```bash
   npm test
   # Expect: 126/126 Vitest

   npx playwright test --retries=1
   # Expect: all 53 Playwright green
   ```

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `cssLayoutGuards.test.ts` | 4 | +1 | 5 |
| `TourGuide.test.tsx` | 5 | +1 | 6 |
| All other files | 115 | — | 115 |
| **Total** | **124** | **+2** | **126** |

### Playwright

| Suite | Before | Delta | After |
|-------|--------|-------|-------|
| All specs | 53 | 0 | 53 |
