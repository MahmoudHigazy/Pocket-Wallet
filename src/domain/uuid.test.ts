import { uuidv7 } from './uuid';

const zeros = (n: number) => new Uint8Array(n);
const ones = (n: number) => new Uint8Array(n).fill(0xff);

describe('uuidv7', () => {
  it('has version 7 and RFC variant', () => {
    const id = uuidv7(1_700_000_000_000, ones);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('encodes the timestamp in the first 48 bits', () => {
    const id = uuidv7(0x0123456789ab, zeros);
    expect(id.replace(/-/g, '').slice(0, 12)).toBe('0123456789ab');
  });

  it('sorts by creation time', () => {
    const a = uuidv7(1000, ones);
    const b = uuidv7(2000, zeros);
    expect(a < b).toBe(true);
  });
});
