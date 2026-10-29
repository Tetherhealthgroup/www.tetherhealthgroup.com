<?php

declare(strict_types=1);

/*
 * One-time import of the beta waitlist CSV into Supabase (P-116).
 *
 * Run by the owner on the server, from a cPanel terminal, after Supabase is
 * configured in the private beta-config.php:
 *
 *     php import-waitlist-csv.php            dry run: counts only, nothing sent
 *     php import-waitlist-csv.php --apply    sign up each pending row
 *
 * Options:
 *     --lib=<path>   the deployed beta-lib.inc (default below)
 *
 * What it does with each row of the CSV:
 *   - pending and not expired: calls beta_waitlist_signup. When Supabase
 *     answers "sent", the person is emailed a new confirmation link, because
 *     the old link's token lives only in the CSV. Their old link keeps working
 *     through the file fallback until it expires.
 *   - confirmed: left in the CSV. Supabase can only confirm with a token, and
 *     those tokens are gone; docs/beta-waitlist-runbook.md has an owner-run SQL
 *     template for adding confirmed people directly.
 *   - expired pending: skipped.
 *
 * It reads the CSV and never writes it. It prints counts only, never names,
 * addresses, tokens or keys.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$apply = in_array('--apply', $argv, true);
$lib = '/home2/safecode/public_html/tetherhealthgroup.com/api/beta-lib.inc';
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--lib=')) {
        $lib = substr($arg, 6);
    }
}
if (!is_file($lib)) {
    fwrite(STDERR, "beta-lib.inc not found; pass --lib=<path to the deployed api/beta-lib.inc>\n");
    exit(2);
}
require $lib;

$config = beta_load_config();
if ($config === null) {
    fwrite(STDERR, "The private config is missing or invalid.\n");
    exit(2);
}
if (!is_array($config['supabase'])) {
    fwrite(STDERR, "Supabase is not configured (or its keys are unusable) in the private config.\n");
    exit(2);
}

$path = $config['storage_path'];
$counts = ['pending' => 0, 'confirmed' => 0, 'expired' => 0, 'unreadable' => 0];
$candidates = [];
$handle = is_file($path) ? @fopen($path, 'rb') : false;
if ($handle !== false) {
    $header = fgetcsv($handle, 0, ',', '"', '');
    if ($header !== BETA_COLUMNS) {
        fwrite(STDERR, "The CSV header is not the expected one; nothing was imported.\n");
        exit(2);
    }
    $now = beta_utc(time());
    while (($cells = fgetcsv($handle, 0, ',', '"', '')) !== false) {
        if ($cells === [null]) {
            continue;
        }
        if (count($cells) !== count(BETA_COLUMNS)) {
            $counts['unreadable']++;
            continue;
        }
        $row = array_combine(BETA_COLUMNS, array_map('beta_csv_uncell', $cells));
        if ($row['status'] === 'confirmed') {
            $counts['confirmed']++;
        } elseif ($row['status'] === 'pending' && $row['token_expires_utc'] > $now) {
            $counts['pending']++;
            $candidates[] = $row;
        } else {
            $counts['expired']++;
        }
    }
    fclose($handle);
}

printf(
    "CSV: %d pending to import, %d confirmed (stay in the CSV), %d expired, %d unreadable.\n",
    $counts['pending'], $counts['confirmed'], $counts['expired'], $counts['unreadable']
);
if (!$apply) {
    echo "Dry run: nothing was sent. Run again with --apply to import.\n";
    exit(0);
}

$results = ['sent' => 0, 'already' => 0, 'throttled' => 0, 'invalid' => 0, 'failed' => 0, 'mail_failed' => 0];
foreach ($candidates as $row) {
    $phone = array_search($row['phone'], BETA_PHONES, true);
    $source = array_search($row['heard_from'], BETA_SOURCES, true);
    $answer = beta_supabase_call($config['supabase'], 'beta_waitlist_signup', [
        'p_first_name' => $row['first_name'],
        'p_email' => $row['email'],
        'p_phone' => $phone === false ? '' : $phone,
        'p_heard_from' => ($source === false || $source === '') ? null : $source,
        'p_age_confirmed' => $row['confirmed_18_plus'] === 'yes',
        'p_consent' => $row['consent_beta_email'] === 'yes',
    ]);
    if (!is_array($answer)) {
        $results['failed']++;
        continue;
    }
    $results[$answer['status']]++;
    if ($answer['status'] === 'sent'
        && !beta_send_confirmation($row['email'], $answer['token'], $config['from'])) {
        $results['mail_failed']++;
    }
}

printf(
    "Imported: %d sent a new link, %d already confirmed, %d throttled, %d invalid, %d failed (database unavailable), %d emails failed.\n",
    $results['sent'], $results['already'], $results['throttled'], $results['invalid'], $results['failed'], $results['mail_failed']
);
exit($results['failed'] > 0 || $results['mail_failed'] > 0 ? 1 : 0);
