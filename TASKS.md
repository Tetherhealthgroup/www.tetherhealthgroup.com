# Tasks

Living task board. The Planner writes entries; the assigned role updates
status; the Reviewer closes them. Keep it current — a stale board is worse
than no board, because it is trusted and wrong.

## Status values

| Status | Meaning |
|---|---|
| `todo` | Defined and assigned, not started |
| `doing` | In progress by the named role |
| `blocked` | Cannot proceed; the blocker is stated |
| `review` | Implementation done, awaiting Reviewer |
| `done` | Every completion criterion in ORCHESTRATION.md is met |

Nothing moves to `done` on the author's judgment alone.

## Task format

```markdown
### T-001 — Short imperative title
- **Status:** todo
- **Owner:** backend
- **Depends on:** —
- **Acceptance criteria:**
  - [ ] Stated as something checkable, not "works correctly"
  - [ ] One criterion per line
- **Verification:** the exact command or check that proves it
- **Notes:** decisions made, alternatives rejected and why
```

Acceptance criteria are the contract. If a criterion cannot be checked by
running something or reading something specific, rewrite it until it can.

## Active

_No tasks yet._

## Done

_None yet._

## Decisions

Durable choices that outlive the task that produced them. Record the decision
and the reason; a decision without its reason gets reversed by the next person
who sees it.

| Date | Decision | Reason |
|---|---|---|
| | | |

---

## Session: 2026-08-29 — site build + app fixes

### Done

- **Website scaffolded and built** — Astro 7 + Tailwind 4, 13 static routes,
  design tokens ported verbatim from the app's `lib/theme/app_colors.dart`.
  Build PASS, `astro check` 0 errors/0 warnings/0 hints.
- **Coming-soon posture** across the site: one health area marked
  "In development", nine "Planned"; no app-store links, no availability claim.
- **Waitlist form** delivering to `support@tetherhealthgroup.com`, with an
  optional `PUBLIC_WAITLIST_ENDPOINT` POST mode.
- **Mobile app (`develop` branch)** — three defects fixed, four unreachable
  controls reached, 11 tests added. See `DEVELOPMENT_NOTES.md` in the app repo.

### Open — needs a decision or an owner

- [ ] Provision the `support@tetherhealthgroup.com` mailbox.
- [ ] Legal review of `/privacy/`, `/terms/`, `/security/`.
- [ ] Choose hosting; add CSP/HSTS/Referrer-Policy at the edge.
- [ ] Independent accessibility audit (the site says one has not happened).
- [ ] Approve or replace the corporate mark in `TetherLogo.astro`.
- [ ] Confirm the ordering of the nine planned health areas.
- [ ] App: commit the `develop` changes and open a PR.
