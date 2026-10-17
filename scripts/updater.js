/* eslint-disable no-console */
/**
 * Installs and updates the POS on the shop laptop from GitHub releases.
 *
 * Layout (the "home" folder, normally C:\SunflowerPOS):
 *   launch.cmd            what the Windows startup script runs: update check, then start
 *   current.txt           version that runs (e.g. 1.0.2); previous.txt is the one before
 *   releases\<version>\   unzipped releases (app\, node\, start.cmd, release.json)
 *   shared\.env.local     shop settings, copied into every release's app\
 *   shared\uploads\       item photos     shared\backups\  backups
 *   shared\updater.json   GitHub repository and an optional read-only token
 *   shared\update-status.json   result of the last update, shown in the POS sidebar
 *   shared\logs\updater.log
 *
 * Commands (run with the release's own node.exe):
 *   updater.js install --from-app <old app folder> [--token <github token>] [--home C:\SunflowerPOS]
 *       one-time setup from an unzipped release; keeps the shop's data and settings
 *   updater.js boot       check GitHub, install a newer release if there is one (never blocks startup)
 *   updater.js check      only report whether a newer release exists
 *   updater.js rollback   switch back to the previous version
 *   updater.js status     show versions and the last update result
 *
 * Releases must keep the database backward compatible (add columns/tables, don't drop or
 * rename in the same release), so switching back to the previous version always works.
 */
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')
const { execFileSync, spawn } = require('child_process')
const { removePath, renameWithRetry } = require('./migration-utils')

const DEFAULT_REPO = 'nidalJaafar/POS'
const ASSET_PLATFORM = 'win-x64'
const KEEP_RELEASES = 3
const HEALTH_PORT = 3999
const API_TIMEOUT_MS = 20_000
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000

// ── Paths ──────────────────────────────────────────────────────────────────────

// This file lives in <home>\releases\<version>\app\scripts
function defaultHome() {
  return path.resolve(__dirname, '..', '..', '..', '..')
}

function paths(home) {
  const shared = path.join(home, 'shared')
  return {
    home,
    releases: path.join(home, 'releases'),
    current: path.join(home, 'current.txt'),
    previous: path.join(home, 'previous.txt'),
    launch: path.join(home, 'launch.cmd'),
    shared,
    env: path.join(shared, '.env.local'),
    uploads: path.join(shared, 'uploads'),
    backups: path.join(shared, 'backups'),
    config: path.join(shared, 'updater.json'),
    status: path.join(shared, 'update-status.json'),
    downloads: path.join(shared, 'downloads'),
    log: path.join(shared, 'logs', 'updater.log'),
  }
}

function releaseDir(p, version) {
  return path.join(p.releases, version)
}

// ── Small helpers ──────────────────────────────────────────────────────────────

let logFile = null
function log(message) {
  const line = `${new Date().toISOString()} ${message}`
  console.log(message)
  if (!logFile) return
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    fs.appendFileSync(logFile, `${line}\n`)
  } catch {}
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim() || null
  } catch {
    return null
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

/** -1, 0 or 1, comparing "1.2.3" style versions (a leading "v" is ignored). */
function compareVersions(a, b) {
  const parse = (v) => String(v).replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0) ? 1 : -1
  }
  return 0
}

function writeStatus(p, status) {
  writeJson(p.status, { ...status, at: new Date().toISOString() })
}

// Settings the app needs to find the shared folders; added to the shop's .env.local
function sharedSettings(p) {
  const slash = (dir) => dir.split(path.sep).join('/')
  return {
    UPLOADS_DIR: slash(p.uploads),
    BACKUP_DIR: slash(p.backups),
    POS_HOME: slash(p.home),
  }
}

/** Sets KEY="value" lines in an .env file, replacing existing ones. */
function upsertEnv(content, settings) {
  const lines = content.split(/\r?\n/)
  for (const [key, value] of Object.entries(settings)) {
    const line = `${key}="${value}"`
    const index = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l))
    if (index >= 0) lines[index] = line
    else lines.splice(lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length, 0, line)
  }
  return lines.join('\n').replace(/\n*$/, '\n')
}

// ── GitHub ─────────────────────────────────────────────────────────────────────

function apiBase() {
  // Overridable so tests can stand in for GitHub
  return process.env.UPDATER_API_URL || 'https://api.github.com'
}

