<?php

declare(strict_types=1);

/*
 * Shared code for the beta waitlist handlers, beta-signup.php and
 * beta-confirm.php. The ".inc" name is refused by the deny-list in .htaccess,
 * so this file is never served; it only defines constants and functions.
 *
 * Storage is one CSV file outside the web root. Every change rewrites it
 * whole under an exclusive lock on "<file>.lock", through a temporary file
 * renamed into place, so a reader never sees half a file. A sign-up starts as
 * "pending" with the SHA-256 hash of a random single-use token; the plain
 * token exists only in the confirmation email. Confirming marks the row
 * "confirmed" and clears the token.
 *
 * Compatible with PHP 8.0 and later. No external libraries.
 */

const BETA_SITE_URL = 'https://www.tetherhealthgroup.com';

const BETA_MIN_FILL_MS = 3000;
const BETA_TOKEN_TTL = 7 * 86400;
const BETA_RESEND_AFTER = 86400;
const BETA_RATE_FILE_TTL = 86400;

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

const BETA_COLUMNS = [
    'submitted_at_utc', 'first_name', 'email', 'phone', 'heard_from',
    'confirmed_18_plus', 'consent_beta_email', 'status', 'confirmed_at_utc',
    'token_hash', 'token_expires_utc', 'last_sent_utc',
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
        '<title>', beta_html($title), '</title></head>',
        '<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1.25rem;color:#0f3d3e">',
        '<h1>', beta_html($title), '</h1>',
        '<p>', beta_html($message), '</p>',
        '<p><a href="/beta/">Go to the beta waitlist</a></p>',
        '</body></html>';
    exit;
}

function beta_headers(): void
{
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    header('Referrer-Policy: no-referrer');
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
 * Cleanup, run at the start of every request to either handler once the
 * config is loaded: rate-limit files untouched for a day are removed, and
 * pending rows whose token has expired are deleted. Returns false when the
 * waitlist file could not be processed.
 */
function beta_cleanup(array $config): bool
{
    $now = time();
    foreach (glob($config['rate_limit_dir'] . '/*.rate') ?: [] as $stale) {
        $mtime = @filemtime($stale);
        if ($mtime !== false && $mtime < $now - BETA_RATE_FILE_TTL) {
            @unlink($stale);
        }
    }
    if (!is_file($config['storage_path'])) {
        return true;
    }
    return beta_with_rows($config['storage_path'], static function (array $rows): array {
        return [$rows, null];
    }) !== false;
}

/**
 * Per-IP attempt counter in files outside the web root. The file name is a
 * hash of the client address; it holds the timestamps of recent attempts.
 *
 * REMOTE_ADDR is the client address on this host because nothing (no CDN or
 * proxy) sits in front of it. Client-supplied forwarding headers are ignored.
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
function beta_field(array $source, string $name): ?string
{
    $value = $source[$name] ?? '';
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

/** The inverse of beta_csv_cell, applied when the file is read back. */
function beta_csv_uncell(string $value): string
{
    return preg_match("/^'[=+\\-@]/", $value) === 1 ? substr($value, 1) : $value;
}

function beta_utc(int $time): string
{
    return gmdate('Y-m-d\TH:i:s\Z', $time);
}

/**
 * Read every row under an exclusive lock, drop expired pending rows, pass the
 * rest to $change, and write back what it returns. $change returns
 * [rows, result]; the result is returned. False means the file could not be
 * read or written, or its header is not the expected one.
 */
function beta_with_rows(string $path, callable $change): mixed
{
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return false;
    }
    $lock = @fopen($path . '.lock', 'c');
    if ($lock === false) {
        return false;
    }
    try {
        if (!flock($lock, LOCK_EX)) {
            return false;
        }
        $rows = [];
        if (is_file($path)) {
            $in = @fopen($path, 'rb');
            if ($in === false) {
                return false;
            }
            $header = fgetcsv($in, 0, ',', '"', '');
            if ($header !== false && $header !== [null] && $header !== BETA_COLUMNS) {
                fclose($in);
                return false;
            }
            while (($cells = fgetcsv($in, 0, ',', '"', '')) !== false) {
                if ($cells === [null] || count($cells) !== count(BETA_COLUMNS)) {
                    continue;
                }
                $rows[] = array_combine(BETA_COLUMNS, array_map('beta_csv_uncell', $cells));
            }
            fclose($in);
        }

        $now = beta_utc(time());
        $rows = array_values(array_filter($rows, static function (array $row) use ($now): bool {
            return !($row['status'] === 'pending' && $row['token_expires_utc'] <= $now);
        }));

        [$rows, $result] = $change($rows);

        $tmp = $path . '.tmp';
        $out = @fopen($tmp, 'wb');
        if ($out === false) {
            return false;
        }
        @chmod($tmp, 0600);
        $ok = fputcsv($out, BETA_COLUMNS, ',', '"', '') !== false;
        foreach ($rows as $row) {
            $cells = [];
            foreach (BETA_COLUMNS as $column) {
                $cells[] = beta_csv_cell((string) ($row[$column] ?? ''));
            }
            $ok = $ok && fputcsv($out, $cells, ',', '"', '') !== false;
        }
        $ok = fflush($out) && $ok;
        fclose($out);
        if (!$ok || !@rename($tmp, $path)) {
            @unlink($tmp);
            return false;
        }
        flock($lock, LOCK_UN);
        return $result;
    } finally {
        fclose($lock);
    }
}

/** A new single-use token: [plain, sha256 hash]. Only the hash is stored. */
function beta_new_token(): array
{
    $token = bin2hex(random_bytes(32));
    return [$token, hash('sha256', $token)];
}

/** Plain-text mail with fixed headers and no Reply-To. */
function beta_mail(string $to, string $subject, string $body, string $from): bool
{
    $headers = [
        'From' => 'Tether Health <' . $from . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
    ];
    return mail($to, $subject, str_replace("\n", "\r\n", $body), $headers, '-f' . $from);
}

/** The confirmation email. It carries no submitted text, only the link. */
function beta_send_confirmation(string $to, string $token, string $from): bool
{
    $body = implode("\n", [
        'Confirm your spot on the Tether Health beta waitlist:',
        '',
        BETA_SITE_URL . '/api/beta-confirm.php?t=' . $token,
        '',
        'The link works once and expires in 7 days.',
        "If you didn't ask to join, ignore this email; the request is deleted after 7 days.",
        '',
        'Questions or deletion: privacy@tetherhealthgroup.com',
    ]);
    return beta_mail($to, 'Confirm your spot on the Tether Health beta waitlist', $body, $from);
}
