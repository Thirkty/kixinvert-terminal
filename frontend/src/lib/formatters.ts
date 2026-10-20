/**
 * Formatters according to Venezuelan and international financial standards
 * Strictly uses official 'Bs.', never obsolete 'Bs.S'
 */

export function formatVES(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Bs. 0,00';
  const formatted = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Bs. ${formatted}`;
}

export function formatUSD(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUSDT(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0.00 USDT';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} USDT`;
}

export function formatCurrencyByMode(amount: number, mode: 'ves' | 'usd_bcv' | 'usdt'): string {
  if (mode === 'ves') return formatVES(amount);
  if (mode === 'usd_bcv') return formatUSD(amount);
  return formatUSDT(amount);
}

export function formatPercent(value: number, showSign: boolean = true): string {
  if (isNaN(value)) return '0.00%';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
