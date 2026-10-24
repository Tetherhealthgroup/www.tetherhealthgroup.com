/**
 * "Last updated" label for the legal pages.
 *
 * The input is a calendar date, not an instant. `new Date("2026-10-12")` is
 * UTC midnight, and formatting it in the machine's own zone shows the previous
 * day anywhere west of UTC (the release builds run on a Pacific-time Mac). So
 * the date is validated as a real YYYY-MM-DD and formatted in UTC, which makes
 * the visible text and the `<time datetime>` attribute agree in every zone.
 *
 * Pure on purpose, so `node --test` can run it under different TZ values.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Format a strict YYYY-MM-DD string as e.g. "12 October 2026". */
export function formatLegalDate(updated: string): string {
  const match = ISO_DATE.exec(updated);
  if (!match) {
    throw new Error(
      `Legal page "updated" must be a YYYY-MM-DD date, got ${JSON.stringify(updated)}`,
    );
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `Legal page "updated" is not a real calendar date: ${updated}`,
    );
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
