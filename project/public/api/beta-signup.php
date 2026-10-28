<?php

declare(strict_types=1);

/*
 * Beta waitlist sign-up handler: the only server-side code on this site.
 *
 * The form on /beta/ POSTs here as an ordinary HTML form, so it works with
 * JavaScript off. Every outcome is a 303 redirect to a static page:
 *
 *   /beta/thanks/               stored, notified and confirmed
 *   /beta/#error-fields         a field is missing or not valid
 *   /beta/#error-retry          submitted faster than a person fills the form
 *   /beta/#error-rate           too many attempts from one address
 *   /beta/#error-unavailable    no configuration, or storage failed
 *
 * The /beta/ page shows the matching message with CSS :target, so the error is
 * visible without a script.
 *
 * Configuration and data live OUTSIDE the web root. The config file is
 * <home>/tether-private/beta-config.php, where <home> is the directory that
 * contains public_html (on this host, /home2/safecode). It is not in the
 * repository; docs/beta-config.example.php shows its keys. Without it the
 * handler stores nothing and sends nothing.
 *
 * Compatible with PHP 8.0 and later. No external libraries.
 */

const BETA_MIN_FILL_MS = 3000;

/** Byte caps per free-text field. */
const BETA_MAX_FIRST_NAME = 80;
const BETA_MAX_EMAIL = 254;

/** Allowed values for the two selects: submitted value => stored label. */
const BETA_PHONES = [
    'iphone' => 'iPhone',
    'android' => 'Android',
];
const BETA_SOURCES = [
    '' => '(not given)',
    'search' => 'Search engine',
    'social' => 'Social media',
    'friend' => 'Friend or family',
    'clinician' => 'Clinician or care team',
    'event' => 'Event or talk',
    'other' => 'Other',
];

