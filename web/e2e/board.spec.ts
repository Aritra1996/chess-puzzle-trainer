import { test, expect } from '@playwright/test'

const SAMPLE_FEN = 'r2qkb1r/pp2pppp/2p2n2/8/2BPP1b1/2N5/PPP2PPP/R1BQK2R b KQkq - 0 8'

test.describe('Phase 1 — Static Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // ── Page content ─────────────────────────────────────────────────
  test('shows the page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /visualis/i })
    ).toBeVisible()
  })

  test('displays the FEN string on the page', async ({ page }) => {
    await expect(page.getByText(SAMPLE_FEN)).toBeVisible()
  })

  // ── Board structure ───────────────────────────────────────────────
  test('renders the board container', async ({ page }) => {
    await expect(page.locator('.board-container')).toBeVisible()
  })

  test('board container is 480×480 pixels', async ({ page }) => {
    const box = await page.locator('.board-container').boundingBox()
    expect(box?.width).toBe(480)
    expect(box?.height).toBe(480)
  })

  test('Chessground mounts cg-board inside cg-wrap', async ({ page }) => {
    await expect(page.locator('.cg-wrap cg-board')).toBeVisible()
  })

  // ── Piece rendering ───────────────────────────────────────────────
  test('renders pieces on the board', async ({ page }) => {
    await expect(page.locator('cg-board piece').first()).toBeVisible()
  })

  test('renders exactly 29 pieces for the sample FEN', async ({ page }) => {
    // FEN breakdown: 15 white + 14 black
    await expect(page.locator('cg-board piece')).toHaveCount(29)
  })

  test('white pieces are present', async ({ page }) => {
    const whitePieces = page.locator('cg-board piece.white')
    await expect(whitePieces.first()).toBeVisible()
    expect(await whitePieces.count()).toBe(15)
  })

  test('black pieces are present', async ({ page }) => {
    const blackPieces = page.locator('cg-board piece.black')
    await expect(blackPieces.first()).toBeVisible()
    expect(await blackPieces.count()).toBe(14)
  })

  // ── viewOnly — no interaction ─────────────────────────────────────
  test('clicking a square does not select any piece', async ({ page }) => {
    await page.locator('cg-board').click({ force: true, position: { x: 60, y: 60 } })
    await expect(page.locator('cg-board piece.selected')).toHaveCount(0)
  })

  test('clicking two squares does not show move destinations', async ({ page }) => {
    await page.locator('cg-board').click({ force: true, position: { x: 60, y: 60 } })
    await page.locator('cg-board').click({ force: true, position: { x: 120, y: 60 } })
    await expect(page.locator('cg-board square.move-dest')).toHaveCount(0)
  })

  test('dragging a piece does not change the piece count', async ({ page }) => {
    await expect(page.locator('cg-board piece')).toHaveCount(29)
    const before = await page.locator('cg-board piece').count()
    await page.locator('cg-board').dragTo(page.locator('cg-board'), {
      force: true,
      sourcePosition: { x: 60, y: 420 },
      targetPosition: { x: 60, y: 360 },
    })
    const after = await page.locator('cg-board piece').count()
    expect(after).toBe(before)
  })

  test('piece positions do not change after clicking all over the board', async ({ page }) => {
    const getPositions = () =>
      page.locator('cg-board piece').evaluateAll((pieces) =>
        pieces.map((p) => (p as HTMLElement).style.transform)
      )

    await expect(page.locator('cg-board piece')).toHaveCount(29)
    const before = await getPositions()

    const board = page.locator('cg-board')
    for (const pos of [
      { x: 60, y: 60 }, { x: 180, y: 180 },
      { x: 300, y: 300 }, { x: 420, y: 420 },
    ]) {
      await board.click({ force: true, position: pos })
    }

    const after = await getPositions()
    expect(after).toEqual(before)
  })

  test('board shrinks below 480 px at a short viewport', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 600 } })
    const page = await ctx.newPage()
    await page.goto('/')
    const box = await page.locator('.board-container').boundingBox()
    expect(box!.width).toBeLessThan(480)
    expect(box!.width).toBeGreaterThan(200)
    await ctx.close()
  })

  test('meta-strip bottom edge stays within viewport at a short viewport', async ({ browser }) => {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 600 } })
    const page = await ctx.newPage()
    await page.goto('/')
    const strip    = await page.locator('.meta-strip').boundingBox()
    const viewport = page.viewportSize()
    expect(strip!.y + strip!.height).toBeLessThanOrEqual(viewport!.height)
    await ctx.close()
  })
})
