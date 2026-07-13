/** Curated ISO 4217 currency list for the CURRENCY field's code picker (Twenty parity, trimmed to
 * the common set rather than porting all ~150 codes + per-currency icons). */
export interface CurrencyOption {
  code: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'AED', label: 'UAE Dirham' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'ZAR', label: 'South African Rand' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
];

export const DEFAULT_CURRENCY_CODE = 'USD';