/** Escape for HTML text and attribute contexts. */
function beta_html(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Send the visitor to a static page and stop. */
function beta_redirect(string $path): void
{
    header('Location: ' . $path, true, 303);
    exit;
}

function beta_fail(string $code): void
{
    beta_redirect('/beta/#error-' . $code);
}

/** A minimal page for responses that cannot be a redirect. All text is escaped. */
function beta_page(int $status, string $title, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<meta name="robots" content="noindex">',
        '<title>', beta_html($title), '</title></head><body>',
        '<h1>', beta_html($title), '</h1>',
        '<p>', beta_html($message), '</p>',
        '<p><a href="/beta/">Go to the beta waitlist</a></p>',
        '</body></html>';
    exit;
}

/** Where the private config lives: the env override, else <home>/tether-private. */
function beta_config_path(): ?string
{
    $override = getenv('TETHER_BETA_CONFIG');
    if (is_string($override) && $override !== '') {
        return $override;
    }
    $home = preg_replace('#/public_html(?:/.*)?$#', '', __DIR__, 1, $count);
    if ($count !== 1 || !is_string($home) || $home === '') {
        return null;
    }
    return $home . '/tether-private/beta-config.php';
}

/**
 * True when $path is absolute and outside the web root: no public_html segment
 * and not under the document root. Checked on the configured paths, so a
 * mistaken config cannot publish the list.
 */
function beta_outside_web_root(string $path): bool
{
    if ($path === '' || $path[0] !== '/' || str_contains($path, "\0")) {
        return false;
    }
    if (preg_match('#(^|/)public_html(/|$)#', $path) === 1) {
        return false;
    }
    $docroot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($docroot === false || $docroot === '') {
        return true;
    }
    $existing = $path;
    while (!file_exists($existing) && $existing !== '/' && $existing !== '.') {
        $existing = dirname($existing);
    }
    $resolved = realpath($existing);
    if ($resolved === false) {
        return false;
    }
    return $resolved !== $docroot && !str_starts_with($resolved . '/', $docroot . '/');
}

function beta_is_email(mixed $value): bool
{
    return is_string($value)
        && strlen($value) <= BETA_MAX_EMAIL
        && preg_match('/[\r\n]/', $value) !== 1
        && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

/** The config, validated, or null when it is missing or unusable. */
function beta_load_config(): ?array
{
    $path = beta_config_path();
    if ($path === null || !is_file($path) || !is_readable($path)) {
        return null;
    }
    $config = include $path;
    if (!is_array($config)) {
        return null;
    }
    $storage = $config['storage_path'] ?? null;
    $rateDir = $config['rate_limit_dir'] ?? null;
    $notify = $config['notify'] ?? null;
    $from = $config['from'] ?? null;
    if (!is_string($storage) || !beta_outside_web_root($storage)) {
        return null;
    }
    if (!is_string($rateDir) || !beta_outside_web_root($rateDir)) {
        return null;
    }
    if (!is_array($notify) || $notify === [] || !beta_is_email($from)) {
        return null;
    }
    foreach ($notify as $address) {
        if (!beta_is_email($address)) {
            return null;
        }
    }
    $max = $config['rate_limit_max'] ?? 8;
    $window = $config['rate_limit_window'] ?? 3600;
    if (!is_int($max) || $max < 1 || !is_int($window) || $window < 1) {
        return null;
    }
    return [
        'storage_path' => $storage,
        'rate_limit_dir' => $rateDir,
        'notify' => array_values($notify),
        'from' => $from,
        'rate_limit_max' => $max,
        'rate_limit_window' => $window,
    ];
}

/**
 * Per-IP attempt counter in files outside the web root. The file name is a
 * hash of the client address; it holds the timestamps of recent attempts and
 * is removed a day after its last attempt.
 *
 * Returns true when this attempt is allowed, false when over the limit, and
 * null when the counter cannot be kept (the caller fails closed).
 */
function beta_rate_limit(array $config): ?bool
{
    $dir = $config['rate_limit_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return null;
    }
    $now = time();

    foreach (glob($dir . '/*.rate') ?: [] as $stale) {
        $mtime = @filemtime($stale);
        if ($mtime !== false && $mtime < $now - 86400) {
            @unlink($stale);
        }
    }

    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $file = $dir . '/' . hash('sha256', 'tether-beta|' . $ip) . '.rate';
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return null;
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            return null;
        }
        $raw = stream_get_contents($handle);
        $since = $now - $config['rate_limit_window'];
        $recent = [];
        foreach (explode("\n", is_string($raw) ? $raw : '') as $line) {
            if (ctype_digit($line) && (int) $line > $since) {
                $recent[] = (int) $line;
            }
        }
        $allowed = count($recent) < $config['rate_limit_max'];
        if ($allowed) {
            $recent[] = $now;
        }
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, implode("\n", $recent));
        fflush($handle);
        flock($handle, LOCK_UN);
        return $allowed;
    } finally {
        fclose($handle);
    }
}

/**
 * One submitted field as a trimmed string. Arrays, invalid UTF-8, CR or LF
 * (header injection) and other control characters are all rejected as null.
 */
function beta_field(string $name): ?string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value)) {
        return null;
    }
    if (preg_match('/[\r\n]/', $value) === 1) {
        return null;
    }
    if (preg_match('//u', $value) !== 1 || preg_match('/[\x00-\x1F\x7F]/', $value) === 1) {
        return null;
    }
    return trim($value);
}

/** Neutralise spreadsheet formulas: a cell starting with = + - @ is prefixed. */
function beta_csv_cell(string $value): string
{
    return preg_match('/^[=+\-@]/', $value) === 1 ? "'" . $value : $value;
}

/** Append one row, writing the header first when the file is new. */
function beta_store(string $path, array $row): bool
{
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return false;
    }
    $handle = @fopen($path, 'ab');
    if ($handle === false) {
        return false;
    }
    @chmod($path, 0600);
    try {
        if (!flock($handle, LOCK_EX)) {
            return false;
        }
        clearstatcache(true, $path);
        $ok = true;
        if ((int) filesize($path) === 0) {
            $ok = fputcsv($handle, [
                'submitted_at_utc', 'first_name', 'email', 'phone', 'heard_from',
                'confirmed_18_plus', 'consent_beta_email',
            ], ',', '"', '') !== false;
        }
        $ok = $ok && fputcsv($handle, array_map('beta_csv_cell', $row), ',', '"', '') !== false;
        $ok = fflush($handle) && $ok;
        flock($handle, LOCK_UN);
        return $ok;
    } finally {
        fclose($handle);
    }
}

