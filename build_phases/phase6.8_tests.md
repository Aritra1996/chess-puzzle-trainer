# Phase 6.8 Tests — Result Bar: Remove Legend, Add Verdict + Counts

## Current test counts (baseline)

| File | Tests |
|---|---|
| `MoveTree.test.tsx` | 15 (8 base + 6 context-token + 1 legend) |
| `PuzzleGame.test.tsx` | 32 (15 base + 8 solution-checking + 5 undo-reset + 3 context-token + 1 breadcrumb) |
| `cssLayoutGuards.test.ts` | 2 |
| All other Vitest files | 55 |
| **Total** | **104** |

---

## 🔴 RED — Write failing tests before touching production code

Two files change:  
**`MoveTree.test.tsx`** — 5 new tests (4 fail, 1 passes as stability anchor)  
**`PuzzleGame.test.tsx`** — 5 new tests (4 fail, 1 passes as stability anchor)

After adding all tests, run:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 8 failed | 106 passed (114 total)
```

---

### `MoveTree.test.tsx` — 5 new tests

Add a new `describe('MoveTree — token titles')` block after the existing context-token block:

```typescript
describe('MoveTree — token titles', () => {
  it('does not render .token-legend', () => {
    const { container } = render(<MoveTree lines={[]} />)
    expect(container.querySelector('.token-legend')).toBeNull()
  })

  it('token has title "mistake" when checkResult marks it wrong', () => {
    const result: Map<string, string> = new Map([['node-1', 'wrong']])
    render(<MoveTree lines={[PLAYER_LINE]} checkResult={result} />)
    expect(document.querySelector('.move-token.player')).toHaveAttribute('title', 'mistake')
  })

  it('token has title "correct" when checkResult marks it correct', () => {
    const result: Map<string, string> = new Map([['node-1', 'correct']])
    render(<MoveTree lines={[PLAYER_LINE]} checkResult={result} />)
    expect(document.querySelector('.move-token.player')).toHaveAttribute('title', 'correct')
  })

  it('token has title "illegal" when checkResult marks it illegal', () => {
    const result: Map<string, string> = new Map([['node-1', 'illegal']])
    render(<MoveTree lines={[PLAYER_LINE]} checkResult={result} />)
    expect(document.querySelector('.move-token.player')).toHaveAttribute('title', 'illegal')
  })

  it('token has no title attribute when checkResult is not provided', () => {
    render(<MoveTree lines={[PLAYER_LINE]} />)
    expect(document.querySelector('.move-token.player')).not.toHaveAttribute('title')
  })
})
```

#### Why RED

| Test | Fails because |
|---|---|
| `does not render .token-legend` | Legend still present in `MoveTree.tsx` |
| `token has title "mistake"` | `title` attribute not yet added to token spans |
| `token has title "correct"` | Same |
| `token has title "illegal"` | Same |
| `token has no title attribute` | **Passes at RED** — no title set yet (stability anchor) |

---

### `PuzzleGame.test.tsx` — 5 new tests

The `evalNodes` mock's `mockImplementationOnce` callback receives the `NodeToCheck[]` array, so
we can derive real node IDs at call time without hardcoding them.

Add a new `describe('PuzzleGame — ResultBar')` block at the bottom of the file:

```typescript
describe('PuzzleGame — ResultBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('result bar is not rendered before submit', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(container.querySelector('.result-bar')).toBeNull()
  })

  it('result bar appears inside .an-footer after submit with recorded moves', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'correct' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    const footer = container.querySelector('.an-footer')
    expect(footer?.querySelector('.result-bar')).not.toBeNull()
  })

  it('result bar shows "Clean line" verdict when all player moves are correct', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'correct' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    const verdict = container.querySelector('.result-verdict')
    expect(verdict).not.toBeNull()
    expect(verdict).toHaveClass('rv-clean')
    expect(verdict?.textContent).toBe('Clean line')
  })

  it('result bar shows "Not optimal" verdict when a player move is wrong', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'wrong' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    const verdict = container.querySelector('.result-verdict')
    expect(verdict).toHaveClass('rv-wrong')
    expect(verdict?.textContent).toMatch(/Not optimal/i)
    expect(verdict?.textContent).toMatch(/1 mistake/)
  })

  it('result bar disappears after Reset', async () => {
    vi.mocked(evalNodes).mockImplementationOnce(async nodes =>
      new Map(nodes.map(n => [n.nodeId, 'correct' as const]))
    )
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(container.querySelector('.result-bar')).not.toBeNull()   // ← fails at RED
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(container.querySelector('.result-bar')).toBeNull()
  })
})
```

#### Why RED

| Test | Fails because |
|---|---|
| `result bar is not rendered before submit` | **Passes at RED** — no result-bar exists (stability anchor) |
| `result bar appears inside .an-footer after submit` | `ResultBar` not yet in `PuzzleGame.tsx` — `.result-bar` never renders |
| `result bar shows "Clean line"` | Same — `.result-verdict` does not exist |
| `result bar shows "Not optimal"` | Same |
| `result bar disappears after Reset` | First assertion fails — bar never rendered |

**Minimum RED: 8 failures across both files.**

---

## 🟢 GREEN — Apply source changes from `phase6.8.md`

Make ALL changes at once (they are interdependent):

1. **`MoveTree.tsx`** — remove `<div className="token-legend">…</div>`, add `title={statusTitle}` to tokens
2. **`PuzzleGame.tsx`** — add `getResultSummary()`, `ResultBar` component, render `{checkResult && <ResultBar …/>}` inside `.an-footer`
3. **`globals.css`** — remove 5 legend rules; add `result-bar` / `result-verdict` / `rv-*` / `result-counts` / `rc-*` rules

After source changes, the old `describe('MoveTree — legend')` test now **fails** because the
legend no longer exists. Delete that describe block before running the suite.

**Also clean up E2E selectors** (these are passing tests, not RED/GREEN failures):
- `recording.spec.ts`: `.move-token:not(.tl-sample)` → `.move-token.player` (2 occurrences)
- `navigation.spec.ts`: `.move-token.fixed:not(.tl-sample)` → `.move-token.fixed`

Verify Vitest:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 113 passed (113 total)
```

