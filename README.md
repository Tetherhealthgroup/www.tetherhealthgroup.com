# www.tetherhealthgroup.com

Marketing and company website for **Tether Health LLC** (Tether Health Group).

The site presents the company, the ten health areas it intends to support, and
its first product — **BreatheFree**, a smoking-cessation application currently
in development. It carries a pre-launch ("in development") posture throughout:
there are no app-store links, and no claim is made that any product is
available.

## Stack

|                    |                                                            |
| ------------------ | ---------------------------------------------------------- |
| Framework          | Astro 7 (static output)                                    |
| Styling            | Tailwind CSS 4, via `@tailwindcss/vite`                    |
| Images             | `astro:assets` + sharp (AVIF/WebP, responsive `densities`) |
| Sitemap            | `@astrojs/sitemap`                                         |
| Fonts              | System stacks only — no webfont is downloaded              |
| JavaScript shipped | Two small inline scripts (mobile menu, waitlist form)      |

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
npm run test:smoke # asserts the built output in project/dist
npm run preview    # serve the built output
```

`test:smoke` runs against `dist/`, so run `npm run build` first. It asserts the
24 routes are emitted, the sitemap exists, every page has a title, description
and canonical URL, no page skips a heading level, every health area states its
own status, the safety routing appears on every page, and — the one that
matters most — that **no page loads a third-party resource** and no page links
to an app store while the product is pre-launch. Those two guard promises the
site makes in prose, which a later edit could otherwise break silently.

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
    data/
      site.ts          Identity, navigation, contact, quitline numbers
      programs.ts       The 10 health areas and each one's honest status
      screens.ts        The 28-screen BreatheFree catalog + artwork resolver
    components/         Logo, TetherLogo, Button, Card, Icon, Section,
                        PageHero, PhoneFrame, ProgramCard, SupportEmail,
                        WaitlistForm, Header, Footer
    layouts/
      Base.astro        Document shell, SEO, structured data, landmarks
      Legal.astro       Shell for the policy pages
    pages/              24 routes (see below)
    styles/global.css   Design tokens, base styles, motion
    assets/screens/     The 28 approved 1290x2796 PNGs
```

### Routes

`/` · `/programs/` · `/programs/<area>/` (ten, generated) · `/updates/` ·
`/breathefree/` · `/breathefree/how-it-works/` · `/breathefree/tour/` ·
`/for-clinicians/` · `/about/` · `/support/` · `/privacy/` · `/terms/` ·
`/security/` · `/accessibility/` · `404`

### Scope versus record

Two kinds of statement live on this site and they must never blur:

|                             | Where it lives                          | What it means                                      |
| --------------------------- | --------------------------------------- | -------------------------------------------------- |
| Services, upcoming projects | `/programs/<area>/`, from `programs.ts` | Intent. Nine of the ten areas have no code at all. |
| Updates                     | `/updates/`, from `updates.ts`          | Things that have actually happened.                |

`programs.ts` carries `services` and `upcoming` per area; project horizons are
`In development`, `Next` and `Later` — **no dates are published for work that
has not started**. `updates.ts` is append-only in spirit: add entries as work
lands, and do not backfill a history that was never published. A smoke case
fails the build if the updates page starts carrying "coming soon" language.

## Design system

Colours are **ported verbatim** from the BreatheFree mobile application so the
site and the app read as one product. The source of truth is
`Tether-Smoking-cessation-breath-free/lib/theme/app_colors.dart`; the values
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
- [ ] Decide hosting, then confirm the privacy notice's statement about
      server access logs matches what the host actually keeps.
- [ ] Add security headers at the edge (CSP, HSTS, `X-Content-Type-Options`,
      `Referrer-Policy`). A static host serves these; Astro does not.
- [ ] Commission an independent accessibility audit, as `/accessibility/`
      states has not yet happened.
- [ ] Replace `TetherLogo.astro` if and when a corporate mark is approved — the
      current mark is site-original, not from an approved identity.

## Governance

The repository root carries the standard project scaffold — `CLAUDE.md`,
`AGENTS.md`, `VERIFY.md`, `TESTING.md`, `SECURITY.md`, `TASKS.md` and `.ai/`.
`VERIFY.md` is authoritative for what "done" means here.
