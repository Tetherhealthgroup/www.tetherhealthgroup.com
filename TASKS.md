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
| 2026-09-11 | _(Superseded 2026-10-27.)_ Unplug is described on `/breathefree/` as a module in design, and appears in `upcoming` under Tobacco & nicotine — not as its own health area or its own page. | The code lives inside the BreatheFree application repository, so that is where the site should point. Giving it a page of its own would imply a product line that does not exist. Mental & behavioural health gets two `upcoming` entries instead, because whether screen time belongs to that area is genuinely undecided. |
| 2026-09-11 | _(Superseded 2026-10-27.)_ The `/breathefree/` Unplug section names what is **not** built, in a coral card, in the same breath as what is. | The module's blocking layer is unwritten. A section describing an intercept without saying the intercept does not exist yet would be the exact overstatement `src/data/programs.ts` was written to prevent. |
| 2026-10-27 | The site is presented as a finished product: no status badges, no "in development / prototype / planned / not available" wording, no per-area roadmap, and **early access** as the only call to action. The app's status text stays in `programs.ts` (pinned to the app fixture) but is never rendered. | Owner direction, for official marketing. The underlying fact is unchanged — nothing is released — so the no-download, no-store, no-date and no-"available now" guards stay in force. |
| 2026-10-27 | Regulatory and integration wording is limited to commitments and work in progress: "designed to meet HIPAA's requirements", "designed with FDA digital health guidance in mind", "building connections to" Blue Button and Epic. Never "HIPAA compliant", "FDA approved / cleared / compliant", "integrated with", or a partnership. No CMS, Epic or HL7 logos. | The owner asked for "HIPAA compliant / FDA compliant"; nothing in the repository evidences either, and for a health product both are claims regulators act on. Integrations are sandbox-only. Epic's developer terms forbid implying partnership. Enforced by `test/acceptance/regulatory-claims.test.js`. |
| 2026-10-27 | The Blue Button API is named without a version. | The owner referred to a "Blue Button 3.0" gateway; it could not be verified (web access disabled in-session), and the counsel draft `/app-privacy/` says "Blue Button 2.0". |

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
- **Dead-link and dead-control sweep (2026-09-01).** Every reference the build
  emits was resolved against the emitted files, and every route was then
  requested over HTTP from the preview server. 1038 references across 24
  pages; 119 URLs requested, all 200. Interactive inventory: 920 anchors, 13
  buttons, 78 form controls — no anchor with a missing, empty or `#` href, no
  anchor without an accessible name, no button without a submit target.

  Two real defects were found and fixed:

  1. **The 404 page claimed a canonical URL that 404s.** `Astro.url.pathname`
     made `<link rel="canonical">` and `og:url` point at
     `https://www.tetherhealthgroup.com/404/`, which is not a route. Apache
     serves that document via `ErrorDocument` at whatever path was requested,
     so it has no URL of its own — `Base.astro` gained `noCanonical` and both
     tags are now omitted there.
  2. **The waitlist submit button did nothing without JavaScript.** Delivery
     is entirely the form script's job; the form has no `action` and no
     `method`, so submitting it unscripted GETs the current URL — the page
     reloaded and everything typed was discarded, on all 13 pages carrying
     the form. The `<noscript>` block now hides the form and prints the
     support address instead, verified in a `sandbox="allow-same-origin"`
     frame (scripting genuinely off): computed `display: none`, the submit
     button unreachable, the `mailto:` fallback visible.

  Both defects have a regression test that was confirmed to fail against the
  defective output before it passed against the fix. Gate after: build PASS,
  `astro check` 0/0/0, lint PASS, 8 unit PASS, 31 smoke PASS.

  Not dead links, and deliberately unchanged: `/#waitlist` is absolute on
  every page (it is the home page's section), and the site references zero
  external URLs — the pre-launch posture means no app-store or social links
  exist to rot.

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
- [ ] Own the per-area `services` / `upcoming` copy in `programs.ts`. It
      elaborates the supplied programme plan and has had no clinical review.
      (`updates.ts` is gone — see the updates-removal entry below.)
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
tripwire that fails if HSTS is lengthened before the site has served a page.

Gate: build PASS (25 pages) · `astro check` 0/0/0 · prettier PASS ·
unit 8/8 PASS · smoke 23/23 PASS.

**Open, and needs the account owner:**

- [x] ~~Run AutoSSL in cPanel for `tetherhealthgroup.com` and `www.`.~~ Done —
      see the 2026-08-30 (later still) entry below. A Let's Encrypt certificate
      covering both names is live and the chain verifies.
- [x] ~~Decide how the built site reaches `public_html`.~~ Decided: a second
      branch, `deploy`, carries the **compiled** site with `dist/`'s contents at
      the branch root, so a checkout of `deploy` into `public_html` is directly
      servable — `index.html`, `_astro/`, `.htaccess` and all. `master` keeps
      holding source only, and `dist/` stays gitignored there. See "Hosting and
      deployment" in `README.md`. Publishing it is still an owner action; see
      below.

### Session: 2026-08-30 (later still) — the certificate cleared, a 403 behind it

Measured against the live host, not recalled.

**The certificate is issued and valid.** `openssl s_client` against
`www.tetherhealthgroup.com:443`:

    subject=CN=cpcontacts.tetherhealthgroup.com
    issuer=C=US, O=Let's Encrypt, CN=YR2
    notBefore=Aug 30 15:27:15 2026 GMT   notAfter=Nov 28 15:27:14 2026 GMT
    SANs include: tetherhealthgroup.com, www.tetherhealthgroup.com
    Verification: OK        Verify return code: 0 (ok)

The `*.hostgator.com` certificate recorded earlier this day is gone. The top
open task on this board is closed, and the "HTTPS is broken" bullet above is
superseded — kept, not deleted, because it was true when written.

**A different fault was behind it: the site returns 403 on every path.**

    GET https://www.tetherhealthgroup.com/            -> 403
    GET https://www.tetherhealthgroup.com/about/      -> 403
    GET https://www.tetherhealthgroup.com/robots.txt  -> 403
    GET http://www.tetherhealthgroup.com/             -> 403, and no redirect

The body is HostGator's canned 403 page: 732 bytes,
`Last-Modified: Wed, 25 Mar 2026 21:45:30 GMT`, predating this project. No
redirect, no CSP, no HSTS — and `/.well-known/acme-challenge/` is 403 as well,
though that path is exempt from every rule in our `.htaccess`. A directive
cannot both fail to apply and fail to be overridden, so Apache is not reading
our `.htaccess`: the document root it serves is not where the built site is.

This also corrects the earlier bullet "Nothing is deployed... `/` answers
`302 -> /404.html`". That was a different response from a different
configuration; the host answers 403 now.

Ruled out: `safecodeg.com` (the account's primary domain) serves 200 on
**any** path including `zzz-does-not-exist-9f8a`, so it is a catch-all SPA and
the 200s under it are not this site's content.

The cPanel checkout is at `/home2/safecode/tetherhealthgroup.com` — cPanel's
default clone target is `/home2/<user>/<repo-name>`, the home directory, not a
document root. The `deploy` branch content is correct and directly servable.

**Shipped in response:** `project/public/.cpanel.yml`. The owner confirmed the
document root is `/home2/safecode/public_html/tetherhealthgroup.com`, which is
not the checkout path — so the copy step was the missing piece. The file
exports that path and rsyncs the checkout into it, which is what the "The
system cannot deploy" notice was asking for.

Two failure modes it is written against, both guarded by new tests:

- `cp -R * $DOCROOT` does not match `.htaccess`. A deploy using it succeeds and
  silently ships the site with no CSP, no HSTS and no redirects.
- `--delete` would remove `.well-known/`, where AutoSSL writes HTTP-01
  challenge tokens. A deploy during validation would fail an unrelated renewal.

**Also fixed — `.git` was publicly readable if a checkout ever reached the
document root.** The deny-list at the foot of `.htaccess` matches filenames, so
`/.git` was blocked but `/.git/config` was not: `config` has no leading dot and
does not end in `.config`. Measured against Apache 2.4.66 with a `.git/` in the
document root:

    GET /.git/config   (no path rule)  -> 200, body "[core] secret=yes"
    GET /.git/config   (with the rule) -> 403

`RewriteRule (^|/)\.git(/|$) - [F,L]` now sits in the rewrite block, after the
ACME exemption and ahead of both redirects.

Gate: build PASS (25 pages) · `astro check` 0/0/0 · prettier PASS ·
unit 8/8 PASS · smoke+headers 29/29 PASS. The four new deploy tests were each
confirmed to fail against a deliberately broken `.cpanel.yml` (bare `cp *`
glob, DOCROOT pointing back at the checkout, and `--delete` without the
`.well-known` exclusion) before being accepted.

**The site went live during this session, from the PREVIOUS build.**

Between the 403 measurement above and the end of the session the document root
was populated by someone with cPanel access. Measured afterwards:

    24/24 sitemap routes            -> 200 over HTTPS
    http://www  and  http://bare    -> 301 to https://www..., path+query kept
    /nope-missing/                  -> 404, the site's own 404 page
    CSP, HSTS, Referrer-Policy, Permissions-Policy, COOP/CORP  all present
    _astro asset -> immutable 1y · HTML -> must-revalidate · robots -> 1d
    HTML gzips 68,639 -> 25,716 bytes
    Chromium: renders at 1440 and 390, mobile menu opens, 0 console messages

The served content is **byte-identical to deploy commit `5502124`** — the build
before this session's. Identified by the per-build random SVG gradient id:
live and `5502124` both carry `leaf-29rxp7g`, while `d180a1b` carries
`leaf-c2qhq38`.

So `d180a1b` is pushed but **not deployed**, and two things follow:

- The `.git` path rule is **not live yet**. `/.git/config` does answer 403, but
  `5502124`'s `.htaccess` contains no such rule, so that 403 comes from
  something else on this host — probably a server-level block. It is not
  evidence of our rule, and a server-level rule is not ours to depend on.
- `.cpanel.yml` is not in the checked-out branch yet, so the copy step it
  provides has not run. Whatever populated the document root this time was not
  it.

**Open, and needs the account owner:**

- [ ] cPanel → Git Version Control → Pull or Deploy → **Update from Remote**,
      then **Deploy HEAD Commit**. The first brings `d180a1b` — and with it
      `.cpanel.yml` — into the checkout, which is what makes the second
      possible.
- [ ] Confirm the new build is actually serving, rather than assuming it:

          curl -s https://www.tetherhealthgroup.com/ | grep -o 'leaf-[a-z0-9]*' | head -1

      It should print `leaf-c2qhq38`. `leaf-29rxp7g` means the document root is
      still on the old build and the deploy did not take effect — in which case
      re-check that `DOCROOT` in `.cpanel.yml` matches the domain's real
      document root.
- [x] ~~Then raise HSTS `max-age` and update the tripwire test in the same
      commit.~~ Done — `max-age=31536000`. Both gating conditions were measured
      first: the certificate verifies, and all 24 routes serve 200 over HTTPS
      with a clean Chromium render. `includeSubDomains` and `preload` stay off
      and the tripwire now fails if either appears; `mail.`, `webmail.` and
      `cpanel.` are covered by the certificate but were never confirmed to
      serve valid HTTPS.

### Session: 2026-08-30 (later still) — HSTS to a year, and updates removed entirely

Two owner decisions, taken after the questions below were put and answered.

**HSTS raised to `max-age=31536000`.** The ramp waited on two measurements, not
one, because HSTS cannot be walked back: the certificate verifies
("Verify return code: 0 (ok)"), and the site demonstrably serves — 24/24 routes
200 over HTTPS, a clean Chromium render, and the header read off a live
response. `includeSubDomains` and `preload` stay off; the tripwire test changed
shape rather than being deleted, pinning max-age exactly and refusing both
modifiers by name. Confirmed against three mutations: `includeSubDomains`
added, `preload` added, max-age dropped to 300 — each fails.

`mail.`, `webmail.` and `cpanel.` are covered by the certificate but were never
confirmed to *serve* valid HTTPS, which is why `includeSubDomains` is refused:
asserting it for a subdomain that then fails removes it for a full year, and
webmail is what someone reaches for when the main site is broken.

**The updates feature removed completely.** The previous entry removed the page
and kept the data and the per-area section; the owner then asked for both. Now
deleted: `project/src/data/updates.ts`, the "Already done / What has landed
here" section on `/programs/<area>/`, its imports, and the smoke case that
guarded it — that case's subject no longer exists, so it was removed rather
than weakened. The link guard stays: no page may link to `/updates/`.

**Consequence worth recording rather than discovering later:** the site now has
**no record of shipped work at all**. Every remaining claim is forward-looking,
and the scope-versus-record distinction the content rules were built around has
only one side left. `README.md` states this in the "Scope versus record"
section. Restoring a record is a content decision, not a revert.

Verified in Chromium at 1440 and 390: heading order stays sequential
(h1 -> h2, no skips), the page flows "What happens next here." -> BreatheFree
with no gap where the section was, 0 links to `/updates/`, 0 console messages.

Gate: build PASS (24 pages) · `astro check` 0/0/0 · prettier PASS ·
unit 8/8 PASS · smoke+headers 29/29 PASS (one case fewer, deliberately).

### Session: 2026-08-30 (later still) — the updates page removed

Requested by the owner: the site does not need a dedicated updates page.

**Removed:** `project/src/pages/updates.astro`, the `Updates` entry in
`primaryNav` and in the footer's Product column, and the "All updates" link at
the foot of the per-area "Already done" section. The build goes from 25 pages
to 24, and `/updates/` no longer appears in the sitemap or in any nav.

**Kept:** `project/src/data/updates.ts` and the per-area "Already done"
section on `/programs/<area>/`, which renders those entries. The request named
the page, and deleting the data would have removed real content from ten health
area pages that nobody asked to change. Reversible either way — say so and the
section goes too.

**Tests changed rather than dropped.** The case that guarded the updates
content read `dist/updates/index.html`, which no longer exists. It now reads
the "Already done" section of `/programs/tobacco/` and checks the same
invariant — entries describe work that has landed, never intent. The check is
scoped to a slice of that page because the same page legitimately describes
future work further down, under "Coming up"; scanning the whole document would
have meant either a false failure or no check at all.

Added a case asserting that no built page links to `/updates/`. Deleting a
page is only half the job — a link left behind is a 404 for a real visitor and
the build does not complain. Both were confirmed to fail before being accepted:
a `/updates/` link injected into `dist/about/index.html` fails the second, and
"coming soon" injected into the "Already done" section fails the first.

Gate: build PASS (24 pages) · `astro check` 0/0/0 · prettier PASS ·
unit 8/8 PASS · smoke+headers 30/30 PASS.

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

---

## WEB-003 — team and role contacts, security.txt

- About page: Leadership section (names and titles only) from `leadership` in
  `src/data/site.ts`.
- Role mailboxes (support, privacy, security, partnerships, careers) live in
  `contact` in `src/data/site.ts` and render through `SupportEmail`
  (`mailbox` prop). Support, privacy, security and terms use the one that fits.
- `public/.well-known/security.txt` (RFC 9116), served as
  `text/plain; charset=utf-8`. **Expires 2027-10-12: renew before then.**
- `.cpanel.yml` no longer excludes all of `.well-known/` (that also blocked
  copying security.txt). Instead everything under `.well-known/` is protected
  from `--delete` (`--filter='P /.well-known/**'`), so the host's own files
  there survive a deploy. The flip side: a file removed from
  `public/.well-known/` is not removed from the document root by the next
  deploy, and has to be deleted on the host by hand.
- Unknown until the owner confirms a test message: whether any role mailbox
  receives mail.
- Legal-page contact changes (privacy, security, terms; "Last updated" bumped to
  2026-10-12) are **needs-counsel**: they need counsel's review and the owner's
  sign-off before publishing.

---

## WEB-902 — admin and finance mailboxes

- `contact` in `src/data/site.ts` now holds seven role mailboxes: support,
  privacy, security, partnerships, careers, finance and admin. No personal
  address is published anywhere on the site.
- `/support/` lists finance (invoices and other financial matters) and admin
  (general company and administrative matters) with the other addresses.
  The footer still shows support only, and the legal pages are unchanged: no
  page offers anything for sale or mentions billing, so there is no text for
  finance to sit beside, and changing legal-page contacts needs counsel.
- `security.txt` Contact stays security@.
- Tests: every address and every `mailto:` on every built page must be one of
  the seven; `/support/` must link finance@ and admin@.
- Unknown until the owner confirms a test message: whether admin@ and finance@
  receive mail.

---

## WEB-903a — app claims, metadata, links and accessibility checks

- Copy now matches the app as it exists today. The screen tour says its
  screens are design artwork, not screenshots of a released app. Craving help
  is described as "One tap, no typing" rather than tools that "work
  anywhere". Screen-reader, larger-text, Spanish and audio features are
  described as designed, not as things the app does. "Release gates" and
  "evidence-informed" are gone from the home, about and clinician pages.
  The security page is legal text and is unchanged; it needs counsel.
- New checks, all against the build: the claim families above, with
  paraphrases (`test/acceptance/claims.test.js`); more availability and
  testing paraphrases in the existing overclaim filter; title, description,
  canonical and share tags on every page, the sitemap listing exactly the
  indexed pages, and robots.txt (`test/ui/seo.test.js`); every internal
  link, image, script and fragment resolving to something built
  (`test/functional/links.test.js`); language, viewport, one h1, landmarks,
  skip link, image and SVG text alternatives, accessible names, field labels
  and the focus ring (`test/ui/a11y.test.js`).
- Published addresses: tracked text files may name only the seven role
  mailboxes at the company domain; the mailto check reads URLs as a browser
  does (tab and newline removed, `=` allowed in unquoted attribute values).
- The draft-page wording check also reads attribute strings, frontmatter
  string literals and expression comments.
- Not checked here: layout at 320, 390 and 768 px, tap-target size, and
  keyboard focus in a real browser. Those need a rendered page.

---

## WEB-905 — no offline wording

- The site no longer says the app works offline, in any form, matching the
  app's own copy. Removed from the home, about, BreatheFree and
  how-it-works pages and the tobacco cessation service description; the
  home principle and the how-it-works note now use the clock and wave icons
  instead of the no-signal icon. "One-handed" and "no typing" stay as they
  were.
- `test/acceptance/claims.test.js`: offline and no-connection wording fails
  whether or not it is hedged. For the other claim families, "will" is no
  longer a hedge, and "not" counts only directly before the claim.
- `test/ui/a11y.test.js`: no page goes more than one heading level deeper
  than the heading before it.

---

## WEB-907 — Android App Links statement

- `public/.well-known/assetlinks.json` names the Android app
  (`com.TetherHealthLLC.tetherhealth`) and the SHA-256 fingerprint of its Play
  app-signing certificate, with the `handle_all_urls` relation. `.htaccess`
  serves it as `application/json`, beside the security.txt rule.
- It takes effect only once the app declares verified links for this domain.
  Today the app declares only its custom-scheme sign-in callback, so nothing
  changes for users yet.
- Only the app-signing key is listed; Play-distributed builds are signed with
  it. The upload key is not added.
- Like security.txt, a later removal from `public/.well-known/` is not removed
  from the document root by a deploy and has to be deleted on the host by hand.
- Tests (`test/security/assetlinks.test.js`): valid JSON with exactly one
  statement, the exact relation, package and fingerprint (32 colon-separated
  uppercase hex bytes), the content-type rule in `.htaccess`, and the file
  emitted in the build byte for byte.
- After deploy, the owner checks the URL answers 200 with
  `Content-Type: application/json`.

## WEB-MKT — marketing-ready site, contact, careers, integrations, FHIR callbacks

- **Status:** review (branch `feat/marketing-ready`, uncommitted)
- **Owner:** frontend
- **Acceptance criteria:**
  - [x] No development-status wording or badge on any non-legal page (`no page presents development status`)
  - [x] Early access is the call to action in the header and on the form pages
  - [x] `/contact/` with a topic-routed form and every role mailbox; `/careers/` with the careers mailbox
  - [x] `/integrations/` with FHIR, SMART on FHIR, CMS Blue Button API, Epic FHIR APIs, HIPAA and FDA commitments, and the trademark notice
  - [x] `/fhir/callback/bluebutton/` and `/fhir/callback/epic/`: noindex, outside the sitemap, `no-store`, `no-referrer`, code stripped from the URL and never printed, Android hand-off to the package in assetlinks.json
  - [x] No HIPAA / FDA certification, live-integration or partnership claim anywhere
  - [ ] Phone number and business address on `/contact/` — **blocked on owner**
  - [ ] Google Search Console verification files (`google6925e19023bb7f68.html`, `google90cd7aaa7b8ae113.html`) added to `project/public/` — **blocked on owner pasting their contents**
  - [ ] Android app declares verified App Links for `https://www.tetherhealthgroup.com/fhir/callback/*` — app repository, not this one
  - [ ] Counsel review of the revised wording (formerly WEB-005) and of `/terms/`, which still says "Products described here are in development"
  - [ ] Counsel: `/privacy/` covers only the early-access form; the new contact form (name, organisation) and the careers mailbox (résumés) are not described in it
  - [ ] Owner decision: the tour no longer says its screens are design artwork, and several screens are iPhone-framed while Android comes first
  - [ ] Owner decision: the ten programs other than BreatheFree are described in the present tense (owner direction); counsel to confirm against `/terms/` "statements of intent"
- **Independent review (2026-10-27):** a separate reviewer ran the `.htaccess` under Apache 2.4.67 and confirmed the callback block yields one `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag`, with other pages unchanged. Fixed from its findings: home-page integration cards and Unplug copy no longer state present capabilities; careers clinical claim reworded; "early access covers the whole app" removed; callback pages carry their own no-referrer meta; the intent link has a browser fallback so it never opens a store listing; the download scan covers the whole HTML again; the honest "not screenshots" disclaimer is no longer banned; a test now catches "can connect … Medicare/Epic" claims.
- **Verification:** `npm run build && npm test` (242 pass, 0 fail on 2026-10-27), `npm run lint`, `npx astro check` (0 errors), `gitleaks dir . --redact` (no leaks)
- **Notes:** contact and early-access form scripts now share `isReplyableEmail`, so Astro ships both as modules under `/_astro/`; the CSP pins JSON-LD, header and FHIR-callback inline scripts only.
