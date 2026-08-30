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

- [ ] **Mail delivery is unproven.** On 2026-08-29 this was recorded as "no MX
      record at all". On 2026-08-30 DNS publishes
      `MX 0 mail.tetherhealthgroup.com` and that name resolves to
      192.185.39.65, so the record side is no longer missing. What has still
      never happened is a message sent to `support@tetherhealthgroup.com` and
      read in an inbox. Do that before the address is promoted anywhere — the
      waitlist form's default mode composes mail to it.
- [ ] **The waitlist form sends nothing by itself.** With no
      `PUBLIC_WAITLIST_ENDPOINT` set it opens the visitor's mail client and
      relies on them pressing Send. The POST path is implemented and was
      re-verified against a local handler on 2026-08-30; point
      `PUBLIC_WAITLIST_ENDPOINT` at a real form handler to stop depending on
      the visitor's mail app. Note that this is downstream of the MX blocker
      above: in the default mode the message is addressed to a mailbox that
      cannot currently receive it.
- [ ] Legal review of `/privacy/`, `/terms/`, `/security/`.
- [x] ~~Choose hosting; add CSP/HSTS/Referrer-Policy at the edge.~~ HostGator
      (Apache); the headers ship in `project/public/.htaccess` and are verified
      against Apache 2.4. The certificate itself is still outstanding — above.
- [ ] Independent accessibility audit (the site says one has not happened).
- [ ] Approve or replace the corporate mark in `TetherLogo.astro` — the share
      card at `project/public/og-image.png` is generated from it and must be
      regenerated if the mark changes.
- [ ] Confirm the ordering of the nine planned health areas.
- [ ] Own the content of `updates.ts` and the per-area `services` / `upcoming`
      copy. It elaborates the supplied programme plan and has had no clinical
      review.
- [x] ~~Push the website commits to `origin/master`.~~ Done. This entry was
      stale when it was read on 2026-08-30: `git ls-remote --heads origin`
      already showed `refs/heads/master` at the same commit as the local
      branch. Later commits from that day are pushed too.

### Session: 2026-08-30 (later) — the domain, measured

Checked over DNS-over-HTTPS and against the live host, not recalled:

- **The domain is on HostGator.** `NS hgns1/hgns2.hostgator.com`,
  `A 192.185.39.65`, `TXT v=spf1 a mx include:websitewelcome.com ~all`. The
  server is Apache.
- **HTTPS is broken, not absent.** `:443` presents `CN=*.hostgator.com`
  (SANs `*.hostgator.com`, `hostgator.com`, DigiCert/RapidSSL, valid to
  2027-02-21), which does not cover this domain. Every browser refuses the
  connection. Port 80 already 301s to `https://`, so the plain-HTTP entry
  point sends people straight into the error.
- **Nothing is deployed.** Behind the certificate error, `/` answers
  `302 -> /404.html` with `x-robots-tag: noindex, nofollow`.
- **The MX blocker recorded on 2026-08-29 no longer matches DNS.**
  `tetherhealthgroup.com MX 0 mail.tetherhealthgroup.com` is published, and
  `mail.tetherhealthgroup.com` resolves to 192.185.39.65. Whether a mailbox
  behind it accepts and delivers mail is **still unverified** — a published MX
  is not a working inbox, and no message has been sent or received end to end.

