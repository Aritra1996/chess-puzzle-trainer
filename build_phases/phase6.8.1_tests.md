# Phase 6.8.1 — Test Plan: Inline Context Token

## Overview

Three test files change. Two unit/guard files gain new or updated assertions that go RED before
implementation. One Playwright spec has its single test replaced.

Total tests: **113 → 115 Vitest**, **14 → 14 Playwright** (1 replaced, not added).

---

## RED phase — what to write before touching source

### 1. `web/src/lib/__tests__/cssLayoutGuards.test.ts` — MODIFY 1 test

**Current test (line 21-27) — describes OLD behaviour; will be updated:**
```typescript
it('move-token.fixed has display: block to stay in block flow', () => {
  const src = fs.readFileSync(CSS, 'utf8')
  const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
  expect(fixedBlock).not.toBe('')
  expect(fixedBlock).toContain('display: block')       // ← guards the old block layout
})
```

**Replace with (new invariant: Tailwind override, not block layout):**
```typescript
it('move-token.fixed has position: static to override Tailwind position:fixed', () => {
  const src = fs.readFileSync(CSS, 'utf8')
  const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
  expect(fixedBlock).not.toBe('')
  expect(fixedBlock).toContain('position: static')     // CRITICAL Tailwind override must remain
  expect(fixedBlock).not.toContain('display: block')   // must NOT revert to standalone block
})
```

**Why RED:**
- Current CSS has `display: block` → `not.toContain('display: block')` FAILS immediately.
- `position: static` is already in the CSS → first assertion passes. The second fails → RED ✓.

**After GREEN:**
- CSS changes to `display: inline`, removes `display: block` → both assertions pass ✓.

---

### 2. `web/src/components/__tests__/MoveTree.test.tsx` — ADD 2 tests

Add to the existing `describe('MoveTree — context token')` block:

```typescript
it('context token is the first child inside the first .tree-line, not a sibling above it', () => {
  render(<MoveTree lines={[PLAYER_LINE]} rootNodeId="root-1" isAtRoot={false} />)
  const firstLine = document.querySelector('.tree-line')
  expect(firstLine).not.toBeNull()
  const fixedInsideLine = firstLine!.querySelector('.move-token.fixed')
  expect(fixedInsideLine).not.toBeNull()
})

it('renders exactly one .tree-line when lines is empty and rootNodeId is set', () => {
  render(<MoveTree lines={[]} rootNodeId="root-1" isAtRoot={false} />)
  expect(document.querySelectorAll('.tree-line')).toHaveLength(1)
})
```

**Why RED:**

Test 1 — *context token inside first tree-line:*
Current `MoveTree.tsx` renders the context `<span>` as a **direct child of `.move-tree`**, not
inside any `.tree-line`. So `firstLine.querySelector('.move-token.fixed')` returns null → FAILS ✓.

Test 2 — *one tree-line when empty:*
Current code renders the context span and then `{lines.map(...)}` — no `.tree-line` when
`lines=[]`. `querySelectorAll('.tree-line')` returns 0 elements → FAILS ✓.

**After GREEN:**
Both tests pass because the context token is now the first child of the first `.tree-line`,
and an empty `lines` array still produces one synthetic `.tree-line` containing the context token.

**Existing context-token tests — all continue GREEN throughout:**

| Test | Why it still passes |
|------|---------------------|
| renders "▸ start" when no lastMoveLabel | button is still in the DOM, still has the text |
| renders lastMoveLabel when provided | same |
| context token visible when lines is empty | button rendered inside synthetic tree-line |
| active class when isAtRoot is true | class applied on the span itself, location irrelevant |
| no active class when isAtRoot is false | same |
| clicking context token calls onTokenClick | handler attached to the same span |

None of these tests assert anything about the token's position relative to `.tree-line`, so
they survive the structural refactor unchanged.

---

### 3. `web/e2e/ui-layout.spec.ts` — REPLACE existing test

The current test (`context token is on its own row, not inline with the first tree line`) is now
the **inverse** of what we want. Delete it entirely and replace with:

