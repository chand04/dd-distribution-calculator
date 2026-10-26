<!--
Source conversation: https://chatgpt.com/g/g-p-6a30dd03c82081919ef95ca0732f126a-d-d-teaching/c/6adef602-0edc-83e8-b0d9-95e48f0be1a1
Created: 2026-10-26
Last updated: 2026-10-26
-->

# Honorlock acceptance checklist

For the instructor or GSI. This is a human test and nothing in the repository
can stand in for it: passing local and deployed checks says only that the page
itself works, not that Honorlock will let a student reach it.

Nothing here changes bCourses or Honorlock settings on your behalf.

**Calculator URL:** _fill in the production URL once the Vercel project is
connected; see Deployment in README.md._

## Before the practice attempt

1. In the bCourses quiz's Honorlock settings, add the calculator URL under
   **Allowed Site URLs**.
2. Link the same URL in the instructions of a **practice assessment**, so
   students meet it before the graded exam.
3. Confirm the practice assessment has the same restrictions you intend to use
   on the exam itself.

## The practice attempt

4. Launch an **actual Honorlock practice attempt as a student**. Instructor
   Preview does not run the proctoring extension and is not evidence.
5. Open the calculator from the quiz and work through it:
   - both modes: a probability from a value, and a value from a probability;
   - all four regions: left tail, right tail, central area, two tails;
   - both distributions, entering degrees of freedom for *t*.
6. Return to the quiz and confirm the answers already typed are still there and
   the attempt has not been flagged or ended.
7. Confirm the page renders completely: the styling loads, the controls appear,
   and a calculation returns a number. A blank or unstyled page means an asset
   was blocked.
8. Confirm no other domain is needed. The page makes no third-party requests,
   so allowing anything beyond the calculator URL should not be necessary; if
   something is being blocked, note exactly what.

## Access

9. Operate the whole page by keyboard alone inside the Honorlock session: tab
   to each control, arrow keys within each group of options, Enter to
   calculate.
10. Turn on VoiceOver and confirm the result is announced once and
    understandably when Calculate is used, inside that same session.

## Isolation

11. Try a few unrelated sites during the attempt and confirm they are still
    blocked.
12. Check how Honorlock matched the URL: try the site's root and a made-up
    path under the same domain. Do not assume an entry isolates one exact page
    — find out whether the whole domain became reachable, and decide whether
    that is acceptable.

## Freeze

13. Once the practice attempt passes, freeze the release. Do not deploy changes
    during the exam window.
14. Record which of the three kinds of evidence you have: local numerical and
    browser checks (in the repository), checks on the deployed page, and this
    actual Honorlock test.
