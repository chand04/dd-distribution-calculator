/** Display formatting. All values are rounded for display only; the calculator
 *  keeps full double precision internally. */

/** Significant digits shown for every numeric answer. */
export const SIG_DIGITS = 6;

/**
 * The floor used when reporting a probability that underflowed to zero.
 *
 * Not the smallest double (5e-324): the standard normal routines do reach
 * that, but the Student's t routines stop returning a nonzero tail at around
 * 2e-310 for large degrees of freedom. This bound is the one that is true of
 * every routine, and `npm test` checks that no reference value a routine
 * rounds to zero is larger than it.
 */
export const UNDERFLOW_BOUND = '1e-308';

function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  if (s.includes('e') || s.includes('E')) return s;
  return s.replace(/\.?0+$/, '');
}

function tidyExponential(s: string): string {
  // 1e-10 rather than 1.00000e-10, and 1e24 rather than 1.00000e+24.
  const [mantissa, exponent] = s.split('e');
  return `${stripTrailingZeros(mantissa)}e${exponent.replace('+', '')}`;
}

/** Format a finite number to SIG_DIGITS significant digits, using scientific
 *  notation for very small or very large magnitudes. */
export function formatNumber(x: number): string {
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a < 1e-4 || a >= 1e6) {
    return tidyExponential(x.toExponential(SIG_DIGITS - 1));
  }
  // toPrecision still switches to exponential form on its own in places, so
  // tidy whatever it produces rather than assuming plain decimal.
  const s = x.toPrecision(SIG_DIGITS);
  return s.includes('e') ? tidyExponential(s) : stripTrailingZeros(s);
}

export interface ProbabilityValue {
  /** The probability itself, at full double precision. */
  value: number;
  /** The complementary probability 1 - value, computed stably (never as a
   *  subtraction of two numbers close to 1). */
  complement: number;
  /** True when `value` is mathematically positive but underflows to 0. */
  underflow?: boolean;
  /** True when `value` is mathematically below 1 but rounds to 1, and the
   *  complement itself underflows, so no complementary digits exist. */
  complementUnderflow?: boolean;
}

/**
 * Format a probability for display.
 *
 * A probability so close to 1 that six significant digits would print "1" is
 * shown as `1 - <complement>` instead, so that a near-certain event is never
 * presented as a certain one. A positive probability too small to represent is
 * reported as a bound rather than as 0.
 */
export function formatProbability(p: ProbabilityValue): string {
  const { value, complement } = p;
  if (p.underflow) return `< ${UNDERFLOW_BOUND}`;
  if (value === 0) return '0';
  if (value === 1) {
    if (p.complementUnderflow) return `> 1 - ${UNDERFLOW_BOUND}`;
    if (complement > 0) return `1 - ${formatNumber(complement)}`;
    return '1';
  }
  // Would six significant digits round this to exactly "1.00000"?
  if (value > 0.5 && complement > 0 && Number(value.toPrecision(SIG_DIGITS)) === 1) {
    return `1 - ${formatNumber(complement)}`;
  }
  return formatNumber(value);
}
