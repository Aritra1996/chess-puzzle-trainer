import { test, expect } from '@playwright/test'

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

test.describe('Phase 2.1 — Paper/Ink UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the Visualis brand heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /visualis/i })).toBeVisible()
  })

  test('shows the puzzle chip with id #4521', async ({ page }) => {
    await expect(page.locator('.chip', { hasText: '#4521' })).toBeVisible()
  })

  test('shows the rating chip', async ({ page }) => {
    await expect(page.locator('.chip.rating')).toBeVisible()
  })

  test('shows nav links in the header', async ({ page }) => {
    await expect(page.locator('.nav-link', { hasText: 'Library' })).toBeVisible()
  })

  test('turn plate shows "Black to move"', async ({ page }) => {
    await expect(page.locator('.turn-plate')).toContainText('Black to move')
  })

  test('board mat wraps the board container', async ({ page }) => {
    await expect(page.locator('.board-mat .board-container')).toBeVisible()
  })

  test('meta strip shows the FEN label and value', async ({ page }) => {
    await expect(page.locator('.meta-strip')).toContainText('FEN')
    await expect(page.locator('.meta-strip .val')).toContainText(SAMPLE_FEN)
  })

  test('analysis panel shows "Move tree" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /move tree/i })).toBeVisible()
  })

  test('move tree renders player move tokens in blue', async ({ page }) => {
    const overlay = page.locator('.click-overlay')
    await overlay.click({ position: { x: 150, y: 330 } })  // f6 (black orient)
    await overlay.click({ position: { x: 270, y: 270 } })  // d5 (player: black → Nd5)
    await expect(page.locator('.move-token.player').first()).toBeVisible()
  })

  test('move tree renders opponent move tokens in red', async ({ page }) => {
    const overlay = page.locator('.click-overlay')
    await overlay.click({ position: { x: 150, y: 330 } })  // f6 (black orient)
    await overlay.click({ position: { x: 270, y: 270 } })  // d5 (player: black → Nd5)
    await overlay.click({ position: { x: 450, y: 90 } })   // a2 (black orient)
    await overlay.click({ position: { x: 450, y: 150 } })  // a3 (opponent: white → a3)
    await expect(page.locator('.move-token.opponent').first()).toBeVisible()
  })

  test('recording status shows "no moves recorded"', async ({ page }) => {
    await expect(page.locator('.rec-text')).toContainText('no moves recorded')
  })

  test('Submit solution button is present', async ({ page }) => {
    await expect(page.locator('.btn-primary')).toContainText('Submit solution')
  })

  test('board starts with black pieces at the bottom for a black-to-move FEN', async ({ page }) => {
    const boardBox = await page.locator('.board-container').boundingBox()
    const queenBox = await page.locator('cg-board piece.black.queen').boundingBox()
    expect(queenBox!.y).toBeGreaterThan(boardBox!.y + boardBox!.height * 0.6)
  })

  test('clicking the flip button shows white pieces at the bottom', async ({ page }) => {
    await page.locator('button[title="flip board"]').click()
    const boardBox = await page.locator('.board-container').boundingBox()
    const queenBox = await page.locator('cg-board piece.black.queen').boundingBox()
    expect(queenBox!.y).toBeLessThan(boardBox!.y + boardBox!.height * 0.4)
  })
})
