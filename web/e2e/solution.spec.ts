import { test, expect } from '@playwright/test'

// Board: 480×480px, BLACK orientation (black to move in SAMPLE_FEN)
// file: a=0 b=1 c=2 d=3 e=4 f=5 g=6 h=7
// Black orientation: file h is left (x≈30), file a is right (x≈450); rank 1 top, rank 8 bottom.
const sq = (file: number, rank: number) => ({
  x: (7 - file) * 60 + 30,
  y: (rank - 1) * 60 + 30,
})

const EVAL_TIMEOUT = 90_000  // Stockfish init (~5s) + depth-15 eval

test.describe('Phase 6.4 — Solution Checking Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
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
    const cls = await page.locator('.move-token.player').first().getAttribute('class')
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
    await expect(page.locator('.move-token.player').first()).toHaveClass(/illegal/)
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
    expect(await page.locator('.move-token.player').first().getAttribute('class')).toMatch(/correct|wrong/)
    await page.getByRole('button', { name: /undo/i }).click()
    // Move was undone — no player tokens remain
    await expect(page.locator('.move-token.player')).toHaveCount(0)
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
    expect(await page.locator('.move-token.player').first().getAttribute('class')).toMatch(/correct|wrong/)
    await page.getByRole('button', { name: /reset/i }).click()
    // Tree cleared — no player tokens remain
    await expect(page.locator('.move-token.player')).toHaveCount(0)
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
