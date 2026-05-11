# Phase 4.1 Tests — Move-Tree Dimming (isActivePath bug)

## Context

The `buildLines` function in `shared/moveTree.ts` sets `isActivePath` incorrectly for
Lines that contain multiple inlined nodes. When nodes are chained inline (single-child
path), `isActivePath` is only computed from the *last* node pushed, not the whole chain.
This causes incorrect dimming when the cursor sits on an intermediate node.

All new tests live in `shared/__tests__/moveTree.test.ts`, under a new
`describe('buildLines — isActivePath across inline chains')` block appended after the
existing `buildLines` tests. No other test files are modified.

---

## Test infrastructure: new helpers

Add these two helpers alongside the existing `twoMoveTree()` and `branchTree()`:

```ts
// e4 → e5, cursor manually set to e4 (not the leaf)
function twoMoveAtFirst() {
  const t = twoMoveTree()
  return navigateTo(t, t.root.children[0].id)  // cursor = e4
}

// e4 → e5 → { Nf3, d4 }
// (inline chain e4+e5 ends in a branch; uses existing FEN constants as placeholders)
function inlineThenBranchTree() {
  const t0    = createTree(START_FEN, 'white')
  const t1    = addNode(t0,  { uci: 'e2e4', san: 'e4',  fen: AFTER_E4,    illegal: false, color: 'player',   moveNumber: 1, isBlackMove: false })
  const t2    = addNode(t1,  { uci: 'e7e5', san: 'e5',  fen: AFTER_E4_E5, illegal: false, color: 'opponent', moveNumber: 1, isBlackMove: true  })
  // Add two children to e5 — reuse existing FEN constants (value irrelevant for isActivePath tests)
  const atE5  = { ...t2, currentNodeId: t2.root.children[0].children[0].id }
  const t3    = addNode(atE5, { uci: 'g1f3', san: 'Nf3', fen: AFTER_E4_C5, illegal: false, color: 'player', moveNumber: 2, isBlackMove: false })
  const back  = { ...t3, currentNodeId: t3.root.children[0].children[0].id }
  const t4    = addNode(back, { uci: 'd2d4', san: 'd4',  fen: AFTER_D4,    illegal: false, color: 'player', moveNumber: 2, isBlackMove: false })
  return t4   // cursor = d4 (last added)
}
```

---

## RED phase — 5 new tests (all must fail before the fix)

```ts
describe('buildLines — isActivePath across inline chains', () => {
```

### Test 1 — cursor at root of a 2-move chain → line is NOT active
```ts
it('inline chain is not active when cursor is at root', () => {
  const t = { ...twoMoveTree(), currentNodeId: twoMoveTree().root.id }
  expect(buildLines(t)[0].isActivePath).toBe(false)
})
```
**RED?** No — this already passes (leaf e5 is also not on path). Keep as regression guard.

### Test 2 — cursor at first inlined node → line MUST be active  ← primary regression
```ts
it('inline chain is active when cursor sits on the first inlined node', () => {
  const t = twoMoveAtFirst()           // cursor = e4, leaf = e5
  expect(buildLines(t)[0].isActivePath).toBe(true)
})
```
**RED** — currently fails because leaf `e5` is not in `activePath` when cursor is at `e4`.

### Test 3 — cursor at leaf of a 2-move chain → line is active (regression guard)
```ts
it('inline chain is active when cursor is at the leaf node', () => {
  const t = twoMoveTree()              // cursor = e5 (leaf)
  expect(buildLines(t)[0].isActivePath).toBe(true)
})
```
**RED?** No — currently passes. Kept to catch regressions from the fix.

### Test 4 — inline-then-branch, cursor at the first inlined node
```ts
it('branch-flush line is active when cursor is on the first inlined node before the branch', () => {
  const t     = inlineThenBranchTree()
  const e4Id  = t.root.children[0].id
  const atE4  = navigateTo(t, e4Id)   // cursor = e4; line [e4 e5] is flushed at branch point
  const lines = buildLines(atE4)
  // lines[0] = "1. e4 1... e5"  (branch-flush line)
  // lines[1] = "├─ 2. Nf3"
  // lines[2] = "└─ 2. d4"
  expect(lines[0].isActivePath).toBe(true)
  expect(lines[1].isActivePath).toBe(false)
  expect(lines[2].isActivePath).toBe(false)
})
```
**RED** — currently fails: `e5` (branch-point) is not in `activePath` when cursor is `e4`,
so the branch-flush push sets `isActivePath: false`.

### Test 5 — inline-then-branch, cursor at a branch child
```ts
it('correct lines are active when cursor is on a branch child', () => {
  const t     = inlineThenBranchTree()
  const nf3Id = t.root.children[0].children[0].children[0].id
  const atNf3 = navigateTo(t, nf3Id)  // cursor = Nf3
  const lines = buildLines(atNf3)
  // e4 and e5 are ancestors of Nf3, so lines[0] should be active
  expect(lines[0].isActivePath).toBe(true)
  expect(lines[1].isActivePath).toBe(true)   // Nf3 line
  expect(lines[2].isActivePath).toBe(false)  // d4 line
})
```
**RED** — currently fails: `e4` is ancestor of Nf3 but `e5` (branch-point that triggers
the flush) is also an ancestor. Actually `e5` IS in `activePath` here. Let me re-check:
`activePath = {root, e4, e5, Nf3}` → `e5` IS on path → `lines[0]` might already pass.
But `lines[1]` (Nf3 branch) starts fresh with `chainOnActivePath=false`; `isOnActivePath`
for Nf3 is `true` → `lines[1].isActivePath = true`. So this test may already pass.
Include it anyway as an explicit assertion and regression guard.

---

## Summary of RED tests (tests that fail before the fix)

| # | Test name | Currently fails? |
|---|-----------|-----------------|
| 1 | cursor at root → not active | No (passes — regression guard) |
| 2 | cursor at first inlined node → active | **YES** |
| 3 | cursor at leaf → active | No (passes — regression guard) |
| 4 | branch-flush line active when cursor is before branch | **YES** |
| 5 | correct lines active with cursor at branch child | Likely no — regression guard |

Minimum RED count: **2 tests fail**. These are the ones the fix must flip to green.

---

## GREEN phase — implement the fix

Apply the `chainOnActivePath` fix to `shared/moveTree.ts` as specified in
`build_phases/phase4.1.md`. After the fix all 5 new tests must pass.

```bash
cd web && npm test -- shared/__tests__/moveTree.test.ts
# Expect: all tests green (was 44, now 49)
```

---

## REFACTOR phase — full regression check

```bash
cd web && npm test
# All 49 unit + component tests must be green

cd web && npm run test:e2e
# All E2E tests green — no navigation regressions
```

Existing tests that must remain green (directly related to `buildLines`):

- `marks all lines on the active path with isActivePath: true`
- `marks inactive branch lines with isActivePath: false`
- `marks the cursor move segment with active: true`
- `inlines a response move on the same line when there is no branch`
- `creates branch lines with connectors when a node has two children`

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `shared/__tests__/moveTree.test.ts` | 44 | +5 | 49 |
| All others | unchanged | — | unchanged |
| **Total** | **~61** | **+5** | **~66** |
