/* eslint-disable no-console */
/**
 * Throwaway PostgreSQL for the test suites. It listens on 127.0.0.1:55432 so it can
 * never be confused with the real database on 5432.
 *
 *   node scripts/test-db.js up      start (or reuse) the database and apply migrations
 *   node scripts/test-db.js down    remove the container and its data
 *   node scripts/test-db.js reset   down + up
 *   node scripts/test-db.js url     print the connection URL
 *
 * By default Postgres runs in a Docker or Podman container. With TEST_DB_EXTERNAL=1 a
 * Postgres you started yourself on port 55432 (user postgres, password postgres) is
 * used instead, e.g. on Windows CI, where Linux containers aren't available.
 */
const { execFileSync, spawnSync } = require('child_process')
const { Client } = require('pg')
const { runPrisma } = require('./migration-utils')

const CONTAINER = 'sunflower-pos-test-db'
const PORT = 55432
const SERVER_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}`
const TEST_DATABASE_URL = `${SERVER_URL}/sunflower_crafts_pos`
// The browser tests get their own database so both suites can run at the same time
const E2E_DATABASE_URL = `${SERVER_URL}/sunflower_crafts_pos_e2e`
const EXTERNAL = Boolean(process.env.TEST_DB_EXTERNAL)

function containerRuntime() {
  for (const runtime of ['docker', 'podman']) {
    if (spawnSync(runtime, ['--version'], { stdio: 'ignore' }).status === 0) return runtime
  }
  throw new Error(
    'Docker or Podman is required to run the database tests ' +
      '(or start Postgres on port 55432 yourself and set TEST_DB_EXTERNAL=1)'
  )
}

function run(runtime, args) {
  return execFileSync(runtime, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function containerState(runtime) {
  const result = spawnSync(runtime, ['inspect', '-f', '{{.State.Running}}', CONTAINER], { encoding: 'utf8' })
  if (result.status !== 0) return 'missing'
  return result.stdout.trim() === 'true' ? 'running' : 'stopped'
}

async function withServer(callback) {
  const client = new Client({ connectionString: `${SERVER_URL}/postgres` })
  await client.connect()
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

async function waitForPostgres() {
  const deadline = Date.now() + 60_000
  for (;;) {
    try {
      return await withServer((client) => client.query('SELECT 1'))
    } catch (error) {
      if (Date.now() > deadline) throw new Error(`Test database did not become ready within 60s: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

async function ensureDatabase(name) {
  await withServer(async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    // Identifiers can't be query parameters; name is one of our two constants
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`)
  })
}

function migrate(url) {
  runPrisma(['migrate', 'deploy'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, DATABASE_URL: url },
  })
}

async function up() {
  if (!EXTERNAL) {
    const runtime = containerRuntime()
    const state = containerState(runtime)
    if (state === 'missing') {
      run(runtime, [
        'run', '-d', '--name', CONTAINER,
        '-e', 'POSTGRES_PASSWORD=postgres',
        '-p', `127.0.0.1:${PORT}:5432`,
        // Data lives in memory: fast, and nothing survives `down`
        '--tmpfs', '/var/lib/postgresql/data',
        'docker.io/library/postgres:16-alpine',
      ])
    } else if (state === 'stopped') {
      run(runtime, ['start', CONTAINER])
    }
  }
  await waitForPostgres()
  await ensureDatabase('sunflower_crafts_pos')
  await ensureDatabase('sunflower_crafts_pos_e2e')
  migrate(TEST_DATABASE_URL)
  migrate(E2E_DATABASE_URL)
  return TEST_DATABASE_URL
}

function down() {
  if (EXTERNAL) return
  const runtime = containerRuntime()
  if (containerState(runtime) !== 'missing') run(runtime, ['rm', '-f', CONTAINER])
}

async function main() {
  const command = process.argv[2]
  if (command === 'up') {
    await up()
    console.log(`Test database ready: ${TEST_DATABASE_URL}`)
  } else if (command === 'down') {
    down()
    console.log(EXTERNAL ? 'External test database left running' : 'Test database removed')
  } else if (command === 'reset') {
    down()
    await up()
    console.log(`Test database recreated: ${TEST_DATABASE_URL}`)
  } else if (command === 'url') {
    console.log(TEST_DATABASE_URL)
  } else {
    console.error('Usage: node scripts/test-db.js up|down|reset|url')
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = { up, down, TEST_DATABASE_URL, E2E_DATABASE_URL, PORT }
