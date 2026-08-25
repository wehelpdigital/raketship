import type { Dict } from "@/lib/i18n/dictionary"

/**
 * Saying which day it is.
 *
 * The counted forms are not the same shape in the two languages. Filipino
 * spells the number out and wraps it — "sa loob ng tatlong araw" — so the
 * number arrives already worded and linked. English keeps the digits.
 */
export const dates = {
  "date.today": { fil: "Ngayon", en: "Today" },
  "date.tomorrow": { fil: "Bukas", en: "Tomorrow" },
  "date.dayAfter": { fil: "Makalawa", en: "In 2 days" },
  "date.yesterday": { fil: "Kahapon", en: "Yesterday" },
  "date.inDays": {
    fil: "Sa loob ng {count} araw",
    en: "In {n} days",
  },
  "date.daysAgo": {
    fil: "{count} araw na",
    en: "{n} days ago",
  },
} satisfies Dict
