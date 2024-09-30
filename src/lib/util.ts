export function currencyFormat(num: number): string {
  if (isNaN(num)) {
    return ''
  }
  return '$' + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}
