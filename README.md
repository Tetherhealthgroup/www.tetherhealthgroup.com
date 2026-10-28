# www.tetherhealthgroup.com

Marketing and company website for **Tether Health LLC** (Tether Health Group).

The site presents the company, the eleven programs of the Tether Health app,
its featured program — **BreatheFree**, for quitting smoking — and the
health-record integrations it is building (FHIR, SMART on FHIR, the CMS Blue
Button API and Epic's FHIR APIs).

Since 2026-10-27 the site is presented as a finished product, at the owner's
direction: no development-status badges or wording, and **early access** as
the one call to action. Nothing is released yet, so there are still no
app-store links and no claim that anything can be downloaded or used today,
and regulatory wording stays at commitments ("designed to meet HIPAA's
requirements"), never certifications. Tests enforce both
(`test/acceptance/acceptance.test.js`, `test/acceptance/regulatory-claims.test.js`).

## Stack

|                    |                                                            |
| ------------------ | ---------------------------------------------------------- |
| Framework          | Astro 7 (static output)                                    |
| Styling            | Tailwind CSS 4, via `@tailwindcss/vite`                    |
| Images             | `astro:assets` + sharp (AVIF/WebP, responsive `densities`) |
| Sitemap            | `@astrojs/sitemap`                                         |
| Fonts              | System stacks only — no webfont is downloaded              |
| JavaScript shipped | Small scripts: mobile menu, two forms, FHIR callback       |

The site is fully static. There is no server, no database, no analytics, no
cookies and no third-party request of any kind.

## Getting started

The repository is an npm workspace. Install once from the **root**, not from
`project/`:

```bash
npm install
npm run dev        # http://localhost:4321
```

The full verification gate, all runnable from the root:

```bash
npm run build      # static build into project/dist
npm run check      # astro check — type-checks .astro and .ts
npm run lint       # prettier --check
npm run format     # prettier --write
npm run test:unit  # pure units, no DOM and no build needed
npm run test:smoke # asserts the built output in project/dist
npm run preview    # serve the built output
```

`test:unit` covers `src/lib/waitlist.ts` — which addresses the form accepts,
and the exact `mailto:` URL it composes. That URL earns a test of its own:
once the page assigns it to `window.location.href` the browser hands it to an
external mail handler and reports nothing back, so what the company actually
receives cannot be observed from a browser test.

`test:smoke` runs against `dist/`, so run `npm run build` first. It asserts the
32 routes are emitted, the sitemap exists, every page has a title, description
and canonical URL, no page skips a heading level, the safety routing appears
on every page, and — the one that
matters most — that **no page loads a third-party resource** and no page links
to an app store while the product is pre-launch. Those two guard promises the
site makes in prose, which a later edit could otherwise break silently.

Two of its assertions guard against a control or a tag that points nowhere:

- **The 404 document must claim no canonical URL.** Apache serves it through
  `ErrorDocument` at whatever path was requested, so it has none of its own.
  Deriving one produced `https://www.tetherhealthgroup.com/404/` — itself a
  404 — so `Base.astro` takes `noCanonical` and the test fails if either
  `<link rel="canonical">`, `og:url`, or the string `/404/` comes back.
- **The waitlist form must never be shown as a control that cannot submit.**
  It has no `action` and no `method` because delivery is the script's job, so
  unscripted submission would GET the current URL and silently discard the
  input. Whenever the form carries no `action`, the page must also hide it and
  offer the support address in `<noscript>`.

### Why the root package.json exists

The scaffold puts source in `project/`, but the verification gate discovers
checks from `package.json` at the repository root. The root file is a workspace
manifest that delegates each script into `project/`, so the gate runs the site's
build, typecheck, lint and smoke tests instead of reporting "no automated check
configured".

## Layout

```
project/
  src/
    lib/
      waitlist.ts      Address checking and mailto composition (pure, tested)
      contact.ts       Contact-form topic routing and mailto (pure, tested)
      fhir-callback.ts FHIR OAuth redirect decision logic (pure, tested)
    data/
      site.ts          Identity, navigation, mailboxes, Android package, quitlines
      programs.ts       The 11 programs (app-pinned fields + website copy)
      integrations.ts   FHIR / Blue Button / Epic / HIPAA / FDA wording rules
      screens.ts        The 28-screen BreatheFree catalog + artwork resolver
    components/         Logo, TetherLogo, Button, Card, Icon, Section,
                        PageHero, PhoneFrame, ProgramCard, SupportEmail,
                        WaitlistForm, ContactForm, FhirCallback,
                        Header, Footer
    layouts/
      Base.astro        Document shell, SEO, structured data, landmarks
      Legal.astro       Shell for the policy pages
    pages/              32 routes (see below)
    styles/global.css   Design tokens, base styles, motion
    assets/screens/     The 28 approved 1290x2796 PNGs
```

### Routes

`/` · `/programs/` · `/programs/<area>/` (eleven, generated) · `/services/` ·
`/breathefree/` · `/breathefree/how-it-works/` · `/breathefree/tour/` ·
`/integrations/` · `/for-clinicians/` · `/about/` · `/careers/` ·
`/contact/` · `/support/` · `/privacy/` · `/app-privacy/` ·
`/delete-account/` · `/terms/` · `/security/` · `/accessibility/` ·
`/beta/` · `/beta/thanks/` · `/beta/confirmed/` · `404`

FHIR OAuth redirect URIs, noindex, outside the sitemap and never cached:
`/fhir/callback/bluebutton/` and `/fhir/callback/epic/`. Register exactly
these (with the trailing slash) with CMS and Epic. On Android the app's
verified App Link for these paths should take the redirect before the page
renders; the page is the fallback, hands the redirect to the app through an
`intent://` link, strips the code from the address bar, and never prints it.
The token exchange happens in the app — this site has no backend.

### Program copy

`programs.ts` carries each program's app-pinned fields (name, area, archetype,
tagline, colour, letter, status) and website copy (`summary`, `services`).
The app's status text is kept so the pinned fixture can be checked, and is
never rendered. The per-area roadmap (`upcoming`) was removed on 2026-10-27
with the rest of the development-status presentation. **No dates are
published.**

There is no longer a record of shipped work anywhere on the site. The
`/updates/` feed and the per-area "Already done" section were both removed at
the owner's request, along with `updates.ts`. A smoke case fails if any page
links to the removed `/updates/` route, so the deletion cannot rot into a
broken link.

Nothing replaced them, which is worth stating plainly: **the site can no longer
show that anything has actually been built.** Every remaining claim is
forward-looking, and the guards that kept intent and record from blurring have
nothing left to separate. If a record is wanted again, it needs a new home —
re-adding it is a content decision, not a revert.

## Design system

Colours are **ported verbatim** from the BreatheFree mobile application so the
site and the app read as one product. The source of truth is
`Tether-Health/lib/theme/app_colors.dart`; the values
live in the `@theme` block of `project/src/styles/global.css` with the
originating constant named in a comment beside each one.

Verified identical on both `main` and `develop` of the application repository —
`lib/theme/` does not differ between them.

Type, radii and spacing are matched to the same source: display type at
`-1.7/40 = -0.0425em` tracking and `1.08` line height, eyebrows at 12px/w800
with `2.2/12 = 0.183em` tracking, and a 14px control radius, all taken from
`lib/theme/app_theme.dart` and the native screens on `develop`.

**Do not change a colour here without changing it in the app first.**

The 28 screenshots are the application's own approved artwork, copied from
`assets/screens/`. The site never redraws an app screen.

## The waitlist form

`src/components/WaitlistForm.astro` delivers in one of two modes:

1. **`PUBLIC_WAITLIST_ENDPOINT` is set** — the form POSTs JSON to that URL.
2. **It is not set (the default)** — the form composes the message in the
   visitor's own mail client, addressed to `support@tetherhealthgroup.com`.

Mode 2 is the default because the site has no backend, and a form that silently
drops submissions is worse than one that hands the visitor a message they can
see themselves send. The address is also printed in plain text inside
`<noscript>`, so the route still works with JavaScript disabled.

To switch to mode 1, set the variable at build time:

```bash
PUBLIC_WAITLIST_ENDPOINT="https://forms.example.com/waitlist" npm run build
```

The form asks which health _area_ interests someone — never whether they have a
condition — because the message travels as ordinary email.

The address is checked against the syntax `<input type="email">` itself
enforces — the HTML standard's own expression, in `src/lib/waitlist.ts` — so
the field's declared type and the form's check agree. The form promises a
reply, so an address that cannot receive one is refused rather than waved
through.

## Beta waitlist runbook

`/beta/` is the one form that is sent to the server. It POSTs to
`project/public/api/beta-signup.php` (works with JavaScript off), which
validates every field, stores a `pending` row in a CSV file **outside** the
web root and emails the member a single-use confirmation link
(`api/beta-confirm.php`, 7 days). The notify list is emailed only once the
member confirms. Its private
config, `beta-config.php`, lives in a `tether-private` folder next to
`public_html` and is not in this repository; without it the form stores and
sends nothing.

The owner's steps — where the config goes in cPanel File Manager and what it
contains, how to read the CSV, SPF/DKIM in cPanel → Email Deliverability, and
how to invite people through TestFlight, Firebase App Distribution or Play
internal testing — are in
[`docs/beta-waitlist-runbook.md`](docs/beta-waitlist-runbook.md). The config
keys are in [`docs/beta-config.example.php`](docs/beta-config.example.php).

## Hosting and deployment

The domain resolves to HostGator shared hosting (`NS hgns1/hgns2.hostgator.com`,
`A 192.185.39.65`, checked 2026-08-30), which is Apache. The edge configuration
the project used to be missing therefore lives in `project/public/.htaccess`
and ships into `dist/` with the rest of the site.

It sets the canonical host and scheme (`http` and the bare domain both 301 to
`https://www.tetherhealthgroup.com`), a Content-Security-Policy, HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Frame-Options`, the two cross-origin isolation headers, cache lifetimes per
file type, compression, and the AVIF/WebP MIME types. It also exempts the ACME
HTTP-01 challenge path from both redirects — see below, because that exemption
is what lets the certificate be issued at all.

Every block is wrapped in `<IfModule>`, because on shared hosting a directive
from an absent module is a 500 for the whole site — and the module named has to
be the one that actually provides the directive. `AddOutputFilterByType` is
mod_filter's, not mod_deflate's; guarded on mod_deflate alone it took the whole
site down on a server that had mod_deflate without mod_filter, which was
reproduced locally before it was fixed.

Verified against Apache 2.4.66 locally, serving `dist/` with `AllowOverride
All`: the redirects fire and preserve path and query, `/about/` resolves,
a missing page returns the site's own 404, `.htaccess` itself is 403, there is
no directory listing, `/_astro/` assets are `immutable` for a year while HTML
must revalidate, and HTML compresses 68,639 → 11,976 bytes. The ACME challenge
path is served 200 over plain HTTP rather than redirected.

### Two branches: `master` is source, `deploy` is the site

`master` holds the Astro source, and `dist/` is gitignored there — so checking
`master` out into `public_html` would deploy nothing a browser can render. That
is what the host's 404 was.

`deploy` is the compiled site. It is an **orphan** branch — no shared history
with `master`, because its contents are build output rather than source — and
it carries the contents of `dist/` at the branch root rather than under a
`dist/` folder. That is what makes it directly servable: the checkout root _is_
the document root.

    git checkout deploy      ->      index.html, _astro/, .htaccess, 404.html, ...

To publish, in cPanel → Git Version Control, clone this repository with
`deploy` as the checked-out branch and `public_html` as the path. To refresh it
after a source change, do the Node security check below first, then:

```bash
npm run build          # from the repository root
npm run deploy         # commits dist/ to the deploy branch and pushes it
```

`npm run deploy` builds the branch in a throwaway git worktree, so it never
disturbs your working tree or your current branch. Every deploy commit names
the `master` commit it was built from, so a deployed page can always be traced
back to the source that produced it.

Publishing is a two-step: `npm run deploy` pushes the `deploy` branch, then
cPanel copies it into the document root. The second step is what
`project/public/.cpanel.yml` provides — see "The document root was the
blocker" below for why a copy step is needed at all.

**Before each publish, check Node's security releases. This is a manual
check: nothing watches it automatically** (source: WEB-020). From the
repository root, `git log -s -L '/node-version:/,+1:.github/workflows/ci.yml'`
lists the commits that changed the `node-version` floor in
`.github/workflows/ci.yml`; the first (newest) one is when it last changed.
Read <https://nodejs.org/en/blog/vulnerability> for Node 22 security releases
published since then. If one fixes Node's bundled undici (the copy behind
global `fetch` and `WebSocket`; `node -p process.versions.undici` prints its
version) or another advisory relevant to the build, raise that floor in its
own ticket. If a post announces an upcoming Node 22 security release, check
again once it ships, before publishing. Then confirm that `node --version` on
the machine running `npm run build` and `npm run deploy` satisfies the
`node-version` range in `ci.yml`, and upgrade Node there first if it does not.

### The certificate is done

AutoSSL has issued it. Measured on 2026-08-30 against `:443`:

    subject=CN=cpcontacts.tetherhealthgroup.com
    issuer=C=US, O=Let's Encrypt, CN=YR2
    notBefore=Aug 30 15:27:15 2026 GMT
    notAfter=Nov 28 15:27:14 2026 GMT
    SANs: ... tetherhealthgroup.com, www.tetherhealthgroup.com ...
    Verification: OK / Verify return code: 0 (ok)

Both names this site uses are covered and the chain validates to ISRG Root X1.
The earlier `*.hostgator.com` shared certificate is gone. TLS is no longer a
blocker, and the previous version of this section — which said every browser
refuses the connection — is no longer true.

The ACME exemption in `.htaccess` stays. The certificate authority validates
over **plain HTTP**, fetching
`http://<domain>/.well-known/acme-challenge/<token>`, and the force-HTTPS rule
would 301 that fetch into `https://`. That is survivable only while the
certificate on the other side is valid — which is exactly what a renewal
attempted after something has gone wrong cannot assume. The exemption sits
first in the rewrite block, ahead of both redirects, because mod_rewrite runs
rules in order; a smoke test fails if it is removed or reordered.

`Strict-Transport-Security` is now `max-age=31536000` — one year. The ramp is
finished, and it waited on two measurements rather than one: the certificate
verifies, and the site demonstrably serves (all 24 routes 200 over HTTPS, clean
Chromium render). HSTS cannot be walked back, so neither half was assumed.

`includeSubDomains` and `preload` are deliberately absent, and the tripwire
test now fails if either appears. The certificate covers `mail.`, `webmail.`
and `cpanel.`, but none has been confirmed to _serve_ valid HTTPS — asserting
HSTS for a subdomain that then fails removes it for the full year, and webmail
is what someone reaches for when the main site is broken. `preload` is a
months-long commitment to leave.

### The document root was the blocker

The site is not being served. Measured on 2026-08-30, every path answers `403`
on **both** schemes:

    GET https://www.tetherhealthgroup.com/            -> 403
    GET https://www.tetherhealthgroup.com/about/      -> 403
    GET https://www.tetherhealthgroup.com/robots.txt  -> 403
    GET http://www.tetherhealthgroup.com/             -> 403, no redirect

The body is HostGator's canned "403 Error. Forbidden." page — 732 bytes,
`Last-Modified: Wed, 25 Mar 2026`, predating this project. Three things follow
from that response, and together they identify the fault:

- **No redirect.** Port 80 does not 301 to `https://`, so the rewrite block is
  not running.
- **No headers.** No CSP, no HSTS, no `X-Content-Type-Options`.
- **`/.well-known/acme-challenge/` is 403 too**, and that path is exempt from
  every rule in this file.

A directive cannot fail to apply and also fail to be overridden. The only
reading consistent with all three is that Apache is not reading our
`.htaccess` at all: the document root it serves for this domain is not where
the built site is.

The cPanel Git Version Control checkout is at
`/home2/safecode/tetherhealthgroup.com` — cPanel's default is
`/home2/<user>/<repo-name>`, the **home directory**, not a document root. The
`deploy` branch content is correct and directly servable; it is simply in the
wrong place, or in a directory Apache cannot traverse.

**The fix ships in `project/public/.cpanel.yml`**, which travels to the
`deploy` branch root the same way `.htaccess` does. It exports the document
root and copies the checkout into it, so cPanel's **Deploy HEAD Commit** button
— previously refused with "The system cannot deploy" — becomes the step that
publishes the site.

Two details in it are load-bearing, and both are guarded by tests:

- **The copy must include dotfiles.** `cp -R * $DOCROOT`, the idiom in most
  `.cpanel.yml` examples, does not match `.htaccess` — so the deploy reports
  success and ships the site with no CSP, no HSTS and no redirects. It uses
  `rsync` (falling back to `tar`) instead.
- **`--delete` must spare everything under `.well-known/`.** AutoSSL and cPanel
  write validation tokens there (`acme-challenge/`, `pki-validation/`,
  `cpanel-dcv/`) and the host may hold other live files such as
  `assetlinks.json`; a deploy running during validation would otherwise fail a
  renewal it has nothing to do with. The copy uses `--filter='P /.well-known/**'`
  (protect from deletion) rather than `--exclude`, because an exclude also
  blocks the transfer and `/.well-known/security.txt` (RFC 9116, from
  `public/.well-known/`) would then never reach the document root. `.git/` and
  `cgi-bin/` are excluded too.

`.git/` matters twice. The deny-list at the foot of `.htaccess` matches
filenames, so it stops `/.git` but not `/.git/config` — `config` has no leading
dot. Verified against Apache 2.4.66: with a `.git/` in the document root and no
path rule, `GET /.git/config` returned **200 and the file's contents**. A
`RewriteRule (^|/)\.git(/|$) - [F,L]` now sits in the rewrite block and the
same request returns 403.

**Still an owner action.** The repository already has the config; someone with
cPanel access has to click **Git Version Control → Pull or Deploy → Update from
Remote**, then **Deploy HEAD Commit**.

### The CSP pins hashes, and they move

`script-src` allows exactly four `sha256-` hashes: the JSON-LD block, the
mobile-menu script, the FHIR callback script and the beta form's fill-time
script. The early-access and contact form scripts share a module, so they ship
as files under `/_astro/`, which `'self'` covers. Edit any of those and the
browser silently refuses to run it — the menu stops opening, the form starts
reloading the page. `npm run test:smoke` recomputes the hashes from the build
and fails in both directions: a script the policy does not allow, and a hash
the policy allows that nothing matches.

Setting `PUBLIC_WAITLIST_ENDPOINT` also needs that origin added to
`connect-src`, or the browser blocks the POST.

## Content accuracy rules

This is a health company's website, so the following are enforced by
convention and must survive future edits:

- **Status is never inflated.** `programs.ts` marks exactly one area as
  `building`, because exactly one has code. Promote an area only when there is
  something to point at.
- **No efficacy, certification or partnership claims.** None is evidenced in
  this repository, so none appears on the site.
- **No fake availability.** No app-store badges or download links until there
  is something to download.
- **Safety routing is always present.** The footer carries the emergency number
  and the quitline numbers on every page.
- **Every product claim traces to the app.** Feature copy is drawn from the
  approved screens, not invented.

## Before launch

These are outstanding and are **not** handled by this repository:

- [ ] Provision `support@tetherhealthgroup.com` so it receives mail.
- [ ] Have `privacy.astro`, `terms.astro` and `security.astro` reviewed by a
      lawyer. They are written to be accurate about what the site does, but they
      have not had legal review.
- [ ] Get a certificate issued for the domain (cPanel → SSL/TLS Status → Run
      AutoSSL). Until then `https://` fails in every browser — see above.
- [ ] Confirm the privacy notice's statement about server access logs matches
      what HostGator actually keeps.
- [x] Security headers at the edge — `project/public/.htaccess`, verified
      against Apache 2.4.
- [ ] Commission an independent accessibility audit, as `/accessibility/`
      states has not yet happened.
- [ ] Replace `TetherLogo.astro` if and when a corporate mark is approved — the
      current mark is site-original, not from an approved identity.

## Governance

The repository root carries the standard project scaffold — `CLAUDE.md`,
`AGENTS.md`, `VERIFY.md`, `TESTING.md`, `SECURITY.md`, `TASKS.md` and `.ai/`.
`VERIFY.md` is authoritative for what "done" means here.
