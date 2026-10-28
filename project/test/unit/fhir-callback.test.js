/**
 * Unit tests for the FHIR OAuth redirect page's decision logic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { appIntentUrl, callbackOutcome } from "../../src/lib/fhir-callback.ts";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15";

test("a declined authorization is reported as declined", () => {
  assert.equal(
    callbackOutcome("?error=access_denied&state=x", ANDROID),
    "denied",
  );
});

test("any other OAuth error is reported as an error, even with a code present", () => {
  assert.equal(callbackOutcome("?error=server_error", DESKTOP), "error");
  assert.equal(
    callbackOutcome("?code=abc&error=invalid_scope", ANDROID),
    "error",
  );
});

test("a code on Android offers the app; elsewhere it sends the person back to the phone", () => {
  assert.equal(callbackOutcome("?code=abc&state=xyz", ANDROID), "android");
  assert.equal(callbackOutcome("?code=abc&state=xyz", DESKTOP), "other-device");
});

test("no OAuth parameters, or an empty code, is the empty case", () => {
  assert.equal(callbackOutcome("", ANDROID), "empty");
  assert.equal(callbackOutcome("?utm_source=x", DESKTOP), "empty");
  assert.equal(callbackOutcome("?code=", ANDROID), "empty");
});

test("the intent URL reopens the same https callback in the named package", () => {
  assert.equal(
    appIntentUrl(
      "www.tetherhealthgroup.com",
      "/fhir/callback/epic/",
      "?code=abc&state=xyz",
      "com.TetherHealthLLC.tetherhealth",
    ),
    "intent://www.tetherhealthgroup.com/fhir/callback/epic/?code=abc&state=xyz" +
      "#Intent;scheme=https;package=com.TetherHealthLLC.tetherhealth;" +
      "S.browser_fallback_url=https%3A%2F%2Fwww.tetherhealthgroup.com%2Ffhir%2Fcallback%2Fepic%2F;end",
  );
});
