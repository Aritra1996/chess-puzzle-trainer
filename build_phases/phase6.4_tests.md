# Phase 6.4 Tests — Browser Smoke Test

## Context

Phase 6.4 is the final sub-phase of Phase 6. Two kinds of tests are needed:

**A — Build error regression guards** (Vitest, Node environment)
Two build errors surfaced during integration: webpack tried to bundle the stockfish JS file and
hit Node-only `require('fs')`. These guards prevent the same class of mistake from recurring.

**B — E2E browser smoke tests** (Playwright)
Automates the 7-item manual checklist in `phase6.4.md`: engine pre-warm, loading state, token
colour classes, clear on Undo/Reset, zero API calls.

No existing test files are modified.

---

## Files

| File | Action | Tests |
|------|--------|-------|
| `web/src/lib/__tests__/chessEngineGuards.test.ts` | **CREATE** | 4 Vitest guards |
| `web/e2e/solution.spec.ts` | **CREATE** | 7 Playwright E2E |

---

## Part A — Build Error Regression Guards

### What went wrong

| Error | Root cause | Fix |
|-------|-----------|-----|
| `Can't resolve 'stockfish/src/stockfish-nnue-16.js'` | Wrong package path (v16 path, v18 installed) | Changed to `stockfish/bin/stockfish-18-lite-single.js` |
| `Can't resolve 'fs'` | `new URL('stockfish/…', import.meta.url)` caused webpack to bundle the stockfish JS file; the file contains Node-only `require('fs')` | Changed to plain string `new Worker('/stockfish-18-lite-single.js')`; files copied to `public/` |

### Guard tests

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const WEB    = path.resolve(__dirname, '../../../')
const PUBLIC = path.join(WEB, 'public')
const ENGINE = path.join(WEB, 'src/lib/chessEngine.ts')

describe('chessEngine — build error guards', () => {
  it('worker uses a plain string URL — webpack cannot bundle it', () => {
    const src = fs.readFileSync(ENGINE, 'utf8')
    // new URL('stockfish/…', import.meta.url) caused webpack to bundle the file → fs error
    expect(src).not.toMatch(/new URL\(['"]stockfish/)
    expect(src).toContain("new Worker('/stockfish-18-lite-single.js')")
  })

  it('public/stockfish-18-lite-single.js exists (served statically, not bundled)', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'stockfish-18-lite-single.js'))).toBe(true)
  })

  it('public/stockfish-18-lite-single.wasm exists (engine needs both files)', () => {
    expect(fs.existsSync(path.join(PUBLIC, 'stockfish-18-lite-single.wasm'))).toBe(true)
  })

  it('package.json postinstall copies stockfish files to public/', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(WEB, 'package.json'), 'utf8'))
    expect(pkg.scripts?.postinstall).toMatch(/stockfish-18-lite-single/)
  })
})
```

These guards are **already green** because the build errors were fixed before writing the plan.
They are regression insurance — they fail if someone accidentally reverts the fix.

---

## Part B — E2E Browser Smoke Tests

### Square coordinate helper

Board is 480×480 px. For SAMPLE_FEN black to move, orientation auto-derives to **black**:
- File h is left (x ≈ 30), file a is right (x ≈ 450)
- Rank 1 is top (y ≈ 30), rank 8 is bottom (y ≈ 450)

```typescript
// file: a=0  b=1  c=2  d=3  e=4  f=5  g=6  h=7
const sq = (file: number, rank: number) => ({
  x: (7 - file) * 60 + 30,
  y: (rank - 1) * 60 + 30,
})
```

### Moves used in tests

| Move | UCI | Type | Squares | Why |
|------|-----|------|---------|-----|
| Nd5 | `f6d5` | legal | f6 → d5 | Black knight move, standard from SAMPLE_FEN |
| d1d2 | `d1d2` | **illegal** | d1 → d2 | Tries to move WHITE queen when it's black's turn |

For the "token gets status class" test the engine decides correct/wrong — the test only checks
that SOME status class (`correct` or `wrong`) appears, not which one.

### E2E test file

```typescript
import { test, expect } from '@playwright/test'

