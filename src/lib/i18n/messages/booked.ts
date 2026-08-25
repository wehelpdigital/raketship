import type { Dict } from "@/lib/i18n/dictionary"

/** /modules/booking/booked — the owner's list of what came in. */
export const booked = {
  "booked.title": { fil: "Booked", en: "Booked" },
  "booked.subtitle": {
    fil: "Ang mga booking na dumating sa public link mo.",
    en: "The bookings that came in through your public link.",
  },
  "booked.back": { fil: "Booking", en: "Booking" },

  "booked.tab.upcoming": { fil: "Paparating", en: "Upcoming" },
  "booked.tab.past": { fil: "Tapos na", en: "Finished" },
  "booked.tab.cancelled": { fil: "Cancelled", en: "Cancelled" },

  "booked.notice.slots": {
    fil: "Sarado na ang mga oras na ito sa public page mo — hindi na sila mapipili ng iba. Kapag na-cancel mo ang isa, babalik itong bakante.",
    en: "These times are closed on your public page — nobody else can pick them. Cancel one and it goes back to free.",
  },
  "booked.notice.cancelled": {
    fil: "Bakante na ulit ang mga oras na ito — pwede na silang kunin ng iba.",
    en: "These times are free again — anyone can take them now.",
  },
  "booked.notice.dismiss": { fil: "Itago ang paalala", en: "Hide the note" },
  "booked.notice.restore": { fil: "Ipakita ang paalala", en: "Show the note" },

  "booked.empty.title": { fil: "Wala pang booking", en: "No bookings yet" },
  "booked.empty.body": {
    fil: "Kapag may kumuha ng oras sa public link mo, lalabas sila dito — kasama ang pangalan, contact at mga sagot nila sa form mo.",
    en: "When someone takes a time on your public link they show up here — with their name, contact and answers to your form.",
  },
  "booked.empty.action": {
    fil: "Tingnan ang mga calendar",
    en: "See your calendars",
  },
  "booked.empty.upcoming": {
    fil: "Walang paparating na booking. Ang mga bagong booking sa public link mo ay lalabas dito.",
    en: "Nothing coming up. New bookings from your public link will appear here.",
  },
  "booked.empty.past": {
    fil: "Wala pang natapos na booking.",
    en: "No finished bookings yet.",
  },
  "booked.empty.cancelled": {
    fil: "Walang na-cancel. Mabuti iyon.",
    en: "Nothing cancelled. Good.",
  },

  "booked.search.open": { fil: "Maghanap ng booking", en: "Search bookings" },
  "booked.search.placeholder": {
    fil: "Pangalan, number, serbisyo, reference…",
    en: "Name, number, service, reference…",
  },
  "booked.search.title": { fil: "Maghanap", en: "Search" },
  "booked.search.hint": {
    fil: "Hinahanap sa pangalan, email, number, serbisyo, reference at sa mga sagot nila.",
    en: "Searches names, emails, numbers, services, references and their answers.",
  },
  "booked.search.clear": { fil: "Burahin ang hinahanap", en: "Clear the search" },
  "booked.search.showing": { fil: "Hinahanap: {query}", en: "Searching: {query}" },

  "booked.filter.calendar": {
    fil: "Salain ayon sa calendar",
    en: "Filter by calendar",
  },
  "booked.filter.allCalendars": {
    fil: "Lahat ng calendar",
    en: "All calendars",
  },
  "booked.filter.open": { fil: "Filter", en: "Filter" },
  "booked.filter.clear": { fil: "I-clear ang filter", en: "Clear the filter" },

  "booked.count.one": { fil: "{n} booking", en: "{n} booking" },
  "booked.count.many": { fil: "{n} bookings", en: "{n} bookings" },
  "booked.count.ofTotal": { fil: "{shown} sa {total}", en: "{shown} of {total}" },
  "booked.count.none": { fil: "Walang tugma", en: "Nothing matches" },
  "booked.noMatch": {
    fil: "Walang booking na tugma sa hinahanap mo.",
    en: "No booking matches what you searched for.",
  },

  "booked.more": { fil: "Marami pang booking", en: "More bookings" },
  "booked.allLoaded": { fil: "Iyon na lahat.", en: "That is all of them." },

  "booked.fact.name": { fil: "Pangalan", en: "Name" },
  "booked.fact.when": { fil: "Kailan", en: "When" },
  "booked.fact.timezone": { fil: "Timezone", en: "Timezone" },
  "booked.fact.email": { fil: "Email", en: "Email" },
  "booked.fact.mobile": { fil: "Mobile", en: "Mobile" },
  "booked.fact.contact": { fil: "Contact", en: "Contact" },
  "booked.fact.noContact": {
    fil: "Wala silang iniwan",
    en: "They left none",
  },
  "booked.fact.service": { fil: "Serbisyo", en: "Service" },
  "booked.fact.length": { fil: "Haba", en: "Length" },
  "booked.fact.price": { fil: "Presyo", en: "Price" },
  "booked.fact.calendar": { fil: "Calendar", en: "Calendar" },
  "booked.fact.reference": { fil: "Reference", en: "Reference" },
  "booked.answers": { fil: "Sagot sa form mo", en: "Answers to your form" },

  "booked.action.cancel": { fil: "I-cancel", en: "Cancel" },
  "booked.action.restore": { fil: "Ibalik", en: "Restore" },
  "booked.cancel.title": {
    fil: "I-cancel ang booking?",
    en: "Cancel this booking?",
  },
  "booked.cancel.body": {
    fil: "{who}, {when}. Babalik sa bakante ang oras na ito, kaya pwede na ulit itong kunin ng iba. Hindi namin sila aabisuhan — ikaw ang magpapaalam.",
    en: "{who}, {when}. This time goes back to free, so anyone can take it again. We will not tell them — that part is yours.",
  },
  "booked.cancel.confirm": { fil: "Oo, i-cancel", en: "Yes, cancel it" },

  "booked.status.booked": { fil: "Booked", en: "Booked" },
  "booked.status.cancelled": { fil: "Cancelled", en: "Cancelled" },

  "booked.toast.failed": {
    fil: "Hindi natuloy. Pakisubukan ulit.",
    en: "That did not go through. Please try again.",
  },
  "booked.toast.done": { fil: "Tapos na.", en: "Done." },
  "booked.toast.error": {
    fil: "Something went wrong. Pakisubukan ulit.",
    en: "Something went wrong. Please try again.",
  },
} satisfies Dict
