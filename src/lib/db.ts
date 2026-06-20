import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const fallbackDbUrl = 'file:./db/custom.db'
const candidatePaths = [
  path.resolve(process.cwd(), 'db', 'custom.db'),
  path.resolve(process.cwd(), '.next', 'standalone', 'Med_data_analysis', 'db', 'custom.db'),
]
const resolvedDbPath = candidatePaths.find((p) => fs.existsSync(p))
const runtimeDbUrl = resolvedDbPath ? `file:${resolvedDbPath}` : fallbackDbUrl

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: runtimeDbUrl,
      },
    },
    // Set to ['query'] for SQL debugging
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db