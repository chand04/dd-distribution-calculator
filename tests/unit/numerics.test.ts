import { describe, expect, it } from 'vitest';
import {
  loadFixtures, evaluate, caseLabel, PROBABILITY_KINDS, type FixtureCase,
} from '../support/fixtures';
import * as N from '../../src/numerics';

/**
 * Accuracy budget.
 *
 * Probabilities: an absolute budget is meaningless for a tail of 1e-89, and a
 * relative budget is needlessly tight for a probability of 0.5, so each case
 * passes on whichever of the two it should be judged by. The crossover sits at
 * 1e-6: above it the absolute target from the specification applies, below it
 * the relative one, so that a tail cannot pass by being rounded to zero.
 *
 * Quantiles: the specification's 1e-8 * max(1, |reference|).
 *
 * These are the measured headroom of @stdlib against 60-digit mpmath
 * references over the supported range, with roughly two orders of margin;
 * tools/report_accuracy.ts prints the observed worst cases.
 */
const PROB_ABS_TOL = 1e-12;
const PROB_REL_TOL = 1e-11;
const PROB_CROSSOVER = 1e-6;
const QUANT_REL_TOL = 1e-8;
/** Below this a probability may legitimately come back as 0; see format.ts. */
const UNDERFLOW_LIMIT = 1e-308;

/**
 * The range the calculator offers, and the range these fixtures are judged
 * over. Both limits are measured, not chosen for convenience:
 *
 *  - Degrees of freedom below 1 make @stdlib's t quantile overflow to infinity
 *    in the far tail instead of returning the finite answer.
 *  - For Student's t, an inverse at a tail probability below 1e-100 does the
 *    same for small degrees of freedom (at df = 1 the answer is about 1e299).
 *
 * These are the limits of what is *guaranteed*, not a claim that everything
 * past them fails. Outside them a case must still either agree with the
 * reference or return a non-finite value, which the interface turns into an
 * out-of-range message. What must never happen, in range or out of it, is a
 * plausible-looking wrong number.
 */
const DF_MIN = 1;
const DF_MAX = 1e5;
const T_INVERSE_MIN_P = 1e-100;

const INVERSE_KINDS = new Set(['cdfInv', 'sfInv', 'centralInv', 'twoTailInv']);

function withinSupportedRange(c: FixtureCase): boolean {
  if (c.df !== undefined && (c.df < DF_MIN || c.df > DF_MAX)) return false;
  if (c.dist === 't' && INVERSE_KINDS.has(c.kind) && c.arg < T_INVERSE_MIN_P) {
    return false;
  }
  return true;
}

const fixtures = loadFixtures();

function checkProbability(c: FixtureCase, got: number): void {
  const exp = c.expected as number;
  if (exp === 0) {
    // A mathematically exact zero: the degenerate c = 0 central area.
    expect(got, caseLabel(c)).toBe(0);
  } else if (Math.abs(exp) >= PROB_CROSSOVER) {
    expect(Math.abs(got - exp), caseLabel(c)).toBeLessThanOrEqual(PROB_ABS_TOL);
  } else if (got === 0 && Math.abs(exp) < UNDERFLOW_LIMIT) {
    // Below this the routines stop producing a nonzero tail; the interface
    // reports the bound rather than a number. Checked in its own test above.
  } else {
    expect(got, `${caseLabel(c)} must not round a tiny tail to zero`).not.toBe(0);
    expect(Math.abs(got - exp) / Math.abs(exp), caseLabel(c))
      .toBeLessThanOrEqual(PROB_REL_TOL);
  }
}

function checkQuantile(c: FixtureCase, got: number): void {
  const exp = c.expected as number;
  const tol = QUANT_REL_TOL * Math.max(1, Math.abs(exp));
  expect(Math.abs(got - exp), caseLabel(c)).toBeLessThanOrEqual(tol);
}

