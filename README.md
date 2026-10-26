<!--
Source conversation: https://chatgpt.com/g/g-p-6a30dd03c82081919ef95ca0732f126a-d-d-teaching/c/6adef602-0edc-83e8-b0d9-95e48f0be1a1
Created: 2026-10-26
Last updated: 2026-10-26
-->

# Distribution Calculator

A single static page that replaces the printed normal and *t* tables in Data &
Decisions coursework and Honorlock exams. A student picks the distribution and
the region; the page returns the number. It does not choose a test, build a
confidence interval, interpret significance, or give any statistical advice.

- Standard normal, *Z* ~ N(0, 1), and Student's *t* with user-entered degrees
  of freedom, including fractional values.
- **A probability, from a value:** left tail, right tail, the central area
  between −c and c, or the two tails outside them.
- **A value, from a probability:** the same four regions, inverted.
- No backend, no database, no network at runtime, no analytics, no stored
  input.

`SPEC.md` is the authoritative specification; `CLAUDE.md` holds the short
standing conventions.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install pinned dependencies (`package-lock.json` is committed). |
| `npm run dev` | Vite dev server. |
| `npm run build` | Type-check, then build the static site into `dist/`. |
| `npm run preview` | Serve the production build at <http://127.0.0.1:4173>. |
| `npm test` | Unit tests: 1859 of them, covering 1728 fixture comparisons plus symmetry, monotonicity, round-trip, formatting and validation tests. |
| `npm run test:browser` | Playwright tests of the real controls in Chromium and WebKit, against the production build. |
| `npm run test:a11y` | The automated accessibility subset only. |
| `npm run test:all` | Build, then both test suites. |

Regenerating the reference fixtures additionally needs Python; see below.

## Tail conventions

The region names on the page are the whole contract, so nothing is labelled
with a bare α, q, or "inverse CDF":

| Region | Probability from a value | Value from a probability |
| --- | --- | --- |
| Left tail | P(*X* ≤ *x*) | the *x* with P(*X* ≤ *x*) = *p* |
| Right tail | P(*X* ≥ *x*) | the *x* with P(*X* ≥ *x*) = *p* |
| Central area | P(−*c* ≤ *X* ≤ *c*) | the *c* ≥ 0 with that area = *p* |
| Two tails | P(*X* ≤ −*c* **or** *X* ≥ *c*) | the *c* ≥ 0 with that total = *p* |

A symmetric interval always has equal tails. **For the two-tail inverse, the
probability you enter is the total across both tails**, which the result
states in words, together with the probability in each tail.

Answers are shown to six significant digits, in scientific notation when very
small or very large, and are approximate. Full double precision is kept
internally. A probability too close to 1 to distinguish at six digits is
written as `1 - 7.61985e-24` rather than as `1`, and a positive probability
too small for the routines to return is written as `< 1e-308` rather than
as `0`.

## Supported numerical range

The calculator declines, with a message, rather than showing a number it
cannot stand behind.

| Input | Accepted | Note |
| --- | --- | --- |
| Value *x* | finite, \|*x*\| ≤ 10<sup>6</sup> | Beyond this every tail underflows anyway. |
| Cutoff *c* | finite, 0 ≤ *c* ≤ 10<sup>6</sup> | Negative cutoffs are rejected. |
| Probability *p* | 0 < *p* < 1 | Endpoints and anything outside are rejected. |
| Degrees of freedom | 1 ≤ df ≤ 100000, fractions allowed | Below df = 1 the library's *t* quantile overflows in the far tail instead of answering, so that band is not offered. |

Verified accuracy within that range, against 60-digit references:

- probabilities: absolute error ≤ 10<sup>−12</sup> for values at or above
  10<sup>−6</sup>; relative error ≤ 10<sup>−11</sup> below that, so a tiny tail
  cannot pass the tests by being rounded to zero;
- values on the axis: error ≤ 10<sup>−8</sup> × max(1, \|reference\|).

Observed worst cases are far inside those budgets: 7.0 × 10<sup>−14</sup>
relative on normal quantiles at *p* = 10<sup>−300</sup>, 6.2 × 10<sup>−14</sup>
on *t* tails at *x* = 40 with df = 1000, and 3.6 × 10<sup>−14</sup> on normal
tails at *z* = 20. Run `npx vite-node tools/report_accuracy.ts` to reprint the
measured table.

Two further limits are measured rather than assumed.

- **Tiny tails.** The normal routines stay nonzero down to the smallest double
  (4.9 × 10<sup>−324</sup>, at *z* ≈ 38.48), but the *t* routines stop at about
  2 × 10<sup>−310</sup> for large degrees of freedom. `< 1e-308` is therefore
  the bound the page reports, because it is the one true of every routine;
  `npm test` checks that no reference value a routine rounds to zero is larger
  than it.
- **Far inverse tails for *t*.** An inverse at a tail probability below about
  10<sup>−100</sup> can need a cutoff near 10<sup>299</sup>, which the library
  reports as infinite rather than returning. The page then says the probability
  is too extreme, rather than showing a number.

