import type { Dict } from "@/lib/i18n/dictionary"

/** The Build-your-Raket canvas — the outer board. */
export const raket = {
  "raket.summary.none": {
    fil: "Wala pang module — kumuha sa Raket Market.",
    en: "No modules yet — add one from the Raket Market.",
  },
  "raket.summary.one": {
    fil: "{n} module · i-tap para buksan",
    en: "{n} module · tap one to open its builder",
  },
  "raket.summary.many": {
    fil: "{n} modules · i-tap ang isa para buksan",
    en: "{n} modules · tap one to open its builder",
  },

  "raket.booking.noCalendars": {
    fil: "Wala pang calendar",
    en: "No calendars yet",
  },
  "raket.booking.calendars.one": { fil: "{n} calendar", en: "{n} calendar" },
  "raket.booking.calendars.many": { fil: "{n} calendar", en: "{n} calendars" },
  "raket.booking.live": { fil: "{n} live", en: "{n} live" },
  "raket.booking.draft": { fil: "draft pa", en: "still draft" },
  "raket.booking.upcoming.none": {
    fil: "Walang paparating",
    en: "Nothing upcoming",
  },
  "raket.booking.upcoming.one": {
    fil: "{n} paparating na booking",
    en: "{n} upcoming booking",
  },
  "raket.booking.upcoming.many": {
    fil: "{n} paparating na booking",
    en: "{n} upcoming bookings",
  },

  "raket.business.unset": {
    fil: "I-set up ang detalye ng negosyo",
    en: "Set up your business details",
  },
  "raket.business.theme": { fil: "Tema: {name}", en: "Theme: {name}" },
} satisfies Dict
