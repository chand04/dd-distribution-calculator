#!/usr/bin/env python3
"""Generate independent reference fixtures for the Distribution Calculator.

Reference values come from mpmath at 60 decimal digits -- an arbitrary-precision
implementation that shares no code with the JavaScript (@stdlib) library used in
production. tools/crosscheck_fixtures.py then validates the written file against
SciPy at double precision.

Usage (from the repository root):

    python3 -m venv .venv && .venv/bin/pip install scipy mpmath
    .venv/bin/python tools/generate_fixtures.py
    .venv/bin/python tools/crosscheck_fixtures.py

Writes fixtures/reference.json. Production never needs Python.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import mpmath as mp

mp.mp.dps = 60

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "fixtures", "reference.json")

HALF = mp.mpf(1) / 2


# --------------------------------------------------------------------------
# Standard normal, in mpmath
# --------------------------------------------------------------------------
def n_cdf(x):
    return mp.erfc(-mp.mpf(x) / mp.sqrt(2)) / 2


def n_sf(x):
    return mp.erfc(mp.mpf(x) / mp.sqrt(2)) / 2


def n_central(c):
    return mp.erf(mp.mpf(c) / mp.sqrt(2))


def n_two_tail(c):
    return mp.erfc(mp.mpf(c) / mp.sqrt(2))


# 120 halvings take any of the brackets used below (widest: 640 decades in
# log10 space) far past double precision; the values are unchanged from a
# 300-iteration run.
def _bisect(f, target, lo, hi, iters=120):
    """Bisection on a monotone f, to well past double precision."""
    lo, hi = mp.mpf(lo), mp.mpf(hi)
    increasing = f(hi) > f(lo)
    for _ in range(iters):
        mid = (lo + hi) / 2
        if mid == lo or mid == hi:
            break
        if (f(mid) < target) == increasing:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def n_sf_inv(p):
    """x with P(Z >= x) = p, solved on erfc so that tiny p keeps full precision."""
    p = mp.mpf(p)
    if p == HALF:
        return mp.mpf(0)
    return _bisect(n_sf, p, mp.mpf(-60), mp.mpf(60))


def n_cdf_inv(p):
    return -n_sf_inv(p)


def n_central_inv(p):
    p = mp.mpf(p)
    if p > HALF:
        return n_sf_inv((1 - p) / 2)
    return mp.sqrt(2) * mp.erfinv(p)


def n_two_tail_inv(p):
    return n_sf_inv(mp.mpf(p) / 2)


# --------------------------------------------------------------------------
# Student's t, in mpmath, via the regularized incomplete beta
# --------------------------------------------------------------------------
def _ibeta(a, b, x):
    """Regularized incomplete beta I_x(a, b).

    Integrated directly rather than through mpmath's hyp2f1 route, which fails
    to converge for the extremely small arguments the far tails require. The
    substitution t = x * s**(1/a) removes the t**(a-1) endpoint singularity:

        int_0^x t^(a-1)(1-t)^(b-1) dt = (x^a/a) int_0^1 (1 - x s^(1/a))^(b-1) ds
    """
    a, b, x = mp.mpf(a), mp.mpf(b), mp.mpf(x)
    if x <= 0:
        return mp.mpf(0)
    if x >= 1:
        return mp.mpf(1)
    if x > a / (a + b):
        return 1 - _ibeta(b, a, 1 - x)
    inv_a = 1 / a
    integral = mp.quad(lambda s: (1 - x * s ** inv_a) ** (b - 1), [0, 1])
    return (x ** a / a) * integral / mp.beta(a, b)


def t_sf(x, df):
    """P(T >= x)."""
    x = mp.mpf(x)
    v = mp.mpf(df)
    if x == 0:
        return HALF
    z = v / (v + x * x)
    tail = _ibeta(v / 2, HALF, z) / 2
    return tail if x > 0 else 1 - tail


def t_cdf(x, df):
    """P(T <= x), taken from the survival function at -x by symmetry.

    Not 1 - t_sf(x, df): for x well below zero the tail is smaller than the
    working precision, and the subtraction would return a flat zero.
    """
    return t_sf(-x, df)


def t_central(c, df):
    """P(-c <= T <= c) as an incomplete beta in its own right -- no 1 - 2*tail."""
    c = mp.mpf(c)
    v = mp.mpf(df)
    if c == 0:
        return mp.mpf(0)
    z = (c * c) / (v + c * c)
    return _ibeta(HALF, v / 2, z)


def t_two_tail(c, df):
    return 2 * t_sf(c, df)


def t_sf_inv(p, df):
    """x with P(T >= x) = p. Bisected in log10(x) so far tails stay reachable."""
    p = mp.mpf(p)
    if p == HALF:
        return mp.mpf(0)
    q = p if p < HALF else 1 - p
    u = _bisect(lambda uu: -t_sf(mp.mpf(10) ** uu, df), -q, mp.mpf(-320), mp.mpf(320))
    x = mp.mpf(10) ** u
    return x if p < HALF else -x


def t_cdf_inv(p, df):
    return -t_sf_inv(p, df)


def t_central_inv(p, df):
    p = mp.mpf(p)
    if p > HALF:
        return t_sf_inv((1 - p) / 2, df)
    u = _bisect(lambda uu: t_central(mp.mpf(10) ** uu, df), p, mp.mpf(-320), mp.mpf(320))
    return mp.mpf(10) ** u


def t_two_tail_inv(p, df):
    return t_sf_inv(mp.mpf(p) / 2, df)



# --------------------------------------------------------------------------
# Case table
# --------------------------------------------------------------------------
MP = {
    ("normal", "cdf"): lambda a, df: n_cdf(a),
    ("normal", "sf"): lambda a, df: n_sf(a),
    ("normal", "central"): lambda a, df: n_central(a),
    ("normal", "twoTail"): lambda a, df: n_two_tail(a),
    ("normal", "cdfInv"): lambda a, df: n_cdf_inv(a),
    ("normal", "sfInv"): lambda a, df: n_sf_inv(a),
    ("normal", "centralInv"): lambda a, df: n_central_inv(a),
    ("normal", "twoTailInv"): lambda a, df: n_two_tail_inv(a),
    ("t", "cdf"): t_cdf,
    ("t", "sf"): t_sf,
    ("t", "central"): t_central,
    ("t", "twoTail"): t_two_tail,
    ("t", "cdfInv"): t_cdf_inv,
    ("t", "sfInv"): t_sf_inv,
    ("t", "centralInv"): t_central_inv,
    ("t", "twoTailInv"): t_two_tail_inv,
}

X_VALUES = [0.0, 1.0, -1.0, 1.96, -1.96, 0.5, -0.5, 2.5, -2.5, 3.0, -3.0,
            1e-8, -1e-8, 1e-4, 6.0, -6.0, 8.0, -8.0, 10.0, -10.0, 20.0, -20.0,
            # Past these the normal tail underflows to zero in a double; the
            # fixtures record that it is an underflow, not an exact zero.
            38.0, -38.0, 40.0, -40.0, 45.0, -45.0]
C_VALUES = [0.0, 1e-10, 1e-6, 0.001, 0.5, 1.0, 1.644853626951472, 1.96,
            2.5, 3.0, 5.0, 8.0, 10.0, 20.0, 40.0, 45.0]
P_TAIL = [0.5, 0.975, 0.95, 0.9, 0.75, 0.25, 0.05, 0.025, 0.01, 0.005, 0.001,
          1e-6, 1e-9, 1e-12, 1e-24, 1e-50, 1e-100, 1e-300]
P_CENTRAL = [1e-12, 1e-6, 0.001, 0.5, 0.8, 0.9, 0.95, 0.99, 0.999,
             0.9999999999]
P_TWOTAIL = [0.5, 0.1, 0.05, 0.02, 0.01, 0.001, 1e-6, 1e-12, 1e-24, 1e-100]
DFS = [1.0, 2.0, 3.0, 5.0, 7.5, 10.0, 30.0, 0.5, 100.0, 1000.0, 100000.0]


def to_float(v):
    """Round an mpmath value to double, or None when it leaves double range."""
    try:
        f = float(v)
    except (OverflowError, ValueError):
        return None
    return None if not (f == f and abs(f) != float("inf")) else f


def build():
    cases = []

    def add(dist, kind, arg, df=None):
        ref = MP[(dist, kind)](arg, df)
        val = to_float(ref)
        case = {"dist": dist, "kind": kind, "arg": arg, "expected": val}
        if df is not None:
            case["df"] = df
        # Record whether a 0 or a null is mathematically exact or merely the
        # edge of double precision, so the JavaScript tests can tell a correct
        # "too small / too large to represent" from a wrong answer.
        if val is None:
            # Beyond the range of a double. The bracket used to find it is
            # itself bounded, so no magnitude is recorded -- only the fact and
            # the sign, which is all the tests need.
            case["overflow"] = True
            case["sign"] = 1 if ref > 0 else -1
        elif val == 0.0 and ref != 0:
            case["underflow"] = True
            case["log10"] = float(mp.log10(ref))
        cases.append(case)

    for x in X_VALUES:
        add("normal", "cdf", x)
        add("normal", "sf", x)
    for c in C_VALUES:
        add("normal", "central", c)
        add("normal", "twoTail", c)
    for p in P_TAIL:
        add("normal", "cdfInv", p)
        add("normal", "sfInv", p)
    for p in P_CENTRAL:
        add("normal", "centralInv", p)
    for p in P_TWOTAIL:
        add("normal", "twoTailInv", p)

    for df in DFS:
        for x in X_VALUES:
            add("t", "cdf", x, df)
            add("t", "sf", x, df)
        for c in C_VALUES:
            add("t", "central", c, df)
            add("t", "twoTail", c, df)
        for p in P_TAIL:
            add("t", "cdfInv", p, df)
            add("t", "sfInv", p, df)
        for p in P_CENTRAL:
            add("t", "centralInv", p, df)
        for p in P_TWOTAIL:
            add("t", "twoTailInv", p, df)

    return cases


def main():
    cases = build()
    payload = {
        "_comment": ("Reference values from mpmath at 60 decimal digits; "
                     "cross-checked against SciPy by tools/crosscheck_fixtures.py. "
                     "Regenerate with tools/generate_fixtures.py."),
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "mpmath": mp.__version__,
        "digits": mp.mp.dps,
        "cases": cases,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(payload, fh, indent=1)
        fh.write("\n")

    print(f"wrote {len(cases)} cases to {OUT}")


if __name__ == "__main__":
    main()