// Board: 480×480px, BLACK orientation (black to move in SAMPLE_FEN)
// file: a=0 b=1 c=2 d=3 e=4 f=5 g=6 h=7
const sq = (file: number, rank: number) => ({
  x: (7 - file) * 60 + 30,
  y: (rank - 1) * 60 + 30,
})

const EVAL_TIMEOUT = 90_000  // Stockfish init (~5s) + depth-15 eval

test.describe('Phase 6.4 — Solution Checking Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // 1 — Engine pre-warm
  test('Stockfish JS starts downloading on page load before Submit is clicked', async ({ page }) => {
    const sfRequest = page.waitForRequest(
      req => req.url().includes('stockfish-18-lite-single'),
      { timeout: 10_000 },
    )
    await page.goto('/')
    await sfRequest  // must resolve without any user interaction
  })

  // 2 — Submit button initially enabled
  test('Submit Solution button is enabled before any moves are recorded', async ({ page }) => {
    await expect(page.getByRole('button', { name: /submit solution/i })).toBeEnabled()
  })

  // 3 — Loading state
  test('Submit shows "Checking…" and is disabled while Stockfish evaluates', async ({ page }) => {
    test.setTimeout(30_000)
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })  // f6
    await board.click({ position: sq(3, 5) })  // d5  → Nd5
    await page.getByRole('button', { name: /submit solution/i }).click()
    // Loading state is observable immediately after click (before engine resolves)
    await expect(page.getByRole('button', { name: /checking/i })).toBeDisabled()
  })

  // 4 — Token status class after submit (engine result)
  test('move token gets a check status class (correct or wrong) after Stockfish finishes', async ({ page }) => {
    test.setTimeout(EVAL_TIMEOUT)
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await page.getByRole('button', { name: /submit solution/i }).click()
    // Wait for eval to finish — button re-enables
    await expect(
      page.getByRole('button', { name: /submit solution/i }),
    ).toBeEnabled({ timeout: EVAL_TIMEOUT - 5_000 })
    const cls = await page.locator('.move-token').first().getAttribute('class')
    expect(cls).toMatch(/correct|wrong/)
  })

  // 5 — Illegal move token (no engine needed — sync classification)
  test('illegal move token gets .illegal class immediately after submit', async ({ page }) => {
    test.setTimeout(20_000)
    const board = page.locator('.board-container')
    // d1→d2: tries to move white queen when it is black's turn → illegal
    await board.click({ position: sq(3, 1) })  // d1
    await board.click({ position: sq(3, 2) })  // d2
    await page.getByRole('button', { name: /submit solution/i }).click()
    // No engine eval needed — button re-enables fast
    await expect(
      page.getByRole('button', { name: /submit solution/i }),
    ).toBeEnabled({ timeout: 5_000 })
    await expect(page.locator('.move-token').first()).toHaveClass(/illegal/)
  })

  // 6 — Undo clears check state
  test('pressing Undo after submit removes all check classes', async ({ page }) => {
    test.setTimeout(EVAL_TIMEOUT)
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await page.getByRole('button', { name: /submit solution/i }).click()
    await expect(
      page.getByRole('button', { name: /submit solution/i }),
    ).toBeEnabled({ timeout: EVAL_TIMEOUT - 5_000 })
    // Confirm a status class is present before undoing
    expect(await page.locator('.move-token').first().getAttribute('class')).toMatch(/correct|wrong/)
    await page.getByRole('button', { name: /undo/i }).click()
    // Move was undone — no tokens remain
    await expect(page.locator('.move-token')).toHaveCount(0)
  })

  // 7 — Reset clears check state
  test('pressing Reset after submit removes all check classes', async ({ page }) => {
    test.setTimeout(EVAL_TIMEOUT)
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await page.getByRole('button', { name: /submit solution/i }).click()
    await expect(
      page.getByRole('button', { name: /submit solution/i }),
    ).toBeEnabled({ timeout: EVAL_TIMEOUT - 5_000 })
    expect(await page.locator('.move-token').first().getAttribute('class')).toMatch(/correct|wrong/)
    await page.getByRole('button', { name: /reset/i }).click()
    await expect(page.locator('.move-token')).toHaveCount(0)
  })

  // 8 — Zero API calls (all client-side)
  test('no XHR or fetch calls to /api/ are made during submit', async ({ page }) => {
    test.setTimeout(EVAL_TIMEOUT)
    const apiCalls: string[] = []
    page.on('request', req => {
      if (
        (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') &&
        req.url().includes('/api/')
      ) {
        apiCalls.push(req.url())
      }
    })
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await page.getByRole('button', { name: /submit solution/i }).click()
    await expect(
      page.getByRole('button', { name: /submit solution/i }),
    ).toBeEnabled({ timeout: EVAL_TIMEOUT - 5_000 })
    expect(apiCalls).toHaveLength(0)
  })
})
```

---

## 🔴 RED

### Vitest guards
Already green — fixes were applied before writing tests. These guards never had a RED phase
in this session; they exist to prevent regression.

### E2E tests
New file — all 7 tests are RED (file doesn't exist yet).

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm run test:e2e -- --reporter=list
# Expected: 7 failures in solution.spec.ts (file doesn't exist)
```

