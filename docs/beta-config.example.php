<?php

/*
 * Example configuration for the beta waitlist handler (api/beta-signup.php).
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

    // Optional: attempts allowed per IP address per window (seconds).
    'rate_limit_max' => 8,
    'rate_limit_window' => 3600,
];
