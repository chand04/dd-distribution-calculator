/** Diagnostic: worst-case error per (distribution, kind, df) against the
 *  committed reference fixtures. Run with `npx vite-node tools/report_accuracy.ts`.
 *  Not part of the test suite; used to set and re-check the documented limits. */
import {
  loadFixtures, evaluate, PROBABILITY_KINDS, caseLabel, type FixtureCase,
} from '../tests/support/fixtures';

interface Row {
  key: string; worstRel: number; worstAbs: number; at: string; n: number;
  bad: string[]; floored: number;
}
const rows = new Map<string, Row>();

/** Degrees of freedom the calculator actually offers; see DF_MIN/DF_MAX. */
const SUPPORTED_DF = (df: number | undefined) => df === undefined || (df >= 1 && df <= 1e5);
/** Tail probabilities below this may come back as 0; see UNDERFLOW_BOUND. */
const UNDERFLOW_LIMIT = 1e-308;
/** Student's t inverses below this tail probability may be declined. */
const T_INVERSE_MIN_P = 1e-100;
const INVERSE_KINDS = new Set(['cdfInv', 'sfInv', 'centralInv', 'twoTailInv']);

for (const c of loadFixtures().cases as FixtureCase[]) {
  if (!SUPPORTED_DF(c.df)) continue;
  if (c.dist === 't' && INVERSE_KINDS.has(c.kind) && c.arg < T_INVERSE_MIN_P) continue;
  const key = `${c.dist}.${c.kind}${c.df !== undefined ? ` df=${c.df}` : ''}`;
  let r = rows.get(key);
  if (!r) {
    r = { key, worstRel: 0, worstAbs: 0, at: '', n: 0, bad: [], floored: 0 };
    rows.set(key, r);
  }
  r.n += 1;
  const got = evaluate(c);

  if (c.overflow) {
    if (Number.isFinite(got)) r.bad.push(`${caseLabel(c)} overflow-ref but got ${got}`);
    continue;
  }
  if (c.underflow) {
    if (got !== 0) r.bad.push(`${caseLabel(c)} underflow-ref but got ${got}`);
    continue;
  }
  const exp = c.expected as number;
  if (!Number.isFinite(got)) { r.bad.push(`${caseLabel(c)} got=${got} exp=${exp}`); continue; }
  if (got === 0 && exp !== 0 && Math.abs(exp) < UNDERFLOW_LIMIT) {
    r.floored += 1; // reported as "< 1e-308" rather than as a number
    continue;
  }
  const abs = Math.abs(got - exp);
  const rel = exp === 0 ? abs : abs / Math.abs(exp);
  if (rel > r.worstRel) { r.worstRel = rel; r.at = `arg=${c.arg}`; }
  if (abs > r.worstAbs) r.worstAbs = abs;
}

for (const r of [...rows.values()].sort((a, b) => b.worstRel - a.worstRel)) {
  const kind = r.key.split('.')[1].split(' ')[0];
  const tag = PROBABILITY_KINDS.has(kind) ? 'P' : 'Q';
  console.log(
    `${tag} ${r.key.padEnd(26)} n=${String(r.n).padStart(3)} ` +
    `relmax=${r.worstRel.toExponential(2)} absmax=${r.worstAbs.toExponential(2)} ${r.at}` +
    (r.floored ? `  floored=${r.floored}` : '') +
    (r.bad.length ? `  BAD(${r.bad.length}): ${r.bad.slice(0, 2).join('; ')}` : ''),
  );
}
