# Phase 6.8.5 — First-Visit Tour Guide

## Goal

Show a welcome popup on the user's first visit.
If accepted, walk through the UI step-by-step with a spotlight highlight and a tooltip on each
element. If declined (or on every subsequent visit), do nothing.

---

## Library — Driver.js v1

```bash
npm install driver.js   # in web/
```

**Why Driver.js over alternatives:**

| Library | Size | Spotlight | TS support | Last release |
|---------|------|-----------|------------|--------------|
| Driver.js v1 | ~5 KB gzip | ✅ dark overlay + focus ring | ✅ first-class | Active |
| Intro.js | ~10 KB | ✅ | partial | Active |
| Shepherd.js | ~17 KB | ❌ (popover only) | ✅ | Active |
| Custom | 0 KB | manual CSS | — | — |

Driver.js creates the "circling" spotlight the user described: a semi-transparent dark overlay with
the target element cut out and a focus ring around it. Tooltip appears adjacent to the element.

---

## Persistence — localStorage

```typescript
const TOUR_KEY = 'visualis_tour_seen';

// First visit: key absent → show welcome popup
// After accept/decline: localStorage.setItem(TOUR_KEY, '1')
// Subsequent visits: key present → no popup, no tour
```

No server, no cookies. Resets automatically if the user clears site data (expected behaviour).

---

## Welcome Popup

A custom React modal — **not** Driver.js — so it gets full paper/ink styling before the tour begins.

```
┌─────────────────────────────────────────┐
│                                         │
│   Welcome to Visualis                   │
│                                         │
│   This trainer works differently from   │
│   other chess tools — the board never   │
│   moves. Want a quick 60-second tour?   │
│                                         │
│   [ Skip ]        [ Take the tour → ]   │
│                                         │
└─────────────────────────────────────────┘
```

- Appears centered, over a `backdrop-filter: blur(2px)` scrim
- Paper/ink palette: cream background, ink text, blue primary button
- Both buttons dismiss the popup and write `TOUR_KEY` to localStorage
- Only "Take the tour →" then starts the Driver.js sequence

---

## Tour Steps (8 stops)

Driver.js `driver.drive(steps)` — each step has `element`, `popover: { title, description, side }`.

| # | Element | Title | Key message |
|---|---------|-------|-------------|
| 1 | `.panel-board` | The frozen board | The board never moves — you visualize all lines in your head |
| 2 | `.board-mat` | Click to record | Click a source square then a destination square to record a move |
| 3 | `.panel-analysis` | Your move tree | Every move you record appears here as a text tree |
| 4 | `.move-token.fixed` | Setup move | This dark chip shows the last move played before the puzzle started |
| 5 | `.legend` | Colour coding | Blue = your moves, red = opponent moves, yellow highlight = your cursor |
| 6 | `.kb-hints` | Keyboard navigation | ← → walk depth · ↑ ↓ switch branches · click any token to jump |
| 7 | `.actions` | Undo & Reset | Made a wrong click? Undo removes the last move; Reset clears everything |
| 8 | `.btn-primary` | Submit & check | When your tree is ready, Submit sends it to Stockfish for evaluation |

The Driver.js popover is styled to match paper/ink via the CSS variables exposed by driver.js v1:
```css
--driver-popover-bg: var(--paper);
--driver-popover-border: 1px solid var(--ink-edge);
--driver-popover-border-radius: 6px;
--driver-overlay-color: rgba(30, 24, 18, 0.70);
```

A "replay tour" link can be added later in Settings — out of scope here.

---

## Files

| File | Action |
|------|--------|
| `web/package.json` | Add `driver.js` dependency |
| `web/src/components/TourGuide.tsx` | **CREATE** — welcome popup + Driver.js orchestration |
| `web/src/app/page.tsx` | **MODIFY** — mount `<TourGuide />` |
| `web/src/app/globals.css` | **MODIFY** — welcome modal styles + driver.js overrides |

No changes to `PuzzleGame.tsx`, `MoveTree.tsx`, or `PuzzleBoard.tsx`.

---

## `TourGuide.tsx` — component design

