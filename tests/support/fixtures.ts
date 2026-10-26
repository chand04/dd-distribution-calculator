/** Loading and dispatch for the committed reference fixtures (test-time only;
 *  none of this is part of the deployed bundle). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as N from '../../src/numerics';

export interface FixtureCase {
  dist: 'normal' | 't';
  kind: string;
  arg: number;
  df?: number;
  /** The reference value rounded to double, or null when the true value falls
   *  outside the range of a double. */
  expected: number | null;
  /** True when the true value is positive but underflows to 0 in a double. */
  underflow?: boolean;
  /** True when the true value's magnitude exceeds the largest double. */
  overflow?: boolean;
  log10?: number;
  sign?: number;
}

export interface FixtureFile {
  generated: string;
  mpmath: string;
  digits: number;
  cases: FixtureCase[];
}

export function loadFixtures(): FixtureFile {
  const path = fileURLToPath(new URL('../../fixtures/reference.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as FixtureFile;
}

const DISPATCH: Record<string, (arg: number, df: number) => number> = {
  'normal.cdf': (a) => N.normalCdf(a),
  'normal.sf': (a) => N.normalSf(a),
  'normal.central': (a) => N.normalCentral(a),
  'normal.twoTail': (a) => N.normalTwoTail(a),
  'normal.cdfInv': (a) => N.normalCdfInv(a),
  'normal.sfInv': (a) => N.normalSfInv(a),
  'normal.centralInv': (a) => N.normalCentralInv(a),
  'normal.twoTailInv': (a) => N.normalTwoTailInv(a),
  't.cdf': (a, df) => N.tCdfAt(a, df),
  't.sf': (a, df) => N.tSf(a, df),
  't.central': (a, df) => N.tCentral(a, df),
  't.twoTail': (a, df) => N.tTwoTail(a, df),
  't.cdfInv': (a, df) => N.tCdfInv(a, df),
  't.sfInv': (a, df) => N.tSfInv(a, df),
  't.centralInv': (a, df) => N.tCentralInv(a, df),
  't.twoTailInv': (a, df) => N.tTwoTailInv(a, df),
};

/** Kinds whose answer is a probability; the rest return a value on the axis. */
export const PROBABILITY_KINDS = new Set(['cdf', 'sf', 'central', 'twoTail']);

export function evaluate(c: FixtureCase): number {
  const fn = DISPATCH[`${c.dist}.${c.kind}`];
  if (!fn) throw new Error(`no routine for ${c.dist}.${c.kind}`);
  return fn(c.arg, c.df ?? NaN);
}

export function caseLabel(c: FixtureCase): string {
  return `${c.dist}.${c.kind}(${c.arg}${c.df !== undefined ? `, df=${c.df}` : ''})`;
}