// The repository is public, so a token is optional. If one is configured but GitHub
// refuses it (expired, revoked), retry anonymously instead of pausing updates.
async function github(config, urlPath, options = {}) {
  const request = (withToken) =>
    fetch(`${apiBase()}${urlPath}`, {
      ...options,
      headers: {
        ...(withToken ? { Authorization: `Bearer ${config.token}` } : {}),
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sunflower-pos-updater',
        ...(options.headers ?? {}),
      },
      signal: options.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
    })
  let response = await request(Boolean(config.token))
  if (config.token && (response.status === 401 || response.status === 403)) {
    log('GitHub refused the configured token; continuing without it')
    response = await request(false)
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new Error(`GitHub returned ${response.status} for ${urlPath} (repository private, or rate limit reached?)`)
  }
  // With redirect: 'manual' a 302 is expected, not an error
  if (!response.ok && !(response.status >= 300 && response.status < 400)) {
    throw new Error(`GitHub returned ${response.status} for ${urlPath}`)
  }
  return response
}

async function latestRelease(config) {
  const response = await github(config, `/repos/${config.repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  const release = await response.json()
  const version = String(release.tag_name).replace(/^v/, '')
  const zipName = `sunflower-pos-v${version}-${ASSET_PLATFORM}.zip`
  const zip = release.assets.find((a) => a.name === zipName)
  const sha = release.assets.find((a) => a.name === `${zipName}.sha256`)
  if (!zip || !sha) throw new Error(`Release ${release.tag_name} has no ${zipName} (or its checksum)`)
  return { version, zip, sha }
}

// Asset downloads redirect to a signed storage URL, which must be fetched without the
// token: follow that redirect ourselves instead of relying on fetch to drop the header
async function downloadAsset(config, asset, target) {
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
  let response = await github(config, `/repos/${config.repo}/releases/assets/${asset.id}`, {
    headers: { Accept: 'application/octet-stream' },
    redirect: 'manual',
    signal,
  })
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error(`GitHub redirect for ${asset.name} has no location`)
    response = await fetch(new URL(location, apiBase()), { signal })
    if (!response.ok) throw new Error(`Download of ${asset.name} failed with ${response.status}`)
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const partial = `${target}.partial`
  const out = fs.createWriteStream(partial)
  const hash = crypto.createHash('sha256')
  let bytes = 0
  for await (const chunk of response.body) {
    hash.update(chunk)
    bytes += chunk.length
    if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve))
  }
  await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())))
  renameWithRetry(partial, target)
  return { sha256: hash.digest('hex'), bytes }
}

// ── Installing a release folder ────────────────────────────────────────────────

function extractZip(zipFile, target) {
  fs.mkdirSync(target, { recursive: true })
  if (process.platform === 'win32') {
    // Windows' own tar (bsdtar) reads zip files; use it explicitly, not a tar from Git
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    execFileSync(tar, ['-xf', zipFile, '-C', target], { stdio: 'pipe' })
  } else {
    execFileSync('unzip', ['-q', '-o', zipFile, '-d', target], { stdio: 'pipe' })
  }
}

function nodeExe(dir) {
  return path.join(dir, 'node', process.platform === 'win32' ? 'node.exe' : 'node')
}

function runInApp(dir, args, extraEnv = {}) {
  return execFileSync(nodeExe(dir), args, {
    cwd: path.join(dir, 'app'),
    env: { ...process.env, ...extraEnv },
    stdio: 'pipe',
    encoding: 'utf8',
  })
}

function migrate(dir) {
  runInApp(dir, [path.join('node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'])
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 5000 }, (response) => {
      let body = ''
      response.on('data', (chunk) => (body += chunk))
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(body) })
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', reject)
  })
}

/** Starts the release on a spare port and waits for /api/health to report its version. */
async function healthCheck(dir, version) {
  const server = spawn(
    nodeExe(dir),
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(HEALTH_PORT)],
    { cwd: path.join(dir, 'app'), env: { ...process.env, NODE_ENV: 'production' }, stdio: 'ignore' }
  )
  try {
    const deadline = Date.now() + 90_000
    let last = 'no answer'
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`the new version exited with code ${server.exitCode}`)
      try {
        const { status, body } = await httpGetJson(`http://127.0.0.1:${HEALTH_PORT}/api/health`)
        if (status === 200 && body.ok && body.version === version) return
        last = `health returned ${status}: ${JSON.stringify(body)}`
      } catch (error) {
        last = error.message
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error(`the new version did not become healthy (${last})`)
  } finally {
    server.kill()
  }
}

