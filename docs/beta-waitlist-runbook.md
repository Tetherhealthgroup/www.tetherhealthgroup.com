# Beta waitlist runbook

How the beta waitlist at `/beta/` works on the HostGator cPanel account, and
what the owner does to switch it on, read it, and invite people.

## How it works

1. A visitor fills in the form on `/beta/`: first name, email, phone type
   (iPhone or Android), how they heard about us (optional), an 18+ box and an
   "Email me about the beta" box.
2. The browser POSTs it to `/api/beta-signup.php`. This works with JavaScript
   off.
3. The handler checks every field and stores the sign-up as `pending` in a
   CSV file **outside** the website, with the hash of a random single-use
   token. It emails the member only "Confirm your spot on the Tether Health
   beta waitlist" and a link to `/api/beta-confirm.php?t=…`; the email repeats
   nothing they typed. The link works once and expires in 7 days.
4. The visitor lands on `/beta/thanks/` ("Check your email"), or back on
   `/beta/` with a message (table below).
5. The link opens a page with a **Confirm my spot** button (a click is needed
   because mail scanners open links by themselves). Confirming marks the row
   `confirmed`, and **only then** is the notify list emailed. The member lands
   on `/beta/confirmed/` ("You're on the list").
6. Signing up again with the same address sends at most one confirmation
   email a day. An address that has confirmed is left alone. A pending row
   whose link has expired is deleted by the cleanup that runs at the start of
   every request to either handler.

Messages on `/beta/`:

   | Message on /beta/                          | Cause                                                          |
   | ------------------------------------------ | -------------------------------------------------------------- |
   | "Please check the form…"                   | A field was missing or invalid                                 |
   | "That was quicker than we expected…"       | Sent faster than a person fills the form in                    |
   | "We have had several attempts…"            | More than 8 attempts from one IP address in an hour            |
   | "That confirmation link has expired…"      | The link is unknown, past 7 days, or already used              |
   | "The beta waitlist is not available…"      | No config file, a bad config, or the CSV could not be written  |

The handler never stores or sends anything until the private config file
below exists.

## 1. Put the private config on the server

The config holds where the CSV goes and who is notified. It is **not** in the
repository and is **never** deployed: it lives next to `public_html`, not
inside it.

1. cPanel → **File Manager**. Click **Home** (top left). You are now in
   `/home2/safecode`, the folder that contains `public_html`.
2. **+ Folder** → name it `tether-private`. Select it → **Permissions** →
   `0700`.
3. Open `tether-private` → **+ File** → `beta-config.php`. Right-click →
   **Edit**, paste the contents below, **Save Changes**. Permissions → `0600`.

```php
<?php
return [
    'storage_path' => '/home2/safecode/tether-private/beta-waitlist.csv',
    'rate_limit_dir' => '/home2/safecode/tether-private/beta-rate-limit',
    'notify' => [
        'support@tetherhealthgroup.com',
    ],
    'from' => 'support@tetherhealthgroup.com',
    'rate_limit_max' => 8,
    'rate_limit_window' => 3600,
    'contact_routes' => [
        'support' => 'support@tetherhealthgroup.com',
        'sales_partnerships' => 'partnerships@tetherhealthgroup.com',
        'careers' => 'careers@tetherhealthgroup.com',
        'privacy' => 'privacy@tetherhealthgroup.com',
        'finance' => 'finance@tetherhealthgroup.com',
    ],
];
```

The same file, with comments, is `docs/beta-config.example.php`.

- The handler, at `public_html/tetherhealthgroup.com/api/beta-signup.php`,
  looks for `<the folder that contains public_html>/tether-private/beta-config.php`.
  Do not rename the folder.
- It refuses any `storage_path` or `rate_limit_dir` inside `public_html`, so
  a typo cannot publish the list.
- Use role mailboxes only in `notify` and `from`.

**Check PHP is running for the site** before anyone uses the form: open
`https://www.tetherhealthgroup.com/api/beta-signup.php` in a browser. You
should see "Use the form to join the beta". If you see PHP source code or the
browser downloads a file, PHP is not handling `.php` for this domain: fix it
in cPanel → **MultiPHP Manager** (PHP 8.0 or later) before going further.

Note on MultiPHP: when a PHP version is set per domain, cPanel writes a
handler block into that domain's `.htaccess`. Each deploy replaces
`.htaccess` with the site's own copy, so a per-domain setting is removed and
the server default PHP is used. After each deploy, repeat the check above.

