import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { readUpdateNotice } from '@/lib/update-status'

const DAY = 24 * 60 * 60 * 1000
let home: string | null = null

function withStatus(status: object) {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'sunflower-status-'))
  fs.mkdirSync(path.join(home, 'shared'))
  fs.writeFileSync(path.join(home, 'shared', 'update-status.json'), JSON.stringify(status))
  process.env.POS_HOME = home
}

afterEach(() => {
  delete process.env.POS_HOME
  if (home) fs.rmSync(home, { recursive: true, force: true })
  home = null
})

describe('readUpdateNotice', () => {
  const at = new Date('2026-10-17T10:00:00Z').getTime()

  it('shows a recent successful update for three days', () => {
    withStatus({ ok: true, message: 'Updated to 1.0.2', at: new Date(at).toISOString() })
    expect(readUpdateNotice(at + DAY)).toEqual({ tone: 'ok', message: 'Updated to 1.0.2' })
    expect(readUpdateNotice(at + 4 * DAY)).toBeNull()
  })

  it('shows a failed update for a week', () => {
    withStatus({ ok: false, failedVersion: '1.0.3', message: 'x', at: new Date(at).toISOString() })
    expect(readUpdateNotice(at + 6 * DAY)?.tone).toBe('error')
    expect(readUpdateNotice(at + 8 * DAY)).toBeNull()
  })

  it('keeps warning about a token GitHub refuses', () => {
    withStatus({ ok: true, checkError: 'GitHub refused the token (expired or revoked?)', at: new Date(at).toISOString() })
    expect(readUpdateNotice(at + 30 * DAY)?.message).toMatch(/token needs replacing/)
  })

  it('says nothing for a plain install, or off the shop laptop', () => {
    withStatus({ ok: true, message: 'Installed 1.0.2', at: new Date(at).toISOString() })
    expect(readUpdateNotice(at)).toBeNull()
    delete process.env.POS_HOME
    expect(readUpdateNotice(at)).toBeNull()
  })
})
