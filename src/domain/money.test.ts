import { formatMinor, toMinor } from './money';

describe('money', () => {
  it('parses decimal strings to minor units', () => {
    expect(toMinor('1234.56', 'EGP')).toBe(123456);
    expect(toMinor('10', 'EGP')).toBe(1000);
    expect(toMinor('0.1', 'EGP')).toBe(10);
    expect(toMinor('-5.5', 'EGP')).toBe(-550);
    expect(toMinor('1.234', 'KWD')).toBe(1234);
  });

  it('rejects invalid or over-precise input', () => {
    expect(() => toMinor('abc', 'EGP')).toThrow();
    expect(() => toMinor('1.234', 'EGP')).toThrow();
  });

  it('formats minor units', () => {
    expect(formatMinor(123456, 'EGP')).toBe('1234.56');
    expect(formatMinor(5, 'EGP')).toBe('0.05');
    expect(formatMinor(-550, 'EGP')).toBe('-5.50');
  });

  it('round-trips without float drift', () => {
    expect(formatMinor(toMinor('0.30', 'EGP'), 'EGP')).toBe('0.30');
  });
});