**Send one test sign-up** with a mailbox you control. Check that the
confirmation email arrived (and that `support@` got nothing yet) and that a
`pending` row appeared in the CSV. Open the link, press **Confirm my spot**,
and check that the row is now `confirmed` and the notification reached
`support@`. Then delete the test row.

## 2. Read the waitlist

cPanel → File Manager → Home → `tether-private` → `beta-waitlist.csv` →
**Download**. Open it in a spreadsheet.

| Column               | Contents                                   |
| -------------------- | ------------------------------------------ |
| `submitted_at_utc`   | When it was sent, UTC                      |
| `first_name`         | As typed, up to 80 characters              |
| `email`              | Validated address                          |
| `phone`              | `iPhone` or `Android`                      |
| `heard_from`         | One of the form's options, or `(not given)` |
| `confirmed_18_plus`  | Always `yes`                               |
| `consent_beta_email` | Always `yes`                               |
| `status`             | `pending` until the link is used, then `confirmed` |
| `confirmed_at_utc`   | When they confirmed, UTC                   |
| `token_hash`, `token_expires_utc`, `last_sent_utc` | Used by the handlers; ignore |

A cell that would start with `=`, `+`, `-` or `@` is stored with a leading
`'` so a spreadsheet opens it as text, not a formula.

When Supabase is configured (section 7), the list lives there and this CSV
holds only sign-ups made while Supabase was unreachable. Check both.

**Invite only rows whose `status` is `confirmed`.** A `pending` row has not
proved the address is theirs; it is deleted automatically if not confirmed
within 7 days.

Handling the file:

- Keep it in `tether-private`. Do not move it into `public_html`, attach it
  to email, or commit it anywhere.
- **Unsubscribe** (a member replies "unsubscribe"): delete their row
  (File Manager → right-click → **Edit**), and stop emailing them.
- **Deletion request** to `privacy@tetherhealthgroup.com`: delete their row,
  remove them from TestFlight / Firebase / Play testers if invited, and reply.
- **After the beta**: delete `beta-waitlist.csv` and the `beta-rate-limit`
  folder. The privacy notice promises this.

The `beta-rate-limit` folder holds one small file per recent IP address
(named by a hash, holding attempt times). A file is removed by the first
request to either handler more than a day after its last attempt; with no
traffic, nothing runs, so files can stay longer. Nothing in it needs reading.

**Access logs and the confirmation token.** The confirmation page sends the
token back by POST, but the link in the email is a GET, so the token appears
in the host's Apache access log for `/api/beta-confirm.php?t=…`. This is
accepted: on this account those logs are readable only by the cPanel owner,
the token works once, and it expires in 7 days. Do not share raw access logs
outside the account owner.

**Client address.** The rate limit uses `REMOTE_ADDR`, which on this
HostGator account is the visitor's own address because nothing (no CDN or
proxy) sits in front of the site. If Cloudflare or another proxy is ever put
in front, `REMOTE_ADDR` becomes the proxy's address and every visitor shares
one limit: the IP source in `api/beta-lib.inc` must then change to the
proxy's trusted header (for Cloudflare, `CF-Connecting-IP`, accepted only
from Cloudflare's address ranges). Never trust `X-Forwarded-For` from the
open internet.

## 3. Make the emails deliverable (SPF and DKIM)

PHP `mail()` sends from the HostGator server. Without SPF and DKIM for
`tetherhealthgroup.com`, receiving providers are likely to mark it as spam.

1. cPanel → **Email** → **Email Deliverability**.
2. Find `tetherhealthgroup.com`. If it shows a problem with **DKIM** or
   **SPF**, click **Repair** (or **Manage** and install the suggested
   records).
3. The domain uses HostGator's nameservers (`hgns1/hgns2.hostgator.com`), so
   Repair can write the DNS records itself. If DNS ever moves elsewhere, copy
   the suggested TXT records to the new DNS host instead.
4. Wait for DNS to update, reload the page, and confirm both show valid.
5. Send a test sign-up to a personal Gmail or Outlook address you own, open
   the message → **Show original** (Gmail) and check `SPF: PASS` and
   `DKIM: PASS`.

`support@tetherhealthgroup.com` must exist as a mailbox or forwarder, since it
is both the `From` and the reply address members write back to.

## 4. Invite people

Take addresses from the CSV rows with `status` `confirmed`, oldest first, by
`phone` column. Inviting shares
the member's name and email with Apple or Google, which the privacy notice
discloses.

### iPhone: TestFlight

App Store Connect → **Apps** → Tether Health → **TestFlight**.

- **Internal testing** — for people on the App Store Connect team (Users and
  Access). Add them to an internal group; no review is needed. Apple limits
  this to 100 people at the time of writing.
