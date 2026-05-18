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
})