---

## 🟢 GREEN

### Step 1 — Create the Vitest guard file

Create `web/src/lib/__tests__/chessEngineGuards.test.ts` with the 4 tests above.

Verify:
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test -- --reporter=verbose
# Expect: 91/91 green (87 existing + 4 guards)
```

### Step 2 — Create the E2E spec file

Create `web/e2e/solution.spec.ts` with the 7 E2E tests above.

Verify (requires dev server — Playwright starts it automatically):
```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm run test:e2e -- e2e/solution.spec.ts --reporter=list
# Expect: 7/7 green
# Note: tests 4, 6, 7, 8 take up to 90s each (Stockfish eval) — total ~5–10 min
```

---

## 🟡 YELLOW

```bash
cd /home/aritra/Claude/chess-puzzle-trainer/web && npm test
# Expect: 91/91 green (no regressions)

cd /home/aritra/Claude/chess-puzzle-trainer/web && npm run test:e2e
# Expect: all E2E suites green (existing + new solution.spec.ts)
```

---

## Test count

| Suite | Before | +new | After |
|-------|--------|------|-------|
| `chessEngineGuards.test.ts` | 0 | +4 | 4 |
| All other Vitest | 87 | — | 87 |
| **Vitest total** | **87** | **+4** | **91** |
| `solution.spec.ts` | 0 | +7 | 7 |
| All other E2E | existing | — | — |
| **E2E total** | existing | **+7** | existing + 7 |

---

## Notes

- **Stockfish eval timeout**: depth-15 eval on a cold engine can take 30–60 s on slow hardware.
  `EVAL_TIMEOUT = 90_000` gives comfortable headroom. Adjust down once typical run time is known.
- **Test 4 correctness assertion**: `expect(cls).toMatch(/correct|wrong/)` — does not assert
  which the engine picks, only that it classified. Engine decision depends on eval depth/score.
- **Test 5 speed**: illegal classification is sync (no Stockfish). Button re-enables in <1 s.
  `timeout: 5_000` is intentionally tight to catch regressions where illegal moves accidentally
  go to the engine.
- **`postinstall` guard (test 4)**: if stockfish is re-installed without the postinstall running
  (e.g., `npm install stockfish --ignore-scripts`), the public files would be stale. The guard
  documents that the script must stay in place.
