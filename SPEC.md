<!--
Source conversation: https://chatgpt.com/g/g-p-6a30dd03c82081919ef95ca0732f126a-d-d-teaching/c/6adef602-0edc-83e8-b0d9-95e48f0be1a1
Created: 2026-10-26
Last updated: 2026-10-26
-->

# CLAUDE CODE TASK: DATA & DECISIONS DISTRIBUTION CALCULATOR

Work locally in VS Code in the existing dd-distribution-calculator GitHub repository. Build the application, verify it, and prepare it for deployment. Do not create another repository. Treat this file as the implementation specification.

## 1. START AND SCOPE

Inspect the checkout, git status, remote, and project instructions. Preserve existing work. If the checkout is missing, locate the authenticated user's matching GitHub repository and clone it; resolve ambiguity rather than guessing the owner. Make routine implementation decisions yourself and continue through testing.

Purpose: replace distribution-table lookups during Data & Decisions coursework and Honorlock exams. Students select the distribution and probability region; the tool supplies numerical answers. It must not choose tests, construct confidence intervals, interpret significance, or give statistical advice.

Use the lightest suitable static implementation. Prefer TypeScript and a small build tool such as Vite, unless the repository already establishes another stack. A framework is optional. Avoid a backend, database, and unnecessary UI dependencies.

## 2. EXACT CALCULATIONS

Distributions:
- Standard normal, Z ~ N(0,1).
- Student's t, T with user-entered finite positive degrees of freedom, including fractional values.

Do not add arbitrary normal means or standard deviations in this version.

Mode A: probability from a value.
- Left tail: P(X <= x), signed finite x.
- Right tail: P(X >= x), signed finite x.
- Central area: P(-c <= X <= c), finite c >= 0.
- Two tails: P(X <= -c or X >= c), finite c >= 0.

Mode B: value from a probability, with 0 < p < 1.
- Left tail: find signed x such that P(X <= x) = p.
- Right tail: find signed x such that P(X >= x) = p.
- Central area: find c >= 0 such that P(-c <= X <= c) = p.
- Two tails: find c >= 0 such that P(X <= -c or X >= c) = p.

Symmetric intervals always have equal tails. For two-tail inverse input, p means the TOTAL across both tails. Label this explicitly. Display Z or T, rather than generic X, in results. Include degrees of freedom in t results.

Defaults: standard normal; probability from a value; left tail; x = 1.96. Defaults must be visible. Do not automatically display an answer until Calculate is selected. Reset restores those defaults and clears the result.

## 3. USER INTERFACE

One compact responsive page titled Distribution Calculator, with modest Data & Decisions branding, distribution, mode and region selectors, relevant inputs, Calculate and Reset buttons, and one result panel. Hide the degrees-of-freedom input for normal calculations.

Use readable navy-and-gold styling, generous spacing, system fonts, and strong contrast. Reuse approved logo assets only if readily available in the project or explicitly supplied. Otherwise use text branding; do not invent a logo or delay implementation to find artwork.

Show the actual probability statement with the result. For example:
P(Z <= 1.96) = 0.975002
For inverse symmetric calculations, show the cutoff magnitude and both interval endpoints. Avoid unexplained q, alpha, beta, CDF, or inverse-CDF labels in the main controls.

Use up to six significant digits for displayed answers, with scientific notation for small nonzero values. Retain full internal precision. Near-one probabilities must not misleadingly display as exactly 1: use sufficient digits or a complementary expression such as 1 - 7.62e-24. Label outputs as approximate and state the display convention in one short note. Do not promise exact probabilities.

Whenever an input or selection changes, clear the previous result. Pressing Enter in an input should calculate. Reject empty, malformed, nonfinite and out-of-range inputs, including negative symmetric cutoffs and nonpositive degrees of freedom. Do not use parseFloat in a way that accepts trailing garbage. Accept valid scientific notation.

No graphs, ads, login, AI, saved history, analytics, social links, external navigation, general expression evaluator, or unrelated calculators. Do not persist student input.

## 4. NUMERICAL IMPLEMENTATION

Choose an appropriately licensed numerical dependency after checking its current documentation, maintenance, accuracy and supported functions. Bundle it locally, pin versions, and commit the lockfile. Do not fetch numerical functions at runtime or use external CDNs.

Use stable CDF, survival-function, quantile, and inverse-survival calculations or equivalent stable formulations. In particular:
- Avoid upper-tail cancellation from 1 - CDF(x) for large positive x.
- Avoid rounding 1 - p to 1 before inverse-tail evaluation for tiny p.
- Exploit distribution symmetry where appropriate.
- Do not subtract two values close to 1 to compute a tiny central area.
- Distinguish representational underflow or overflow from a mathematically exact 0 or 1.

