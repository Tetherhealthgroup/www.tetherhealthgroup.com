# Verification and Evidence

Do not report success without evidence. Confidence is not evidence.

## Evidence classification

Every important statement is one of these, and is labelled when it matters:

| Class | Meaning |
|---|---|
| **Verified** | Evidence exists — a command was run, output was read |
| **Observed** | Directly visible in the code or repository |
| **Inferred** | A reasonable conclusion, not verified |
| **Assumed** | Information is missing and a value was chosen |
| **Unknown** | Cannot be determined from available information |

Never present Inferred, Assumed, or Unknown as fact.

## Claims in prose

The checklist below governs task reports. These govern every sentence, in
reports and conversation alike.

**Evidence travels with the claim.** State what supports it in the same
breath: the command run and the part of its output that matters, a
`path/file.ts:42` actually read, or a document actually fetched and quoted.

**Never fabricate a specific.** Flags, function names, config keys, paths,
version numbers, counts, and timings are either looked up or named as
unchecked. A plausible invented specific is the most damaging output
available — it is acted on immediately and it looks right. Counts are counted.

**Say who established it.** "I ran it" · "it is in the code at X" · "a
subagent reported it" · "I expect". A subagent's finding is a claim until it
is checked; repetition does not promote it to fact.

**Do not answer from memory where a check is cheap.** File contents, installed
versions, config keys, and API surfaces change. Check, then answer.

**Uncertainty goes in the sentence, not the footnote.** A confident paragraph
with a closing caveat reads as confidence.

**Absence is a result.** A thing not checked is said to be unchecked. Silence
about a step reads as a claim that it was done.

**Disagreement does not move the truth.** If a claim is challenged, re-check
it and report what the evidence shows. Do not concede to pressure and do not
defend out of ownership. Agreement is not evidence.

## Verification checklist

Each item gets exactly one result: **PASS** / **FAIL** / **NOT RUN** / **UNKNOWN**.
Every row appears in the report every time. A row that does not apply is
**NOT RUN with the reason**, never deleted from the table.

### Build gate

| # | Check | Applies when |
|---|---|---|
| 1 | Build | Always |
| 2 | Type check | The language has one |
| 3 | Lint | The project has one configured |

### Test matrix

Categories, owners, and triggers are defined in `TESTING.md`. This table is
the report format, not a second definition of them.

| # | Check | Applies when |
|---|---|---|
| 4 | Unit tests | Always |
| 5 | Integration tests | The change crosses a boundary |
| 6 | Functional tests | The change adds or alters a feature |
| 7 | End-to-end tests | An E2E harness exists, or the change spans components |
| 8 | Acceptance tests | Always — one per acceptance criterion |
| 9 | Security testing | Per SECURITY.md triggers |
| 10 | Performance testing | The change touches a hot path, or a budget is declared |
| 11 | Smoke tests | Always, once the project is runnable |
| 12 | Regression tests | Always — the suite is re-run; a fixed defect adds a case |
| 13 | UI / UX verification | The change touches UI |

### Review

| # | Check | Applies when |
|---|---|---|
| 14 | Documentation review | Public behavior changed |

## Rules

- **NOT RUN is an honest answer. A fabricated PASS is not.** If a step was not
  performed, report NOT RUN and say why.
- **Every row is reported every time.** Dropping a row from the table reads as
  coverage that does not exist. A category with no runner configured is NOT
  RUN with that as the reason.
- **A UI row cannot pass on inspection of the code.** Render it, look at the
  result, and check it against the requirement.
- Report failures with the **actual output**, not a summary of it.
- A check that cannot fail proves nothing. Confirm a test fails before the fix
  and passes after.
- Re-run the whole checklist after a fix, not only the item that failed.
- Do not weaken a check to make it pass. If the check is right and the code is
  wrong, that is a defect.
- Verification is not self-certification: the implementing role's PASS is a
  claim; the Reviewer's PASS is the verdict.

## Definition of Done

A task is complete only when:

- Requirements satisfied
- Implementation finished — no placeholders, stubs, or TODOs
- Code reviewed by someone other than the author
- Every test-matrix row reported, with no row FAIL and no applicable row
  silently absent
- Documentation updated
- No unresolved blockers

If any requirement is unmet, report the task as **incomplete**. Partial
completion is reported as partial, with the specific gap named.
