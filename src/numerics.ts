/**
 * Numerical core for the Data & Decisions Distribution Calculator.
 *
 * Every routine is written as a *stable* formulation: upper tails are never
 * computed as `1 - cdf(x)`, tiny central areas are never computed by
 * subtracting two numbers close to 1, and inverse-tail routines never round
 * `1 - p` to 1. Special functions come from @stdlib (Apache-2.0 / BSL-1.0);
 * nothing here re-implements one.
 */
import erf from '@stdlib/math-base-special-erf';
import erfc from '@stdlib/math-base-special-erfc';
import erfinv from '@stdlib/math-base-special-erfinv';
import erfcinv from '@stdlib/math-base-special-erfcinv';
import betainc from '@stdlib/math-base-special-betainc';
import betaincinv from '@stdlib/math-base-special-betaincinv';
import tCdf from '@stdlib/stats-base-dists-t-cdf';
import tPdf from '@stdlib/stats-base-dists-t-pdf';
import tQuantile from '@stdlib/stats-base-dists-t-quantile';

const SQRT2 = Math.SQRT2;

/* ------------------------------------------------------------------ */
/* Standard normal                                                     */
/* ------------------------------------------------------------------ */

/** P(Z <= x). Stable for x << 0 because erfc underflows gracefully. */
export function normalCdf(x: number): number {
  return 0.5 * erfc(-x / SQRT2);
}

/** P(Z >= x), computed directly rather than as 1 - normalCdf(x). */
export function normalSf(x: number): number {
  return 0.5 * erfc(x / SQRT2);
}

/** P(-c <= Z <= c) for c >= 0. erf is exact for small c, so tiny central
 *  areas keep full relative precision. */
export function normalCentral(c: number): number {
  return erf(c / SQRT2);
}

/** P(Z <= -c or Z >= c) for c >= 0. */
export function normalTwoTail(c: number): number {
  return erfc(c / SQRT2);
}

/** x with P(Z <= x) = p. Uses erfcinv(2p) so that no 1 - p ever appears. */
export function normalCdfInv(p: number): number {
  return -SQRT2 * erfcinv(2 * p);
}

/** x with P(Z >= x) = p. */
export function normalSfInv(p: number): number {
  return SQRT2 * erfcinv(2 * p);
}

/** c >= 0 with P(-c <= Z <= c) = p. */
export function normalCentralInv(p: number): number {
  // erfinv keeps relative precision for small p; for p near 1 the complement
  // is the better-conditioned argument.
  return p <= 0.5 ? SQRT2 * erfinv(p) : SQRT2 * erfcinv(1 - p);
}

/** c >= 0 with P(Z <= -c or Z >= c) = p (p is the TOTAL of both tails). */
export function normalTwoTailInv(p: number): number {
  return SQRT2 * erfcinv(p);
}

/* ------------------------------------------------------------------ */
/* Student's t                                                         */
/* ------------------------------------------------------------------ */

/** c^2 / (df + c^2), computed without overflowing for very large c. */
function betaArg(c: number, df: number): number {
  if (c === 0) return 0;
  if (!Number.isFinite(c)) return 1;
  const u = df / c / c; // two divisions: no c*c overflow
  return 1 / (1 + u);
}

export function tCdfAt(x: number, df: number): number {
  return tSf(-x, df);
}

/**
 * P(T >= x).
 *
 * Away from the centre this is the lower tail at -x, by symmetry, so there is
 * no cancellation. Within |x| < 0.1 the library's own cdf loses the small
 * offset from one half for some degrees of freedom (at df = 1 it is only
 * accurate to about 1e-9 near zero), so the answer is instead assembled as
 * half the central area taken off a half, which is exact to the last bit
 * because the central area is computed in its own right.
 */
export function tSf(x: number, df: number): number {
  if (Math.abs(x) < 0.1) {
    const half = 0.5 * tCentral(Math.abs(x), df);
    return x >= 0 ? 0.5 - half : 0.5 + half;
  }
  return tCdf(-x, df);
}

/**
 * P(-c <= T <= c) for c >= 0.
 *
 * Written as the regularized incomplete beta I_{c^2/(df+c^2)}(1/2, df/2),
 * which is the central area itself, rather than 1 - 2*tSf(c) which would
 * cancel for small c.
 */
export function tCentral(c: number, df: number): number {
  return betainc(betaArg(c, df), 0.5, df / 2);
}

/** P(T <= -c or T >= c) for c >= 0. */
export function tTwoTail(c: number, df: number): number {
  return 2 * tSf(c, df);
}

/**
 * One safeguarded Newton step on the survival function.
 * Solves S(x) = p using S'(x) = -pdf(x). Both S(x) and p are the same
 * magnitude here, so their difference keeps relative precision even for
 * tiny tails.
 */
function polishSf(x: number, p: number, df: number): number {
  let cur = x;
  for (let i = 0; i < 3; i += 1) {
    const d = tPdf(cur, df);
    if (!Number.isFinite(d) || d === 0) return cur;
    const next = cur + (tSf(cur, df) - p) / d;
    if (!Number.isFinite(next)) return cur;
    const before = Math.abs(tSf(cur, df) - p);
    const after = Math.abs(tSf(next, df) - p);
    if (!(after <= before)) return cur;
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

/** x with P(T <= x) = p. */
export function tCdfInv(p: number, df: number): number {
  return -tSfInv(p, df);
}

/** x with P(T >= x) = p. */
export function tSfInv(p: number, df: number): number {
  // tQuantile(p, df) is the lower quantile; -it is the upper one, and using
  // the small-side argument avoids rounding 1 - p to 1 for tiny p.
  const start = -tQuantile(p, df);
  if (!Number.isFinite(start)) return start;
  return polishSf(start, p, df);
}

/** c >= 0 with P(-c <= T <= c) = p. */
export function tCentralInv(p: number, df: number): number {
  if (p > 0.5) {
    // Better conditioned through the tails once the central area dominates.
    return tSfInv((1 - p) / 2, df);
  }
  const z = betaincinv(p, 0.5, df / 2);
  if (!Number.isFinite(z) || z >= 1) return NaN;
  return Math.sqrt((df * z) / (1 - z));
}

/** c >= 0 with P(T <= -c or T >= c) = p (p is the TOTAL of both tails). */
export function tTwoTailInv(p: number, df: number): number {
  return tSfInv(p / 2, df);
}
