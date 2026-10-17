import sharp from 'sharp'
import { Order } from './dto'
import { createPrinter, writeReceipt } from './receipt'

// 80 mm paper at 203 dpi: 576 dots, 48 columns of 12×24-dot characters (font A)
const PAPER_DOTS = 576
// The paper itself is 80 mm (640 dots); the head prints the middle 72 mm, leaving ~4 mm each side
const PAPER_WIDTH = 640
const PAPER_SIDE = (PAPER_WIDTH - PAPER_DOTS) / 2
const CHAR_WIDTH = 12
const CHAR_HEIGHT = 24
const DEFAULT_LINE_SPACING = 30
const MARGIN = 32

type Op =
  | { kind: 'text'; x: number; y: number; text: string; scaleX: number; scaleY: number }
  | { kind: 'bitmap'; x: number; y: number; width: number; height: number; black: Uint8Array }
  | { kind: 'event'; y: number; label: string; cut?: boolean }

/** Runs the real receipt code against an in-memory adapter and returns the ESC/POS bytes. */
export async function captureReceipt(order: Order): Promise<Buffer> {
  const chunks: Buffer[] = []
  const adapter = {
    write(data: Buffer, callback?: (error?: Error | null) => void) {
      chunks.push(Buffer.from(data))
      callback?.(null)
    },
    close(callback?: (error?: Error | null) => void) {
      callback?.(null)
    },
  }
  const printer = createPrinter(adapter)
  await writeReceipt(printer, order)
  await new Promise<void>((resolve, reject) =>
    printer.flush((error?: Error | null) => (error ? reject(error) : resolve()))
  )
  return Buffer.concat(chunks)
}

/**
 * Interprets the subset of ESC/POS the receipt uses (text, alignment, size, line
 * spacing, ESC * bit images, GS v 0 raster images, drawer, beep, cut) into drawing ops.
 */
export function interpretEscPos(bytes: Buffer): { ops: Op[]; height: number } {
  const ops: Op[] = []
  let i = 0
  let y = 0
  let align = 0
  let scaleX = 1
  let scaleY = 1
  let lineSpacing = DEFAULT_LINE_SPACING
  let line = ''
  let bandHeight = 0

  const alignedX = (width: number) =>
    align === 1 ? Math.round((PAPER_DOTS - width) / 2) : align === 2 ? PAPER_DOTS - width : 0

  function lineFeed() {
    if (line.length) {
      const width = line.length * CHAR_WIDTH * scaleX
      ops.push({ kind: 'text', x: alignedX(width), y, text: line, scaleX, scaleY })
      y += Math.max(lineSpacing, CHAR_HEIGHT * scaleY)
    } else if (bandHeight) {
      y += Math.max(lineSpacing, bandHeight)
    } else {
      y += lineSpacing
    }
    line = ''
    bandHeight = 0
  }

  while (i < bytes.length) {
    const byte = bytes[i]

    if (byte === 0x0a) {
      lineFeed()
      i += 1
    } else if (byte === 0x1b) {
      const command = bytes[i + 1]
      if (command === 0x61) {
        align = bytes[i + 2] % 48 // accepts 0-2 and '0'-'2'
        i += 3
      } else if (command === 0x2a) {
        // ESC * m nL nH d1...dk — one band of a bit image
        const mode = bytes[i + 2]
        const columns = bytes[i + 3] + bytes[i + 4] * 256
        const bytesPerColumn = mode >= 32 ? 3 : 1
        const height = bytesPerColumn * 8
        const data = bytes.subarray(i + 5, i + 5 + columns * bytesPerColumn)
        const black = new Uint8Array(columns * height)
        for (let col = 0; col < columns; col++) {
          for (let b = 0; b < bytesPerColumn; b++) {
            const value = data[col * bytesPerColumn + b]
            for (let bit = 0; bit < 8; bit++) {
              if (value & (0x80 >> bit)) black[(b * 8 + bit) * columns + col] = 1
            }
          }
        }
        ops.push({ kind: 'bitmap', x: alignedX(columns), y, width: columns, height, black })
        bandHeight = Math.max(bandHeight, height)
        i += 5 + columns * bytesPerColumn
      } else if (command === 0x33) {
        lineSpacing = bytes[i + 2]
        i += 3
      } else if (command === 0x32) {
        lineSpacing = DEFAULT_LINE_SPACING
        i += 2
      } else if (command === 0x70) {
        ops.push({ kind: 'event', y, label: 'cash drawer opens' })
        i += 5
      } else if (command === 0x42) {
        ops.push({ kind: 'event', y, label: 'beep' })
        i += 4
      } else if (command === 0x40) {
        align = 0
        scaleX = scaleY = 1
        lineSpacing = DEFAULT_LINE_SPACING
        i += 2
      } else {
        i += 3 // unknown ESC command with one parameter
      }
    } else if (byte === 0x1d) {
      const command = bytes[i + 1]
      if (command === 0x21) {
        const n = bytes[i + 2]
        scaleX = ((n >> 4) & 7) + 1
        scaleY = (n & 7) + 1
        i += 3
      } else if (command === 0x76 && bytes[i + 2] === 0x30) {
        // GS v 0 m xL xH yL yH d1...dk — raster image, width in bytes
        const widthBytes = bytes[i + 4] + bytes[i + 5] * 256
        const height = bytes[i + 6] + bytes[i + 7] * 256
        const width = widthBytes * 8
        const data = bytes.subarray(i + 8, i + 8 + widthBytes * height)
        const black = new Uint8Array(width * height)
        for (let row = 0; row < height; row++) {
          for (let xb = 0; xb < widthBytes; xb++) {
            const value = data[row * widthBytes + xb]
            for (let bit = 0; bit < 8; bit++) {
              if (value & (0x80 >> bit)) black[row * width + xb * 8 + bit] = 1
            }
          }
        }
        ops.push({ kind: 'bitmap', x: alignedX(width), y, width, height, black })
        y += height
        i += 8 + widthBytes * height
      } else if (command === 0x56) {
        if (line.length) lineFeed()
        const mode = bytes[i + 2]
        if (mode === 65 || mode === 66) {
          // Feed to the cutter plus n dots, then cut: the printer accounts for the
          // head-to-cutter distance, so the paper ends n dots below the last line
          y += bytes[i + 3]
          ops.push({ kind: 'event', y, label: mode === 66 ? 'paper cut (partial)' : 'paper cut', cut: true })
          i += 4
        } else {
          ops.push({ kind: 'event', y, label: 'paper cut', cut: true })
          i += 3
        }
      } else {
        i += 3 // unknown GS command with one parameter
      }
    } else if (byte >= 0x20) {
      line += String.fromCharCode(byte)
      i += 1
    } else {
      i += 1 // CR and other control bytes
    }
  }
  if (line.length) lineFeed()
  return { ops, height: y }
}