Inputs are parsed with a strict pattern, not `parseFloat`, so `1.96abc`,
`1,96`, `Infinity` and `NaN` are rejected while `1.5E+3` and `1e-24` are
accepted.

### How the hard cases are computed

Every routine is a stable formulation; `src/numerics.ts` carries the detail.
In short: upper tails come from the symmetric lower tail rather than from
`1 - cdf(x)`; normal inverses go through `erfcinv(2p)`, so `1 - p` never
appears; central areas are computed as quantities in their own right —
`erf(c/√2)` for the normal and the regularized incomplete beta
I<sub>c²/(df+c²)</sub>(1/2, df/2) for *t* — rather than by subtracting two
numbers close to 1; near the centre the *t* survival function is assembled from
half the central area, because the library's own cdf loses the small offset
from one half at df = 1; and *t* inverses are polished with a safeguarded
Newton step on the survival function.

## Dependencies and licensing

Numerics come from [stdlib](https://stdlib.io/) — 9 direct packages, 228 with
transitive dependencies, all pinned exactly, bundled into `dist/`, and never
fetched at runtime:

- `@stdlib/math-base-special-erf`, `-erfc`, `-erfinv`, `-erfcinv`,
  `-betainc`, `-betaincinv`
- `@stdlib/stats-base-dists-t-cdf`, `-t-pdf`, `-t-quantile`

216 of the 228 are Apache-2.0; the remaining 12 are Apache-2.0 AND BSL-1.0
(the Boost Software License, from Boost's incomplete-beta and error-function
routines). Both are permissive and impose no obligation beyond retaining their
notices, which the published bundle does. Build and test tooling — Vite,
TypeScript, Vitest, Playwright, axe-core — is MIT or Mozilla Public License 2.0
and ships nothing to the browser.

## Independent validation

`fixtures/reference.json` holds 1728 reference values produced by **mpmath at
60 decimal digits**, an arbitrary-precision implementation that shares no code
with the JavaScript library under test. The fixtures and their generator are
committed; production never needs Python.

```bash
python3 -m venv .venv && .venv/bin/pip install scipy mpmath
.venv/bin/python tools/generate_fixtures.py     # writes fixtures/reference.json (~45 min)
.venv/bin/python tools/crosscheck_fixtures.py   # second opinion, from SciPy
```

`tools/crosscheck_fixtures.py` re-derives every case from SciPy's own special
functions at double precision, in stable formulations, and reports agreement,
mismatches, and the cases where SciPy itself underflows or saturates and has no
opinion to offer. At the last run: 1669 agree to 10<sup>−9</sup> relative, 14
outside the double range, 45 skipped for that reason, 0 mismatches.

`npm test` then compares the production routines against the fixtures across
every distribution, region and direction, together with the specification's
named benchmarks (P(Z ≤ 1.96) = 0.975002; *t* with df = 10 and a total two-tail
probability of 0.05 giving 2.228138852), symmetry, monotonicity, round trips,
underflow, and all invalid-input cases.

## Accessibility

Automated, in `tests/browser/accessibility.spec.ts`: axe-core against
WCAG 2.1 A and AA on the initial page, with an answer displayed, with an error
displayed, and in the *t* layout; no horizontal scrolling at a 320 px viewport
or at the equivalent of 200% zoom; a single polite live region, so an answer is
announced once rather than as notation plus a hidden expansion of it; a label
for every control; and a visible focus ring. Keyboard operation — tab order,
arrow keys within each radio group, Enter to calculate — is exercised in
Chromium, and switching modes is tested not to move focus.

**These are automated checks, and they are not evidence of VoiceOver
compatibility.** The following still have to be done by a person, on the
deployed URL:

1. VoiceOver on macOS Safari and on iOS: read the whole page, move through
   every control, and confirm the answer is announced once, intelligibly, when
   Calculate is used.
2. Confirm the announcement of `≤`, `≥` and scientific notation is
   understandable as spoken, in each screen reader used.
3. Safari with Full Keyboard Access on: confirm every control is reachable
   (WebKit omits radios and buttons from the tab order by default, which is why
   the automated tab-order walk runs in Chromium).
4. Repeat 1–3 inside an actual Honorlock session, which is a different browsing
   context.

## Deployment

Static output, no backend, no hosting analytics. `vercel.json` sets the Vite
framework preset, `npm run build`, and `dist/` as the output directory.
Asset paths are relative, so the build also works from a subpath.

To connect the project on Vercel: import `chand04/dd-distribution-calculator`,
framework preset **Vite**, build command `npm run build`, output directory
`dist`, install command `npm install`, no environment variables, and deploy
`main` as production. Use the stable production URL for students, not a
preview URL — preview deployments can expire or sit behind Vercel
authentication.

Freeze a tested release before an exam and do not deploy during the exam
window. `HONORLOCK.md` has the acceptance checklist, which is a separate human
test.
