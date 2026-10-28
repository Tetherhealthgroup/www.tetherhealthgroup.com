<?php

declare(strict_types=1);

/*
 * Beta waitlist confirmation: the link in the confirmation email.
 *
 * GET shows a one-button page that POSTs the token back. Confirming takes a
 * deliberate click because mail scanners fetch links on their own, and a GET
 * that confirmed would let a scanner sign someone up. POST marks the pending
 * row "confirmed", clears its token (so the link works once), and only then
 * notifies the team.
 *
 *   /beta/confirmed/        confirmed
 *   /beta/#error-link       unknown, expired or already used link
 *   /beta/#error-rate       too many attempts from one address
 *   /beta/#error-unavailable no configuration, or storage failed
 */

require __DIR__ . '/beta-lib.inc';

beta_headers();

$config = beta_load_config();
if ($config !== null && !beta_cleanup($config)) {
    error_log('beta-confirm: cleanup could not process the waitlist file');
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    beta_page(405, 'Use the link in your email', 'This address only accepts the beta waitlist confirmation link.');
}
if ($config === null) {
    error_log('beta-confirm: configuration missing or invalid');
    beta_fail('unavailable');
}

$token = beta_field($method === 'POST' ? $_POST : $_GET, 't');
if ($token === null || preg_match('/^[0-9a-f]{64}$/', $token) !== 1) {
    beta_fail('link');
}
$hash = hash('sha256', $token);
$now = beta_utc(time());

/** True when a row is pending with this token and the token has not expired. */
$matches = static function (array $row) use ($hash, $now): bool {
    return $row['status'] === 'pending'
        && $row['token_hash'] !== ''
        && hash_equals($row['token_hash'], $hash)
        && $row['token_expires_utc'] > $now;
};

if ($method === 'GET') {
    $found = beta_with_rows($config['storage_path'], static function (array $rows) use ($matches): array {
        foreach ($rows as $row) {
            if ($matches($row)) {
                return [$rows, 'found'];
            }
        }
        return [$rows, 'missing'];
    });
    if ($found === false) {
        beta_fail('unavailable');
    }
    if ($found !== 'found') {
        beta_fail('link');
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="robots" content="noindex">',
        '<title>Confirm your spot on the Tether Health beta waitlist</title></head>',
        '<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1.25rem;color:#0f3d3e">',
        '<h1>Confirm your spot on the Tether Health beta waitlist</h1>',
        '<form method="post" action="/api/beta-confirm.php">',
        '<input type="hidden" name="t" value="', beta_html($token), '">',
        '<button type="submit">Confirm my spot</button>',
        '</form>',
        '</body></html>';
    exit;
}

$rate = beta_rate_limit($config);
if ($rate === null) {
    error_log('beta-confirm: rate-limit storage unavailable');
    beta_fail('unavailable');
}
if ($rate === false) {
    beta_fail('rate');
}

$confirmed = beta_with_rows($config['storage_path'], static function (array $rows) use ($matches, $now): array {
    foreach ($rows as $i => $row) {
        if ($matches($row)) {
            $row['status'] = 'confirmed';
            $row['confirmed_at_utc'] = $now;
            $row['token_hash'] = '';
            $row['token_expires_utc'] = '';
            $rows[$i] = $row;
            return [$rows, $row];
        }
    }
    return [$rows, null];
});
if ($confirmed === false) {
    error_log('beta-confirm: could not update the waitlist file');
    beta_fail('unavailable');
}
if ($confirmed === null) {
    beta_fail('link');
}

$body = implode("\n", [
    'A beta waitlist sign-up was confirmed.',
    '',
    'First name: ' . $confirmed['first_name'],
    'Email: ' . $confirmed['email'],
    'Phone: ' . $confirmed['phone'],
    'Heard about us from: ' . $confirmed['heard_from'],
    'Confirmed 18 or over: yes',
    'Asked for beta email: yes',
    'Signed up (UTC): ' . $confirmed['submitted_at_utc'],
    'Confirmed (UTC): ' . $confirmed['confirmed_at_utc'],
    '',
    'Stored in the private waitlist file.',
]);
$failed = 0;
$subject = in_array($confirmed['phone'], BETA_PHONES, true)
    ? 'Beta waitlist sign-up confirmed (' . $confirmed['phone'] . ')'
    : 'Beta waitlist sign-up confirmed';
foreach ($config['notify'] as $address) {
    if (!beta_mail($address, $subject, $body, $config['from'])) {
        $failed++;
    }
}
if ($failed > 0) {
    error_log('beta-confirm: mail() failed for ' . $failed . ' message(s)');
}

beta_redirect('/beta/confirmed/');
