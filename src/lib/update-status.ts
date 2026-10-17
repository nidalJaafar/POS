import fs from 'fs'
import path from 'path'

export interface UpdateNotice {
  tone: 'ok' | 'error'
  message: string
}

const DAY = 24 * 60 * 60 * 1000

/**
 * What the sidebar should say about the last update, if anything. The updater writes
 * <POS_HOME>/shared/update-status.json; POS_HOME is only set on the shop laptop.
 */
export function readUpdateNotice(now = Date.now()): UpdateNotice | null {
  const home = process.env.POS_HOME
  if (!home) return null
  let status: { ok?: boolean; message?: string; at?: string; failedVersion?: string; checkError?: string }
  try {
    status = JSON.parse(fs.readFileSync(path.join(home, 'shared', 'update-status.json'), 'utf8'))
  } catch {
    return null
  }
  const age = now - new Date(status.at ?? 0).getTime()
  if (status.checkError && /private, or rate limit/.test(status.checkError)) {
    return { tone: 'error', message: 'Updates paused: GitHub refused access' }
  }
  if (status.ok === false && status.failedVersion && age < 7 * DAY) {
    return { tone: 'error', message: `Update to ${status.failedVersion} failed; still on the previous version` }
  }
  if (status.ok && status.message && /^(Updated|Rolled back)/.test(status.message) && age < 3 * DAY) {
    return { tone: 'ok', message: status.message }
  }
  return null
}