- **External testing** — for waitlist members. Create a group (for example
  "Beta waitlist"), add a build, and submit it for **Beta App Review**. Once
  approved, either add testers by email from the CSV, or turn on a **Public
  Link** for the group and email that link to the people you choose.

Testers get the invite by email and open it in Apple's TestFlight app.

### Android: Firebase App Distribution or Play internal testing

Either route works; use one consistently.

- **Firebase App Distribution** — Firebase console → the Tether Health
  project → **App Distribution** → **Testers & Groups** → group **Internal**
  → **Add testers** (emails from the CSV). Distribute a build to the group;
  each tester gets an email invite.
- **Play internal testing** — Play Console → the app → **Testing** →
  **Internal testing** → **Testers** → add an email list. Share the opt-in
  link with those testers. Google limits internal testing to 100 testers at
  the time of writing.

## 5. Deploy, then check

From the source branch, after the changes are merged:

```bash
npm run build
npm run deploy
```

Then cPanel → **Git Version Control** → Manage → **Pull or Deploy** →
**Deploy HEAD Commit**. Check:

```bash
curl -sI https://www.tetherhealthgroup.com/.well-known/assetlinks.json   # 200, application/json
curl -sI https://www.tetherhealthgroup.com/app-ads.txt                   # 200, text/plain
curl -sI https://www.tetherhealthgroup.com/api/beta-signup.php           # 405
curl -sI https://www.tetherhealthgroup.com/api/beta-lib.inc              # 403
curl -sI https://www.tetherhealthgroup.com/beta/                          # 200
```

## 6. Contact form routing

`/contact/` has one form with a required topic: Support, App feedback,
Sales & partnerships, Careers, Privacy or Finance. It POSTs to
`/api/contact.php`, which sends **one** plain-text email to the mailbox for
that topic and redirects to `/contact/thanks/`. The mailboxes are set only in
the private config; the page never shows them.

`/feedback/` is the same form with App feedback preselected; it is the
address to give App Store Connect and TestFlight as the feedback URL. Its
errors come back to `/feedback/` rather than `/contact/`. **App feedback
needs no config change:** when `contact_routes` has no `app_feedback` entry
it goes to the `support` mailbox, with the subject `[Contact · App
feedback]`. To send it elsewhere, add an `'app_feedback' => '…'` line to
`contact_routes`; an entry that is present but not a valid address makes the
form say it is unavailable rather than falling back.

- From: the config's `from`. No Reply-To: reply to the visitor's address,
  which is in the body.
- Subject: `[Contact · <Topic>]`, nothing the visitor typed.
- The visitor is not emailed (an automatic copy would repeat what they typed
  to any address they enter).
- For App feedback and Support only, after the email is sent, the message
  text is queued for the team's private issue tracker: one JSON line (random
  id, topic, time, message; never the name, email address or organisation)
  in `feedback-queue.jsonl`, in the same `tether-private` folder as the
  config. Entries older than 14 days are dropped on the next request to any
  form, and the file is replaced through a temporary file and a rename under
  `feedback-queue.jsonl.lock`, so a failed write never empties it. The office
  collects the file every 30 minutes and files each entry as a GitHub issue
  in the private app repository, with email addresses and phone numbers
  removed. If the queue cannot be written, the error log says `contact:
  feedback queue unavailable for 1 message` and the visitor still sees the
  thank-you page. Apart from that queue, only the per-IP rate-limit record
  is stored. The office collector only reads the file; it never edits it.
- Same guards as the beta form: POST only, length caps (message up to 2,000
  characters), control characters refused, honeypot, minimum fill time, and a
  per-IP limit with its own counter in `beta-rate-limit`.
- If the config is missing, or the chosen topic has no valid route (for App
  feedback: an invalid entry of its own, or no entry and no support route), the form
  says "Sorry, the form is unavailable; email support@tetherhealthgroup.com"
  and sends nothing.

**Add this to the server config** (cPanel → File Manager → Home →
`tether-private` → `beta-config.php` → Edit), inside the `return [ … ];`,
for example after `'rate_limit_window' => 3600,`:

```php
    'contact_routes' => [
        'support' => 'support@tetherhealthgroup.com',
        'sales_partnerships' => 'partnerships@tetherhealthgroup.com',
        'careers' => 'careers@tetherhealthgroup.com',
        'privacy' => 'privacy@tetherhealthgroup.com',
        'finance' => 'finance@tetherhealthgroup.com',
    ],
```

