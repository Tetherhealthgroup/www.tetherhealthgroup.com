<?php

declare(strict_types=1);

/*
 * Contact form handler. The form on /contact/ POSTs here as an ordinary HTML
 * form, so it works with JavaScript off. Every outcome is a 303 redirect:
 *
 *   /contact/thanks/              sent to the team for the chosen topic
 *   /contact/#error-fields        a field is missing or not valid
 *   /contact/#error-retry         submitted faster than a person fills the form
 *   /contact/#error-rate          too many attempts from one address
 *   /contact/#error-unavailable   no config, no route for the topic, or mail failed
 *
 * The topic decides the mailbox through 'contact_routes' in the private config
 * (see beta-lib.inc and docs/beta-config.example.php); no address is in the
 * page or this file. One plain-text email goes to that mailbox: fixed From,
 * no Reply-To, a fixed subject naming only the topic, and the visitor's
 * details in the body. Nothing is stored and nothing is sent to the visitor.
 *
 * Single-line fields reject CR, LF and every other control character. The
 * message may contain line breaks (it is body text only, never a header);
 * any other control character is rejected.
 */

require __DIR__ . '/beta-lib.inc';

beta_headers();

$config = beta_load_config();
if ($config !== null && !beta_cleanup($config)) {
    error_log('contact: cleanup could not process the waitlist file');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    beta_page(405, 'Use the contact form', 'This address only accepts the contact form.');
}

/** Redirect back to the contact page with an error fragment. */
function contact_fail(string $code): void
{
    beta_redirect('/contact/#error-' . $code);
}

if ($config === null) {
    error_log('contact: configuration missing or invalid');
    contact_fail('unavailable');
}

$rate = beta_rate_limit($config, 'tether-contact');
if ($rate === null) {
    error_log('contact: rate-limit storage unavailable');
    contact_fail('unavailable');
}
if ($rate === false) {
    contact_fail('rate');
}

// Honeypot: shown the normal thank-you page, nothing is sent.
$honeypot = $_POST['contact_ref'] ?? '';
if (!is_string($honeypot) || trim($honeypot) !== '') {
    beta_redirect('/contact/thanks/');
}

// Minimum fill time, for submissions that carry the page script's value.
$fill = beta_field($_POST, 'fill_ms');
if ($fill === null || ($fill !== '' && (!ctype_digit($fill) || (int) $fill < BETA_MIN_FILL_MS))) {
    contact_fail('retry');
}

$topic = beta_field($_POST, 'topic');
$firstName = beta_field($_POST, 'first_name');
$email = beta_field($_POST, 'email');
$organisation = beta_field($_POST, 'organisation');

// The message keeps its line breaks; every other control character fails.
$rawMessage = $_POST['message'] ?? '';
$message = null;
if (is_string($rawMessage) && preg_match('//u', $rawMessage) === 1) {
    $normalised = str_replace(["\r\n", "\r"], "\n", $rawMessage);
    if (preg_match('/[\x00-\x09\x0B-\x1F\x7F]/', $normalised) !== 1) {
        $message = trim($normalised);
    }
}

$valid = $topic !== null && array_key_exists($topic, BETA_CONTACT_TOPICS)
    && $firstName !== null && $firstName !== '' && strlen($firstName) <= BETA_MAX_FIRST_NAME
    && $email !== null && beta_is_email($email)
    && $organisation !== null && strlen($organisation) <= BETA_MAX_ORGANISATION
    && $message !== null && $message !== ''
    && preg_match_all('/./su', $message) <= BETA_MAX_MESSAGE_CHARS;
if (!$valid) {
    contact_fail('fields');
}

$to = $config['contact_routes'][$topic] ?? null;
if ($to === null) {
    error_log('contact: no route configured for one topic');
    contact_fail('unavailable');
}

$label = BETA_CONTACT_TOPICS[$topic];
$body = implode("\n", [
    'Website contact form · ' . $label,
    '',
    'First name: ' . $firstName,
    'Email: ' . $email,
    'Organisation: ' . ($organisation === '' ? '(not given)' : $organisation),
    'Sent (UTC): ' . beta_utc(time()),
    '',
    'Message:',
    $message,
    '',
    'Reply by writing to the email address above.',
]);

if (!beta_mail($to, beta_header_text('[Contact · ' . $label . ']'), $body, $config['from'])) {
    error_log('contact: sending failed for 1 message');
    contact_fail('unavailable');
}

beta_redirect('/contact/thanks/');
