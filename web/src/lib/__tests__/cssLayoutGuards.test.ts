// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const CSS = path.resolve(__dirname, '../../../src/app/globals.css')

describe('CSS layout guards', () => {
  it('white-space: pre is on .tree-line, not .move-tree', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    const moveTreeBlock = src.match(/\.move-tree\s*\{[^}]*\}/)?.[0] ?? ''
    expect(moveTreeBlock).not.toBe('')
    expect(moveTreeBlock).not.toContain('white-space')

    const treeLineBlock = src.match(/\.tree-line\s*\{[^}]*\}/)?.[0] ?? ''
    expect(treeLineBlock).not.toBe('')
    expect(treeLineBlock).toContain('white-space: pre')
  })

  it('move-token.fixed has position: static to override Tailwind position:fixed', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
    expect(fixedBlock).not.toBe('')
    expect(fixedBlock).toContain('position: static')    // CRITICAL Tailwind override must remain
    expect(fixedBlock).not.toContain('display: block')  // must NOT revert to standalone block
  })

  it('move-token.fixed has a dark background chip (must not revert to transparent)', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    const fixedBlock = src.match(/\.move-token\.fixed\s*\{[^}]*\}/)?.[0] ?? ''
    expect(fixedBlock).not.toBe('')
    expect(fixedBlock).toContain('background:')         // dark chip must have a background
    expect(fixedBlock).not.toContain('opacity: 0.80')   // faded ghost must not return
  })

  it('move-token.fixed.active rule exists and suppresses cursor-pulse animation', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    const fixedActiveBlock = src.match(/\.move-token\.fixed\.active\s*\{[^}]*\}/)?.[0] ?? ''
    expect(fixedActiveBlock).not.toBe('')               // rule must exist
    expect(fixedActiveBlock).toContain('animation: none') // cursor-pulse must be suppressed
  })

  it('.tour-scrim overlay uses inline styles — selector must not exist in globals.css', () => {
    const src = fs.readFileSync(CSS, 'utf8')
    // Scrim is positioned via React inline style props (TourGuide.tsx).
    // A CSS selector here silently fails in Next.js dev mode.
    expect(src).not.toMatch(/\.tour-scrim\s*\{/)
  })

  it('PuzzleBoard imports Key from @lichess-org/chessground/types, not /dist/types', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/PuzzleBoard.tsx'),
      'utf8',
    )
    // /dist/types fails on Vercel (bundler moduleResolution enforces exports map)
    // but silently works locally — guard prevents silent regression.
    expect(src).toContain("from '@lichess-org/chessground/types'")
    expect(src).not.toContain("from '@lichess-org/chessground/dist/types'")
  })

  // ── Phase 6.8.9 guards — fluid CSS (px → rem) ──────────────────────

  it('--board-size formula uses rem cap, not px', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    // Old form that must NOT appear after the refactor:
    //   --board-size: min(480px, ...)
    //   --board-size: min(380px, ...)
    expect(src).not.toMatch(/--board-size:\s*min\(\d+px/)

    // New form that MUST be present:
    //   --board-size: min(30rem, ...)  or  min(23.75rem, ...)
    expect(src).toMatch(/--board-size:\s*min\([\d.]+rem/)
  })

  it('board-container has no explicit px width/height override inside @media blocks', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    // Old pattern that must be gone after refactor:
    //   .board-container { width:  min(480px, calc(100vw - 80px)); ... }  (960px block)
    //   .board-container { width:  min(380px, calc(100vw - 52px)); ... }  (600px block)
    //
    // After the refactor .board-container only uses var(--board-size) — no direct px override.
    expect(src).not.toMatch(/\.board-container\s*\{[^}]*width:\s*min\(\d+px/)
    expect(src).not.toMatch(/\.board-container\s*\{[^}]*height:\s*min\(\d+px/)
  })

  it('app-header height uses rem, not px', () => {
    const src = fs.readFileSync(CSS, 'utf8')

    const headerBlock = src.match(/\.app-header\s*\{[^}]*\}/)?.[0] ?? ''
    expect(headerBlock).not.toBe('')

    // Must not contain a raw-px height (e.g. height: 56px)
    expect(headerBlock).not.toMatch(/height:\s*\d+px/)

    // Must contain a rem height (e.g. height: 3.5rem)
    expect(headerBlock).toMatch(/height:\s*[\d.]+rem/)
  })
})
