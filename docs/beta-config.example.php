<?php

/*
 * Example configuration for the beta waitlist handler (api/beta-signup.php).
 *
 * Used by the beta waitlist handlers and the contact form (api/contact.php).
 *
 * Copy this file to the server OUTSIDE the web root, as
 *
 *     /home2/safecode/tether-private/beta-config.php
 *
 * that is, a folder named tether-private next to public_html, in the cPanel
 * home directory. The handler looks for it there. It is never deployed with the
 * site and is not in the repository. See docs/beta-waitlist-runbook.md.
 *
 * Without this file the form shows "not available right now" and nothing is
 * stored or sent.
 */

return [
    // The CSV file each sign-up is appended to. Must be outside public_html.
    // The folder is created if it does not exist.
    'storage_path' => '/home2/safecode/tether-private/beta-waitlist.csv',

    // Folder for the per-IP attempt counters. Must be outside public_html.
    'rate_limit_dir' => '/home2/safecode/tether-private/beta-rate-limit',

    // Who is told about each new sign-up. Role mailboxes only.
    'notify' => [
        'support@tetherhealthgroup.com',
    ],

    // The From address on both the notification and the member's confirmation.
    'from' => 'support@tetherhealthgroup.com',

    // Optional: attempts allowed per IP address per window (seconds). The
    // beta form and the contact form keep separate counters.
    'rate_limit_max' => 8,
    'rate_limit_window' => 3600,

    // Supabase (optional, P-116). With all three set, the beta waitlist is
    // stored in Supabase and this server's CSV is only the fallback. Leave
    // them out to keep the CSV alone. Use the PUBLISHABLE key only
    // (sb_publishable_...); never a secret key or the service role key.
    // The server secret is the output of `openssl rand -hex 32`; only its
    // hash goes into Supabase (see docs/beta-waitlist-runbook.md).
    'supabase_url' => 'https://YOUR-PROJECT-REF.supabase.co',
    'supabase_publishable_key' => 'sb_publishable_REPLACE_ME',
    'supabase_waitlist_secret' => 'REPLACE_WITH_OUTPUT_OF_openssl_rand_hex_32',

    // Contact form: which mailbox each topic reaches. Visitors never see these
    // addresses. A topic with no valid entry here makes the form say it is
    // unavailable instead of sending. One exception: 'app_feedback' (the
    // /feedback/ page) may be left out, and then uses the 'support' mailbox.
    // Add an 'app_feedback' line only to send app feedback somewhere else.
    'contact_routes' => [
        'support' => 'support@tetherhealthgroup.com',
        'sales_partnerships' => 'partnerships@tetherhealthgroup.com',
        'careers' => 'careers@tetherhealthgroup.com',
        'privacy' => 'privacy@tetherhealthgroup.com',
        'finance' => 'finance@tetherhealthgroup.com',
    ],
];
