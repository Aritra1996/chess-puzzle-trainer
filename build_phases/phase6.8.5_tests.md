# Phase 6.8.5 — Test Plan: First-Visit Tour Guide

## Overview

Phase 6.8.5 introduces one new component (`TourGuide.tsx`) and two non-functional file edits
(`page.tsx` adds `<TourGuide />`, `globals.css` adds CSS rules). The Driver.js spotlight is a
browser-visual side-effect — not meaningful to unit-test. The welcome popup logic is fully
testable.

| File | Change | Delta |
|------|--------|-------|
| `TourGuide.test.tsx` | **CREATE** — 5 tests | +5 Vitest |
| All other test files | Unchanged | — |
| Playwright | No new tests | — |

**Total: 119 → 124 Vitest (+5), 53 Playwright (unchanged)**

---

## Files changed — test impact

| File | Test impact |
|------|-------------|
| `src/components/TourGuide.tsx` | New — needs its own test file |
| `src/app/page.tsx` | Adds `<TourGuide />` — Next.js page; not Vitest-tested directly |
| `src/app/globals.css` | CSS only — no test impact |
| `package.json` | Adds `driver.js` dep — no test impact |

---

## Mock strategy

### `driver.js`

Driver.js uses browser-only APIs (`document.querySelectorAll`, `getBoundingClientRect`,
canvas-style overlay) that jsdom does not implement. It must be mocked at the module level.

```typescript
vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({
    drive:   vi.fn(),
    destroy: vi.fn(),
  })),
}))
```

The CSS import `'driver.js/dist/driver.css'` inside `TourGuide.tsx` is handled by Vite's CSS
pipeline — in jsdom test runs it resolves to an empty module and never throws.

### `localStorage`

jsdom provides `localStorage` automatically. Clear between tests to prevent state bleed:

```typescript
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
```

---

## Timing — `useEffect` + `setTimeout`

`TourGuide` sets `showPopup` inside a `useEffect`:

```typescript
useEffect(() => {
  if (!localStorage.getItem(TOUR_KEY)) setShowPopup(true)
}, [])
```

React Testing Library's `render` flushes effects synchronously when wrapped in `act`. All
assertions on popup visibility must come after `render` (RTL wraps render in `act`
automatically). No extra `act` calls needed for this pattern.

The `startTour` function uses `setTimeout(..., 300)` before calling `driver.drive()`. Use
`vi.useFakeTimers()` in the "Take the tour" test to advance past the delay without waiting.

---

## Test file — `web/src/components/__tests__/TourGuide.test.tsx`

### Full file

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { driver as mockDriver } from 'driver.js'

vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({
    drive:   vi.fn(),
    destroy: vi.fn(),
  })),
}))

const TOUR_KEY = 'visualis_tour_seen'

// Dynamic import so the vi.mock above is in scope before module evaluation
const { default: TourGuide } = await import('../TourGuide')

