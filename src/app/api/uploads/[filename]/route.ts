import fs from 'fs/promises'
import path from 'path'
import { uploadsDir } from '@/lib/storage'

// `next start` only serves public/ files that existed when the server started, so
// images uploaded afterwards are served from here (see the rewrite in next.config.mjs).
export const dynamic = 'force-dynamic'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}

export async function GET(_req: Request, { params }: { params: { filename: string } }) {
  const filename = params.filename
  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()]
  if (!contentType || filename !== path.basename(filename) || filename.startsWith('.')) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const file = await fs.readFile(path.join(uploadsDir(), filename))
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        // Upload names are unique, so a file never changes once written
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
