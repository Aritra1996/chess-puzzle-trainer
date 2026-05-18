import { test, expect } from '@playwright/test'

// Board is 480×480px, BLACK orientation (black to move auto-orients).
// Black orientation: file h is left (x≈0), file a is right. Rank 1 is top, rank 8 is bottom.
// Formula: x = (7 - file) * 60 + 30,  y = (rank - 1) * 60 + 30
const sq = (file: number, rank: number) => ({
  x: (7 - file) * 60 + 30,
  y: (rank - 1) * 60 + 30,
})

test.describe('Phase 3 — Move Recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
    await page.goto('/')
  })

  test('click overlay is present on the board', async ({ page }) => {
    await expect(page.locator('[data-testid="click-overlay"]')).toBeVisible()
  })

  test('clicking two squares adds a move to the analysis tree', async ({ page }) => {
    const board = page.locator('.board-container')
    // f6 → d5: Nd5 is a legal black knight move from SAMPLE_FEN
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.locator('.move-token').first()).toBeVisible()
  })

  test('recorded move appears in algebraic notation not raw UCI', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.locator('.move-token.player', { hasText: 'Nd5' })).toBeVisible()
  })

  test('status bar updates after the first move is recorded', async ({ page }) => {
    await expect(page.getByText(/no moves recorded/i)).toBeVisible()
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.getByText(/no moves recorded/i)).not.toBeVisible()
  })

  test('board piece count is unchanged after recording a move', async ({ page }) => {
    await expect(page.locator('cg-board piece')).toHaveCount(29)
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.locator('cg-board piece')).toHaveCount(29)
  })

  test('clicking the same square twice does not record a move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(5, 6) })
    await expect(page.locator('.move-token.player')).toHaveCount(0)
  })

  test('square selection appears after the first click', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await expect(page.locator('cg-board square.selected')).toBeVisible()
  })

  test('square selection disappears after completing a move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.locator('cg-board square.selected')).not.toBeVisible()
  })
})
