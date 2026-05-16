# Phase 6.8.4 — Remove Board Coordinates

## Problem

Chessground's `coordinates: true` is the default. We never disabled it, so the board renders
`<coords class="ranks">` and `<coords class="files">` elements inside `.cg-wrap`.

The brown theme CSS styles these with alternating white/dark-gray colors (to contrast with
board squares), producing inconsistent visuals against the uniform paper/ink design system.
Font is `sans-serif 9px` — unrelated to the app's typeface.

Removing coordinates is also correct for the use case: visual board training benefits from a
clean board without labels — the player should orientate from the position, not the letters.

---

## Change — `web/src/components/PuzzleBoard.tsx`

One line added to the Chessground config:

```typescript
const config: Config = {
  fen,
  orientation,
  viewOnly:     true,
  coordinates:  false,          // ← ADD: disable rank/file labels
  animation:    { enabled: false },
  highlight:    { lastMove: !!lastMove, check: false },
  drawable:     { enabled: false },
  ...(lastMove && { lastMove: lastMove as Key[] }),
};
```

No other files change.

---

## Tests

### Playwright guard — `web/e2e/ui-layout.spec.ts`

Add one test that fails before the change (coords present) and passes after (coords absent):

```typescript
test('board renders without coordinate labels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cg-wrap coords')).toHaveCount(0)
})
```

**Why RED:** With `coordinates: true` (current default), Chessground renders two `<coords>`
elements — `.ranks` and `.files` — inside `.cg-wrap`. Count is 2, not 0 → FAIL ✓.

**After GREEN:** `coordinates: false` prevents Chessground from injecting those elements.
Count is 0 → PASS ✓.

No Vitest changes — `PuzzleBoard` is not unit-tested directly (Chessground is a DOM side-effect).

---

## TDD sequence

| Step | Action | Expected |
|------|--------|----------|
| RED | Add Playwright test | 1 failure — `toHaveCount(0)` fails (2 coords elements present) |
| GREEN | Add `coordinates: false` to Chessground config | Test passes |
| YELLOW | `npm test` + `npx playwright test --retries=1` | 119/119 Vitest, 16/16 Playwright |

**Test delta:**

| Suite | Before | Delta | After |
|-------|--------|-------|-------|
| `ui-layout.spec.ts` | 2 | +1 | 3 |
| Everything else | unchanged | — | — |
| **Vitest total** | 119 | 0 | 119 |
| **Playwright total** | 15 | +1 | 16 |