/** Gives a freshly unzipped release the shop's settings. */
function configureRelease(p, dir) {
  fs.copyFileSync(p.env, path.join(dir, 'app', '.env.local'))
}

function pruneReleases(p) {
  const keep = new Set([readText(p.current), readText(p.previous)].filter(Boolean))
  const versions = fs
    .readdirSync(p.releases, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+$/.test(e.name))
    .map((e) => e.name)
    .sort(compareVersions)
    .reverse()
  versions.slice(KEEP_RELEASES).forEach((version) => {
    if (!keep.has(version)) removePath(releaseDir(p, version))
  })
}

function writeLauncher(p) {
  // The startup script runs this. %~dp0 is the home folder.
  const lines = [
    '@echo off',
    'rem Sunflower Crafts POS: check for an update, then start the current version',
    'cd /d "%~dp0"',
    'set /p POS_VERSION=<current.txt',
    '"releases\\%POS_VERSION%\\node\\node.exe" "releases\\%POS_VERSION%\\app\\scripts\\updater.js" boot',
    'set /p POS_VERSION=<current.txt',
    'call "releases\\%POS_VERSION%\\start.cmd"',
    '',
  ]
  fs.writeFileSync(p.launch, lines.join('\r\n'))
}

// ── Commands ───────────────────────────────────────────────────────────────────

/**
 * Downloads, verifies, installs and health-checks `release`, then makes it current.
 * Any failure leaves the current version untouched.
 */
async function applyRelease(p, config, release, hooks = {}) {
  const current = readText(p.current)
  const zipPath = path.join(p.downloads, release.zip.name)
  const shaPath = `${zipPath}.sha256`
  const staging = path.join(p.releases, `.staging-${release.version}`)
  const target = releaseDir(p, release.version)

  log(`Updating ${current} → ${release.version}`)
  await downloadAsset(config, release.sha, shaPath)
  const expected = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0].toLowerCase()
  const { sha256, bytes } = await downloadAsset(config, release.zip, zipPath)
  if (sha256 !== expected) throw new Error(`checksum mismatch for ${release.zip.name}`)
  log(`Downloaded ${release.zip.name} (${Math.round(bytes / 1e6)} MB), checksum verified`)

  removePath(staging)
  extractZip(zipPath, staging)
  const info = readJson(path.join(staging, 'release.json'))
  if (info?.version !== release.version) throw new Error(`zip contains ${info?.version}, expected ${release.version}`)
  configureRelease(p, staging)

  // Safety copy of the data before the new version's migrations run
  if (current) {
    ;(hooks.backup ?? ((dir) => runInApp(dir, ['scripts/backup.js'])))(releaseDir(p, current))
    log('Backed up the data')
  }
  ;(hooks.migrate ?? migrate)(staging)
  log('Database migrations applied')
  await (hooks.healthCheck ?? healthCheck)(staging, release.version)
  log('New version passed its health check')

  removePath(target)
  renameWithRetry(staging, target)
  if (current) fs.writeFileSync(p.previous, current)
  fs.writeFileSync(p.current, release.version)
  removePath(zipPath)
  removePath(shaPath)
  pruneReleases(p)
  log(`Now running ${release.version}`)
}

async function boot(p, hooks = {}) {
  const current = readText(p.current)
  const config = { repo: DEFAULT_REPO, token: '', ...(readJson(p.config) ?? {}) }
  let release
  try {
    release = await latestRelease(config)
  } catch (error) {
    // Offline or GitHub unreachable: start what's installed
    log(`Update check skipped: ${error.message}`)
    writeStatus(p, { ...(readJson(p.status) ?? {}), checked: false, checkError: error.message })
    return
  }
  if (current && compareVersions(release.version, current) <= 0) {
    log(`Up to date (${current})`)
    return
  }
  try {
    await applyRelease(p, config, release, hooks)
    writeStatus(p, { ok: true, version: release.version, previous: current, message: `Updated to ${release.version}` })
  } catch (error) {
    log(`Update to ${release.version} failed: ${error.message}`)
    removePath(path.join(p.releases, `.staging-${release.version}`))
    writeStatus(p, {
      ok: false,
      version: current,
      failedVersion: release.version,
      message: `Update to ${release.version} failed; still on ${current}: ${error.message}`,
    })
  }
}

