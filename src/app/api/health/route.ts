import { prisma } from '@/lib/prisma'

// Used by the updater after starting a new release: 200 only when the app can reach its database
export const dynamic = 'force-dynamic'

export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ ok: true, version })
  } catch (error) {
    return Response.json({ ok: false, version, error: (error as Error).message }, { status: 503 })
  }
}
