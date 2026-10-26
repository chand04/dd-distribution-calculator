/**
 * Input parsing, validation and the calculator's public operations.
 *
 * This layer owns the student-facing contract: what counts as a valid entry,
 * which probability statement a selection corresponds to, and when an answer is
 * outside the range the implementation has actually been verified over.
 */
import * as N from './numerics';
import { formatNumber, formatProbability, type ProbabilityValue } from './format';

export type Distribution = 'normal' | 't';
export type Mode = 'probability' | 'value';
export type Region = 'left' | 'right' | 'central' | 'twoTails';

/* ------------------------------------------------------------------ */
/* Supported range                                                     */
/* ------------------------------------------------------------------ */

/**
 * Degrees of freedom are verified against independent 60-digit references over
 * [1, 1e5]. Below df = 1 the library's t quantile overflows to infinity for
 * far-tail probabilities instead of returning the (finite) answer, so that
 * band is not offered rather than being offered unverified.
 */
export const DF_MIN = 1;
export const DF_MAX = 1e5;

/** Largest |x| accepted. Beyond this every tail underflows to zero anyway. */
export const X_MAX = 1e6;
const X_MAX_TEXT = '1000000';

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/** A decimal number, optionally signed, optionally in scientific notation, and
 *  nothing else. Deliberately stricter than parseFloat, which happily accepts
 *  "1.96abc" and "1,96". */
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