```typescript
test('context token and first recorded move are on the same row', async ({ page }) => {
  const board = page.locator('.board-container')
  await board.click({ position: sq(5, 6) })  // f6
  await board.click({ position: sq(3, 5) })  // d5 → Nd5

  const contextToken   = page.locator('.move-token.fixed').first()
  const firstMoveToken = page.locator('.move-token.player').first()

  await expect(contextToken).toBeVisible()
  await expect(firstMoveToken).toBeVisible()

  const tokenBox = await contextToken.boundingBox()
  const moveBox  = await firstMoveToken.boundingBox()

  expect(tokenBox).not.toBeNull()
  expect(moveBox).not.toBeNull()

  // Inline layout: both tokens share the same text baseline.
  // Their top edges must be within 8 px of each other.
  expect(Math.abs(tokenBox!.y - moveBox!.y)).toBeLessThanOrEqual(8)
})
```

**Why RED:**
Before the CSS/component change, the context token is a separate block above the tree lines.
Its `y + height ≈ lineBox.y` — the two elements are vertically stacked, so
`Math.abs(tokenBox.y - moveBox.y)` is roughly equal to one line height (~28 px) → FAILS ✓.

**After GREEN:**
Both elements are inline inside the same `.tree-line`, sharing the same row →
`Math.abs(tokenBox.y - moveBox.y) ≤ 8` → PASSES ✓.

---

## Existing tests that must stay GREEN throughout

### Vitest (no changes)

| File | Test | Why safe |
|------|------|----------|
| `cssLayoutGuards.test.ts` | white-space guard | doesn't touch `.move-token.fixed` |
| `MoveTree.test.tsx` — base | all 8 tests | test `player`/`opponent`/`connector` segments, none of which are affected |
| `MoveTree.test.tsx` — token titles | all 5 tests | test `title` attribute on segments, unaffected |
| `PuzzleGame.test.tsx` | all 37 tests | `MoveTree` is mocked; structural change is invisible |
| All other Vitest files | all tests | unrelated to this phase |

### Playwright (no changes to these files)

| File | Concern | Why safe |
|------|---------|----------|
| `navigation.spec.ts` — initial state | checks `.move-token.fixed` is visible | token is still visible, now inside a tree-line |
| `navigation.spec.ts` — ArrowLeft | checks `.move-token.player.active` count = 0 at root | fixed token gets `active` but is `.fixed`, not `.player` — count stays 0 |
| `navigation.spec.ts` — clicking Nd5 | checks `.move-token.active` has text Nd5 | cursor is NOT at root so `.move-token.fixed` is not active; only Nd5 matches |
| `recording.spec.ts` — all | none check token DOM position | all use `.move-token.player` / element counts |

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `cssLayoutGuards.test.ts` | 2 | 0 (1 updated) | 2 |
| `MoveTree.test.tsx` | 19 | +2 | 21 |
| `PuzzleGame.test.tsx` | 37 | — | 37 |
| All other web Vitest | 55 | — | 55 |
| **Web total** | **113** | **+2** | **115** |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| `ui-layout.spec.ts` | 1 | 0 (1 replaced) | 1 |
| `navigation.spec.ts` | 4 | — | 4 |
| `recording.spec.ts` | 8 | — | 8 |
| `solution.spec.ts` | 1 | — | 1 |
| **E2E total** | **14** | **0** | **14** |

---

## TDD sequence

### RED
1. Update `cssLayoutGuards.test.ts`: replace `display: block` test with `position: static` guard.
2. Add 2 structural tests to `MoveTree.test.tsx` inside `describe('MoveTree — context token')`.
3. Replace the `ui-layout.spec.ts` test (delete old, add new same-row test).
4. Verify RED:
   ```bash
   # Vitest — expect 2 failures: layout guard + 2 MoveTree structural
   npm test -- --reporter=verbose 2>&1 | grep -E 'FAIL|✓|×'
   # Playwright — expect 1 failure: ui-layout same-row test
   npx playwright test e2e/ui-layout.spec.ts --reporter=line
   ```

### GREEN
5. Update `web/src/app/globals.css` — replace `.move-token.fixed` block (inline style, keep `position: static`).
6. Rewrite `web/src/components/MoveTree.tsx` — context token inline in first tree-line.
7. Verify GREEN:
   ```bash
   npm test -- --reporter=verbose
   # Expect: 115/115
   npx playwright test e2e/ui-layout.spec.ts --reporter=line
   # Expect: 1/1
   ```

### YELLOW (regression guard)
8. Run full suite:
   ```bash
   npm test
   npx playwright test --retries=1
   ```
   Expected: **115/115 Vitest, 14/14 Playwright**.
