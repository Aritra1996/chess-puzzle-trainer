import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
  await page.goto('/')
})

test('board is visible and not overflowing on mobile', async ({ page }) => {
  const board = page.locator('.board-container')
  await expect(board).toBeVisible()
  const box = await board.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(375)
  expect(box!.x).toBeGreaterThanOrEqual(0)
})

test('board pieces render on mobile', async ({ page }) => {
  await expect(page.locator('cg-board piece')).not.toHaveCount(0)
})

test('header nav is hidden on mobile', async ({ page }) => {
  await expect(page.locator('.header-nav')).toBeHidden()
})

test('puzzle chips are hidden on mobile', async ({ page }) => {
  await expect(page.locator('.header-puzzle')).toBeHidden()
})

test('keyboard hints are hidden on mobile', async ({ page }) => {
  await expect(page.locator('.kb-hints')).toBeHidden()
})

test('action buttons are visible and not clipped', async ({ page }) => {
  const submit = page.locator('.btn-primary')
  await expect(submit).toBeVisible()
  const box = await submit.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
})

test('submit button has adequate touch height (≥ 40px)', async ({ page }) => {
  const submit = page.locator('.btn-primary')
  await expect(submit).toBeVisible()
  const box = await submit.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(40)
})

test('move tree is visible', async ({ page }) => {
  await expect(page.locator('.move-tree')).toBeVisible()
})

test('can record a move by tapping on mobile', async ({ page }) => {
  const board = page.locator('.board-container')
  await expect(page.locator('cg-board piece')).not.toHaveCount(0)

  const box = await board.boundingBox()
  const sq  = (file: number, rank: number) => ({
    x: box!.x + ((7 - file) + 0.5) * box!.width  / 8,  // black orientation
    y: box!.y + ((rank - 1) + 0.5) * box!.height / 8,
  })

  // f6 → d5 (Nd5 — legal black knight move from SAMPLE_FEN)
  const from = sq(5, 6)
  const to   = sq(3, 5)
  await page.mouse.click(from.x, from.y)
  await page.mouse.click(to.x,   to.y)

  await expect(page.locator('.an-stats')).toContainText('nodes')
})

test('board fits and is visible on a 320px narrow phone', async ({ browser }) => {
  // Uses browser.newContext so this test can run its own viewport independently
  // of the test.use({ width: 375 }) set at the top of the file.
  const ctx  = await browser.newContext({ viewport: { width: 320, height: 568 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('visualis_tour_seen', '1'))
  await page.goto('/')

  const board = page.locator('.board-container')
  await expect(board).toBeVisible()

  const box = await board.boundingBox()
  // Board must fit horizontally within the 320px viewport
  expect(box!.width).toBeLessThanOrEqual(320)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  // Board must be large enough to be usable (min ~200px)
  expect(box!.width).toBeGreaterThan(200)

  await ctx.close()
})