export function parseStrictNumber(raw: string): number | null {
  const s = raw.trim();
  if (s === '' || !NUMBER_RE.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/* ------------------------------------------------------------------ */
/* Request / result types                                              */
/* ------------------------------------------------------------------ */

export interface CalcRequest {
  distribution: Distribution;
  mode: Mode;
  region: Region;
  /** Raw text from the x / c input (mode "probability"). */
  valueText: string;
  /** Raw text from the probability input (mode "value"). */
  probabilityText: string;
  /** Raw text from the degrees-of-freedom input (t only). */
  dfText: string;
}

export interface CalcSuccess {
  ok: true;
  /** The full statement, e.g. "P(Z <= 1.96) = 0.975002". */
  statement: string;
  /** Extra lines, e.g. the endpoints of a symmetric interval. */
  detail: string[];
}

export interface CalcFailure {
  ok: false;
  message: string;
  /** Which control the student should fix, for focus and aria-describedby. */
  field: 'value' | 'probability' | 'df';
}

export type CalcResult = CalcSuccess | CalcFailure;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const LE = '≤'; // <=
const GE = '≥'; // >=

function symbol(d: Distribution): string {
  return d === 'normal' ? 'Z' : 'T';
}

function dfSuffix(d: Distribution, df: number): string {
  return d === 'normal' ? '' : ` with df = ${formatNumber(df)}`;
}

/** The lower endpoint of a symmetric interval, written without a "-0". */
function negated(x: number, formatted: string): string {
  return x === 0 ? formatted : `-${formatted}`;
}

function fail(message: string, field: CalcFailure['field']): CalcFailure {
  return { ok: false, message, field };
}

function validateDf(req: CalcRequest): number | CalcFailure {
  if (req.distribution === 'normal') return NaN;
  const df = parseStrictNumber(req.dfText);
  if (df === null) {
    return fail('Enter degrees of freedom as a number, for example 10 or 7.5.', 'df');
  }
  if (df <= 0) {
    return fail('Degrees of freedom must be greater than 0.', 'df');
  }
  if (df < DF_MIN || df > DF_MAX) {
    return fail(
      `Degrees of freedom outside the supported range ${formatNumber(DF_MIN)} to ${formatNumber(DF_MAX)}.`,
      'df',
    );
  }
  return df;
}

function isFailure(v: number | CalcFailure): v is CalcFailure {
  return typeof v !== 'number';
}

/* ------------------------------------------------------------------ */
/* Mode A: probability from a value                                    */
/* ------------------------------------------------------------------ */

function probabilityValue(
  dist: Distribution,
  region: Region,
  x: number,
  df: number,
): ProbabilityValue {
  if (dist === 'normal') {
    switch (region) {
      case 'left':
        return { value: N.normalCdf(x), complement: N.normalSf(x) };
      case 'right':
        return { value: N.normalSf(x), complement: N.normalCdf(x) };
      case 'central':
        return x === 0
          ? { value: 0, complement: 1 }
          : { value: N.normalCentral(x), complement: N.normalTwoTail(x) };
      case 'twoTails':
        return x === 0
          ? { value: 1, complement: 0 }
          : { value: N.normalTwoTail(x), complement: N.normalCentral(x) };
    }
  }
  switch (region) {
    case 'left':
      return { value: N.tCdfAt(x, df), complement: N.tSf(x, df) };
    case 'right':
      return { value: N.tSf(x, df), complement: N.tCdfAt(x, df) };
    case 'central':
      return x === 0
        ? { value: 0, complement: 1 }
        : { value: N.tCentral(x, df), complement: N.tTwoTail(x, df) };
    case 'twoTails':
      return x === 0
        ? { value: 1, complement: 0 }
        : { value: N.tTwoTail(x, df), complement: N.tCentral(x, df) };
  }
}

/** A region whose area is mathematically zero only in the degenerate c = 0 case. */
function isExactZero(region: Region, x: number): boolean {
  return region === 'central' && x === 0;
}

function calcProbability(req: CalcRequest, df: number): CalcResult {
  const symmetric = req.region === 'central' || req.region === 'twoTails';
  const x = parseStrictNumber(req.valueText);
  if (x === null) {
    return fail(
      symmetric
        ? 'Enter the cutoff c as a number, for example 1.96.'
        : 'Enter a value as a number, for example 1.96 or -2.5.',
      'value',
    );
  }
  if (symmetric && x < 0) {
    return fail('The cutoff c must be 0 or greater.', 'value');
  }
  if (Math.abs(x) > X_MAX) {
    return fail(`Enter a value with magnitude at most ${X_MAX_TEXT}.`, 'value');
  }

  const pv = probabilityValue(req.distribution, req.region, x, df);
  if (!Number.isFinite(pv.value)) {
    return fail('That input is outside the supported range.', 'value');
  }
  if (pv.value === 0 && !isExactZero(req.region, x)) {
    pv.underflow = true;
  }
  if (pv.value === 1 && pv.complement === 0 && !(req.region === 'twoTails' && x === 0)) {
    pv.complementUnderflow = true;
  }

  const s = symbol(req.distribution);
  const xs = formatNumber(x);
  let lhs: string;
  switch (req.region) {
    case 'left':
      lhs = `P(${s} ${LE} ${xs})`;
      break;
    case 'right':
      lhs = `P(${s} ${GE} ${xs})`;
      break;
    case 'central':
      lhs = `P(${negated(x, xs)} ${LE} ${s} ${LE} ${xs})`;
      break;
    case 'twoTails':
      lhs = `P(${s} ${LE} ${negated(x, xs)} or ${s} ${GE} ${xs})`;
      break;
  }

  // A bounded answer already carries its own relation ("< 5e-324"), so it is
  // joined without an equals sign.
  const shown = formatProbability(pv);
  const joiner = shown.startsWith('<') || shown.startsWith('>') ? ' ' : ' = ';

  return {
    ok: true,
    statement: `${lhs}${joiner}${shown}${dfSuffix(req.distribution, df)}`,
    detail: [],
  };
}

/* ------------------------------------------------------------------ */
/* Mode B: value from a probability                                    */
/* ------------------------------------------------------------------ */

function quantile(dist: Distribution, region: Region, p: number, df: number): number {
  if (dist === 'normal') {
    switch (region) {
      case 'left':
        return N.normalCdfInv(p);
      case 'right':
        return N.normalSfInv(p);
      case 'central':
        return N.normalCentralInv(p);
      case 'twoTails':
        return N.normalTwoTailInv(p);
    }
  }
  switch (region) {
    case 'left':
      return N.tCdfInv(p, df);
    case 'right':
      return N.tSfInv(p, df);
    case 'central':
      return N.tCentralInv(p, df);
    case 'twoTails':
      return N.tTwoTailInv(p, df);
  }
}

function calcValue(req: CalcRequest, df: number): CalcResult {
  const p = parseStrictNumber(req.probabilityText);
  if (p === null) {
    return fail('Enter a probability as a number, for example 0.05.', 'probability');
  }
  if (!(p > 0 && p < 1)) {
    return fail('The probability must be greater than 0 and less than 1.', 'probability');
  }

  const x = quantile(req.distribution, req.region, p, df);
  if (!Number.isFinite(x)) {
    return fail(
      'That probability is too extreme for this distribution to answer at the supported precision.',
      'probability',
    );
  }

  const s = symbol(req.distribution);
  const ps = formatNumber(p);
  const xs = formatNumber(x);
  const suffix = dfSuffix(req.distribution, df);
  const detail: string[] = [];
  let statement: string;

  switch (req.region) {
    case 'left':
      statement = `${s} = ${xs} gives P(${s} ${LE} ${xs}) = ${ps}${suffix}`;
      break;
    case 'right':
      statement = `${s} = ${xs} gives P(${s} ${GE} ${xs}) = ${ps}${suffix}`;
      break;
    case 'central':
      statement =
        `c = ${xs} gives P(${negated(x, xs)} ${LE} ${s} ${LE} ${xs}) = ${ps}${suffix}`;
      detail.push(`Interval endpoints: ${negated(x, xs)} and ${xs}`);
      break;
    case 'twoTails':
      statement =
        `c = ${xs} gives P(${s} ${LE} ${negated(x, xs)} or ${s} ${GE} ${xs})`
        + ` = ${ps} in total${suffix}`;
      detail.push(`Interval endpoints: ${negated(x, xs)} and ${xs}`);
      detail.push(`Each tail has probability ${formatNumber(p / 2)}.`);
      break;
  }

  return { ok: true, statement, detail };
}

/* ------------------------------------------------------------------ */

export function calculate(req: CalcRequest): CalcResult {
  const df = validateDf(req);
  if (isFailure(df)) return df;
  return req.mode === 'probability' ? calcProbability(req, df) : calcValue(req, df);
}