```typescript
'use client';
import { useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'visualis_tour_seen';

const STEPS = [
  {
    element: '.panel-board',
    popover: {
      title: 'The frozen board',
      description: 'The board never moves. Every line lives only in your head — that\'s the training.',
      side: 'right',
    },
  },
  {
    element: '.board-mat',
    popover: {
      title: 'Click to record a move',
      description: 'Click a source square, then a destination square. The pieces stay put.',
      side: 'right',
    },
  },
  {
    element: '.panel-analysis',
    popover: {
      title: 'Your move tree',
      description: 'Every move you record appears here. You can build branching lines.',
      side: 'left',
    },
  },
  {
    element: '.move-token.fixed',
    popover: {
      title: 'Setup move',
      description: 'This shows the last move played before the puzzle — your starting context.',
      side: 'bottom',
    },
  },
  {
    element: '.legend',
    popover: {
      title: 'Colour coding',
      description: 'Blue = your moves · Red = opponent · Yellow glow = your active cursor.',
      side: 'top',
    },
  },
  {
    element: '.kb-hints',
    popover: {
      title: 'Keyboard navigation',
      description: '← → walk depth · ↑ ↓ switch branches · click any token to jump directly.',
      side: 'top',
    },
  },
  {
    element: '.actions',
    popover: {
      title: 'Undo & Reset',
      description: 'Undo removes your last recorded move. Reset clears the whole tree.',
      side: 'top',
    },
  },
  {
    element: '.btn-primary',
    popover: {
      title: 'Submit & check',
      description: 'When your tree is complete, Submit runs Stockfish evaluation on every move.',
      side: 'top',
    },
  },
];

export default function TourGuide() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setShowPopup(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(TOUR_KEY, '1');
    setShowPopup(false);
  }

  function startTour() {
    dismiss();
    const driverInstance = driver({
      showProgress: true,
      steps: STEPS,
      onDestroyStarted: () => driverInstance.destroy(),
    });
    // Small delay so the popup fade-out completes before spotlight appears
    setTimeout(() => driverInstance.drive(), 300);
  }

  if (!showPopup) return null;

  return (
    <div className="tour-scrim">
      <div className="tour-popup" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <h2 id="tour-title" className="tour-popup-title">Welcome to Visualis</h2>
        <p className="tour-popup-body">
          This trainer works differently — the board never moves.
          You map out lines entirely in your head, then let the engine judge them.
          Want a quick 60-second tour?
        </p>
        <div className="tour-popup-actions">
          <button className="btn" onClick={dismiss}>Skip</button>
          <button className="btn-primary" onClick={startTour}>Take the tour →</button>
        </div>
      </div>
    </div>
  );
}
```

---

## CSS — `globals.css` additions

### Welcome modal

```css
/* Tour scrim */
.tour-scrim {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 24, 18, 0.45);
  backdrop-filter: blur(3px);
  animation: tour-fade-in 200ms ease;
}

@keyframes tour-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.tour-popup {
  background: var(--paper);
  border: 1px solid var(--ink-edge);
  border-radius: 8px;
  padding: 28px 32px;
  max-width: 420px;
  width: 90vw;
  box-shadow: 0 8px 32px rgba(30, 24, 18, 0.22);
}

.tour-popup-title {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--ink);
  margin: 0 0 12px;
}

.tour-popup-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-soft);
  margin: 0 0 24px;
}

.tour-popup-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
```

### Driver.js popover overrides

```css
/* Override driver.js defaults to match paper/ink theme */
.driver-popover {
  background: var(--paper) !important;
  border: 1px solid var(--ink-edge) !important;
  border-radius: 6px !important;
  color: var(--ink) !important;
  font-family: var(--font-body), sans-serif !important;
  box-shadow: 0 4px 16px rgba(30, 24, 18, 0.20) !important;
}

.driver-popover-title {
  font-family: var(--font-display) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  color: var(--ink) !important;
}

.driver-popover-description {
  font-size: 13px !important;
  color: var(--ink-soft) !important;
  line-height: 1.5 !important;
}

.driver-popover-progress-text {
  color: var(--ink-faint) !important;
  font-size: 11px !important;
}

.driver-popover-next-btn {
  background: var(--blue) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 4px !important;
  font-size: 12px !important;
}

.driver-popover-prev-btn {
  background: transparent !important;
  border: 1px solid var(--ink-edge) !important;
  color: var(--ink-soft) !important;
  border-radius: 4px !important;
  font-size: 12px !important;
}

.driver-overlay {
  background: rgba(30, 24, 18, 0.68) !important;
}
```

---

## `page.tsx` change

```tsx
import TourGuide from '@/components/TourGuide';

export default function Home() {
  return (
    <div className="app">
      <TourGuide />          {/* ← ADD */}
      <header ...>
      ...
    </div>
  );
}
```

---

## Tests

Driver.js involves real DOM spotlighting — not meaningful to test with Vitest/jsdom.
The welcome popup is testable:

### Vitest — `web/src/components/__tests__/TourGuide.test.tsx` (4 tests)

```
describe('TourGuide — welcome popup')
  ✓ popup renders when localStorage key is absent
  ✓ popup does not render when localStorage key is set
  ✓ clicking Skip sets localStorage key and removes popup
  ✓ clicking "Take the tour" sets localStorage key and removes popup
```

`driver.js` is mocked:
```typescript
vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({ drive: vi.fn(), destroy: vi.fn() })),
}));
```
No CSS import mocking needed (Vitest ignores `.css` imports by default in this project).

### No Playwright tests — the spotlight is a visual feature with no stable DOM selector to assert.

---

## TDD sequence

| Step | Action | Expected |
|------|--------|----------|
| RED | Write 4 Vitest tests | 4 fail (TourGuide.tsx doesn't exist) |
| GREEN | Implement TourGuide.tsx | 4 pass |
| YELLOW | `npm test` + `npx playwright test --retries=1` | 123/123 Vitest, all Playwright green |

**Test delta:**

| Suite | Before | Delta | After |
|-------|--------|-------|-------|
| `TourGuide.test.tsx` | 0 | +4 | 4 |
| All other Vitest | 119 | — | 119 |
| **Vitest total** | **119** | **+4** | **123** |
| **Playwright total** | **53** | **0** | **53** |
