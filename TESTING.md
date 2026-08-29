# Testing Standard

Owned by the Testing role. Implementing roles write the tests that accompany
their change; Security, Performance, and Frontend own the three specialist
categories marked below.

Every change is assessed against **all ten categories**. A category that does
not apply is recorded **NOT RUN with the reason** — never omitted, never
rounded up to a pass. Silence about a category is a defect in the report.

---

## The test matrix

| # | Category | Proves | Owner | Required when |
|---|---|---|---|---|
| 1 | **Unit** | One unit behaves in isolation, including its failure paths | Testing | Always, for any new or changed behavior |
| 2 | **Integration** | Units work across a real boundary — DB, HTTP, filesystem, queue | Testing | The change crosses a boundary |
| 3 | **Functional** | A feature satisfies its specified behavior end of input to end of output, dependencies stubbed | Testing | The change adds or alters a user-visible feature |
| 4 | **End-to-end** | A full user path works against the assembled system | Testing | The project has an E2E harness, or the change spans components |
| 5 | **Acceptance** | Each acceptance criterion in `TASKS.md` is met, in the criterion's own terms | Testing | Always — the criteria are the contract |
| 6 | **Security** | Auth, authorization, input validation, secrets, and dependencies hold under abuse | Security | Per `SECURITY.md` triggers |
| 7 | **Performance** | No regression against a measured baseline | Performance | The change touches a hot path, or a budget is declared |
| 8 | **Smoke** | The build starts and its critical paths respond at all | Testing | Always, once the project is runnable |
| 9 | **Regression** | A previously fixed defect stays fixed | Testing | Any defect is fixed; the suite is re-run on every change |
| 10 | **UI / UX** | Rendered output matches the requirement; keyboard, contrast, and breakpoints hold | Frontend, verified by Reviewer | The change touches UI |

**Categories 1, 5, 8, and 9 have no escape hatch** on a change that ships
behavior. The others have stated triggers; when a trigger is absent, say which
trigger and why.

---

## Runner naming convention

The Stop-hook verification gate discovers categories by name. Use these names
and the gate runs the category automatically; use different ones and it
reports NOT RUN because it could not find a runner.

**Node** — `package.json` scripts:

```
test:unit  test:integration  test:functional  test:e2e  test:acceptance
test:security  test:performance  test:smoke  test:regression  test:ui
```

A plain `test` script is treated as the unit suite when `test:unit` is absent.

**Python** — pytest markers of the same names, registered in `pyproject.toml`
or `pytest.ini`:

```toml
[tool.pytest.ini_options]
markers = [
  "unit", "integration", "functional", "e2e", "acceptance",
  "security", "performance", "smoke", "regression", "ui",
]
```

An unregistered marker is not discovered — the gate reports the category NOT
RUN rather than silently collecting nothing and calling it a pass.

**Go** — build tags of the same names on the test file:

```go
//go:build integration
```

Untagged `_test.go` files are the unit suite.

---

## Rules

**One test per acceptance criterion, minimum.** The criteria are the contract;
an untested criterion is an unverified claim.

**Test observable behavior, not internal structure.** Tests coupled to
implementation break on every refactor and prove nothing about correctness.

**A test that cannot fail is not a test.** Confirm it fails before the fix and
passes after. This is the single most skipped step and the reason suites give
false confidence.

**Cover the failure paths.** Invalid input, missing data, boundary values,
permission denials, and every error branch the code declares. A suite that
only covers the happy path is why bugs reach production.

**Every fixed defect gets a regression test** reproducing the original
failure. Otherwise it returns.

**Do not weaken a test to make it pass.** If the test is right and the code is
wrong, that is a defect to report, not a test to relax.

**Report failures with the real output.** Never "some tests failed."

**A category with no runner is NOT RUN, not passing.** Absence of tests is
absence of evidence. Report it and say what it would take to run.

---

## Evidence per category

Each category's result is one of PASS / FAIL / NOT RUN / UNKNOWN, and carries
the evidence that produced it:

| Category | What counts as evidence |
|---|---|
| Unit, Integration, Functional, E2E, Acceptance, Smoke, Regression | Runner output, read — not the exit code alone |
| Security | The finding list from a Security-role pass, or a clean run with the checks named |
| Performance | Two measurements — baseline and after — with the delta stated |
| UI / UX | A rendered screenshot inspected against the requirement, plus keyboard order and contrast results |

A UI category marked PASS without a rendered result inspected is a fabricated
pass. `CLAUDE.md` forbids it.

---

## Coverage

Coverage is a diagnostic, not a goal. High coverage with assertion-free tests
is worse than honest lower coverage, because it is trusted.

Target 95% on new code. Use it to find untested paths, not to certify quality
— uncovered error branches are the useful signal.

---

## Budget

The gate's total runtime is bounded. A category the budget cuts off reports
NOT RUN with the reason, never PASS. If this project's E2E or performance
suites are long enough to be cut off routinely, raise
`CLAUDE_VERIFY_GATE_BUDGET` **and** the Stop hook's `timeout` in
`settings.json` together — raising the budget alone gets the hook killed by
the harness, and a killed hook enforces nothing.

---

## What not to test

- Framework or standard library behavior
- Generated code with no hand-written logic
- Getters and setters with no behavior

Testing these adds maintenance cost without adding information.
