import fs from 'fs'
import os from 'os'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const testDb = require('../../scripts/test-db.js')

export default async function globalSetup() {
  await testDb.up()
  const uploads = path.join(os.tmpdir(), 'sunflower-e2e-uploads')
  fs.rmSync(uploads, { recursive: true, force: true })
  fs.mkdirSync(uploads, { recursive: true })
}
