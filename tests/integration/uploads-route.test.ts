import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/uploads/[filename]/route'

function get(filename: string) {
  return GET(new Request(`http://localhost/uploads/${filename}`), { params: { filename } })
}

describe('GET /uploads/:filename', () => {
  it('serves an uploaded image with long-lived caching', async () => {
    fs.writeFileSync(path.join(process.env.UPLOADS_DIR!, 'cup.jpg'), 'jpeg-bytes')
    const response = await get('cup.jpg')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toContain('immutable')
    expect(await response.text()).toBe('jpeg-bytes')
  })

  it('serves files added after startup', async () => {
    const name = `late-${Date.now()}.png`
    expect((await get(name)).status).toBe(404)
    fs.writeFileSync(path.join(process.env.UPLOADS_DIR!, name), 'png')
    expect((await get(name)).status).toBe(200)
  })

  it.each(['missing.jpg', 'page.html', 'image.svg', '.hidden.jpg'])('returns 404 for %s', async (name) => {
    expect((await get(name)).status).toBe(404)
  })

  it('never serves a real file outside the uploads folder', async () => {
    // A readable image right next to the uploads folder, so a traversal bug would return 200
    const secret = `secret-${process.pid}.jpg`
    const secretPath = path.join(path.dirname(process.env.UPLOADS_DIR!), secret)
    fs.writeFileSync(secretPath, 'private')
    try {
      for (const name of [`../${secret}`, `..%2F${secret}`, `..\\${secret}`, `%2e%2e%2f${secret}`]) {
        expect((await get(name)).status, name).toBe(404)
      }
    } finally {
      fs.rmSync(secretPath, { force: true })
    }
  })
})
