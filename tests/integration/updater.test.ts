import crypto from 'crypto'
import { execFileSync } from 'child_process'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const updater = require('../../scripts/updater.js')

const tempDirs: string[] = []
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunflower-updater-'))
  tempDirs.push(dir)
  return dir
}

// A release folder shaped like the real one (release.json, app/, node/, start.cmd)
function fakeRelease(version: string) {
  const dir = tempDir()
  fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify({ version }))
  fs.mkdirSync(path.join(dir, 'app', 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'app', 'package.json'), JSON.stringify({ version }))
  fs.mkdirSync(path.join(dir, 'node'))
  fs.writeFileSync(path.join(dir, 'start.cmd'), '@echo off\r\n')
  return dir
}

function zipFolder(dir: string, out: string) {
  if (process.platform === 'win32') {
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    execFileSync(tar, ['-a', '-cf', out, '-C', dir, '.'])
  } else {
    execFileSync('zip', ['-qr', out, '.'], { cwd: dir })
  }
}

interface FakeGitHub {
  url: string
  storageRequests: { authorization?: string }[]
  close: () => Promise<unknown>
}

// Stands in for api.github.com: latest release, asset redirects to "storage"
async function fakeGitHub(options: { version: string; zip: Buffer; sha?: string; status?: number }): Promise<FakeGitHub> {
  const zipName = `sunflower-pos-v${options.version}-win-x64.zip`
  const sha = options.sha ?? crypto.createHash('sha256').update(options.zip).digest('hex')
  const storageRequests: { authorization?: string }[] = []
  const server = http.createServer((req, res) => {
    const url = req.url ?? ''
    if (options.status) return res.writeHead(options.status).end()
    if (url === '/repos/shop/pos/releases/latest') {
      if (req.headers.authorization !== 'Bearer test-token') return res.writeHead(401).end()
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          tag_name: `v${options.version}`,
          assets: [
            { id: 1, name: zipName },
            { id: 2, name: `${zipName}.sha256` },
          ],
        })
      )
    }
    if (url === '/repos/shop/pos/releases/assets/1') return res.writeHead(302, { Location: '/storage/zip' }).end()
    if (url === '/repos/shop/pos/releases/assets/2') return res.writeHead(302, { Location: '/storage/sha' }).end()
    if (url.startsWith('/storage/')) {
      storageRequests.push({ authorization: req.headers.authorization })
      if (url === '/storage/zip') return res.writeHead(200).end(options.zip)
      return res.writeHead(200).end(`${sha}  ${zipName}`)
    }
    res.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }
  return { url: `http://127.0.0.1:${port}`, storageRequests, close: () => new Promise((r) => server.close(r)) }
}

// A home folder with version 1.0.0 installed
function installedHome() {
  const home = tempDir()
  const p = updater.paths(home)
  fs.mkdirSync(path.join(p.releases, '1.0.0', 'app'), { recursive: true })
  fs.mkdirSync(p.shared, { recursive: true })
  fs.writeFileSync(p.env, 'DATABASE_URL="postgresql://shop"\n')
  fs.writeFileSync(p.current, '1.0.0')
  fs.writeFileSync(p.config, JSON.stringify({ repo: 'shop/pos', token: 'test-token' }))
  return p
}

function releaseZip(version: string) {
  const out = path.join(tempDir(), 'release.zip')
  zipFolder(fakeRelease(version), out)
  return fs.readFileSync(out)
}

const calls: string[] = []
const okHooks = {
  backup: () => calls.push('backup'),
  migrate: () => calls.push('migrate'),
  healthCheck: async () => {
    calls.push('health')
  },
}

