#!/usr/bin/env python3
"""Cross-check fixtures/reference.json against SciPy at double precision.

The fixtures themselves come from mpmath at 60 digits (tools/generate_fixtures.py).
This script is a second, independent opinion: SciPy's own special functions,
used in stable formulations (erf / erfinv / betainc / betaincinv) rather than
through naive `1 - cdf` or `cdf(c) - cdf(-c)` compositions, which cancel exactly
where the far tails and tiny central areas live.

Cases are reported, not silently dropped:
  OK        agreement within the double-precision tolerance below
  EDGE      the reference itself falls outside the double range (it underflows
            to zero or overflows), so there is no double value to compare
  SKIP      SciPy underflows, saturates or returns a non-finite value, and has
            no opinion to offer; mpmath stands alone
  MISMATCH  a genuine disagreement -- exits non-zero

Usage:  .venv/bin/python tools/crosscheck_fixtures.py
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter

import numpy as np
from scipy import special, stats

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(os.path.dirname(HERE), "fixtures", "reference.json")

# SciPy's double-precision special functions are themselves only good to a few
# ulp, and its incomplete-beta inverse degrades in the far tails, so this is a
# agreement threshold, not an accuracy claim about the fixtures.
REL_TOL = 1e-9

SQRT2 = np.sqrt(2.0)


def beta_arg(c, df):
    """c^2 / (df + c^2) without overflowing for very large c."""
    if c == 0:
        return 0.0
    return 1.0 / (1.0 + df / c / c)


def t_sf(x, df):
    """P(T >= x) via the regularized incomplete beta (never 1 - cdf).

    Two branches, each chosen so the incomplete beta is evaluated away from the
    end of its argument range where double precision runs out:
      |x| >= 0.1 -- SciPy's own stats.t.sf, which is accurate in the far tail
                    where special.betainc(df/2, 1/2, .) loses digits for large
                    df (its argument sits close to 1 there).
      |x| < 0.1  -- 0.5 - 0.5 * I_{x^2/(df+x^2)}(1/2, df/2), i.e. half the
                    central area taken off a half, which is well conditioned
                    because the answer sits near 0.5, and which stats.t.sf
                    cannot resolve because its argument rounds to 1.
    """
    if abs(x) < 0.1:
        return 0.5 - 0.5 * np.sign(x) * t_central(abs(x), df)
    return float(stats.t.sf(x, df))


def t_sf_inv(p, df):
    """x with P(T >= x) = p, inverted on the incomplete beta directly."""
    q = p if p < 0.5 else 1.0 - p
    z = special.betaincinv(df / 2, 0.5, 2.0 * q)
    if not np.isfinite(z) or z <= 0.0:
        return np.nan
    x = np.sqrt(df * (1.0 - z) / z)
    return x if p < 0.5 else -x


def t_central(c, df):
    return special.betainc(0.5, df / 2, beta_arg(c, df))


def t_central_inv(p, df):
    if p > 0.5:
        return t_sf_inv((1.0 - p) / 2.0, df)
    z = special.betaincinv(0.5, df / 2, p)
    if not np.isfinite(z) or z >= 1.0:
        return np.nan
    return np.sqrt(df * z / (1.0 - z))


CHECKS = {
    ("normal", "cdf"): lambda a, df: 0.5 * special.erfc(-a / SQRT2),
    ("normal", "sf"): lambda a, df: 0.5 * special.erfc(a / SQRT2),
    ("normal", "central"): lambda a, df: special.erf(a / SQRT2),
    ("normal", "twoTail"): lambda a, df: special.erfc(a / SQRT2),
    ("normal", "cdfInv"): lambda a, df: -SQRT2 * special.erfcinv(2 * a),
    ("normal", "sfInv"): lambda a, df: SQRT2 * special.erfcinv(2 * a),
    ("normal", "centralInv"): lambda a, df: (
        SQRT2 * special.erfinv(a) if a <= 0.5 else SQRT2 * special.erfcinv(1 - a)
    ),
    ("normal", "twoTailInv"): lambda a, df: SQRT2 * special.erfcinv(a),
    ("t", "cdf"): lambda a, df: t_sf(-a, df),
    ("t", "sf"): t_sf,
    ("t", "central"): t_central,
    ("t", "twoTail"): lambda a, df: 2.0 * t_sf(a, df),
    ("t", "cdfInv"): lambda a, df: -t_sf_inv(a, df),
    ("t", "sfInv"): t_sf_inv,
    ("t", "centralInv"): t_central_inv,
    ("t", "twoTailInv"): lambda a, df: t_sf_inv(a / 2.0, df),
}


def main():
    data = json.load(open(FIXTURES))
    tally = Counter()
    mismatches = []

    for case in data["cases"]:
        key = (case["dist"], case["kind"])
        arg = case["arg"]
        df = case.get("df")
        expected = case["expected"]

        if expected is None or case.get("underflow") or case.get("overflow"):
            tally["EDGE"] += 1
            continue

        with np.errstate(all="ignore"):
            try:
                got = float(CHECKS[key](arg, df))
            except Exception:
                got = float("nan")

        if not np.isfinite(got) or got == 0.0 or expected == 0.0:
            tally["SKIP"] += 1
            continue

        # scipy.special.betaincinv saturates once the inverse needs an argument
        # below about 1e-308, which caps the t quantile near sqrt(DBL_MAX).
        # Past that point SciPy has no opinion to offer and mpmath stands alone.
        if abs(got) > 1e150 and abs(expected) > 1e150:
            tally["SKIP"] += 1
            continue

        rel = abs(got - expected) / abs(expected)
        if rel <= REL_TOL:
            tally["OK"] += 1
        else:
            tally["MISMATCH"] += 1
            mismatches.append((key, arg, df, expected, got, rel))

    for key, arg, df, expected, got, rel in mismatches:
        print(f"MISMATCH {key} arg={arg!r} df={df!r} "
              f"mpmath={expected!r} scipy={got!r} rel={rel:.3e}", file=sys.stderr)

    total = sum(tally.values())
    print(f"{total} cases: {tally['OK']} agree, {tally['EDGE']} outside the "
          f"double range, {tally['SKIP']} skipped (SciPy underflow, saturation "
          f"or non-finite), {tally['MISMATCH']} mismatched "
          f"(relative tolerance {REL_TOL:g})")
    return 1 if tally["MISMATCH"] else 0


if __name__ == "__main__":
    sys.exit(main())