/** Plain-text mail with fixed headers. Only validated addresses reach a header. */
function beta_mail(string $to, string $subject, string $body, string $from, ?string $replyTo): bool
{
    $headers = [
        'From' => 'Tether Health <' . $from . '>',
        'Reply-To' => $replyTo ?? $from,
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
    ];
    return mail($to, $subject, str_replace("\n", "\r\n", $body), $headers, '-f' . $from);
}

// --- Request ------------------------------------------------------------------

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    beta_page(405, 'Use the form to join the beta', 'This address only accepts the beta waitlist form.');
}

$config = beta_load_config();
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
// this check applies to submissions that carry that value.
$fill = beta_field('fill_ms');
if ($fill === null || ($fill !== '' && (!ctype_digit($fill) || (int) $fill < BETA_MIN_FILL_MS))) {
    beta_fail('retry');
}

$firstName = beta_field('first_name');
$email = beta_field('email');
$phone = beta_field('phone');
$source = beta_field('source');
$adult = beta_field('adult');
$consent = beta_field('consent');

$valid = $firstName !== null && $firstName !== '' && strlen($firstName) <= BETA_MAX_FIRST_NAME
    && $email !== null && beta_is_email($email)
    && $phone !== null && array_key_exists($phone, BETA_PHONES)
    && $source !== null && array_key_exists($source, BETA_SOURCES)
    && $adult === 'yes'
    && $consent === 'yes';
if (!$valid) {
    beta_fail('fields');
}

$phoneLabel = BETA_PHONES[$phone];
$sourceLabel = BETA_SOURCES[$source];
$submittedAt = gmdate('Y-m-d\TH:i:s\Z');

if (!beta_store($config['storage_path'], [
    $submittedAt, $firstName, $email, $phoneLabel, $sourceLabel, 'yes', 'yes',
])) {
    error_log('beta-signup: could not append to the waitlist file');
    beta_fail('unavailable');
}

$notifyBody = implode("\n", [
    'New beta waitlist sign-up.',
    '',
    'First name: ' . $firstName,
    'Email: ' . $email,
    'Phone: ' . $phoneLabel,
    'Heard about us from: ' . $sourceLabel,
    'Confirmed 18 or over: yes',
    'Asked for beta email: yes',
    'Submitted (UTC): ' . $submittedAt,
    '',
    'Stored in the private waitlist file. Reply-To is the member\'s address.',
]);
$notified = 0;
foreach ($config['notify'] as $address) {
    if (beta_mail($address, 'New beta waitlist sign-up (' . $phoneLabel . ')', $notifyBody, $config['from'], $email)) {
        $notified++;
    }
}

$invite = $phone === 'iphone'
    ? "When a spot opens we will email you an invite to test on iPhone through\nApple's TestFlight app."
    : "When a spot opens we will email you an invite to test on Android.";
$confirmBody = implode("\n", [
    'Hi ' . $firstName . ',',
    '',
    "You're on the list; we'll email you an invite when there's a spot.",
    '',
    $invite,
    'We cannot promise a date.',
    '',
    'You are receiving this because you joined the Tether Health beta waitlist',
    'at www.tetherhealthgroup.com/beta/. If that was not you, ignore this email.',
    '',
    'To stop beta emails, reply to this message with "unsubscribe".',
    'To have your details deleted, email privacy@tetherhealthgroup.com.',
    '',
    'Tether Health',
    'https://www.tetherhealthgroup.com',
]);
$confirmed = beta_mail($email, "You're on the Tether Health beta waitlist", $confirmBody, $config['from'], null);

if ($notified < count($config['notify']) || !$confirmed) {
    error_log('beta-signup: mail() failed for ' . (count($config['notify']) - $notified + ($confirmed ? 0 : 1)) . ' message(s)');
}

beta_redirect('/beta/thanks/');
