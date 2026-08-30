/**
 * Waitlist message composition and address checking.
 *
 * These are pure functions on purpose. The form's script used to build the
 * `mailto:` URL inline, where no test could reach it: a browser does not
 * report what it hands to an external protocol handler, so the single line
 * that decides what the company actually receives was the one line nothing
 * could check. Here it is a function with a return value.
 *
 * Nothing in this module touches the DOM, so it runs under `node --test`.
 */

export interface WaitlistPayload {
  name: string;
  email: string;
  role: string;
  interest: string;
  message: string;
}

/**
 * The email syntax an `<input type="email">` already enforces — the regular
 * expression the HTML standard gives for the email state, reproduced verbatim
 * so the form's own check and the field's declared type agree rather than
 * disagree.
 *
 * https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
 *
 * It is deliberately permissive about the domain (`someone@intranet` passes,
 * exactly as the browser allows) and strict about the parts that make an
 * address undeliverable: an empty local part, an empty domain, or a space.
 * The form promises a reply, so an address that cannot receive one is not a
 * near miss to wave through — before this check, `a@` was accepted and the
 * composed message went out addressed to nobody.
 */
const HTML_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** True when `value` is an address a reply could actually be sent to. */
export function isReplyableEmail(value: string): boolean {
  return HTML_EMAIL.test(value.trim());
}

/**
 * Trim the free-text fields and fill in the two the visitor may leave blank.
 *
 * The selects always carry a value, so they pass through as given; a missing
 * one becomes an empty string rather than the string "undefined".
 */
export function normalizeWaitlistPayload(
  raw: Partial<Record<keyof WaitlistPayload, string>>,
): WaitlistPayload {
  return {
    name: (raw.name ?? "").trim(),
    email: (raw.email ?? "").trim(),
    role: raw.role ?? "",
    interest: raw.interest ?? "",
    message: (raw.message ?? "").trim(),
  };
}

/**
 * The body of the message the company receives.
 *
 * Labelled lines, not a form dump: whoever opens the inbox reads this, and the
 * two optional fields say so explicitly instead of arriving blank and looking
 * like a delivery fault.
 */
export function waitlistMessageBody(payload: WaitlistPayload): string {
  return [
    `Name: ${payload.name || "(not given)"}`,
    `Email: ${payload.email}`,
    `I am: ${payload.role}`,
    `Health area of interest: ${payload.interest}`,
    "",
    payload.message || "(no message)",
  ].join("\n");
}

/**
 * The `mailto:` URL the visitor's mail client opens.
 *
 * Both query values are percent-encoded: a `&` or a `+` in someone's message
 * would otherwise end the body early or arrive as a space.
 */
export function waitlistMailtoUrl(
  address: string,
  subject: string,
  payload: WaitlistPayload,
): string {
  return (
    `mailto:${address}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(waitlistMessageBody(payload))}`
  );
}
