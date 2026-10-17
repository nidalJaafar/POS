import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const MAX_IMAGE_DIMENSION = 1200

// UPLOADS_DIR lets tests use a scratch folder instead of the shop's real images
export function uploadsDir() {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), 'public', 'uploads')
}

async function ensureUploadsDir() {
  const dir = uploadsDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

// Phone photos are several MB; store a resized JPEG instead of the original.
// Decoding with sharp also rejects anything that isn't actually an image.
export async function addItemImage(file: File): Promise<string> {
  const input = Buffer.from(await file.arrayBuffer())
  let output: Buffer
  try {
    output = await sharp(input)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch {
    throw new Error('The selected file is not a supported image')
  }

  const dir = await ensureUploadsDir()
  const filename = `${crypto.randomUUID()}.jpg`
  await fs.writeFile(path.join(dir, filename), output)
  return `/uploads/${filename}`
}
