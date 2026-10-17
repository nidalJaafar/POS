import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  const adapter = new PrismaPg(new Pool({ connectionString }))
  return new PrismaClient({ adapter, log: ['error'] })
}

function client(): PrismaClient {
  // One client per process (and across dev hot reloads)
  globalForPrisma.prisma ??= createClient()
  return globalForPrisma.prisma
}

// Created on first use rather than on import: `next build` loads every route to collect
// page data, and the release build runs with no database configured
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client()
    const value = Reflect.get(instance, property, instance)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
