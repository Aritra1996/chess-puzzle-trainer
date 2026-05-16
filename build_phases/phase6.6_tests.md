# Phase 6.6 Tests — Layout Bug Guards

## Context

Phase 6.6 fixes two visual bugs introduced in Phase 6.5:

| Bug | Symptom | Fix |
|-----|---------|-----|
| **Bug 1** — duplicate "start" indicator | Breadcrumb `.here` pill + context token both show "▸ start" simultaneously | Remove `<span class="here">` from PuzzleGame breadcrumb |
| **Bug 2** — context token inline with tree line | `8. Bc4xd1  9. Kxd1` — context token flows onto same visual line as first tree line | Move `white-space: pre` from `.move-tree` to `.tree-line` |

Three tests cover these two bugs — two Vitest, one Playwright.

**Follows Red → Green → Yellow TDD.**

---

## Test files changed

**Vitest:**
- `web/src/components/__tests__/PuzzleGame.test.tsx` — +1 test (Bug 1)
- `web/src/lib/__tests__/cssLayoutGuards.test.ts` — **new file**, 1 test (Bug 2 source guard)

**Playwright E2E:**
- `web/e2e/ui-layout.spec.ts` — **new file**, 1 test (Bug 2 visual guard)

---

## 🔴 RED — Write tests before source changes

### 1 — `PuzzleGame.test.tsx`: breadcrumb `.here` check

Add at the end of the existing `describe('PuzzleGame — Undo / Reset', …)` block or as a
new describe:

```typescript
describe('PuzzleGame — breadcrumb', () => {
  it('breadcrumb does not render a .here element', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(container.querySelector('.breadcrumb .here')).toBeNull()
  })
})
```

**Fails at RED because:** `PuzzleGame` currently renders
`<span className="here">▸ start</span>` inside `.breadcrumb`, so
`querySelector('.breadcrumb .here')` returns an element, not null.

### 2 — `web/src/lib/__tests__/cssLayoutGuards.test.ts`: new file

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const CSS = path.resolve(__dirname, '../../../src/app/globals.css')

describe('CSS layout guards', () => {
  it('white-space: pre is on .tree-line, not .move-tree', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    // .move-tree rule block must NOT contain white-space
    const moveTreeBlock = src.match(/\.move-tree\s*\{[^}]*\}/)?.[0] ?? ''
    expect(moveTreeBlock).not.toBe('')           // rule must exist
    expect(moveTreeBlock).not.toContain('white-space')

    // .tree-line rule block MUST contain white-space: pre
    const treeLineBlock = src.match(/\.tree-line\s*\{[^}]*\}/)?.[0] ?? ''
    expect(treeLineBlock).not.toBe('')           // rule must exist
    expect(treeLineBlock).toContain('white-space: pre')
  })
})
```

**Fails at RED because:** The current `globals.css` has `white-space: pre` inside the
`.move-tree` rule block and `.tree-line` does not have it.

### 3 — `web/e2e/ui-layout.spec.ts`: new file

```typescript
import { test, expect } from '@playwright/test'

// Black orientation: x = (7 - file) * 60 + 30,  y = (rank - 1) * 60 + 30
const sq = (file: number, rank: number) => ({ x: (7 - file) * 60 + 30, y: (rank - 1) * 60 + 30 })

test.describe('Phase 6.6 — Tree Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('context token is on its own row, not inline with the first tree line', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })  // f6
    await board.click({ position: sq(3, 5) })  // d5 → Nd5

    const contextToken = page.locator('.move-token.fixed').first()
    const firstTreeLine = page.locator('.tree-line').first()

    await expect(contextToken).toBeVisible()
    await expect(firstTreeLine).toBeVisible()

    const tokenBox  = await contextToken.boundingBox()
    const lineBox   = await firstTreeLine.boundingBox()

    expect(tokenBox).not.toBeNull()
    expect(lineBox).not.toBeNull()

    // Context token's bottom edge must be at or above the tree line's top edge.
    // If they share a line, tokenBox.y ≈ lineBox.y → this assertion fails.
    expect(tokenBox!.y + tokenBox!.height).toBeLessThanOrEqual(lineBox!.y + 4)  // 4 px tolerance
  })
})
```

**Fails at RED because:** `white-space: pre` on `.move-tree` causes the inline `<span>`
context token to share a rendered line with the first `<div class="tree-line">`, so
`tokenBox.y` ≈ `lineBox.y` — the assertion `tokenBox.y + tokenBox.height ≤ lineBox.y + 4` fails.

---

## Why RED

| Test | File | Fails because |
|------|------|---------------|
| `breadcrumb does not render a .here element` | `PuzzleGame.test.tsx` | `.here` IS in the DOM before fix |
| `white-space: pre is on .tree-line, not .move-tree` | `cssLayoutGuards.test.ts` | `.move-tree` currently has `white-space: pre` |
| `context token is on its own row` | `ui-layout.spec.ts` | Inline flow: context token y ≈ tree-line y |

**Minimum RED: 2 Vitest failures, 1 Playwright failure.**
All 101 existing Vitest tests remain green.

Confirm:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 2 failed | 101 passed (103 total)
```

---

## 🟢 GREEN — Apply phase6.6.md source changes

Apply the three changes from `phase6.6.md`:

1. **`globals.css`** — remove `white-space: pre` from `.move-tree`, add it to `.tree-line`
2. **`globals.css`** — remove `.breadcrumb .here { … }` rule block
3. **`PuzzleGame.tsx`** — remove `<span className="here">▸ start</span>` from breadcrumb

Then verify:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 103/103 green (101 existing + 2 new)
```

For the Playwright test (requires dev server):
```bash
npx playwright test e2e/ui-layout.spec.ts
# Expect: 1/1 green
```

---

## 🟡 YELLOW — Regression guard

```bash
# Vitest
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 103/103 green

# Playwright (fast subset — no Stockfish)
npx playwright test e2e/ui-layout.spec.ts e2e/recording.spec.ts e2e/navigation.spec.ts
# Expect: all pass
```

Vitest tests that must stay green:

| Suite | Count |
|-------|-------|
| `PuzzleGame.test.tsx` — existing | 40 |
| `PuzzleGame.test.tsx` — new | 1 |
| `cssLayoutGuards.test.ts` — new | 1 |
| All other web tests | 61 |
| **Total** | **103** (was 101) |

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `PuzzleGame.test.tsx` | 40 | +1 | 41 |
| `cssLayoutGuards.test.ts` | 0 | +1 | 1 |
| All other Vitest | 61 | — | 61 |
| **Vitest total** | **101** | **+2** | **103** |
| `ui-layout.spec.ts` (Playwright) | 0 | +1 | 1 |
