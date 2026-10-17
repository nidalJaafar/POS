/* eslint-disable no-console */
/**
 * Receipt printer helpers.
 *
 *   npm run printer:list   list USB devices with their vendor/product ids, to fill in
 *                          PRINTER_VID and PRINTER_PID in .env.local
 *   npm run printer:test   print a short test receipt (with the logo) and open the drawer
 */
const path = require('path')
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const hex = (n) => `0x${n.toString(16).padStart(4, '0')}`

function list() {
  const usb = require('usb')
  const configured = [process.env.PRINTER_VID, process.env.PRINTER_PID].map((v) => (v ? Number(v) : null))
  const devices = usb.getDeviceList()
  if (!devices.length) {
    console.log('No USB devices found.')
    return
  }
  console.log('USB devices (PRINTER_VID PRINTER_PID):')
  for (const device of devices) {
    const { idVendor, idProduct, bDeviceClass } = device.deviceDescriptor
    // Class 7 = printer; 0 means "defined per interface", which most receipt printers use
    const hint = bDeviceClass === 7 ? ' printer' : ''
    const mark = idVendor === configured[0] && idProduct === configured[1] ? '  ← configured' : ''
    console.log(`  ${hex(idVendor)} ${hex(idProduct)}${hint}${mark}`)
  }
  console.log('\nTip: unplug the printer, run this again, and the line that disappeared is the printer.')
}

function test() {
  const { PRINTER_VID, PRINTER_PID } = process.env
  if (!PRINTER_VID || !PRINTER_PID) throw new Error('Set PRINTER_VID and PRINTER_PID in .env.local first (see npm run printer:list)')
  const escpos = require('escpos')
  escpos.USB = require('escpos-usb')
  const device = new escpos.USB(PRINTER_VID, PRINTER_PID)
  const printer = new escpos.Printer(device, { encoding: 'GB18030' })

  return new Promise((resolve, reject) => {
    device.open((error) => {
      if (error) return reject(error)
      escpos.Image.load(path.join(process.cwd(), 'public', 'logo-printer.png'), (image) => {
        if (image instanceof Error) return reject(image)
        printer.align('ct').image(image, 'd24').then(() => {
          printer
            .text('Printer test')
            .text(new Date().toLocaleString())
            .drawLine()
          // Same bytes as src/lib/receipt.ts: open the drawer (ESC p 0 25 250; escpos'
          // cashdraw() mangles 0xFA into UTF-8), then feed to the cutter + 3 mm and cut (GS V 66 24)
          printer.buffer.write(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]))
          printer.buffer.write(Buffer.from([0x1d, 0x56, 0x42, 24]))
          printer
            .close((closeError) => (closeError ? reject(closeError) : resolve()))
        }, reject)
      })
    })
  })
}

async function main() {
  const command = process.argv[2]
  if (command === 'list') list()
  else if (command === 'test') {
    await test()
    console.log('Test receipt sent.')
  } else {
    console.error('Usage: node scripts/printer.js list|test')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Printer error:', error.message)
  process.exitCode = 1
})
