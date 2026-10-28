// Money is stored as integer minor units (e.g. piastres for EGP). Never floats.

const DECIMALS: Record<string, number> = { EGP: 2, USD: 2, EUR: 2, GBP: 2, SAR: 2, AED: 2, KWD: 3 };

export function decimalsFor(currency: string): number {
  return DECIMALS[currency] ?? 2;
}

/** Parse a decimal string like "1234.56" into minor units without float math. */
export function toMinor(value: string, currency: string): number {
  const d = decimalsFor(currency);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid amount: ${value}`);
  const [, sign, whole, frac = ''] = match;
  if (frac.length > d) throw new Error(`Too many decimals for ${currency}: ${value}`);
  const minor = Number(whole + frac.padEnd(d, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error(`Amount out of range: ${value}`);
  return sign ? -minor : minor;
}

/** Format minor units as a plain decimal string, e.g. 123456 -> "1234.56". */
export function formatMinor(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor)) throw new Error(`Not an integer amount: ${minor}`);
  const d = decimalsFor(currency);
  const abs = Math.abs(minor).toString().padStart(d + 1, '0');
  const body = d === 0 ? abs : `${abs.slice(0, -d)}.${abs.slice(-d)}`;
  return minor < 0 ? `-${body}` : body;
}