function escapeXml(text: string) {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)
}

async function bitmapDataUri(op: Extract<Op, { kind: 'bitmap' }>) {
  const pixels = Buffer.alloc(op.width * op.height, 255)
  op.black.forEach((value, index) => {
    if (value) pixels[index] = 0
  })
  const png = await sharp(pixels, { raw: { width: op.width, height: op.height, channels: 1 } }).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

/** Draws interpreted ops on a strip of receipt paper and returns a PNG. */
export async function renderEscPos(bytes: Buffer): Promise<Buffer> {
  const { ops, height } = interpretEscPos(bytes)
  const notesWidth = 190
  const width = PAPER_WIDTH + MARGIN * 2 + notesWidth
  const paperHeight = height + MARGIN
  const totalHeight = paperHeight + MARGIN * 2

  const parts: string[] = []
  let lastNoteTop = -Infinity
  for (const op of ops) {
    const top = MARGIN + MARGIN / 2 + op.y
    if (op.kind === 'text') {
      // One element per character, centred in its cell: the printer's font is fixed-width
      const advance = CHAR_WIDTH * op.scaleX
      const baseline = top + CHAR_HEIGHT * op.scaleY - 6
      Array.from(op.text).forEach((char, index) => {
        if (char === ' ') return
        const x = MARGIN + PAPER_SIDE + op.x + index * advance + advance / 2
        parts.push(
          `<text x="${x}" y="${baseline}" font-size="${20 * op.scaleY}" text-anchor="middle">${escapeXml(char)}</text>`
        )
      })
    } else if (op.kind === 'bitmap') {
      parts.push(
        `<image x="${MARGIN + PAPER_SIDE + op.x}" y="${top}" width="${op.width}" height="${op.height}" image-rendering="pixelated" href="${await bitmapDataUri(op)}"/>`
      )
    } else {
      const noteX = MARGIN * 2 + PAPER_WIDTH
      if (op.cut) {
        parts.push(
          `<line x1="${MARGIN - 12}" y1="${top}" x2="${MARGIN + PAPER_WIDTH + 12}" y2="${top}" stroke="#888" stroke-width="2" stroke-dasharray="10 8"/>`
        )
      }
      // Events at the same paper position are listed one under another
      const noteTop = Math.max(top, lastNoteTop + 22)
      lastNoteTop = noteTop
      parts.push(
        `<text x="${noteX}" y="${noteTop + 5}" font-size="16" fill="#666" font-family="sans-serif" font-style="italic">← ${escapeXml(op.label)}</text>`
      )
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}">
  <rect width="100%" height="100%" fill="#e8e8e8"/>
  <rect x="${MARGIN}" y="${MARGIN}" width="${PAPER_WIDTH}" height="${paperHeight}" fill="#ffffff"/>
  <g font-family="DejaVu Sans Mono, Consolas, Menlo, Adwaita Mono, monospace" fill="#000000">
  ${parts.join('\n  ')}
  </g>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** PNG of exactly what the receipt printer would print for this order. */
export async function renderReceiptPreview(order: Order): Promise<Buffer> {
  return renderEscPos(await captureReceipt(order))
}

/** A realistic order for previewing the design without touching the database. */
export function exampleOrder(): Order {
  const item = (id: number, name: string, price: number, quantity: number) => ({
    id,
    name,
    price,
    quantity,
    image: '',
    deleted: false,
    created_at: new Date().toISOString(),
  })
  return {
    id: 1042,
    status: 'completed',
    created_at: new Date().toISOString(),
    items: [
      item(1, 'Sunflower Mug', 12.5, 2),
      item(2, 'Hand-painted Vase', 24, 1),
      item(3, 'Clay Coaster Set', 8.75, 3),
      item(4, 'Gift Wrapping', 1.5, 1),
    ],
  }
}
