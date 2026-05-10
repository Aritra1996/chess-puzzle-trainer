# Phase 3.2 — Layout Fix: Responsive Board Height

## Problem

At 100% zoom on a laptop (~650–700 px viewport height after browser chrome), the
meta-strip (FEN label, ⧉ copy, ⇅ flip buttons) below the board is hidden. The board
panel overflows the viewport and `.app { overflow: hidden }` clips the bottom.

Root cause: `.board-container { width: 480px; height: 480px }` is hardcoded. The fixed
480 px board plus surrounding chrome (~254 px) demands ~734 px — more than a typical
laptop viewport provides.

## Fix

### `web/src/app/globals.css`

Add a CSS custom property on `.panel-board` that computes the board size as the smaller
of 480 px or the available viewport height minus all fixed chrome:

```css
.panel-board {
  --board-size: min(480px, calc(100dvh - 260px));
}
```

Use the variable in `.board-container` (replaces hardcoded 480 px):

```css
.board-container {
  width:  var(--board-size, 480px);
  height: var(--board-size, 480px);
}
```

Sync `.meta-strip` max-width to the board-mat outer width:

```css
.meta-strip {
  max-width: calc(var(--board-size, 480px) + 40px);
}
```

**260 px constant breakdown:**

| Element | Height |
|---------|--------|
| `.app-header` | 56 px |
| `.panel-board` top + bottom padding | 56 px |
| `.turn-plate` | ~38 px |
| 2 × gap (18 px each) | 36 px |
| `.board-mat` top + bottom padding | 40 px |
| `.meta-strip` | ~28 px |
| **Total fixed** | **254 px** (+6 px safety = 260) |

### `web/playwright.config.ts`

Set an explicit viewport so the board stays at 480 px in tests:

```ts
viewport: { width: 1280, height: 800 },
// At 800 px: min(480, 800-260) = min(480, 540) = 480 px ✓
```

Without this, the default `Desktop Chrome` device (720 px tall) would produce a
460 px board and break the `"board container is 480×480 pixels"` E2E test.

## Result

- On a 700 px viewport: board shrinks to 440 px → total height 254+440 = 694 px < 700 px ✓
- On an 800 px viewport (tests): board stays at 480 px ✓
- On a tall desktop: board stays at 480 px (min caps it) ✓
