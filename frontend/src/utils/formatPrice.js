export function formatPrice(price) {
  if (price === null || price === undefined || price === '') {
    return '৳0'
  }

  const value = String(price).trim()
  const match = value.match(/^(-?)(\d+)(?:\.(\d+))?$/)

  if (!match) {
    const numericPrice = Number(price)
    return Number.isFinite(numericPrice)
      ? `৳${new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 20,
        }).format(numericPrice)}`
      : `৳${value}`
  }

  const [, sign, integerPart, decimalPart = ''] = match
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const meaningfulDecimals = decimalPart.replace(/0+$/, '')

  return `৳${sign}${groupedInteger}${meaningfulDecimals ? `.${meaningfulDecimals}` : ''}`
}