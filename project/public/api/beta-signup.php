<?php

declare(strict_types=1);

/*
 * Beta waitlist sign-up handler.
 *
 * The form on /beta/ POSTs here as an ordinary HTML form, so it works with
 * JavaScript off. Every outcome is a 303 redirect to a static page:
 *
 *   /beta/thanks/               "check your email" (also shown when nothing
 *                               was sent, so the page reveals nothing)
 *   /beta/#error-fields         a field is missing or not valid
 *   /beta/#error-retry          submitted faster than a person fills the form
 *   /beta/#error-rate           too many attempts from one address
 *   /beta/#error-unavailable    no configuration, or storage failed
 *
 * The /beta/ page shows the matching message with CSS :target.
 *
 * Double opt-in: a sign-up is stored as "pending" with the hash of a random
 * single-use token that expires in 7 days, and the member is emailed a link
 * to beta-confirm.php. Nobody else is told until they confirm. Signing up
 * again with the same address sends at most one confirmation a day; an
 * address that has already confirmed is left as it is.
 *
 * Configuration and data live OUTSIDE the web root: see beta-lib.inc and
 * docs/beta-config.example.php. Without the config nothing is stored or sent.
 */

require __DIR__ . '/beta-lib.inc';

beta_headers();

$config = beta_load_config();
if ($config !== null && !beta_cleanup($config)) {
    error_log('beta-signup: cleanup could not process the waitlist file');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    beta_page(405, 'Use the form to join the beta', 'This address only accepts the beta waitlist form.');
}

if ($config === null) {
    error_log('beta-signup: configuration missing or invalid');
    beta_fail('unavailable');
}

$rate = beta_rate_limit($config);
if ($rate === null) {
    error_log('beta-signup: rate-limit storage unavailable');
    beta_fail('unavailable');
}
if ($rate === false) {
    beta_fail('rate');
}

// Honeypot: a field no person sees. A bot that fills it is shown the normal
// thank-you page and nothing is stored or sent.
$honeypot = $_POST['contact_ref'] ?? '';
if (!is_string($honeypot) || trim($honeypot) !== '') {
    beta_redirect('/beta/thanks/');
}

// Minimum fill time. The page script records how long the form was open;
// this check applies to submissions that carry that value, so visitors with
// JavaScript off are not affected.
$fill = beta_field($_POST, 'fill_ms');
if ($fill === null || ($fill !== '' && (!ctype_digit($fill) || (int) $fill < BETA_MIN_FILL_MS))) {
    beta_fail('retry');
}

$firstName = beta_field($_POST, 'first_name');
$email = beta_field($_POST, 'email');
$phone = beta_field($_POST, 'phone');
$source = beta_field($_POST, 'source');
$adult = beta_field($_POST, 'adult');
$consent = beta_field($_POST, 'consent');

$valid = $firstName !== null && $firstName !== '' && strlen($firstName) <= BETA_MAX_FIRST_NAME
    && $email !== null && beta_is_email($email)
    && $phone !== null && array_key_exists($phone, BETA_PHONES)
    && $source !== null && array_key_exists($source, BETA_SOURCES)
    && $adult === 'yes'
    && $consent === 'yes';
if (!$valid) {
    beta_fail('fields');
}

$now = time();
[$token, $tokenHash] = beta_new_token();
$details = [
    'submitted_at_utc' => beta_utc($now),
    'first_name' => $firstName,
    'email' => $email,
    'phone' => BETA_PHONES[$phone],
    'heard_from' => BETA_SOURCES[$source],
    'confirmed_18_plus' => 'yes',
    'consent_beta_email' => 'yes',
    'status' => 'pending',
    'confirmed_at_utc' => '',
    'token_hash' => $tokenHash,
    'token_expires_utc' => beta_utc($now + BETA_TOKEN_TTL),
    'last_sent_utc' => beta_utc($now),
];

// Decide, under the file lock, whether this address gets a confirmation now.
$send = beta_with_rows($config['storage_path'], static function (array $rows) use ($details, $now): array {
    foreach ($rows as $i => $row) {
        if (strcasecmp($row['email'], $details['email']) !== 0) {
            continue;
        }
        if ($row['status'] === 'confirmed') {
            return [$rows, 'skip'];
        }
        if ($row['last_sent_utc'] > beta_utc($now - BETA_RESEND_AFTER)) {
            return [$rows, 'skip'];
        }
        $rows[$i] = $details;
        return [$rows, 'send'];
    }
    $rows[] = $details;
    return [$rows, 'send'];
});
if ($send === false) {
    error_log('beta-signup: could not update the waitlist file');
    beta_fail('unavailable');
}
if ($send === 'skip') {
    beta_redirect('/beta/thanks/');
}

if (!beta_send_confirmation($email, $token, $config['from'])) {
    error_log('beta-signup: mail() failed for 1 confirmation message');
}

beta_redirect('/beta/thanks/');