async function install(p, { fromApp, token, repo = DEFAULT_REPO, source = path.resolve(__dirname, '..', '..') }, hooks = {}) {
  // source: the unzipped release this runs from
  const info = readJson(path.join(source, 'release.json'))
  if (!info?.version) throw new Error(`Run install from an unzipped release (no release.json in ${source})`)
  if (!fromApp || !fs.existsSync(path.join(fromApp, '.env.local'))) {
    throw new Error('--from-app must point at the current app folder (the one with .env.local)')
  }

  for (const dir of [p.releases, p.shared, p.uploads, p.backups, p.downloads]) fs.mkdirSync(dir, { recursive: true })

  // Shop settings: the current .env.local plus where the shared folders are
  const env = fs.readFileSync(path.join(fromApp, '.env.local'), 'utf8')
  fs.writeFileSync(p.env, upsertEnv(env, sharedSettings(p)))
  log(`Settings saved to ${p.env}`)

  // Photos: copy (not move), so the old app folder stays usable for a rollback
  const oldUploads = path.join(fromApp, 'public', 'uploads')
  let copied = 0
  if (fs.existsSync(oldUploads)) {
    for (const entry of fs.readdirSync(oldUploads, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const to = path.join(p.uploads, entry.name)
      if (!fs.existsSync(to)) fs.copyFileSync(path.join(oldUploads, entry.name), to)
      copied += 1
    }
  }
  log(`Photos in ${p.uploads}: ${copied} copied from the old app`)

  if (token) writeJson(p.config, { repo, token })
  else if (!fs.existsSync(p.config)) writeJson(p.config, { repo, token: '' })

  const target = releaseDir(p, info.version)
  if (path.resolve(source) !== path.resolve(target)) {
    removePath(target)
    fs.cpSync(source, target, { recursive: true })
  }
  configureRelease(p, target)
  ;(hooks.migrate ?? migrate)(target)
  log('Database migrations applied')

  fs.writeFileSync(p.current, info.version)
  writeLauncher(p)
  writeStatus(p, { ok: true, version: info.version, message: `Installed ${info.version}` })
  log(`Installed ${info.version}. Point the startup script at ${p.launch}`)
}

function rollback(p) {
  const current = readText(p.current)
  const previous = readText(p.previous)
  if (!previous || !fs.existsSync(releaseDir(p, previous))) throw new Error('No previous version to go back to')
  fs.writeFileSync(p.current, previous)
  fs.writeFileSync(p.previous, current)
  writeStatus(p, { ok: true, version: previous, message: `Rolled back from ${current} to ${previous}` })
  log(`Rolled back to ${previous}; restart the POS`)
}

function parseArgs(argv) {
  const options = { command: argv[0] }
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--home') options.home = argv[++i]
    else if (argv[i] === '--from-app') options.fromApp = argv[++i]
    else if (argv[i] === '--token') options.token = argv[++i]
    else if (argv[i] === '--repo') options.repo = argv[++i]
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const p = paths(path.resolve(options.home ?? defaultHome()))
  logFile = p.log
  if (options.command === 'install') {
    await install(p, options)
  } else if (options.command === 'boot') {
    // Must never stop the POS from starting
    try {
      await boot(p)
    } catch (error) {
      log(`Updater error: ${error.message}`)
    }
  } else if (options.command === 'check') {
    const config = { repo: DEFAULT_REPO, token: '', ...(readJson(p.config) ?? {}) }
    const release = await latestRelease(config)
    const current = readText(p.current)
    console.log(`Installed ${current}, latest ${release.version}: ${compareVersions(release.version, current) > 0 ? 'update available' : 'up to date'}`)
  } else if (options.command === 'rollback') {
    rollback(p)
  } else if (options.command === 'status') {
    console.log(JSON.stringify({ current: readText(p.current), previous: readText(p.previous), last: readJson(p.status) }, null, 2))
  } else {
    console.error('Usage: updater.js install|boot|check|rollback|status [--home <folder>]')
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((error) => {
    log(`Error: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = {
  boot,
  install,
  rollback,
  applyRelease,
  compareVersions,
  upsertEnv,
  paths,
  writeLauncher,
  pruneReleases,
  readStatus: (home) => readJson(paths(home).status),
}
