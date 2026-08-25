import type { Dict } from "@/lib/i18n/dictionary"

/** Navigation, the header, and the things every page borrows. */
export const shell = {
  "shell.language.switchTo": {
    fil: "Gamitin ang English",
    en: "Gamitin ang Filipino",
  },
  "shell.language.filipino": { fil: "Filipino", en: "Filipino" },
  "shell.language.english": { fil: "English", en: "English" },

  "common.search": { fil: "Maghanap", en: "Search" },
  "common.close": { fil: "Isara", en: "Close" },
  "common.clear": { fil: "I-clear", en: "Clear" },
  "common.cancel": { fil: "Huwag muna", en: "Never mind" },
  "common.showAgain": { fil: "Ipakita ulit ang paalala", en: "Show the note again" },
  "common.hide": { fil: "Itago", en: "Hide" },
  "common.loading": { fil: "Sandali lang…", en: "One moment…" },

  "shell.badge.upcoming": { fil: "{n} paparating", en: "{n} upcoming" },
} satisfies Dict
