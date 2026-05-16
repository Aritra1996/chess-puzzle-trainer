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
