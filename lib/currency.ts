// ISO 4217 currencies the user can pick in /account → Profile. Kept short
// — the ones the user actually asked for plus the obvious extras. Adding more
// is one entry in CURRENCIES + nothing else (formatCurrency uses Intl).

export interface CurrencyOption {
  code: string
  label: string
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'CAD', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'NZD', label: 'New Zealand Dollar (NZ$)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'SEK', label: 'Swedish Krona (kr)' },
  { code: 'NOK', label: 'Norwegian Krone (kr)' },
  { code: 'DKK', label: 'Danish Krone (kr)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
]

export const DEFAULT_CURRENCY = 'GBP'

const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code))

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_CODES.has(code)
}

// Format a numeric amount as currency using the user's chosen code. Always
// formats with the locale-default symbol so EUR renders as "€12.50",
// JPY as "¥1,250", etc. Locale is left undefined so the browser / server
// picks one; that means amount placement (€12 vs 12 €) follows locale.
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      // JPY has no minor unit; let Intl handle it via maximumFractionDigits.
    }).format(amount)
  } catch {
    // Unknown currency code — fall back to plain number.
    return amount.toFixed(2)
  }
}
