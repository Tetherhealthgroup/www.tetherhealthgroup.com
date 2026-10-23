# Legal text drafts for counsel review

Every legal text change listed here is a **draft for counsel review**. None of it
is final legal text. Each changed page also carries a visible HTML comment that
starts with `Draft for counsel review`, and the two app pages show a visible
"Draft for review by Tether Health LLC and its counsel" notice.

The drafts describe the multi-program Tether Health app (11 programs, one of
which is BreatheFree) as its design and code stood on 2026-10-22. Where the
design describes something the code does not yet do, the page says "To be
confirmed" instead of promising it.

## Pages changed

| Page | Source | What changed |
|---|---|---|
| `/app-privacy/` | `project/src/pages/app-privacy.astro` | Rewritten for the multi-program app: data per program, health-record import, sign-in with email, Apple and Google, sharing (supporters, buddy, caregiver, care team, quitline call-back), reminders, permissions, export, deletion, processors, age 18+. Now built and reachable, still `noindex` and out of the sitemap. |
| `/delete-account/` | `project/src/pages/delete-account.astro` | Rewritten for the app's Account > "Your data" > "Delete account and all data" flow, with a short path for versions that show "Settings & privacy", deleting one program's data, an email route that does not need the app, and what is deleted and kept. Now built and reachable, still `noindex` and out of the sitemap. |
| `/privacy/` | `project/src/pages/privacy.astro` | Scope note no longer says BreatheFree is the product; new first section sends app users to `/app-privacy/` and `/delete-account/`. The website sections are unchanged. Last-updated date moved to 2026-10-22. |
| `/terms/` | `project/src/pages/terms.astro` | Scope note no longer says BreatheFree is the product; new section says the app is not covered and that the app's terms are to be confirmed. Last-updated date moved to 2026-10-22. |
| `/support/` | `project/src/pages/support.astro` | Not legal text, but new app FAQ repeats two policy statements ("No ads, and we never sell your health data" and the deletion path). |

Publishing either app page for real means removing `noindex`, the sitemap
filter in `project/astro.config.mjs` and the draft notice, and updating its
test file in the same change. Deploying the site as it stands makes both pages
reachable at their URLs as drafts.

## Open legal questions

1. **Effective date.** When does the app privacy policy take effect?
2. **Apple devices.** Does the policy also cover the app on Apple devices? The
   site's own claims rules keep platform names out of the pages, so the draft
   says "a version of the app for Apple devices" and leaves it open.
3. **Which page the app links.** The app links "Privacy Notice" and "Terms and
   Privacy Notice" to `/privacy/` (the website notice), and "Help & legal" to
   `/support/`. Should the app link `/app-privacy/` directly, or should the app
   policy move into `/privacy/`?
4. **App terms of use.** No app terms exist. Does the owner want its own terms,
   or the stores' standard licence terms? The app's consent screen links "Terms
   and Privacy Notice".
5. **Applicable law.** Which privacy and health-data laws apply to the app and
   which rights they give users (for example state consumer-health-data laws,
   state privacy laws, the FTC Health Breach Notification Rule, and whether any
   program's data falls under 42 CFR Part 2, which a backend service comment
   cites)? The draft lists rights generically and leaves this open.
6. **Commitments copied from the app's own copy.** "No ads. We never sell your
   health data." and "We do not share your information with third parties for
   their own use." are stated as commitments. Counsel to confirm they can be
   made without qualification.
7. **Health-record import.** The design says provider refresh tokens are kept
   encrypted on our servers and never on the phone; no code for record import
   or token storage exists yet. The draft states it as the design and marks
   the date of import and the encryption as to be confirmed. Epic and CMS Blue
   Button app registration terms may add obligations.
8. **Data each program can actually save.** Several program save routes in the
   design are not yet accepted by the server. The draft describes what each
   program collects by design and marks which programs save to an account as
   to be confirmed.
9. **ScrollFree on Android.** The design says daily totals by category are
   saved to the account; no server storage for them exists yet.
10. **Retention.** How long account data is kept if a user stops using the
    app; how long backups and logs keep copies after deletion. The app's
    deletion receipt says "Backups are purged within 30 days"; nothing in the
    code sets that, so the website does not repeat it.
11. **Deletion by email.** Who handles email requests, how identity is checked,
    and how long a request takes.
12. **Export.** The app's copy promises "Every program · PDF + JSON"; the
    server's export today returns JSON with the profile, quit plan and some
    program data only. The draft leaves the format and contents to be
    confirmed.
13. **Processors and hosting.** Supabase (sign-in, database, photo storage) and
    Render (application server) are named; only a development Render service is
    configured in the app repository. Production hosting, regions, contracts,
    the email sender and any notification service are to be confirmed.
14. **Sharing with third parties the user chooses.** Care-team summaries,
    caregiver access, and the quitline call-back (first name, phone number and
    preferred time sent to a quitline) need consent wording; the consent
    documents in the backend are unapproved placeholders.
15. **Research and diagnostics.** The app has "De-identified research" and
    "Anonymous app diagnostics" switches, off by default. What is collected, by
    whom, and how it is de-identified is not defined.
16. **Age.** The app asks users to confirm they are 18 or older; the check is in
    the app only. What happens if a child is found to have an account? The
    website notice still says it does not knowingly collect data from anyone
    under 16.
17. **Device-only data.** The Ease safety plan and guest plans are described in
    the design as encrypted on the phone. The draft attributes this to the
    design; how data is protected on the phone is to be confirmed.
18. **Marks.** The terms name the Tether Health Group and BreatheFree names and
    marks. Whether "Tether Health" (the app name) should be added is a counsel
    question; the draft does not add it.
19. **Medical-advice wording.** The support FAQ says the app does not diagnose,
    treat or prescribe and does not replace a clinician.
20. **Publishing drafts.** Both app pages are reachable at their URLs once the
    site is deployed, marked as drafts. Should they be deployed before counsel
    signs off, given that Google Play needs a working deletion URL?
