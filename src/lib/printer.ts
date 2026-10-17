import { Order } from './dto'
import { createPrinter, writeReceipt } from './receipt'

const escpos = require('escpos')
escpos.USB = require('escpos-usb')

// A jammed or paper-less printer can leave a USB transfer pending forever
const PRINT_TIMEOUT_MS = 20_000

function closeQuietly(device: any) {
  try {
    device.close()
  } catch {}
}

async function print(device: any, order: Order): Promise<void> {
  // open() can throw synchronously (e.g. claim fails); the executor turns that into a rejection
  await new Promise<void>((resolve, reject) =>
    device.open((error: Error | null) => (error ? reject(error) : resolve()))
  )
  const printer = createPrinter(device)
  // The whole receipt is built in memory first: if any part fails, nothing is sent,
  // so a failure never prints half a receipt
  await writeReceipt(printer, order)
  // flush() reports the USB transfer result; escpos' close() would swallow it
  await new Promise<void>((resolve, reject) =>
    printer.flush((error?: Error | null) => (error ? reject(error) : resolve()))
  )
  await new Promise<void>((resolve, reject) =>
    device.close((error?: Error | null) => (error ? reject(error) : resolve()))
  )
}

/**
 * Prints the receipt on an escpos device (USB in the shop; a fake one in tests).
 * Resolves once the printer has accepted it; rejects if any step fails or it doesn't
 * finish within timeoutMs.
 */
export async function printOnDevice(device: any, order: Order, timeoutMs = PRINT_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Printer did not respond within ${timeoutMs / 1000}s`)), timeoutMs)
  })
  try {
    await Promise.race([print(device, order), timeout])
  } catch (error) {
    closeQuietly(device)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export default async function sendToThermalPrinter(order: Order): Promise<void> {
  // Throws if no printer with these ids is connected
  const device = new escpos.USB(process.env.PRINTER_VID, process.env.PRINTER_PID)
  await printOnDevice(device, order)
}
