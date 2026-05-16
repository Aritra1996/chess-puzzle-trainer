# Phase 6.8.2 — Test Plan: Dark Chip Style

## Overview

Phase 6.8.2 is a CSS-only change. No component code changes, no DOM structure changes.
Two new CSS rules are added, one is modified.

The existing 2 guards in `cssLayoutGuards.test.ts` both stay green — they test invariants
(`position: static`, `not display: block`) that are unchanged.

Two new guards are worth adding to protect the dark chip design from accidental regression:
1. `.move-token.fixed` has a background (dark chip must not silently lose its background)
2. `.move-token.fixed.active` suppresses cursor-pulse (must not reintroduce the yellow-bg pulse on the dark chip)

Both guards fail before implementation → proper RED state.

Total test delta: **+2 Vitest** (both in `cssLayoutGuards.test.ts`), **0 Playwright**.

---

## RED phase — tests to write before touching CSS

### `web/src/lib/__tests__/cssLayoutGuards.test.ts` — ADD 2 tests

Append both to the existing `describe('CSS layout guards')` block.

---

#### Guard 1: dark chip background must be present

```typescript
it('move-token.fixed has a dark background chip (must not revert to transparent)', () => {
  const src = fs.readFileSync(CSS, 'utf8')

  const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
  expect(fixedBlock).not.toBe('')
  expect(fixedBlock).toContain('background:')   // dark chip must have a background
  expect(fixedBlock).not.toContain('opacity: 0.80')  // faded ghost must not return
})
```

**Why RED:** Current `.move-token.fixed` block has no `background:` property (and has
`opacity: 0.80`). Both assertions fail immediately → RED ✓.

**After GREEN:** CSS adds `background: #2b2825` and removes `opacity: 0.80` → both pass ✓.

---

#### Guard 2: `.move-token.fixed.active` rule must exist and suppress animation

```typescript
it('move-token.fixed.active rule exists and suppresses cursor-pulse animation', () => {
  const src = fs.readFileSync(CSS, 'utf8')

  const fixedActiveBlock = src.match(/\.move-token\.fixed\.active\s*\{[^}]*\}/)?.[0] ?? ''
  expect(fixedActiveBlock).not.toBe('')           // rule must exist
  expect(fixedActiveBlock).toContain('animation: none')  // cursor-pulse must be suppressed
})
```

**Why RED:** There is no `.move-token.fixed.active` rule in the current CSS. The regex
match returns `undefined`, the `?? ''` fallback gives an empty string, and
`expect('').not.toBe('')` fails → RED ✓.

**After GREEN:** The rule is added with `animation: none` → both assertions pass ✓.

---

## Existing tests — all stay GREEN throughout

### Vitest

| File | Test | Status | Why |
|------|------|--------|-----|
| `cssLayoutGuards.test.ts` | white-space guard | ✓ unchanged | does not touch `.move-token.fixed` |
| `cssLayoutGuards.test.ts` | position: static guard | ✓ unchanged | `position: static` still present; `display: block` still absent |
| `MoveTree.test.tsx` | all 21 tests | ✓ unchanged | no component changes |
| `PuzzleGame.test.tsx` | all 37 tests | ✓ unchanged | `MoveTree` is mocked; CSS invisible |
| All other Vitest | all tests | ✓ unchanged | unrelated |

### Playwright

| File | Tests | Status | Why |
|------|-------|--------|-----|
| `ui-layout.spec.ts` | same-row assertion | ✓ unchanged | layout unchanged, visual only |
| `navigation.spec.ts` | all 4 | ✓ unchanged | check visibility/text, not color |
| `recording.spec.ts` | all 8 | ✓ unchanged | check element counts, not color |
| `solution.spec.ts` | 1 | ✓ unchanged | Stockfish eval flow, unrelated |

---

## Test inventory

### Vitest

| File | Before | Delta | After |
|------|--------|-------|-------|
| `cssLayoutGuards.test.ts` | 2 | +2 | 4 |
| `MoveTree.test.tsx` | 21 | — | 21 |
| `PuzzleGame.test.tsx` | 37 | — | 37 |
| All other web Vitest | 55 | — | 55 |
| **Web total** | **115** | **+2** | **117** |

### Playwright

| File | Before | Delta | After |
|------|--------|-------|-------|
| All E2E files | 14 | — | 14 |
| **E2E total** | **14** | **0** | **14** |

---

## TDD sequence

### RED
1. Add the 2 new guards to `cssLayoutGuards.test.ts`.
2. Verify RED:
   ```bash
   npm test -- --reporter=verbose 2>&1 | grep -E 'FAIL|×'
   # Expect: 2 failures — dark background guard, fixed.active guard
   ```

### GREEN
3. Update `globals.css`:
   - Replace `.move-token.fixed` block (add `background: #2b2825`, change `color`, remove `opacity`)
   - Replace `.move-token.fixed:hover` block
   - Add `.move-token.fixed.active` rule with `animation: none` + yellow outline
4. Verify GREEN:
   ```bash
   npm test -- --reporter=verbose
   # Expect: 117/117
   ```

### YELLOW (regression guard)
5. Run full suite:
   ```bash
   npm test
   npx playwright test --retries=1
   # Expect: 117/117 Vitest, 14/14 Playwright
   ```
