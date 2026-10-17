import { describe, expect, it, vi } from 'vitest'
import { printOnDevice } from '@/lib/printer'
import { exampleOrder } from '@/lib/receipt-preview'

// Stands in for escpos-usb: records what is sent and lets each step succeed, fail or hang
function fakeDevice(behaviour: { open?: 'ok' | 'error' | 'throw'; write?: 'ok' | 'error' | 'hang' } = {}) {
  const sent: Buffer[] = []
  const device = {
    sent,
    closed: 0,
    open(callback: (error: Error | null) => void) {
      if (behaviour.open === 'throw') throw new Error('LIBUSB_ERROR_ACCESS')
      callback(behaviour.open === 'error' ? new Error('Can not find endpoint') : null)
    },
    write(data: Buffer, callback: (error?: Error | null) => void) {
      sent.push(Buffer.from(data))
      if (behaviour.write === 'hang') return
      callback(behaviour.write === 'error' ? new Error('LIBUSB_TRANSFER_STALL') : null)
    },
    close(callback?: (error?: Error | null) => void) {
      device.closed += 1
      callback?.(null)
    },
  }
  return device
}

describe('printOnDevice', () => {
  it('sends the whole receipt in one transfer and closes the device', async () => {
    const device = fakeDevice()
    await printOnDevice(device, exampleOrder())
    expect(device.sent).toHaveLength(1)
    const bytes = device.sent[0]
    expect(bytes.includes(Buffer.from('Order Number: #1042'))).toBe(true)
    expect(bytes.subarray(-4)).toEqual(Buffer.from([0x1d, 0x56, 0x42, 24]))
    expect(device.closed).toBe(1)
  })

  it('reports a failed USB transfer instead of succeeding', async () => {
    const device = fakeDevice({ write: 'error' })
    await expect(printOnDevice(device, exampleOrder())).rejects.toThrow(/STALL/)
    expect(device.closed).toBe(1)
  })

  it.each(['error', 'throw'] as const)('rejects and closes the device when opening fails (%s)', async (open) => {
    const device = fakeDevice({ open })
    await expect(printOnDevice(device, exampleOrder())).rejects.toThrow()
    expect(device.sent).toHaveLength(0)
    expect(device.closed).toBe(1)
  })

  it('gives up on a printer that never answers', async () => {
    const device = fakeDevice({ write: 'hang' })
    await expect(printOnDevice(device, exampleOrder(), 200)).rejects.toThrow(/did not respond within 0.2s/)
    expect(device.closed).toBe(1)
  })

  it('sends nothing when the receipt cannot be built', async () => {
    const device = fakeDevice()
    const broken = { ...exampleOrder(), items: null as never }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(printOnDevice(device, broken)).rejects.toThrow()
    consoleError.mockRestore()
    expect(device.sent).toHaveLength(0)
  })
})
