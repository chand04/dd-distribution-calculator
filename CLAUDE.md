<!--
Source conversation: https://chatgpt.com/g/g-p-6a30dd03c82081919ef95ca0732f126a-d-d-teaching/c/6adef602-0edc-83e8-b0d9-95e48f0be1a1
Created: 2026-10-26
Last updated: 2026-10-26
-->

# Project conventions

SPEC.md is the authoritative specification. Read it before changing behaviour.

- **Scope.** The calculator returns numbers only. It must never choose a test,
  build a confidence interval, interpret significance, or give statistical
  advice. No graphs, login, analytics, external links, saved history, or a
  general expression evaluator.
- **No runtime network.** Everything is bundled. Nothing may be fetched at
  runtime and no CDN may be referenced; the page has to calculate with the
  network disconnected.
- **Stable formulations only.** Never compute an upper tail as `1 - cdf(x)`,
  never round `1 - p` to 1 before an inverse, and never get a small central
  area by subtracting two numbers close to 1. Use the library's special
  functions; do not hand-roll new approximations.
- **Underflow is not zero.** A positive probability too small to represent is
  reported as a bound, and a probability just under 1 as `1 - <small>`.
- **Out of range beats a wrong answer.** If a value cannot be computed to the
  verified accuracy, show the out-of-range message. NaN, Infinity and
  unverified numbers must never reach the student.
- **Fixtures are independent.** `fixtures/reference.json` comes from mpmath at
  60 digits, never from the JavaScript library under test. Regenerate it with
  `tools/generate_fixtures.py` and re-check it with
  `tools/crosscheck_fixtures.py`. Production never needs Python.
- **Markdown metadata.** Every Markdown file starts with the hidden comment
  above: source conversation URL, creation date, last-updated date, as
  `YYYY-MM-DD` in America/Los_Angeles. Preserve the creation date when
  revising.
- **Before an exam.** Freeze a tested release and do not deploy during the exam
  window.
