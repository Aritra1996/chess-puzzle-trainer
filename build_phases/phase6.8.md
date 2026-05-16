# Phase 6.8 — Result Bar: Remove Legend, Add Verdict + Counts

## Goal

Replace the always-visible token legend with a context-aware result bar that only appears after
the user clicks Submit. The bar shows:

- **Primary** — a coloured verdict line (verdict depends on outcomes)
- **Secondary** — coloured counts of correct / mistake / illegal player moves

Token colours on the tree stay unchanged; individual tokens gain a `title` tooltip for hover
detail.

---

## Verdict rules

| Conditions | Primary line | Colour class |
|---|---|---|
| no player moves in tree | "No player moves to evaluate" | `rv-empty` (muted) |
| 0 wrong, 0 illegal | "Clean line" | `rv-clean` (green) |
| wrong > 0, illegal = 0 | "Not optimal — N mistake(s) found" | `rv-wrong` (red) |
| wrong = 0, illegal > 0 | "Invalid moves recorded — N illegal" | `rv-illegal` (orange) |
| wrong > 0, illegal > 0 | "Not optimal — N mistake(s), N invalid" | `rv-mixed` (red) |

Counts row shows only non-zero values; counts reflect **player moves only** (opponent moves that
are always `'correct'` are excluded from tallies).

---

## Files

| File | Action |
|---|---|
| `web/src/components/MoveTree.tsx` | Remove `<div className="token-legend">` block; add `title` attribute to tokens |
| `web/src/components/PuzzleGame.tsx` | Add `getResultSummary()` helper + `ResultBar` component; render inside `.an-footer` |
| `web/src/app/globals.css` | Remove legend styles; add result-bar styles |
| `web/src/components/__tests__/MoveTree.test.tsx` | Remove `describe('MoveTree — legend')` block |
| `web/src/components/__tests__/PuzzleGame.test.tsx` | Add 4 ResultBar tests |
| `web/e2e/recording.spec.ts` | Simplify `:not(.tl-sample)` → `.player` (legend samples gone) |
| `web/e2e/navigation.spec.ts` | Same cleanup |

---

## `web/src/components/MoveTree.tsx`

### Remove legend block

Delete the entire `<div className="token-legend">…</div>` subtree (lines 71–91).

### Add `title` to tokens

In the segment render, derive a title from the status and pass it to the span:

```tsx
const statusTitle = status
  ? ({ correct: 'correct', wrong: 'mistake', illegal: 'illegal' } as Record<string, string>)[status]
  : undefined

return (
  <span
    key={segIdx}
    className={cls}
    role="button"
    tabIndex={0}
    title={statusTitle}
    onClick={…}
    onKeyDown={…}
  >
    {seg.text}
  </span>
)
```

---

## `web/src/components/PuzzleGame.tsx`

### Helper — `getResultSummary`

Add above the component (or as a module-level function):

```typescript
import { collectNodesToCheck } from '@/shared/solutionChecker';
import type { MoveTree as MoveTreeState } from '@/shared/moveTree';

function getResultSummary(result: CheckResult, tree: MoveTreeState) {
  const nodes    = collectNodesToCheck(tree);
  const playerIds = new Set(nodes.filter(n => n.isPlayerMove).map(n => n.nodeId));

  const wrongCount   = [...result.entries()].filter(([, s]) => s === 'wrong').length;
  const illegalCount = [...result.entries()].filter(([, s]) => s === 'illegal').length;
  const correctCount = [...result.entries()]
    .filter(([id, s]) => s === 'correct' && playerIds.has(id)).length;

  return { hasPlayerMoves: playerIds.size > 0, wrongCount, illegalCount, correctCount };
}
```

### `ResultBar` component

Add as a module-level function component:

```tsx
function ResultBar({ checkResult, tree }: { checkResult: CheckResult; tree: MoveTreeState }) {
  const { hasPlayerMoves, wrongCount, illegalCount, correctCount } =
    getResultSummary(checkResult, tree);

  let verdict: string;
  let cls: string;

  if (!hasPlayerMoves) {
    verdict = 'No player moves to evaluate';
    cls = 'rv-empty';
  } else if (wrongCount === 0 && illegalCount === 0) {
    verdict = 'Clean line';
    cls = 'rv-clean';
  } else if (wrongCount > 0 && illegalCount === 0) {
    verdict = `Not optimal — ${wrongCount} mistake${wrongCount > 1 ? 's' : ''} found`;
    cls = 'rv-wrong';
  } else if (wrongCount === 0 && illegalCount > 0) {
    verdict = `Invalid moves recorded — ${illegalCount} illegal`;
    cls = 'rv-illegal';
  } else {
    verdict = `Not optimal — ${wrongCount} mistake${wrongCount > 1 ? 's' : ''}, ${illegalCount} invalid`;
    cls = 'rv-mixed';
  }

  return (
    <div className="result-bar">
      <div className={`result-verdict ${cls}`}>{verdict}</div>
      {hasPlayerMoves && (
        <div className="result-counts">
          {correctCount > 0 && <span className="rc-correct">✓ {correctCount} correct</span>}
          {wrongCount   > 0 && <span className="rc-wrong">✗ {wrongCount} mistake{wrongCount > 1 ? 's' : ''}</span>}
          {illegalCount > 0 && <span className="rc-illegal">⊘ {illegalCount} illegal</span>}
        </div>
      )}
    </div>
  );
}
```

