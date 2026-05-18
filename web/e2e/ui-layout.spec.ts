import { test, expect } from '@playwright/test'

// Black orientation: x = (7 - file) * 60 + 30,  y = (rank - 1) * 60 + 30
const sq = (file: number, rank: number) => ({ x: (7 - file) * 60 + 30, y: (rank - 1) * 60 + 30 })

test.describe('Phase 6.6 — Tree Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
    await page.goto('/')
  })

  test('board renders without coordinate labels', async ({ page }) => {
    // Wait for Chessground to finish initialising (pieces present = useEffect ran)
    await expect(page.locator('cg-board piece')).not.toHaveCount(0)
    await expect(page.locator('.cg-wrap coords')).toHaveCount(0)
  })

  test('last-move squares are rendered on the board when lastMoveUci is wired in page.tsx', async ({ page }) => {
    const lastMoveSquares = page.locator('cg-board square.last-move')
    await expect(lastMoveSquares).toHaveCount(2)  // from-square (f1) + to-square (c4)
  })

  test('context token and first recorded move are on the same row', async ({ page }) => {
    const board = page.locator('.board-container')
    await board.click({ position: sq(5, 6) })  // f6
    await board.click({ position: sq(3, 5) })  // d5 → Nd5

    const contextToken   = page.locator('.move-token.fixed').first()
    const firstMoveToken = page.locator('.move-token.player').first()

    await expect(contextToken).toBeVisible()
    await expect(firstMoveToken).toBeVisible()

    const tokenBox = await contextToken.boundingBox()
    const moveBox  = await firstMoveToken.boundingBox()

    expect(tokenBox).not.toBeNull()
    expect(moveBox).not.toBeNull()

    // Inline layout: both tokens share the same text baseline.
    // Their top edges must be within 8 px of each other.
    expect(Math.abs(tokenBox!.y - moveBox!.y)).toBeLessThanOrEqual(8)
  })

})