#### Expected count after GREEN

| File | Before | Added | Removed | After |
|---|---|---|---|---|
| `MoveTree.test.tsx` | 15 | +5 (titles + no-legend) | −1 (old legend test) | 19 |
| `PuzzleGame.test.tsx` | 32 | +5 (ResultBar) | — | 37 |
| All other Vitest | 57 | — | — | 57 |
| **Total** | **104** | **+10** | **−1** | **113** |

---

## 🟡 YELLOW — Regression guard

```bash
# Full Vitest suite
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 113/113

# Playwright regression suites
npx playwright test e2e/ui-layout.spec.ts e2e/recording.spec.ts e2e/navigation.spec.ts
# Expect: all pass

# Visual smoke in browser:
# 1. Load page — no legend visible, tree area is clean
# 2. Record Nd5 → Submit → result bar appears below buttons inside an-footer
# 3. "Clean line" in green (if Nd5 is a good move by Stockfish)
# 4. Hover a coloured token → browser native tooltip shows "correct" / "mistake" / "illegal"
# 5. Click Reset → result bar disappears instantly
```

---

## Why each guard exists

| Guard | Prevents |
|---|---|
| `does not render .token-legend` | Legend silently re-added in a future refactor |
| `token title = "mistake"` for wrong status | Title attribute dropped when changing token render code |
| `result bar inside .an-footer` | ResultBar moved outside the footer inadvertently |
| `rv-clean` class + text "Clean line" | Verdict logic regression (wrong class or wrong copy) |
| `rv-wrong` class + text "Not optimal … 1 mistake"` | Wrong/illegal counts mis-computed |
| `result bar disappears after Reset` | Stale checkResult surviving a tree reset |
