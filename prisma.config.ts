import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load both local and default env files so Prisma commands can pick up DATABASE_URL
dotenv.config({ path: '.env.local' })
dotenv.config()

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  // `prisma generate` (run by npm install) doesn't need a database, so a fresh machine
  // without .env.local can still install; migrate commands still require DATABASE_URL
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
})
