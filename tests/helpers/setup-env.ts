import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TEST_DATABASE_URL, PORT } = require('../../scripts/test-db.js')

// Every test talks to the throwaway database. Refuse anything else so a test can
// never wipe the shop's real data.
const databaseUrl: string = process.env.TEST_DATABASE_URL ?? TEST_DATABASE_URL
process.env.DATABASE_URL = databaseUrl
if (new URL(databaseUrl).port !== String(PORT)) {
  throw new Error(`Tests must use the test database on port ${PORT}`)
}

// Uploads go to a scratch folder, never public/uploads
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunflower-uploads-'))
process.env.UPLOADS_DIR = uploadsDir
// Backups too (including the automatic one restore --replace takes): never the real backups/
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunflower-backups-'))
process.env.BACKUP_DIR = backupDir
afterAll(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true })
  fs.rmSync(backupDir, { recursive: true, force: true })
})
delete process.env.PRINTER_VID
delete process.env.PRINTER_PID
