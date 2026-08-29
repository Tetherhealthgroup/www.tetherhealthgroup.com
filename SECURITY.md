# Security Standard

Owned by the Security role. Implemented by Backend and Frontend.

## Review triggers

A security review is required when a change touches any of these. Absent all
of them, record the review as NOT RUN with the reason.

- Authentication or authorization
- Any value crossing a trust boundary — user input, external API, file upload
- Secrets, tokens, or credentials
- Data persistence or retrieval by identifier
- Rendering content that originated outside the system
- New third-party dependencies
- Anything exposed to the network

## What to check

**Injection** — SQL, command, template, and path traversal on every value that
crosses a boundary. Parameterize; never concatenate.

**Authorization** — not "is the caller authenticated" but "may *this* caller
touch *this* record." Object-level checks are the most commonly missing
control.

**Secrets** — never in source, logs, error messages returned to users,
committed config, prompts, or project memory. Read from the environment or a
secret manager.

**Output escaping** — anything rendered that came from outside the system,
escaped for its destination context.

**Validation** — at system boundaries, allowlist rather than blocklist. Trust
internal calls and framework guarantees rather than re-validating everywhere;
redundant validation obscures where the real boundary is.

**Dependencies** — what a new package pulls in transitively, whether it is
maintained, and whether its permissions match its purpose.

**Error handling** — errors that inform the caller without disclosing internal
structure, stack traces, or query text.

## Reporting findings

Each finding states a **concrete exploitation path**:

> An unauthenticated caller can read another user's record by changing the
> `id` parameter in `GET /api/records/:id` — there is no ownership check.

Not: "this endpoint could be insecure."

Rank by exploitability and blast radius, not by category name. Report
low-confidence findings too, labelled as such — filtering happens downstream,
not silently at the point of discovery.

If a theoretical issue is already prevented by surrounding code, say so and
name the control rather than reporting it.

## Resolution

Every finding is either **fixed** or **explicitly accepted** with a stated
reason and an owner. Silent dismissal is not a resolution.
