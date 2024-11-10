export function currencyFormat(num: number): string {
  if (isNaN(num)) {
    return ''
  }
  return '$' + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

export function dateFormat(date: string): string {
  const dateObj = new Date(date)

  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  const monthsOfYear = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const dayOfWeek = daysOfWeek[dateObj.getDay()]
  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = monthsOfYear[dateObj.getMonth()]
  const year = dateObj.getFullYear()

  return `${dayOfWeek}, ${month} ${day}, ${year}`
}
