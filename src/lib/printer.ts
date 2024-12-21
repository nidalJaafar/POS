import { Order } from './dto'
import { currencyFormat } from '@/lib/util'

const escpos = require('escpos')
escpos.USB = require('escpos-usb')
const path = require('path')

export default async function sendToThermalPrinter(order: Order) {
  const device = new escpos.USB(
    process.env.PRINTER_VID,
    process.env.PRINTER_PID
  )
  const printer = new escpos.Printer(device, { encoding: 'GB18030' })
  const imagePath = path.join(process.cwd(), 'public', 'logo-printer.png')

  device.open(function (error: Error) {
    if (error) {
      console.error('Printer connection failed:', error)
      return
    }

    // Print the logo image
    printer.align('ct')
    printer.size(0.5, 0.5)
    escpos.Image.load(imagePath, (image: any) => {
      printer.image(image, 'd24')
      // Print the Thank You message
      printer.text('Thank You For Your Order')
      printer.drawLine()

      // Print order number
      printer.text(`Order Number: #${order.id}`)
      printer.drawLine()

      let finalPrice = 0

      // Print order items
      order.items.forEach((item) => {
        finalPrice += item.quantity * item.price
        printer.tableCustom([
          { text: item.name, align: 'LEFT', width: 0.5 },
          { text: `x ${item.quantity}`, align: 'CENTER', width: 0.25 },
          { text: currencyFormat(item.price), align: 'RIGHT', width: 0.25 },
        ])
      })

      // Print total price
      printer.drawLine()
      printer.text(`Total ${currencyFormat(finalPrice)}`)
      printer.drawLine()

      // Additional line with currency info
      printer.text(`${currencyFormat(1)} = 90,000 L.L.`)
      printer.drawLine()

      // Print social media info
      printer.text('Follow Us on Instagram')
      printer.newLine()

      // Print QR code
      printer.qrimage(
        'https://www.instagram.com/sunflowercrafts1?igsh=MTR3c3lwdGp0amxibA==',
        { type: 'png', mode: 'normal' },
        function (err: Error) {
          if (err) {
            console.error('QR code printing failed:', err)
          } else {
            printer.feed(5)
            printer.cashdraw(2)
            printer.beep(1, 1)
            printer.cut('full')
            printer.close()
          }
        }
      )
    })
  })
}