describe('independent reference fixtures', () => {
  it('cover every distribution, region and direction', () => {
    const kinds = new Set(fixtures.cases.map((c) => `${c.dist}.${c.kind}`));
    expect(kinds.size).toBe(16);
    expect(fixtures.cases.length).toBeGreaterThan(1000);
    const dfs = new Set(
      fixtures.cases.filter((c) => c.dist === 't').map((c) => c.df),
    );
    for (const df of [1, 2, 10, 7.5, 100000]) expect(dfs).toContain(df);
  });

  for (const c of fixtures.cases) {
    const label = caseLabel(c);
    const guaranteed = withinSupportedRange(c);
    const title = guaranteed
      ? `matches mpmath for ${label}`
      : `is correct or declines, outside the guaranteed range: ${label}`;
    it(title, () => {
      const got = evaluate(c);

      if (!guaranteed && !Number.isFinite(got)) return; // declined; see above

      if (c.overflow) {
        // The true value exceeds the double range. Anything finite would be a
        // silently wrong answer, so the routine must say so.
        expect(Number.isFinite(got), `${label} must not fake a finite answer`)
          .toBe(false);
        return;
      }
      if (c.underflow) {
        // The true value is positive but smaller than any double. Zero is the
        // only honest double; the user interface reports it as a bound.
        expect(got, label).toBe(0);
        return;
      }

      expect(Number.isNaN(got), `${label} must not be NaN`).toBe(false);
      if (PROBABILITY_KINDS.has(c.kind)) checkProbability(c, got);
      else checkQuantile(c, got);
    });
  }
});

