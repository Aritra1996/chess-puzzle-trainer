# Phase 6.7 Tests — Block-Level Display Guard

## Why Phase 6.6 Tests Did Not Catch This

Two test gaps allowed the visual bug to survive GREEN:

### Gap 1 — CSS guard was too narrow

`cssLayoutGuards.test.ts` only asserted that `white-space: pre` moved from `.move-tree` to
`.tree-line`. It said nothing about how the context token should be displayed. When
`display: inline-block` was written (insufficient), the guard passed because `white-space: pre`
was in the right place.

**Fix:** Add a guard that asserts `.move-token.fixed` has `display: block`.

### Gap 2 — Playwright test was never executed at GREEN

The implementation step only ran `npm test` (Vitest). The Playwright E2E test in
`ui-layout.spec.ts` was written but never run as part of the GREEN verification. Had it been
run, it would still have missed the empty-tree case because:

- The existing test records a move first, then checks context token vs `.tree-line`
- An empty tree has no `.tree-line` elements — the test cannot run the assertion
- The real bug was context token inline with `.token-legend`, not with a tree line

**Fix:** Add a Playwright test that checks context token vs legend bounding box *without*
recording any moves (empty tree state).

---

## Test files changed

**Vitest:**
- `web/src/lib/__tests__/cssLayoutGuards.test.ts` — +1 test (display: block guard)

**Playwright E2E:**
- `web/e2e/ui-layout.spec.ts` — +1 test (context token above legend, empty tree)

---

## 🔴 RED — Write tests before source changes

### 1 — `cssLayoutGuards.test.ts`: add display guard

Add to the existing `describe('CSS layout guards', …)` block:

```typescript
it('move-token.fixed has display: block to prevent inline flow with legend', () => {
  const src = fs.readFileSync(CSS, 'utf8')

  const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
  expect(fixedBlock).not.toBe('')
  expect(fixedBlock).toContain('display: block')
})
```

**Fails at RED because:** `.move-token.fixed` currently has `display: inline-block`, so
`toContain('display: block')` fails (`inline-block` contains the substring `block`, BUT the
full value `inline-block` ≠ `block`).

Wait — `'display: inline-block'.includes('display: block')` is `false` because the full
string is `display: inline-block`, not `display: block`. The substring `display: block`
does not appear literally in `display: inline-block`. ✓ The test fails correctly at RED.

### 2 — `ui-layout.spec.ts`: add empty-tree legend layout test

Add inside the existing `test.describe('Phase 6.6 — Tree Layout', …)` block:

```typescript
test('context token is on its own row above the legend (empty tree)', async ({ page }) => {
  // No moves recorded — tests the critical empty-tree case
  const contextToken = page.locator('.move-token.fixed').first()
  const legend       = page.locator('.token-legend')

  await expect(contextToken).toBeVisible()
  await expect(legend).toBeVisible()

  const tokenBox  = await contextToken.boundingBox()
  const legendBox = await legend.boundingBox()

  expect(tokenBox).not.toBeNull()
  expect(legendBox).not.toBeNull()

  // Context token's bottom edge must be at or above the legend's top edge.
  // If they share a line (inline-block bug), tokenBox.y ≈ legendBox.y → fails.
  expect(tokenBox!.y + tokenBox!.height).toBeLessThanOrEqual(legendBox!.y + 4)
})
```

**Fails at RED because:** With `display: inline-block`, the context token flows inline with
the legend. `tokenBox.y ≈ legendBox.y`, so
`tokenBox.y + tokenBox.height > legendBox.y + 4` and the assertion fails.

---

## Why RED

| Test | File | Fails because |
|------|------|---------------|
| `move-token.fixed has display: block` | `cssLayoutGuards.test.ts` | `.move-token.fixed` has `inline-block`, not `block` |
| `context token above legend (empty tree)` | `ui-layout.spec.ts` | `inline-block` causes inline flow; token y ≈ legend y |

**Minimum RED: 1 Vitest failure, 1 Playwright failure.**
All 103 existing Vitest tests remain green.

Confirm:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 1 failed | 103 passed (104 total)
```

---

## 🟢 GREEN — Apply phase6.7.md source change

Single change: in `globals.css`, replace `display: inline-block` with `display: block` inside
`.move-token.fixed { … }`.

Verify Vitest:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 104/104 green
```

Verify Playwright:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npx playwright test e2e/ui-layout.spec.ts
# Expect: 2/2 green (existing test + new empty-tree test)
```

---

## 🟡 YELLOW — Regression guard

```bash
# Vitest
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 104/104 green

# Playwright layout suite
npx playwright test e2e/ui-layout.spec.ts e2e/recording.spec.ts e2e/navigation.spec.ts
# Expect: all pass
```

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `cssLayoutGuards.test.ts` | 1 | +1 | 2 |
| All other Vitest | 103 | — | 103 |
| **Vitest total** | **103** | **+1** | **104** |
| `ui-layout.spec.ts` (Playwright) | 1 | +1 | 2 |

---

## Lesson: what these guards protect against

| Guard | Prevents |
|-------|----------|
| `white-space: pre` on `.tree-line` (not `.move-tree`) | Reverting `pre` to the container, causing context token + tree line to share a line |
| `display: block` on `.move-token.fixed` | Setting `inline-block` or removing `display`, causing context token + legend to share a line |
| Playwright: token above `.tree-line` | Inline flow when moves are recorded |
| Playwright: token above `.token-legend` | Inline flow in empty-tree state (the gap this phase fills) |