describe('TourGuide — welcome popup', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders the popup when the localStorage key is absent', () => {
    render(<TourGuide />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/welcome to visualis/i)).toBeInTheDocument()
  })

  it('does not render the popup when the localStorage key is already set', () => {
    localStorage.setItem(TOUR_KEY, '1')
    render(<TourGuide />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Skip button writes the localStorage key and removes the popup', () => {
    render(<TourGuide />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(localStorage.getItem(TOUR_KEY)).toBe('1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Take the tour" button writes the localStorage key and removes the popup', () => {
    vi.useFakeTimers()
    render(<TourGuide />)
    fireEvent.click(screen.getByRole('button', { name: /take the tour/i }))
    expect(localStorage.getItem(TOUR_KEY)).toBe('1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('"Take the tour" button calls driver().drive() after the popup closes', () => {
    vi.useFakeTimers()
    render(<TourGuide />)
    fireEvent.click(screen.getByRole('button', { name: /take the tour/i }))

    const instance = (mockDriver as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.drive).not.toHaveBeenCalled()   // not yet — delay pending

    vi.advanceTimersByTime(300)
    expect(instance.drive).toHaveBeenCalledOnce()

    vi.useRealTimers()
  })
})
```

### Why 5 tests instead of 4

The plan sketched 4 tests but omitted the most important guard: confirming that `drive()` is
only called *after* the 300 ms delay (not immediately, not never). Test 5 catches an off-by-one
in the `setTimeout` or a missing `driverInstance.drive()` call. Adding it costs nothing and
prevents a class of "tour never starts" regressions.

---

## Existing tests — all stay GREEN

### Why no existing Vitest test is affected

| Test file | Reason safe |
|-----------|-------------|
| `PuzzleGame.test.tsx` | Does not render `page.tsx`; `TourGuide` is not mounted |
| `MoveTree.test.tsx` | No relationship to `TourGuide` |
| `PuzzleBoard.test.tsx` | No relationship to `TourGuide` |
| `cssLayoutGuards.test.ts` | Reads `globals.css` text — new `.tour-*` rules are additions, no existing rule changes |
| `chessEngine*.test.ts` | No relationship |
| `solutionChecker.test.ts` | Shared module, no relationship |

### Why no existing Playwright test is affected

`TourGuide` writes and reads `localStorage`. Playwright tests navigate to `/` in a fresh
browser context — `localStorage` is empty. The popup will appear, but existing specs do not
assert on `.tour-scrim` or any dialog, so they are unaffected.

If the popup blocks clicks on the board (it is `position: fixed; z-index: 1000`), recording
tests could fail. The popup must be dismissed before recording tests interact with the board.

**Guard:** Add a `beforeEach` dismiss to any spec that clicks the board:

```typescript
// In recording.spec.ts and navigation.spec.ts beforeEach:
await page.evaluate(() => localStorage.setItem('visualis_tour_seen', '1'))
```

This must be done **before** `page.goto('/')` so the component reads the key on mount.

**Affected Playwright files:**

| File | Change | Reason |
|------|--------|--------|
| `e2e/recording.spec.ts` | Add localStorage pre-set in `beforeEach` | Board clicks could be blocked by popup |
| `e2e/navigation.spec.ts` | Add localStorage pre-set in `beforeEach` | Same — records moves to test navigation |
| `e2e/solution.spec.ts` | Add localStorage pre-set in `beforeEach` | Submit flow interacts with board |
| `e2e/ui-layout.spec.ts` | Add localStorage pre-set in `beforeEach` | Board click in same-row test |
| `e2e/board.spec.ts` | Add localStorage pre-set in `beforeEach` | Clicks all over the board |
| `e2e/ui.spec.ts` | No change needed | Only asserts on static text/elements; no board clicks |

Pattern for all affected specs:

```typescript
test.beforeEach(async ({ page }) => {
  // Suppress the first-visit tour popup so it does not block board clicks
  await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
  await page.goto('/')
})
```

`addInitScript` runs before any page script, including React hydration — the `useEffect` reads
`'1'` and `setShowPopup` is never called. This is more reliable than `page.evaluate` after
`goto` (which could race with hydration).

---

## TDD sequence

### RED

1. Create `web/src/components/__tests__/TourGuide.test.tsx` with all 5 tests.
2. Verify:
   ```bash
   cd web && npm test -- --reporter=verbose TourGuide
   # Expect: 5 failures — cannot find module '../TourGuide'
   ```

### GREEN

3. Implement `TourGuide.tsx`.
4. Verify:
   ```bash
   npm test -- --reporter=verbose TourGuide
   # Expect: 5/5 green
   ```

### YELLOW

5. Full suite:
   ```bash
   npm test
   # Expect: 124/124 Vitest

   npx playwright test --retries=1
   # Expect: all Playwright green (with beforeEach localStorage pre-sets in place)
   ```

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `TourGuide.test.tsx` | 0 | +5 | 5 |
| All other files | 119 | — | 119 |
| **Total** | **119** | **+5** | **124** |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| `recording.spec.ts` | — | update `beforeEach` | — |
| `navigation.spec.ts` | — | update `beforeEach` | — |
| `solution.spec.ts` | — | update `beforeEach` | — |
| `ui-layout.spec.ts` | — | update `beforeEach` | — |
| `board.spec.ts` | — | update `beforeEach` | — |
| **Test count** | **53** | **0** | **53** |