**Shipped:** `project/public/.htaccess` — canonical host and scheme, CSP, HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Frame-Options`, COOP/CORP, per-type cache lifetimes, compression, AVIF/WebP
MIME types. Verified against Apache 2.4.66 serving `dist/`, and the CSP
verified in Chromium: both inline scripts still execute, styles and images
load, zero console violations. Six smoke tests now guard it, including a
tripwire that fails if HSTS is lengthened while the certificate is still wrong.

Gate: build PASS (25 pages) · `astro check` 0/0/0 · prettier PASS ·
unit 8/8 PASS · smoke 23/23 PASS.

**Open, and needs the account owner:**

- [ ] Run AutoSSL in cPanel for `tetherhealthgroup.com` and `www.`. No CAA
      record blocks issuance and DNS already points at the account.
- [x] ~~Decide how the built site reaches `public_html`.~~ Decided: a second
      branch, `deploy`, carries the **compiled** site with `dist/`'s contents at
      the branch root, so a checkout of `deploy` into `public_html` is directly
      servable — `index.html`, `_astro/`, `.htaccess` and all. `master` keeps
      holding source only, and `dist/` stays gitignored there. See "Hosting and
      deployment" in `README.md`. Publishing it is still an owner action; see
      below.

### Session: 2026-08-30 — the waitlist form, driven rather than assumed

Both delivery modes were exercised in a browser against the built site, not
read in the source.

- **Mailto mode (the default).** Chromium reports the URL it hands to the
  external handler, so the composed message is on the record: the address,
  subject, labelled body lines, and `&` and `+` inside the message surviving
  percent-encoding.
- **POST mode.** Built with `PUBLIC_WAITLIST_ENDPOINT` pointed at a local
  handler; the handler received exactly
  `{name, email, role, interest, message}` as `application/json`.
- **Endpoint failure.** With the endpoint returning HTTP 500 the form falls
  back to the mail client rather than dropping the submission, as documented.
- **Honeypot.** A filled `company` field produces the ordinary confirmation and
  sends nothing — verified by the handler receiving no request.
- **Validation.** Empty and malformed addresses are refused, the error is
  announced, focus moves to the field, and it clears on the next keystroke.

**Defect found and fixed.** `a@` — and `a b@c.com`, `a@b.`, `a@-b.com`,
`a@@b.com` — passed the old check (`includes("@")`), and the form then composed
a message to an address no reply could reach. The check is now the syntax
`<input type="email">` itself enforces.

`src/lib/waitlist.ts` was extracted so the `mailto:` composition became
testable at all: a browser reports nothing back once the URL goes to an
external handler. `test:unit` (8 tests) now covers it, and the rejection table
fails against the old check on six of its ten cases.

Gate after the change: build PASS (25 pages) · `astro check` 0/0/0 ·
prettier PASS · unit 8/8 PASS · smoke 17/17 PASS.

### Session: 2026-08-29 (later) — production pass

- **Mobile WebKit and laptop testing.** WebKit 26.5 driven over 24 routes at
  four mobile sizes, five laptop sizes, iPhone landscape and the 320px WCAG
  reflow width, in WebKit and Chromium.
- **Defects found and fixed:** `/support/` and `/for-clinicians/` horizontal
  overflow; a skipped heading level on `/programs/`; three undersized touch
  targets; caption/eyebrow contrast below AA site-wide; and a focus indicator
  that was invisible in Safari on the early-access form.
- **Added:** a page per health area with its services and upcoming projects, an
  `/updates/` feed, `robots.txt`, and an Open Graph share card.
- **Not done:** no independent audit, no real-device Safari pass, no
  screen-reader pass, and no email has been sent or received end to end.

### Session: 2026-08-30 (later still) — the .htaccess, run rather than read

The six header tests shipped in the previous session read `dist/.htaccess` as
**text**. Nothing had ever started an Apache and made a request through it. Two
defects were living in the gap between "the file says the right thing" and "the
server does the right thing", and both were found by serving `dist/` from
Apache 2.4.66 locally and probing it with curl.

**Defect 1 — the whole site returned 500.**
`AddOutputFilterByType` is provided by **mod_filter**, not mod_deflate; only the
DEFLATE filter it applies belongs to mod_deflate. The compression block was
guarded by `<IfModule mod_deflate.c>` alone, so on any server carrying
mod_deflate without mod_filter the directive was unguarded — and an unknown
directive in `.htaccess` is not a warning, it is a 500 for every page.

Reproduced, not reasoned about: with mod_deflate loaded and mod_filter absent,
`GET /` answered **500**, and the error log read
`Invalid command 'AddOutputFilterByType'`. This is precisely the failure the
file's own header comment says the `<IfModule>` wrappers exist to prevent — the
wrapper was there, it just named the wrong module. Now nested inside
`<IfModule mod_filter.c>`; the same server that 500'd now answers 301/200.

**Defect 2 — the .htaccess blocked the certificate fix that is the top open
task on this board.**
A certificate authority validates the domain over **plain HTTP**, fetching
`http://<domain>/.well-known/acme-challenge/<token>`. The force-HTTPS rule
applied to that path like any other, so the validator was 301'd to
`https://www.tetherhealthgroup.com/...` — the host that answers with a
`*.hostgator.com` certificate that does not cover this domain. Running AutoSSL
would have sent the check straight into the TLS error it was being run to
clear.

Measured before the fix:

    GET /.well-known/acme-challenge/test-token   Host: tetherhealthgroup.com
    -> 301 Location: https://www.tetherhealthgroup.com/.well-known/acme-challenge/test-token

and after:

    -> 200, body "acme-token-value"

An exemption rule now sits **first** in the rewrite block, before both
redirects, because mod_rewrite runs rules in order and the `[L]` on the
redirect above would otherwise end the round before the exemption is reached.

**Two regression tests added** (`test:smoke`, now 25). Both were confirmed to
fail against the pre-fix file, with the diagnostic each is meant to give:

- *"the ACME challenge is not redirected into the broken certificate"* — checks
  the exemption exists, substitutes `-`, and is ordered ahead of every
  `https://` redirect.
- *"no directive is guarded by a module that does not define it"* — walks the
  `<IfModule>` nesting and checks each directive against the module that
  actually provides it.

Verified unchanged by the fix, against the same local Apache: bare domain and
plain HTTP both 301 to `https://www.` in a single hop; query strings survive
(`/support/?a=b` keeps `?a=b`); `/about/` 200; unknown paths 404 via
`ErrorDocument`; `/.htaccess`, `/.env`, `/secret.log` and `/_astro/` all 403;
gzip still applied to HTML; `Cache-Control` immutable on `/_astro/`, one week on
`og-image.png` and `favicon.svg`, one day on `robots.txt` and the sitemap, and
`must-revalidate` on HTML including on a 304. `/support/` and `/` loaded in
Chromium through Apache with zero console errors or warnings.

Gate: build PASS (25 pages) · `astro check` 0/0/0 · prettier PASS ·
unit 8/8 PASS · smoke 25/25 PASS.

**Still open, unchanged by this work:** AutoSSL has not been run and the
certificate is still wrong — the fix above removes an obstacle to running it,
it does not run it. No mail has been sent or received end to end. Nothing is
deployed to `public_html`.