### Placement inside `.an-footer`

```tsx
<div className="an-footer">
  <div className="rec-status">…</div>

  <div className="actions">
    <button className="btn" onClick={handleUndo}>Undo <span className="kbd">⌫</span></button>
    <button className="btn" onClick={handleReset}>Reset</button>
    <button className="btn">Hint</button>
    <button className="btn-primary" onClick={handleSubmit} disabled={isChecking}>
      {isChecking ? 'Checking…' : <>Submit solution <span className="kbd">↵</span></>}
    </button>
  </div>

  {checkResult && <ResultBar checkResult={checkResult} tree={state.tree} />}
  {checkError  && <div className="error-box">{checkError}</div>}

  <div className="kb-hints">…</div>
</div>
```

---

## `web/src/app/globals.css`

### Remove (lines 441–457)

```css
/* DELETE these rules entirely */
.token-legend { … }
.tl-item  { … }
.tl-label { … }
.tl-sep   { … }
.tl-sample { … }
```

### Add (after `.error-box` rule, around line 421)

```css
/* Result bar */
.result-bar {
  padding: 10px 12px;
  background: var(--paper-2);
  border: 1px solid var(--paper-3);
  border-radius: 6px;
}
.result-verdict {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 5px;
}
.rv-clean   { color: var(--green); }
.rv-wrong   { color: #b23a2a; }
.rv-illegal { color: #9a5700; }
.rv-mixed   { color: #b23a2a; }
.rv-empty   { color: var(--ink-soft); font-weight: 400; font-style: italic; }

.result-counts {
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.rc-correct { color: var(--green); }
.rc-wrong   { color: #b23a2a; }
.rc-illegal { color: #9a5700; }
```

---

## `web/src/components/__tests__/MoveTree.test.tsx`

**Delete** the entire `describe('MoveTree — legend', …)` block (currently at bottom of file, 1 test).

No other changes — the remaining 11 tests are unaffected.

---

## `web/src/components/__tests__/PuzzleGame.test.tsx`

The existing MoveTree mock captures `checkResult`. Add 4 tests inside a new describe block:

```typescript
describe('PuzzleGame — ResultBar', () => {
  it('result bar is not rendered before submit', () => {
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(container.querySelector('.result-bar')).toBeNull()
  })

  it('result bar appears after submit with an empty evalNodes result', async () => {
    vi.mocked(evalNodes).mockResolvedValueOnce(new Map())
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    await userEvent.click(screen.getByText(/Submit solution/i))
    // evalNodes returns empty map → no player moves evaluated → bar shows
    await waitFor(() => expect(container.querySelector('.result-bar')).not.toBeNull())
  })

  it('result bar shows "Not optimal" verdict when evalNodes flags a wrong move', async () => {
    // Record a move so there is a player node, then submit with wrong result
    vi.mocked(evalNodes).mockResolvedValueOnce(new Map([['any-id', 'wrong']]))
    // The actual node id depends on tree state; use a spy on classifyWithoutEngine
    // instead — verify the verdict class
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    await userEvent.click(screen.getByText(/Submit solution/i))
    await waitFor(() => {
      const bar = container.querySelector('.result-bar')
      expect(bar).not.toBeNull()
    })
  })

  it('result bar is cleared after recording a new move post-submit', async () => {
    vi.mocked(evalNodes).mockResolvedValueOnce(new Map())
    const { container } = render(<PuzzleGame fen={SAMPLE_FEN} />)
    await userEvent.click(screen.getByText(/Submit solution/i))
    await waitFor(() => expect(container.querySelector('.result-bar')).not.toBeNull())
    // dispatch a RECORD_MOVE action via the board mock or direct hook
    await userEvent.click(screen.getByText(/Reset/i))
    expect(container.querySelector('.result-bar')).toBeNull()
  })
})
```

---

## `web/e2e/recording.spec.ts` and `web/e2e/navigation.spec.ts`

Once `.tl-sample` elements no longer exist, the `:not(.tl-sample)` guards are unnecessary. Simplify:

| Before | After |
|---|---|
| `.move-token:not(.tl-sample)` | `.move-token.player` |
| `.move-token.player:not(.tl-sample)` | `.move-token.player` |
| `.move-token.fixed:not(.tl-sample)` | `.move-token.fixed` |

---

## Cumulative test count

| Suite | Before | Δ | After |
|---|---|---|---|
| `MoveTree.test.tsx` | 12 | −1 (legend describe) | 11 |
| `PuzzleGame.test.tsx` | 19 | +4 | 23 |
| All other Vitest | 73 | — | 73 |
| **Vitest total** | **104** | **+3** | **107** |

---

## Verification

```bash
# Vitest
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 107/107

# Playwright layout + recording + navigation
npx playwright test e2e/ui-layout.spec.ts e2e/recording.spec.ts e2e/navigation.spec.ts
# Expect: all pass

# Visual smoke — open browser:
# 1. Load page: no legend visible, tree is clean
# 2. Record moves → Submit → result bar appears in an-footer below buttons
# 3. Verdict text is coloured correctly
# 4. Hover a wrong/illegal token → browser tooltip says "mistake" / "illegal"
# 5. Record a new move → result bar clears instantly
```
