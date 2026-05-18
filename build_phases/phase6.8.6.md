# Phase 6.8.6 — Fix Tour Popup Overlay

## Problem

The welcome popup renders as unstyled inline content at the top of the page (above the
header), with no dark scrim, no card background, and no centring. The buttons are styled
correctly because `.btn` / `.btn-primary` pre-date the tour and are in the browser cache.
The tour-specific rules (`.tour-scrim`, `.tour-popup`, etc.) were appended to `globals.css`
after the dev server was already running and were never picked up by Next.js's CSS pipeline
for this client component.

Root cause: In Next.js App Router, CSS class additions to `globals.css` for `'use client'`
components that render after hydration can miss the initial CSS bundle if the dev server has
a stale module graph. The result: `.tour-scrim`'s `position: fixed; inset: 0; background`
rules are not applied, so the div sits in normal document flow with no overlay.

---

## Fix

Move all layout-critical and visual styles on the scrim wrapper and popup card into React
`style` props. Inline styles bypass the CSS pipeline entirely — they are applied directly to
the DOM element and cannot be missed, cached out, or overridden by Tailwind utilities.

The change is **TourGuide.tsx only**. The CSS rules for `.tour-scrim`, `.tour-popup`,
`.tour-popup-title`, `.tour-popup-body`, and `.tour-popup-actions` are removed from
`globals.css` (they were not working anyway). The driver.js override rules stay in
`globals.css` — driver.js renders its own DOM after the user accepts the tour, and those
overrides work correctly.

---

## Files

| File | Change |
|------|--------|
| `web/src/components/TourGuide.tsx` | **MODIFY** — add `style` props to scrim + popup |
| `web/src/app/globals.css` | **MODIFY** — remove `.tour-scrim` / `.tour-popup*` blocks |

---

## `TourGuide.tsx` — inline style values

### Scrim wrapper

```tsx
<div
  className="tour-scrim"
  style={{
    position:       'fixed',
    inset:          0,
    zIndex:         10000,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(30, 24, 18, 0.52)',
    backdropFilter: 'blur(3px)',
  }}
>
```

Keep `className="tour-scrim"` for the `@keyframes tour-fade-in` animation — that rule
stays in `globals.css` because `@keyframes` are not affected by the hot-reload issue (they
are not tied to a selector) and the `animation` shorthand is safe in CSS even if the scrim
falls back to no animation.

### Popup card

```tsx
<div
  className="tour-popup"
  role="dialog"
  aria-modal="true"
  aria-labelledby="tour-title"
  style={{
    background:   'var(--paper)',
    border:       '1px solid rgba(31,29,26,.18)',
    borderRadius: '8px',
    padding:      '28px 32px',
    maxWidth:     '420px',
    width:        '90vw',
    boxShadow:    '0 8px 32px rgba(30, 24, 18, 0.22)',
  }}
>
```

### Title and body — use inline `style` too

```tsx
<h2
  id="tour-title"
  style={{
    fontFamily:  'var(--serif)',
    fontSize:    '20px',
    fontWeight:  600,
    color:       'var(--ink)',
    margin:      '0 0 12px',
  }}
>Welcome to Visualis</h2>

<p
  style={{
    fontFamily: 'var(--sans)',
    fontSize:   '14px',
    lineHeight: 1.65,
    color:      'var(--ink-soft)',
    margin:     '0 0 24px',
  }}
>
  This trainer works differently — the board never moves.
  You map out lines entirely in your head, then let the engine judge them.
  Want a quick 60-second tour?
</p>

<div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
  <button className="btn"         onClick={dismiss}>Skip</button>
  <button className="btn-primary" onClick={startTour}>Take the tour →</button>
</div>
```

Buttons keep their CSS classes — `.btn` and `.btn-primary` already work correctly.

---

## `globals.css` — what to remove

Delete the entire block from `/* ── Tour guide ── */` down to (but NOT including)
`/* driver.js popover overrides */`:

```css
/* ── Tour guide ── */
.tour-scrim { ... }
@keyframes tour-fade-in { ... }
.tour-popup { ... }
.tour-popup-title { ... }
.tour-popup-body { ... }
.tour-popup-actions { ... }
```

Keep:
- `@keyframes tour-fade-in` — keep it; the `animation` on the scrim class still works
  via the CSS file for the fade-in effect (bonus, not critical)
- All `/* driver.js popover overrides */` rules — these work fine

So the actual removal is just the selector blocks (not the keyframe).

---

## Manual verification steps

After implementing, clear localStorage to force the popup to show:

```javascript
// Browser DevTools console:
localStorage.removeItem('visualis_tour_seen'); location.reload();
```

Expected result:
1. Page loads with a dark semi-transparent overlay (whole viewport dimmed)
2. Popup card appears centred — cream background, thin border, title + body text + buttons
3. "Skip" closes the popup immediately
4. "Take the tour →" closes the popup then starts the Driver.js spotlight sequence

---

## Tests

No test changes. The 5 Vitest tests in `TourGuide.test.tsx` cover behaviour (localStorage,
button clicks, `driver().drive()` timing) — not visual styles. All 5 stay GREEN.

**Test delta: 0 new, 0 modified. 124/124 Vitest, 53/53 Playwright unchanged.**
