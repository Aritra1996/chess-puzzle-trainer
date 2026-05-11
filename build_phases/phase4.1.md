# Phase 4.1 — Fix Move-Tree Dimming (isActivePath bug)

## Context

After Phase 4 landed, the move-tree panel dims inactive lines via:

```css
.tree-line:not(.is-active-path) { opacity: .42; }
```

`buildLines` sets `isActivePath` per `Line` object. The flag is supposed to be `true`
whenever the cursor (or any ancestor of the cursor) is represented in that line. But the
current implementation only checks the **last node pushed into that Line** — it ignores
every other node that was inlined onto the same Line earlier in the recursion. This causes
two visible symptoms:

- A line that **contains the cursor** gets dimmed (cursor node was not the final node
  emitted onto that Line).
- A line that **does not contain the cursor** stays bright (the line's final node happened
  to be on the ancestor path even though the cursor is elsewhere).

---

## Root Cause

`renderNode` in `buildLines` (`shared/moveTree.ts:173`) derives:

```ts
const isOnActivePath = activePath.has(node.id);  // only this node
```

For the **inline case** (single child, line 196–209) it recurses without carrying that flag
forward. The `Line` is not pushed until a leaf or a branch-point is reached; by then
`isOnActivePath` reflects only the *final* node, not the full chain.

For the **branch-flush** case (line 212), the same problem applies: `segs` may already
contain several inlined tokens, but `isActivePath: isOnActivePath` only checks the node
that triggered the flush.

### Concrete example

Tree: `8... Nxe4 → 9. Nxe4 → { Qd4, d5 }`  
Cursor at `Nxe4_black` (depth 1).  
`activePath = { root.id, nxe4_black.id }`.

Execution:
1. `renderNode(nxe4_black)` → `isOnActivePath = true` → single child → recurse inline
2. `renderNode(nxe4_white)` → `isOnActivePath = false` → two children → push line with
   `isActivePath: false` ← **wrong** (should be true because nxe4_black is in that Line)

---

## Fix

Add a `chainOnActivePath: boolean` parameter to `renderNode`. Each call ORs in its own
`isOnActivePath`; the accumulated value is used when pushing a Line and passed when
recursing inline.

### Signature change
```ts
function renderNode(
  node: MoveNode,
  depthD: number,
  lineSegs: Segment[],
  isFirst: boolean,
  chainOnActivePath: boolean   // ← new: true if any earlier node in this Line was on path
): void
```

### Push-line sites

**Leaf** (was line 195):
```ts
lines.push({ segments: segs, isActivePath: chainOnActivePath || isOnActivePath });
```

**Branch-flush** (was line 212):
```ts
lines.push({ segments: segs, isActivePath: chainOnActivePath || isOnActivePath });
```

### Inline recursion (was line 209):
```ts
renderNode(child, newDepthD + 1, nextSegs, false, chainOnActivePath || isOnActivePath);
```

### Branch sub-lines (was line 222): each branch starts its own fresh chain
```ts
renderNode(child, connector.length, branchSegs, true, false);
```

### Top-level call sites (lines 235 and 245):
```ts
// single first child
renderNode(child, numText.length, initSegs, true, false);

// multiple first children
renderNode(child, connector.length, branchSegs, true, false);
```

---

## Files to change

| File | Change |
|------|--------|
| `shared/moveTree.ts` | Update `renderNode` signature + all 4 push/recurse sites |

No other files need to change — the `Line` type is unchanged, CSS is unchanged, components
are unchanged.

---

## Test plan (TDD: Red → Green)

### New unit tests — `shared/__tests__/moveTree.test.ts`

All tests build a two-move tree `Nxe4_black → Nxe4_white` (black inlined onto white
because it's a single-child chain) and then check `buildLines` output for different cursor
positions.

**Test 1** — cursor at root: only one Line, `isActivePath: false`
```
tree: root → Nxe4_b → Nxe4_w (cursor at root)
expect: lines[0].isActivePath === false
```

**Test 2** — cursor at first (black) node: Line is `isActivePath: true`
```
cursor = Nxe4_b
expect: lines[0].isActivePath === true
```
*(This is the primary regression test — currently fails.)*

**Test 3** — cursor at second (white) node: Line is `isActivePath: true`
```
cursor = Nxe4_w
expect: lines[0].isActivePath === true
```

**Test 4** — branching tree, cursor at branch-point flushed Line
```
tree: root → A → B → {C, D}   cursor at A
buildLines produces 3 lines: [A B], [├─ C], [└─ D]
expect: lines[0].isActivePath === true   // A is on active path
        lines[1].isActivePath === false
        lines[2].isActivePath === false
```
*(Currently fails because flush at B uses only B's isOnActivePath = false.)*

**Test 5** — branching tree, cursor at a branch child
```
tree: root → A → B → {C, D}   cursor at C
expect: lines[0].isActivePath === true   // A,B are ancestors of C
        lines[1].isActivePath === true   // C is active
        lines[2].isActivePath === false
```

---

## Verification

```bash
cd web && npm test                    # all 61 vitest tests must stay green
cd web && npm run test:e2e            # all navigation E2E tests must stay green
```

Manual smoke-test:
1. Record `e4 e5 Nf3 Nc6`  (single chain, 4 moves)
2. Navigate with ← to each node → the single visible Line must always be bright
3. Record a second response at move 2 to create a branch
4. Navigate to each node → only the Line containing the cursor (or its ancestors) is bright;
   all other branch lines are dimmed
