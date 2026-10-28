/**
 * Contact-form routing and message composition.
 *
 * Pure functions, like src/lib/waitlist.ts and for the same reason: the line
 * that decides which inbox a message reaches is the one a browser never
 * reports, so it lives here where `node --test` can check it.
 *
 * Each topic routes to one of the role mailboxes in data/site.ts. Nothing here
 * hard-codes an address.
 */

import { contact, type Mailbox } from "../data/site.ts";

export interface ContactTopic {
  value: string;
  label: string;
  mailbox: Mailbox;
}

/** Topics in the order the select shows them. The first is the default. */
export const contactTopics: ContactTopic[] = [
  { value: "general", label: "General question", mailbox: "support" },
  { value: "app", label: "Help with the app", mailbox: "support" },
  { value: "early-access", label: "Early access", mailbox: "support" },
  {
    value: "partnerships",
    label: "Partnerships and health systems",
    mailbox: "partnerships",
  },
  { value: "clinical", label: "Clinicians and research", mailbox: "support" },
  { value: "press", label: "Press and media", mailbox: "admin" },
  { value: "careers", label: "Careers", mailbox: "careers" },
  { value: "privacy", label: "Privacy request", mailbox: "privacy" },
  { value: "security", label: "Security report", mailbox: "security" },
];

export interface ContactPayload {
  name: string;
  email: string;
  organisation: string;
  topic: string;
  message: string;
}

/** The topic for `value`, or the default topic when it is not one we know. */
export function contactTopic(value: string): ContactTopic {
  return contactTopics.find((t) => t.value === value) ?? contactTopics[0];
}

/**
 * Trim the free-text fields; an unknown topic becomes the default rather than
 * a message routed nowhere.
 */
export function normalizeContactPayload(
  raw: Partial<Record<keyof ContactPayload, string>>,
): ContactPayload {
  return {
    name: (raw.name ?? "").trim(),
    email: (raw.email ?? "").trim(),
    organisation: (raw.organisation ?? "").trim(),
    topic: contactTopic(raw.topic ?? "").value,
    message: (raw.message ?? "").trim(),
  };
}

/** Where a payload goes, and the subject line it goes under. */
export function contactRoute(payload: ContactPayload): {
  address: string;
  subject: string;
} {
  const topic = contactTopic(payload.topic);
  return {
    address: contact[topic.mailbox],
    subject: `Website enquiry: ${topic.label}`,
  };
}

/** The body of the message the company receives, as labelled lines. */
export function contactMessageBody(payload: ContactPayload): string {
  return [
    `Name: ${payload.name || "(not given)"}`,
    `Email: ${payload.email}`,
    `Organisation: ${payload.organisation || "(not given)"}`,
    `Topic: ${contactTopic(payload.topic).label}`,
    "",
    payload.message || "(no message)",
  ].join("\n");
}

/** The `mailto:` URL the visitor's mail client opens, percent-encoded. */
export function contactMailtoUrl(payload: ContactPayload): string {
  const { address, subject } = contactRoute(payload);
  return (
    `mailto:${address}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(contactMessageBody(payload))}`
  );
}
