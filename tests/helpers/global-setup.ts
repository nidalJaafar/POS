// Starts the throwaway Postgres container (or reuses it) and applies migrations
// before any test file runs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const testDb = require('../../scripts/test-db.js')

// Unit tests don't touch the database; don't require Docker for `npm run test:unit`
function onlyUnitTests() {
  const filters = process.argv.slice(2).filter((arg) => arg.startsWith('tests/'))
  return filters.length > 0 && filters.every((arg) => arg.startsWith('tests/unit'))
}

export default async function setup() {
  if (!process.env.SKIP_TEST_DB && !onlyUnitTests()) await testDb.up()
}