**Test it** after deploying: send one message per topic from `/contact/`
using a mailbox you control as the visitor email, and check each arrives at
its team mailbox with the subject `[Contact · <Topic>]` and no Reply-To.
Send one more from `/feedback/` and check it arrives at the support mailbox
(or the `app_feedback` one, if you added it).
`curl -sI https://www.tetherhealthgroup.com/api/contact.php` should answer
405.

## 7. Supabase as the source of truth (P-116)

With three keys in the private config, sign-ups are stored in Supabase
(`marketing.beta_waitlist`) and this server's CSV becomes the fallback: if
Supabase is unreachable, answers "forbidden" or fails, the sign-up goes to the
CSV instead and is never lost. The page always says "Check your email", so it
never reveals whether an address is already on the list. Without the keys,
everything works from the CSV exactly as before. The database side (the
migration and its four functions) is set up from the app repository's
`docs/WAITLIST.md`.

1. **Generate the server secret** on your own computer:

   ```sh
   openssl rand -hex 32
   ```

2. **Store only its hash in Supabase.** In the Supabase SQL editor, run this
   one statement with your secret in place of `<secret>` (keep the quotes):

   ```sql
   insert into marketing.config(server_secret_hash) values (encode(extensions.digest('<secret>','sha256'),'hex'))
   on conflict (id) do update set server_secret_hash = excluded.server_secret_hash, updated_at = now();
   ```

   Then **delete that query from the SQL editor history** (and from any saved
   snippet): it contains the secret. The database keeps only the hash.

3. **Find the publishable key:** Supabase → Project Settings → API Keys →
   the **publishable** key (`sb_publishable_…`). Use that one only. Never the
   secret key (`sb_secret_…`) or the service role key; the website refuses
   them and falls back to the CSV.

4. **Add these three lines** to `beta-config.php` (cPanel → File Manager →
   Home → `tether-private`), inside `return [ … ];`:

   ```php
       'supabase_url' => 'https://<your-project-ref>.supabase.co',
       'supabase_publishable_key' => '<the sb_publishable_ key>',
       'supabase_waitlist_secret' => '<the openssl rand -hex 32 output>',
   ```

5. **Test:** sign up on `/beta/` with a mailbox you control. In Supabase,
   Table Editor → schema `marketing` → `beta_waitlist` shows the row as
   `pending`; nothing new is in the CSV. Open the email link, press **Confirm
   my spot**: the row becomes `confirmed` and `support@` gets the
   notification. Delete the test row:

   ```sql
   delete from marketing.beta_waitlist where email = lower(btrim('<your test address>')) returning email;
   ```

**If Supabase fails,** the PHP error log (cPanel → Metrics → Errors, or a file named `error_log` in the `api` folder, which the site refuses to serve) gets one
line per request such as `beta-signup: waitlist database unavailable
(forbidden); using the file fallback`. It never contains names, addresses,
tokens or keys. `(forbidden)` usually means the secret in `beta-config.php`
does not match the hash in Supabase; `(config)` means one of the three keys
is missing or not in the expected form. Links from fallback sign-ups keep
working: the confirm page checks Supabase first and then the CSV.

**Cleanup.** Expired pending sign-ups are deleted in Supabase whenever
someone confirms; `docs/WAITLIST.md` also shows a daily `pg_cron` job.

### Moving the existing CSV into Supabase

`scripts/import-waitlist-csv.php` is a one-time import, run by you on the
server. Upload it to `tether-private`, then in cPanel → Terminal:

```sh
php ~/tether-private/import-waitlist-csv.php           # dry run: counts only
php ~/tether-private/import-waitlist-csv.php --apply   # import
```

It reads the CSV and never changes it, and prints counts only. Each pending,
unexpired row is signed up in Supabase and emailed a **new** confirmation
link (the old link's token exists only in the CSV, where it keeps working
until it expires). **Confirmed rows stay in the CSV**: Supabase confirms only
with a token. To add a confirmed person directly, run this in the SQL editor,
one row at a time, from the CSV values (`phone` is `iphone` or `android`;
`heard_from` is `search`, `social`, `friend`, `clinician`, `event`, `other`,
or `null`):

```sql
insert into marketing.beta_waitlist
  (first_name, email, phone, heard_from, consent_at, age_confirmed, status, created_at, confirmed_at, last_sent_at)
values
  ('<first_name>', lower(btrim('<email>')), '<iphone|android>', null,
   '<submitted_at_utc>', true, 'confirmed', '<submitted_at_utc>', '<confirmed_at_utc>', '<last_sent_utc>')
on conflict (email) do nothing;
```

