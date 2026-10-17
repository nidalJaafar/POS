/* eslint-disable no-console */
/**
 * Compares item images in the database with the files in the uploads folder.
 *
 *   npm run uploads:check                  report only
 *   npm run uploads:check -- --move-unused move files no item uses into
 *                                          <BACKUP_DIR>/unused-uploads-<time>/ (nothing is deleted)
 */
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { appUploadsDir, ensureDir, listUploadFiles, removePath, renameWithRetry } = require('./migration-utils')
const { timestamp } = require('./backup')

// rename() can't cross drives (uploads on C:, BACKUP_DIR on D:); copy then delete instead
function moveFile(from, to) {
  try {
    renameWithRetry(from, to)
  } catch (error) {
    if (error.code !== 'EXDEV') throw error
    fs.copyFileSync(from, to)
    removePath(from)
  }
}

async function main() {
  const moveUnused = process.argv.includes('--move-unused')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] })

  try {
    const items = await prisma.item.findMany({ select: { id: true, name: true, image: true } })
    const dir = appUploadsDir()
    const files = fs.existsSync(dir) ? listUploadFiles(dir) : []
    const fileSet = new Set(files)

    const referenced = new Set()
    const missing = []
    for (const item of items) {
      if (!item.image.startsWith('/uploads/')) continue
      const filename = path.basename(item.image)
      referenced.add(filename)
      if (!fileSet.has(filename)) missing.push(item)
    }
    const unused = files.filter((file) => !referenced.has(file))

    console.log(`Uploads folder: ${dir}`)
    console.log(`${files.length} file(s), ${items.length} item(s)\n`)

    if (missing.length) {
      console.log(`Items whose image file is missing (${missing.length}) — edit the item and choose a new image:`)
      for (const item of missing) console.log(`  #${item.id} ${item.name}: ${item.image}`)
    } else {
      console.log('Every item image exists.')
    }

    if (unused.length) {
      console.log(`\nFiles no item uses (${unused.length}):`)
      for (const file of unused) console.log(`  ${file}`)
      if (moveUnused) {
        const backupRoot = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'))
        const target = path.join(backupRoot, `unused-uploads-${timestamp()}`)
        ensureDir(target)
        for (const file of unused) moveFile(path.join(dir, file), path.join(target, file))
        console.log(`\nMoved ${unused.length} file(s) to ${target}`)
      } else {
        console.log('\nRun with --move-unused to move them out of the uploads folder.')
      }
    } else {
      console.log('No unused files.')
    }

    if (missing.length) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Uploads check failed:', error.message)
  process.exitCode = 1
})
