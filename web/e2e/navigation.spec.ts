import { test, expect } from '@playwright/test'

// SAMPLE_FEN is black-to-move; board auto-orients to black.
// Black orientation formula: x = (7 - file_0idx) * 60 + 30,  y = (rank - 1) * 60 + 30
// f6 → d5  (Nd5 — legal black knight move)
// a2 → a3  (a3  — legal white pawn move)
const sq = (file: number, rank: number) => ({ x: (7 - file) * 60 + 30, y: (rank - 1) * 60 + 30 })

test.describe('Phase 4 — Tree Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('initial depth is 0 and breadcrumb shows "start"', async ({ page }) => {
    await expect(page.locator('.an-stats')).toContainText('depth 0')
    await expect(page.locator('.breadcrumb')).toContainText('start')
  })

  test('depth counter becomes 1 after recording one move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })  // f6
    await board.click({ position: sq(3, 5) })  // d5 → Nd5
    await expect(page.locator('.an-stats')).toContainText('depth 1')
  })

  test('breadcrumb shows the SAN of the recorded move', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })
    await expect(page.locator('.breadcrumb')).toContainText('Nd5')
  })

  test('clicking a move token in the tree sets it as the active cursor', async ({ page }) => {
    const board = page.locator('.board-container')
    // Record two moves so there is a non-active token to click
    await board.click({ position: sq(5, 6) }); await board.click({ position: sq(3, 5) })  // Nd5
    await board.click({ position: sq(0, 1) }); await board.click({ position: sq(0, 2) })  // a3
    // cursor is now at a3; click the Nd5 token to navigate back
    await page.locator('.move-token', { hasText: 'Nd5' }).click()
    await expect(page.locator('.move-token.active')).toHaveText('Nd5')
  })

  test('ArrowLeft key moves cursor to parent (active token is lost)', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })
    await board.click({ position: sq(3, 5) })  // Nd5 is now active
    await expect(page.locator('.move-token.active')).toHaveText('Nd5')
    await page.keyboard.press('ArrowLeft')
    // cursor moved to root sentinel (san = '') — no token gets active
    await expect(page.locator('.move-token.active')).toHaveCount(0)
  })
})
