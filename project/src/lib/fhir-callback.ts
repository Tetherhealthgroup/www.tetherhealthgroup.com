/**
 * What a FHIR OAuth redirect page shows, decided from its query string.
 *
 * Blue Button and Epic send the browser back to /fhir/callback/<provider>/
 * with either `code` and `state` (the person approved) or `error` (they did
 * not, or something failed). On Android, when the Tether Health app is
 * installed and its App Link for this path is verified against
 * /.well-known/assetlinks.json, Android hands the URL straight to the app and
 * this page never renders. The page exists for every other case: the app
 * link did not fire, the person is on another device, or they opened the URL
 * by hand.
 *
 * The authorization code is single-use and, under SMART on FHIR with PKCE,
 * worthless without the verifier that only the app holds. Even so it is never
 * displayed, never sent anywhere by this page, and removed from the address
 * bar as soon as the script runs. The token exchange happens in the app, not
 * here: this site is static and has no backend.
 *
 * Pure functions, so `node --test` can check them.
 */

export type CallbackOutcome =
  | "denied" // the person declined at the provider
  | "error" // any other OAuth error
  | "android" // a code arrived on Android: offer to open the app
  | "other-device" // a code arrived elsewhere: send them back to the phone
  | "empty"; // no OAuth parameters at all

export function callbackOutcome(
  search: string,
  userAgent: string,
): CallbackOutcome {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (error !== null) return error === "access_denied" ? "denied" : "error";
  if (params.get("code")) {
    return /\bAndroid\b/i.test(userAgent) ? "android" : "other-device";
  }
  return "empty";
}

/**
 * An Android intent URL that opens this exact callback URL in the app.
 *
 * Chrome resolves `intent://` links to the named package, so this reaches the
 * app's handler for the https callback even when the automatic App Link did
 * not fire. The query string is carried through unchanged — the app needs
 * `code` and `state` to finish the exchange.
 *
 * `S.browser_fallback_url` is the callback path without its query: without
 * it, Chrome sends a visitor who lacks the app to the package's store listing,
 * and the app is not released. The fallback carries no code.
 */
export function appIntentUrl(
  host: string,
  path: string,
  search: string,
  packageName: string,
): string {
  const fallback = encodeURIComponent(`https://${host}${path}`);
  return `intent://${host}${path}${search}#Intent;scheme=https;package=${packageName};S.browser_fallback_url=${fallback};end`;
}