Do not write new special-function approximations casually. If the library cannot reliably support some finite inputs, establish tested limits and show a clear out-of-range message. Do not show NaN, Infinity, a misleading zero, or an unverified value as a successful answer. Document the supported range, without presenting implementation detail in the ordinary student workflow.

## 5. ACCESSIBILITY

Use semantic HTML, explicit labels, fieldsets/legends where useful, visible keyboard focus, accessible validation, and a polite result announcement. All controls must work by keyboard. Switching modes must not unexpectedly steal focus.

Provide understandable spoken probability statements without reading visible notation and its expanded equivalent twice. Prefer ordinary accessible text; do not rely on aria-label on arbitrary text containers without checking support. Keep focus outlines aligned with visible controls.

Check narrow screens, 200% zoom, contrast, keyboard operation, and accessibility with an automated checker. Separately identify manual screen-reader checks. Do not describe automated accessibility results as proof of VoiceOver compatibility.

## 6. REQUIRED VERIFICATION

Generate independent reference fixtures with SciPy or another reputable implementation that does not reuse the chosen JavaScript numerical library. Commit fixtures and their reproducible generator; production must not need Python.

Test all distributions, regions and directions, including:
- Normal: zero, positive/negative values, and 1.96.
- Normal inverse: p = 0.975 for left tail; p = 0.05 for total two tails; p = 0.95 for central area.
- t: df = 1, 2, 10, a fractional value such as 7.5, and a large value such as 100000.
- t df = 10, two-tail p = 0.05 gives cutoff about 2.228138852.
- Tiny normal tails at z = 8, 10 and 20; inverse-tail probabilities including 1e-12 and 1e-24 where supported.
- Probabilities near both endpoints and small positive central areas.
- Symmetry, monotonicity, and round trips where meaningful.
- All invalid-input cases, reset, mode changes, and clearing stale answers.

Set and document accuracy tolerances appropriate for the supported range. Suggested targets for ordinary cases: probability absolute error <= 1e-12 and quantile error <= 1e-8 * max(1, abs(reference)). For tiny nonzero tails, use relative error instead of an absolute tolerance that would allow zero to pass. Justify any relaxed tolerances and verify displayed digits.

Run real browser tests of the controls and results, not just numerical functions. Verify that the production build loads without missing assets, makes no third-party requests, and calculates after the page has loaded with the network disconnected. Do not add a service worker solely for offline use.

## 7. REPO DOCUMENTATION AND HANDOFF

Keep this specification as SPEC.txt initially. Before creating ANY Markdown file, ask the user for this ChatGPT conversation's URL if it has not been supplied. Continue coding while waiting and use .txt documentation temporarily.

Every Markdown file you create must start with a hidden HTML comment containing the actual source conversation URL, creation date and last-updated date. Use YYYY-MM-DD dates in America/Los_Angeles time, preserve creation dates when revising, and never invent a URL. After receiving it, save the specification as SPEC.md and create concise README.md documentation. Put only short enduring project conventions in CLAUDE.md if one is useful; it needs the same metadata.

Document development/build/test commands, tail conventions, supported numerical range, dependency licensing, independent validation, accessibility checks, and deployment. Keep long development explanations out of the student interface.

## 8. GIT AND DEPLOYMENT

Prepare a static production build. Reuse existing deployment configuration. Vercel is the intended default if no hosting configuration exists. Avoid a backend and avoid adding hosting analytics.

After checks pass, review the diff, commit relevant files, and push to the existing repository using normal git operations. Do not force-push or overwrite unrelated work. Respect branch rules. If credentials or permissions block a step, complete everything else and report the exact remaining action.

If an existing connected deployment is available, deploy using its established workflow. If no project is connected, prepare Vercel-compatible output and provide the exact connection settings; do not invent a deployment URL or claim publication. Prefer a stable public production URL requiring no student login, rather than an expiring or protected preview.

## 9. HONORLOCK ACCEPTANCE: A SEPARATE HUMAN TEST

Do not change bCourses or Honorlock. Supply the final calculator URL and a short checklist for the instructor/GSI to:
- Add the intended calculator URL under Allowed Site URLs and link it in practice-assessment instructions.
- Launch an ACTUAL Honorlock practice attempt with intended exam restrictions; instructor Preview is insufficient evidence.
- Test both modes, every region and both distributions; return to the quiz and confirm answers remain intact.
- Confirm all assets load and no unapproved domains are needed.
- Test keyboard and VoiceOver access in that setup.
- Verify unrelated sites remain blocked and inspect how Honorlock matches URL paths/domains, rather than assuming exact-page isolation.

Freeze a tested release before the exam and avoid deploying changes during the exam window. Distinguish local numerical/browser checks, deployed-page checks, and actual Honorlock testing in the final report.

## DELIVERY

Complete the implementation and checks, rather than stopping at a plan. Report the commit, deployment status/URL, tests and accessibility checks actually run, material limitations, and any remaining account connection or human testing. Keep the report concise.
