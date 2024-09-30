import { currencyFormat } from '@/lib/util'
import { Order } from './dto'

const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine,
} = require('node-thermal-printer')
const path = require('path')
const fs = require('fs').promises
export default async function sendToThermalPrinter(order: Order) {
  const imagePath = path.join(process.cwd(), 'public', 'logo-printer.png')
  const image = await fs.readFile(imagePath)
  let printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    width: 32,
    interface: process.env.PRINTER_INTERFACE,
    characterSet: CharacterSet.PC852_LATIN2,
    removeSpecialCharacters: false,
    lineCharacter: '=',
    breakLine: BreakLine.WORD,
  })
  printer.alignCenter()
  printer.printImageBuffer(image)
  printer.println('Thank You For Your Order')
  printer.drawLine()
  printer.println(`Order Number: #${order.id}`)
  let finalPrice = 0
  printer.drawLine()
  order.items.forEach((item) => {
    finalPrice = finalPrice + item.quantity * item.price
    printer.tableCustom([
      { text: item.name, align: 'LEFT', width: 0.5 },
      { text: `x ${item.quantity}`, align: 'CENTER', width: 0.25 },
      { text: currencyFormat(item.price), align: 'RIGHT', width: 0.25 },
    ])
  })
  printer.drawLine()
  printer.println(`Total ${currencyFormat(finalPrice)}`)
  printer.drawLine()
  printer.println(`${currencyFormat(1)} = 90,000 L.L.`)
  printer.drawLine()
  printer.println('Follow Us on Instagram')
  printer.newLine()
  printer.printQR(
    'https://www.instagram.com/sunflowercrafts1?igsh=MTR3c3lwdGp0amxibA=='
  )
  printer.cut()
  printer.beep()
  printer.execute()
}