describe('the reported underflow bound is true', () => {
  it('no reference value a routine rounds to zero exceeds the bound shown', () => {
    const BOUND = 1e-308;
    const offenders: string[] = [];
    for (const c of fixtures.cases) {
      if (!PROBABILITY_KINDS.has(c.kind)) continue;
      if (!withinSupportedRange(c)) continue;
      const exp = c.expected;
      if (exp === null || exp === 0) continue;
      if (evaluate(c) === 0 && exp > BOUND) {
        offenders.push(`${caseLabel(c)} true value ${exp}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('specification benchmarks', () => {
  it('P(Z <= 1.96)', () => {
    expect(N.normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 15);
  });

  it('t with df = 10, total two-tail probability 0.05, gives about 2.228138852', () => {
    expect(N.tTwoTailInv(0.05, 10)).toBeCloseTo(2.228138852, 9);
  });

  it('normal inverse left tail at p = 0.975', () => {
    expect(N.normalCdfInv(0.975)).toBeCloseTo(1.959963984540054, 12);
  });

  it('normal inverse, total two-tail probability 0.05', () => {
    expect(N.normalTwoTailInv(0.05)).toBeCloseTo(1.959963984540054, 12);
  });

  it('normal inverse central area 0.95', () => {
    expect(N.normalCentralInv(0.95)).toBeCloseTo(1.959963984540054, 12);
  });
});

describe('symmetry', () => {
  for (const x of [0.3, 1, 1.96, 4, 12]) {
    it(`normal: P(Z <= -${x}) equals P(Z >= ${x})`, () => {
      expect(N.normalCdf(-x)).toBe(N.normalSf(x));
    });
    for (const df of [1, 2, 7.5, 10, 1000]) {
      it(`t df=${df}: P(T <= -${x}) equals P(T >= ${x})`, () => {
        expect(N.tCdfAt(-x, df)).toBeCloseTo(N.tSf(x, df), 15);
      });
    }
  }

  it('a symmetric interval always has equal tails', () => {
    for (const p of [0.5, 0.05, 1e-8]) {
      expect(N.normalTwoTailInv(p)).toBeCloseTo(N.normalSfInv(p / 2), 12);
      expect(N.tTwoTailInv(p, 10)).toBeCloseTo(N.tSfInv(p / 2, 10), 10);
    }
  });

  it('the central area and the two tails sum to 1', () => {
    for (const c of [0.1, 1, 1.96, 3]) {
      expect(N.normalCentral(c) + N.normalTwoTail(c)).toBeCloseTo(1, 15);
      expect(N.tCentral(c, 7.5) + N.tTwoTail(c, 7.5)).toBeCloseTo(1, 15);
    }
  });
});

describe('monotonicity', () => {
  const xs = [-20, -8, -3, -1.96, -0.5, 0, 0.5, 1.96, 3, 8, 20];

  it('the normal cdf increases and the survival function decreases', () => {
    for (let i = 1; i < xs.length; i += 1) {
      expect(N.normalCdf(xs[i])).toBeGreaterThanOrEqual(N.normalCdf(xs[i - 1]));
      expect(N.normalSf(xs[i])).toBeLessThanOrEqual(N.normalSf(xs[i - 1]));
    }
  });

  for (const df of [1, 7.5, 100]) {
    it(`the t cdf increases, df = ${df}`, () => {
      for (let i = 1; i < xs.length; i += 1) {
        expect(N.tCdfAt(xs[i], df)).toBeGreaterThanOrEqual(N.tCdfAt(xs[i - 1], df));
      }
    });
  }

  it('the central area grows with the cutoff', () => {
    const cs = [0, 1e-6, 0.5, 1, 2, 5, 10];
    for (let i = 1; i < cs.length; i += 1) {
      expect(N.normalCentral(cs[i])).toBeGreaterThan(N.normalCentral(cs[i - 1]));
      expect(N.tCentral(cs[i], 4)).toBeGreaterThan(N.tCentral(cs[i - 1], 4));
    }
  });
});

describe('round trips', () => {
  const ps = [0.9, 0.5, 0.1, 0.025, 1e-6, 1e-12, 1e-24];

  for (const p of ps) {
    it(`normal right tail round trips at p = ${p}`, () => {
      const x = N.normalSfInv(p);
      expect(N.normalSf(x) / p).toBeCloseTo(1, 10);
    });
    it(`normal two tails round trip at total p = ${p}`, () => {
      const c = N.normalTwoTailInv(p);
      expect(N.normalTwoTail(c) / p).toBeCloseTo(1, 10);
    });
  }

  for (const df of [1, 2, 7.5, 10, 100]) {
    for (const p of [0.4, 0.05, 1e-6, 1e-12]) {
      it(`t df=${df} right tail round trips at p = ${p}`, () => {
        const x = N.tSfInv(p, df);
        expect(N.tSf(x, df) / p).toBeCloseTo(1, 9);
      });
      it(`t df=${df} central area round trips at p = ${p}`, () => {
        const c = N.tCentralInv(p, df);
        expect(N.tCentral(c, df) / p).toBeCloseTo(1, 9);
      });
    }
  }
});

describe('stability of the hard cases', () => {
  it('a far upper tail is not computed as 1 - cdf', () => {
    // 1 - normalCdf(10) would be exactly 0 in double precision.
    expect(1 - N.normalCdf(10)).toBe(0);
    expect(N.normalSf(10)).toBeCloseTo(7.619853024160526e-24, 30);
  });

  it('a tiny central area is not computed by subtracting two near-ones', () => {
    // 1 - 2 * normalSf(1e-10) loses every significant digit.
    const naive = 1 - 2 * N.normalSf(1e-10);
    const stable = N.normalCentral(1e-10);
    expect(stable).toBeCloseTo(7.978845608028654e-11, 22);
    expect(Math.abs(naive - stable) / stable).toBeGreaterThan(1e-7);
  });

  it('a tiny central area is stable for t as well', () => {
    const stable = N.tCentral(1e-10, 10);
    expect(stable).toBeGreaterThan(0);
    expect(stable / 7.782167679320621e-11).toBeCloseTo(1, 10);
  });

  it('an inverse tail at p = 1e-24 does not round 1 - p to 1', () => {
    expect(N.normalSfInv(1e-24)).toBeCloseTo(10.199157424513419, 12);
    expect(N.normalCdfInv(1e-24)).toBeCloseTo(-10.199157424513419, 12);
  });

  it('distinguishes underflow from an exact zero', () => {
    expect(N.normalSf(45)).toBe(0); // underflow; the interface says "< 5e-324"
    expect(N.normalCentral(0)).toBe(0); // mathematically exact
    expect(N.normalTwoTail(0)).toBe(1); // mathematically exact
  });
});