let server: FakeGitHub | null = null
beforeEach(() => {
  calls.length = 0
})
afterEach(async () => {
  await server?.close()
  server = null
  delete process.env.UPDATER_API_URL
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

async function serve(options: Parameters<typeof fakeGitHub>[0]) {
  server = await fakeGitHub(options)
  process.env.UPDATER_API_URL = server.url
  return server
}

describe('boot', () => {
  it('installs a newer release: backup, migrate, health check, then switch', async () => {
    const p = installedHome()
    const github = await serve({ version: '1.0.1', zip: releaseZip('1.0.1') })

    await updater.boot(p, okHooks)

    expect(calls).toEqual(['backup', 'migrate', 'health'])
    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.1')
    expect(fs.readFileSync(p.previous, 'utf8')).toBe('1.0.0')
    // The new release got the shop's settings
    expect(fs.readFileSync(path.join(p.releases, '1.0.1', 'app', '.env.local'), 'utf8')).toContain('postgresql://shop')
    expect(updater.readStatus(p.home)).toMatchObject({ ok: true, version: '1.0.1', message: 'Updated to 1.0.1' })
    // The download from storage never carries the GitHub token
    expect(github.storageRequests.length).toBe(2)
    for (const request of github.storageRequests) expect(request.authorization).toBeUndefined()
    // No leftovers
    expect(fs.readdirSync(p.releases).sort()).toEqual(['1.0.0', '1.0.1'])
    expect(fs.readdirSync(p.downloads)).toEqual([])
  })

  it('does nothing when already up to date', async () => {
    const p = installedHome()
    await serve({ version: '1.0.0', zip: releaseZip('1.0.0') })
    await updater.boot(p, okHooks)
    expect(calls).toEqual([])
    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.0')
  })

  it('keeps the current version when the new one fails its health check', async () => {
    const p = installedHome()
    await serve({ version: '1.0.1', zip: releaseZip('1.0.1') })

    await updater.boot(p, {
      ...okHooks,
      healthCheck: async () => {
        throw new Error('the new version did not become healthy')
      },
    })

    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.0')
    expect(fs.existsSync(path.join(p.releases, '1.0.1'))).toBe(false)
    expect(fs.readdirSync(p.releases)).toEqual(['1.0.0'])
    expect(updater.readStatus(p.home)).toMatchObject({ ok: false, version: '1.0.0', failedVersion: '1.0.1' })
  })

  it('refuses a download whose checksum does not match', async () => {
    const p = installedHome()
    await serve({ version: '1.0.1', zip: releaseZip('1.0.1'), sha: 'f'.repeat(64) })
    await updater.boot(p, okHooks)
    expect(calls).toEqual([])
    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.0')
    expect(updater.readStatus(p.home).message).toMatch(/checksum mismatch/)
  })

  it('refuses a zip that contains a different version', async () => {
    const p = installedHome()
    await serve({ version: '1.0.1', zip: releaseZip('9.9.9') })
    await updater.boot(p, okHooks)
    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.0')
    expect(updater.readStatus(p.home).message).toMatch(/contains 9\.9\.9/)
  })

  it('starts normally when GitHub cannot be reached', async () => {
    const p = installedHome()
    process.env.UPDATER_API_URL = 'http://127.0.0.1:9'
    await updater.boot(p, okHooks)
    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.0')
    expect(updater.readStatus(p.home)).toMatchObject({ checked: false })
  })

  it('reports an expired or revoked token clearly', async () => {
    const p = installedHome()
    await serve({ version: '1.0.1', zip: releaseZip('1.0.1'), status: 401 })
    await updater.boot(p, okHooks)
    expect(updater.readStatus(p.home).checkError).toMatch(/refused the token/)
  })
})

describe('install', () => {
  it('sets up the folders from the old app and installs the release', async () => {
    const home = tempDir()
    const oldApp = tempDir()
    fs.writeFileSync(path.join(oldApp, '.env.local'), 'DATABASE_URL="postgresql://shop"\nPRINTER_VID=0x1fc9\n')
    fs.mkdirSync(path.join(oldApp, 'public', 'uploads'), { recursive: true })
    fs.writeFileSync(path.join(oldApp, 'public', 'uploads', 'cup.jpg'), 'photo')
    const p = updater.paths(home)

    await updater.install(
      p,
      { fromApp: oldApp, token: 'test-token', source: fakeRelease('1.0.2') },
      { migrate: () => calls.push('migrate') }
    )

    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.2')
    expect(fs.readFileSync(path.join(p.uploads, 'cup.jpg'), 'utf8')).toBe('photo')
    // The old app keeps its photos, so it still works as a fallback
    expect(fs.existsSync(path.join(oldApp, 'public', 'uploads', 'cup.jpg'))).toBe(true)
    const env = fs.readFileSync(p.env, 'utf8')
    expect(env).toContain('PRINTER_VID=0x1fc9')
    expect(env).toContain(`UPLOADS_DIR="${p.uploads.split(path.sep).join('/')}"`)
    expect(fs.readFileSync(path.join(p.releases, '1.0.2', 'app', '.env.local'), 'utf8')).toBe(env)
    expect(JSON.parse(fs.readFileSync(p.config, 'utf8'))).toEqual({ repo: 'nidalJaafar/POS', token: 'test-token' })
    expect(fs.readFileSync(p.launch, 'utf8')).toMatch(/updater\.js" boot/)
    expect(calls).toEqual(['migrate'])
  })

  it('refuses to run without the old app settings', async () => {
    await expect(
      updater.install(updater.paths(tempDir()), { fromApp: tempDir(), source: fakeRelease('1.0.2') })
    ).rejects.toThrow(/--from-app/)
  })
})

describe('rollback and housekeeping', () => {
  it('switches back to the previous version', () => {
    const p = installedHome()
    fs.mkdirSync(path.join(p.releases, '1.0.1'))
    fs.writeFileSync(p.current, '1.0.1')
    fs.writeFileSync(p.previous, '1.0.0')
    updater.rollback(p)
    expect(fs.readFileSync(p.current, 'utf8')).toBe('1.0.0')
    expect(fs.readFileSync(p.previous, 'utf8')).toBe('1.0.1')
  })

  it('keeps the three newest releases plus current and previous', () => {
    const p = installedHome()
    for (const v of ['1.0.0', '1.0.1', '1.0.2', '1.0.3', '1.0.10']) fs.mkdirSync(path.join(p.releases, v), { recursive: true })
    fs.writeFileSync(p.current, '1.0.10')
    fs.writeFileSync(p.previous, '1.0.0')
    updater.pruneReleases(p)
    expect(fs.readdirSync(p.releases).sort()).toEqual(['1.0.0', '1.0.10', '1.0.2', '1.0.3'])
  })

  it('compares versions numerically', () => {
    expect(updater.compareVersions('1.0.10', '1.0.9')).toBe(1)
    expect(updater.compareVersions('v1.2.0', '1.2.0')).toBe(0)
    expect(updater.compareVersions('1.9.9', '2.0.0')).toBe(-1)
  })

  it('updates .env settings in place', () => {
    expect(updater.upsertEnv('A=1\nUPLOADS_DIR="old"\n', { UPLOADS_DIR: 'C:/x', B: 'y' })).toBe('A=1\nUPLOADS_DIR="C:/x"\nB="y"\n')
  })
})
