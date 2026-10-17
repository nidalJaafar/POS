/* eslint-disable no-console */
/**
 * Assembles a ready-to-run release folder from a built app (used by the release workflow):
 *
 *   <out>/sunflower-pos-v<version>-<platform>/
 *     release.json   version, commit, build time, Node version
 *     node/          the Node runtime the app runs on (node.exe on Windows)
 *     app/           package.json, .next build, node_modules, prisma, public, scripts
 *     start.cmd      starts the POS on Windows (backup first, like `npm run start`)
 *
 * Run it after `npm run build` and `npm prune --omit=dev`:
 *   node scripts/package-release.js --out dist --node <path to node or node.exe> [--platform win-x64]
 *                                   [--build-dir .next]   (copied into the release as .next)
 *
 * The shop's data never goes in a release: public/uploads, .env files and backups are left out.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')

// What the app needs at runtime; everything else (src, tests, docs) stays out
const APP_ENTRIES = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'prisma.config.ts',
  'prisma',
  'public',
  'scripts',
  'node_modules',
]

// Verified: migrations, backups, the server, image resizing and the receipt preview all
// run without these
const BUILD_ONLY_PACKAGES = [
  'node_modules/typescript',
  'node_modules/@playwright',
  'node_modules/playwright',
  'node_modules/playwright-core',
]

function parseArgs(argv) {
  const options = { out: 'dist', node: process.execPath, platform: 'win-x64', buildDir: '.next' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') options.out = argv[++i]
    else if (argv[i] === '--node') options.node = argv[++i]
    else if (argv[i] === '--platform') options.platform = argv[++i]
    else if (argv[i] === '--build-dir') options.buildDir = argv[++i]
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return options
}

function shouldCopy(source, buildDir = '.next') {
  const relative = path.relative(ROOT, source).split(path.sep).join('/')
  const build = buildDir.split(path.sep).join('/')
  return !(
    relative === `${build}/cache` ||
    relative.startsWith(`${build}/cache/`) ||
    relative === 'public/uploads' ||
    relative.startsWith('public/uploads/') ||
    relative === '.next/cache' ||
    relative.startsWith('.next/cache/') ||
    relative === 'node_modules/.cache' ||
    relative.startsWith('node_modules/.cache/') ||
    // Only needed to build, not to run (`npm prune` keeps them as optional peers)
    BUILD_ONLY_PACKAGES.some((pkg) => relative === pkg || relative.startsWith(`${pkg}/`)) ||
    /^node_modules\/@next\/swc-/.test(relative) ||
    // Development-only scripts
    relative === 'scripts/test-db.js' ||
    relative === 'scripts/seed.js' ||
    relative === 'scripts/package-release.js'
  )
}

function gitCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function nodeVersion(nodePath) {
  return execFileSync(nodePath, ['--version'], { encoding: 'utf8' }).trim()
}

function packageRelease({ out, node, platform, buildDir = '.next' }) {
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  if (!fs.existsSync(path.join(ROOT, buildDir, 'BUILD_ID'))) {
    throw new Error(`No production build in ${buildDir}: run \`npm run build\` first`)
  }
  if (!fs.existsSync(node)) throw new Error(`Node runtime not found: ${node}`)

  const name = `sunflower-pos-v${version}-${platform}`
  const target = path.resolve(out, name)
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(path.join(target, 'app'), { recursive: true })
  fs.mkdirSync(path.join(target, 'node'), { recursive: true })

  for (const entry of APP_ENTRIES) {
    const source = path.join(ROOT, entry)
    if (!fs.existsSync(source)) throw new Error(`Missing ${entry}`)
    fs.cpSync(source, path.join(target, 'app', entry), { recursive: true, filter: (s) => shouldCopy(s), dereference: true })
  }
  // The app always runs its build from .next (next.config.mjs reads NEXT_DIST_DIR only in tests)
  fs.cpSync(path.join(ROOT, buildDir), path.join(target, 'app', '.next'), {
    recursive: true,
    filter: (s) => shouldCopy(s, buildDir),
    dereference: true,
  })

  const nodeName = platform.startsWith('win') ? 'node.exe' : 'node'
  fs.copyFileSync(node, path.join(target, 'node', nodeName))
  fs.chmodSync(path.join(target, 'node', nodeName), 0o755)

  const release = {
    version,
    commit: gitCommit(),
    builtAt: new Date().toISOString(),
    node: nodeVersion(node),
    platform,
  }
  fs.writeFileSync(path.join(target, 'release.json'), `${JSON.stringify(release, null, 2)}\n`)

  // Same order as `npm run start`: backup (never blocks startup), then the server.
  // .env.local in app\ holds DATABASE_URL and the printer ids.
  fs.writeFileSync(
    path.join(target, 'start.cmd'),
    [
      '@echo off',
      'cd /d "%~dp0app"',
      '"%~dp0node\\node.exe" scripts\\backup.js --on-start',
      '"%~dp0node\\node.exe" node_modules\\next\\dist\\bin\\next start -H 0.0.0.0',
      '',
    ].join('\r\n')
  )

  return { name, dir: target, release }
}

if (require.main === module) {
  try {
    const { dir, release } = packageRelease(parseArgs(process.argv.slice(2)))
    console.log(`Packaged ${release.version} (${release.platform}, Node ${release.node}) into ${dir}`)
  } catch (error) {
    console.error('Packaging failed:', error.message)
    process.exitCode = 1
  }
}

module.exports = { packageRelease, shouldCopy }
