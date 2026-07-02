// Shared money formatting for quote and payment surfaces. Whole-dollar
// amounts drop the cents ("$325"); fractional amounts keep them ("$325.50").
export function formatCurrency(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}
