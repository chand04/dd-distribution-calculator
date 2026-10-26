import { describe, expect, it } from 'vitest';
import { UNDERFLOW_BOUND, formatNumber, formatProbability } from '../../src/format';

describe('formatNumber', () => {
  it('shows up to six significant digits', () => {
    expect(formatNumber(0.9750021048517795)).toBe('0.975002');
    expect(formatNumber(1.959963984540054)).toBe('1.95996');
    expect(formatNumber(2.228138851986274)).toBe('2.22814');
  });

  it('drops trailing zeros rather than padding', () => {
    expect(formatNumber(0.5)).toBe('0.5');
    expect(formatNumber(1.96)).toBe('1.96');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(-2.5)).toBe('-2.5');
  });

  it('uses scientific notation for very small and very large magnitudes', () => {
    expect(formatNumber(7.619853024160526e-24)).toBe('7.61985e-24');
    expect(formatNumber(2.7536241186062336e-89)).toBe('2.75362e-89');
    expect(formatNumber(1e-10)).toBe('1e-10');
    expect(formatNumber(3.183098861837907e23)).toBe('3.1831e23');
    expect(formatNumber(1e6)).toBe('1e6');
    expect(formatNumber(999999)).toBe('999999');
    expect(formatNumber(-1234567)).toBe('-1.23457e6');
  });

  it('formats zero plainly', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatProbability', () => {
  it('shows an ordinary probability directly', () => {
    expect(formatProbability({ value: 0.9750021048517795, complement: 0.024997895 }))
      .toBe('0.975002');
  });

  it('never presents a near-certain probability as exactly 1', () => {
    expect(
      formatProbability({ value: 1, complement: 7.619853024160526e-24 }),
    ).toBe('1 - 7.61985e-24');
    expect(
      formatProbability({ value: 0.9999999999, complement: 1.0000000827e-10 }),
    ).toBe('1 - 1e-10');
  });

  it('reports an underflowing probability as a bound, not as zero', () => {
    expect(formatProbability({ value: 0, complement: 1, underflow: true }))
      .toBe(`< ${UNDERFLOW_BOUND}`);
  });

  it('reports an unrepresentable complement as a bound too', () => {
    expect(
      formatProbability({ value: 1, complement: 0, complementUnderflow: true }),
    ).toBe(`> 1 - ${UNDERFLOW_BOUND}`);
  });

  it('allows a mathematically exact 0 and 1 through', () => {
    expect(formatProbability({ value: 0, complement: 1 })).toBe('0');
    expect(formatProbability({ value: 1, complement: 0 })).toBe('1');
  });
});
