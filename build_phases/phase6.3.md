# Phase 6.3 — Wire Submit to UI

## Goal

Connect Phase 6.1 (checker logic) and Phase 6.2 (engine wrapper) to the UI. After Submit,
each move token in the tree is coloured green (correct), red strikethrough (wrong), or orange
dashed (illegal). Loading state disables the button during evaluation.

## Context

Part of Phase 6 (Solution Checking). Depends on Phase 6.1 and 6.2 being complete.

## Files

| File | Action |
|------|--------|
| `web/src/components/MoveTree.tsx` | **MODIFY** — add `checkResult` prop |
| `web/src/components/PuzzleGame.tsx` | **MODIFY** — solution prop, warm-up, async submit, loading state |
| `web/src/app/globals.css` | **MODIFY** — `.correct`, `.wrong`, `.illegal`, `.error-box` styles |
| `web/src/components/__tests__/PuzzleGame.test.tsx` | **MODIFY** — 8 new tests |

---

## `web/src/components/MoveTree.tsx`

Add `checkResult` prop. Each move token gets a status class derived from the map.

```typescript
import type { CheckResult } from '@/shared/solutionChecker';

interface Props {
  lines:         Line[];
  onTokenClick?: (nodeId: string) => void;
  checkResult?:  CheckResult;
}
```

Token class construction:
```typescript
const status = seg.nodeId ? (checkResult?.get(seg.nodeId) ?? '') : '';
const cls = ['move-token', seg.kind, isActive ? 'active' : '', status]
  .filter(Boolean).join(' ');
```

---

## `web/src/components/PuzzleGame.tsx`

### New prop
```typescript
interface Props {
  fen:          string;
  orientation?: 'white' | 'black';
  solution?:    string;   // kept for Phase 7 loading; not used in checking logic
}
```

### New state
```typescript
const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
const [isChecking,  setIsChecking]  = useState(false);
const [checkError,  setCheckError]  = useState<string | null>(null);
```

### Engine pre-warm on mount
```typescript
// Starts the ~5MB WASM download in the background so Submit is snappy.
useEffect(() => { warmUpEngine(); }, []);
```

### handleSubmit
```typescript
async function handleSubmit() {
  setIsChecking(true); setCheckError(null);
  try {
    const nodes = collectNodesToCheck(state.tree);
    const { result: syncResult, needsEval } = classifyWithoutEngine(nodes);
    const engineResult = needsEval.length > 0 ? await evalNodes(needsEval) : new Map();
    setCheckResult(mergeResults(syncResult, engineResult));
  } catch {
    setCheckError('Engine error — try again.');
  } finally {
    setIsChecking(false);
  }
}
```

### Clear on record / undo / reset
Every action that changes the tree must also call:
```typescript
setCheckResult(null);
setCheckError(null);
```
These belong inside the reducer dispatch or right after it.

### Submit button + error display
```tsx
<button className="btn-primary" onClick={handleSubmit} disabled={isChecking}>
  {isChecking ? 'Checking…' : <>Submit solution <span className="kbd">↵</span></>}
</button>
{checkError && <div className="error-box">{checkError}</div>}
```

### MoveTree usage
```tsx
<MoveTree lines={lines} onTokenClick={...} checkResult={checkResult ?? undefined} />
```

---

## `web/src/app/globals.css`

```css
.move-token.correct {
  color: var(--green);
  background: rgba(90,122,62,.12);
  outline: 1px solid rgba(90,122,62,.30);
  outline-offset: 1px;
}
.move-token.wrong {
  color: #b23a2a;
  background: rgba(178,58,42,.10);
  text-decoration-line: line-through;
  text-decoration-color: rgba(178,58,42,.45);
}
.move-token.illegal {
  color: #9a5700;
  background: rgba(154,87,0,.10);
  outline: 1px dashed rgba(154,87,0,.45);
  outline-offset: 1px;
}
.error-box {
  padding: 6px 10px;
  margin: 6px 0 0;
  background: rgba(168,51,31,.08);
  border: 1px solid var(--red-edge);
  border-radius: 4px;
  font-size: 13px;
  color: var(--red);
}
```

CSS variable `--green: #5a7a3e` must be added to `:root` if not already present.

---

## `web/src/components/__tests__/PuzzleGame.test.tsx` (8 new tests)

Mock setup additions at the top of the file:

```typescript
vi.mock('@/lib/chessEngine', () => ({
  evalNodes:      vi.fn().mockResolvedValue(new Map()),
  warmUpEngine:   vi.fn(),
}));

// Update MoveTree mock to capture checkResult
let capturedCheckResult: Map<string, string> | null | undefined;
vi.mock('../MoveTree', () => ({
  default: ({ lines, onTokenClick, checkResult }: { ... }) => {
    capturedCheckResult = checkResult;
    capturedOnTokenClick = onTokenClick;
    return <div data-testid="move-tree" data-lines={lines.length} />;
  },
}));
```

```
describe('PuzzleGame — Solution Checking')
  ✓ Submit Solution button renders
  ✓ Submit with empty tree is a no-op (evalNodes not called, checkResult stays null)
  ✓ Submit calls classifyWithoutEngine + evalNodes
  ✓ checkResult is passed to MoveTree after submit
  ✓ recording a new move after submit clears checkResult
  ✓ Undo after submit clears checkResult
  ✓ Reset after submit clears checkResult
  ✓ Submit button is disabled while isChecking
```

---

## TDD

**RED:** `checkResult` not wired, Submit doesn't call engine → tests 3–4 fail. Min RED: 4.

**GREEN:**
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 83/83 green (75 existing + 8 new)
```

## Test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `web/.../PuzzleGame.test.tsx` | 75 | +8 | 83 |
| All other web tests | unchanged | — | — |
| **web total** | **75** | **+8** | **83** |
