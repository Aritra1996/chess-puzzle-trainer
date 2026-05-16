# Phase 6.3 Tests — Wire Submit to UI

## Context

Phase 6.3 wires the checker pipeline to the UI. Three source files change:
- `MoveTree.tsx` — gains `checkResult` prop
- `PuzzleGame.tsx` — gains async Submit, loading state, clear-on-change
- `globals.css` — gains `.correct`, `.wrong`, `.illegal`, `.error-box` styles

One existing test file is modified:
- `web/src/components/__tests__/PuzzleGame.test.tsx` — 8 new tests added

No new test files created.

Follows **Red → Green → Yellow** TDD:
- **Red:** write 8 new tests; 6 fail (Submit not wired, checkResult not cleared)
- **Green:** implement all three source changes; 87/87 web tests pass
- **Yellow:** confirm no regressions

---

## Changes needed to `PuzzleGame.test.tsx`

Four additions to the existing file before writing any source code:

### 1 — New import at the top
```typescript
import { evalNodes } from '@/lib/chessEngine'
```

### 2 — New captured variable alongside the existing ones
```typescript
let capturedCheckResult: Map<string, string> | undefined
```

### 3 — New mock for chessEngine (add before the `await import('../PuzzleGame')` line)
```typescript
vi.mock('@/lib/chessEngine', () => ({
  evalNodes:    vi.fn().mockResolvedValue(new Map()),
  warmUpEngine: vi.fn(),
}))
```

### 4 — Update the existing MoveTree mock to also capture `checkResult`
```typescript
// BEFORE
vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick }: { lines: unknown[]; onTokenClick?: (id: string) => void }) => {
    capturedOnTokenClick = onTokenClick
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))

// AFTER
vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick, checkResult }: {
    lines:          unknown[];
    onTokenClick?:  (id: string) => void;
    checkResult?:   Map<string, string>;
  }) => {
    capturedOnTokenClick = onTokenClick
    capturedCheckResult  = checkResult
    return <div data-testid="move-tree" data-lines={lines.length} />
  },
}))
```

---

## 🔴 RED — Write tests before source changes

Add this new describe block at the **end** of `PuzzleGame.test.tsx`:

```typescript
describe('PuzzleGame — Solution Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks()         // reset evalNodes call count between tests
    capturedCheckResult = undefined
  })

  it('Submit Solution button renders', () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    expect(screen.getByRole('button', { name: /submit solution/i })).toBeInTheDocument()
  })

  it('Submit with empty tree does not call evalNodes', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(evalNodes).not.toHaveBeenCalled()
  })

  it('Submit with recorded moves calls evalNodes', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(evalNodes).toHaveBeenCalled()
  })

  it('checkResult is passed to MoveTree after submit', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
  })

  it('recording a new move after submit clears checkResult', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)    // set after submit
    act(() => { capturedOnMove?.('a2a3') })            // record new move
    expect(capturedCheckResult).toBeUndefined()        // cleared
  })

  it('Undo after submit clears checkResult', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(capturedCheckResult).toBeUndefined()
  })

  it('Reset after submit clears checkResult', async () => {
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit solution/i }))
    })
    expect(capturedCheckResult).toBeInstanceOf(Map)
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(capturedCheckResult).toBeUndefined()
  })

  it('Submit button shows "Checking…" and is disabled while evaluating', async () => {
    // Freeze evalNodes so isChecking=true is observable
    let resolveEval!: (v: Map<string, string>) => void
    vi.mocked(evalNodes).mockImplementationOnce(
      () => new Promise(r => { resolveEval = r as (v: Map<string, string>) => void })
    )
    render(<PuzzleGame fen={SAMPLE_FEN} />)
    act(() => { capturedOnMove?.('f6d5') })

    // Click submit synchronously — setIsChecking(true) runs before the first await
    act(() => { fireEvent.click(screen.getByRole('button', { name: /submit solution/i })) })
    expect(screen.getByRole('button', { name: /checking/i })).toBeDisabled()

    // Resolve so the component finishes and avoids act() warnings
    await act(async () => { resolveEval(new Map()) })
  })
})
```

### Why RED

| Test | Fails because |
|------|---------------|
| 1 — button renders | Already passes |
| 2 — empty tree, evalNodes not called | Already passes (Submit not wired) |
| 3 — evalNodes called on submit | `handleSubmit` not wired to engine — evalNodes never called |
| 4 — checkResult passed to MoveTree | `checkResult` not passed to MoveTree, `capturedCheckResult` stays undefined |
| 5 — record clears checkResult | First assert fails (checkResult never set) |
| 6 — Undo clears checkResult | First assert fails (checkResult never set) |
| 7 — Reset clears checkResult | First assert fails (checkResult never set) |
| 8 — disabled while checking | `isChecking` state not yet added — button never disabled |

**Minimum RED: 6 failures** (tests 3, 4, 5, 6, 7, 8).

Confirm:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# 1 failed suite, 79/79 existing tests still green
```

---

## 🟢 GREEN — Implement source changes

Apply all four changes from `phase6.3.md` in order:

### 1 — `web/src/components/MoveTree.tsx`
Add `checkResult` import and prop, update token class construction:
```typescript
import type { CheckResult } from '@/shared/solutionChecker';

interface Props {
  lines:         Line[];
  onTokenClick?: (nodeId: string) => void;
  checkResult?:  CheckResult;
}

// In the token span:
const status = seg.nodeId ? (checkResult?.get(seg.nodeId) ?? '') : ''
const cls = ['move-token', seg.kind, isActive ? 'active' : '', status]
  .filter(Boolean).join(' ')
```

### 2 — `web/src/components/PuzzleGame.tsx`
- Add `solution?: string` prop
- Add `checkResult`, `isChecking`, `checkError` state
- Add `useEffect(() => { warmUpEngine(); }, [])` on mount
- Add `async handleSubmit()` calling `collectNodesToCheck` → `classifyWithoutEngine` → `evalNodes` → `mergeResults`
- Call `setCheckResult(null); setCheckError(null)` on every `RECORD_MOVE`, `UNDO_LAST`, `RESET` dispatch
- Update Submit button and MoveTree JSX

### 3 — `web/src/app/globals.css`
Add `.correct`, `.wrong`, `.illegal`, `.error-box` styles plus `--green: #5a7a3e` to `:root`.

### 4 — Verify
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 87/87 green (79 existing + 8 new)
```

---

## 🟡 YELLOW — Refactor

No refactor needed.

Regression guard:

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 87/87 green
```

Tests that must stay green:

| Suite | Count |
|-------|-------|
| `PuzzleGame.test.tsx` — existing describes | 24 |
| `PuzzleGame.test.tsx` — Undo/Reset | 5 |
| `MoveTree.test.tsx` | all |
| `PuzzleBoard.test.tsx` | all |
| `chessEngine.test.ts` | 9 |
| **web total before** | **79** |

---

## Cumulative test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `web/.../PuzzleGame.test.tsx` | 29 | +8 | 37 |
| All other web tests | 50 | — | 50 |
| **web total** | **79** | **+8** | **87** |
| `shared` total | 66 | — | 66 |
