import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LocaleProvider } from "@/components/shell/locale-provider"
import type { Locale } from "@/lib/i18n"
import { INITIAL_VISIBLE } from "@/lib/booking/booked-filter"

import { BookedBrowser } from "./booked-browser"
import type { BookedRow } from "./booked-list"

vi.mock("@/features/booking/actions", () => ({
  cancelBooking: vi.fn(),
  restoreBooking: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const CAL_A = "aaaaaaaa-1111-4111-8111-111111111111"
const CAL_B = "bbbbbbbb-2222-4222-8222-222222222222"

function row(index: number, overrides: Partial<BookedRow> = {}): BookedRow {
  const day = String(10 + (index % 20)).padStart(2, "0")
  return {
    id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    calendarId: CAL_A,
    calendarName: "Gupit ni Nena",
    timezone: "Asia/Manila",
    startsAt: `2027-03-${day}T01:00:00.000Z`,
    endsAt: `2027-03-${day}T01:30:00.000Z`,
    status: "confirmed",
    customerName: `Suki ${index}`,
    customerEmail: `suki${index}@example.com`,
    customerPhone: "09171234567",
    serviceName: "Gupit lang",
    servicePriceCentavos: 15000,
    durationMinutes: 30,
    answers: {},
    createdAt: "2027-02-01T00:00:00.000Z",
    ...overrides,
  }
}

/*
  A row on a given day relative to today, in the calendar's own zone. Manila is
  UTC+8, so 02:00Z is the same Manila date whatever hour the suite runs at.
*/
function rowDaysFromToday(offset: number, index = 1): BookedRow {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  const [y, m, d] = today.split("-").map(Number)
  const iso = new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10)
  return row(index, {
    startsAt: `${iso}T02:00:00.000Z`,
    endsAt: `${iso}T02:30:00.000Z`,
  })
}

const clearQuery = vi.fn()

function renderBrowser(
  overrides: Partial<React.ComponentProps<typeof BookedBrowser>> = {},
  locale: Locale = "fil"
) {
  return render(
    <LocaleProvider locale={locale}>
      <BookedBrowser
        rows={[row(1), row(2), row(3)]}
        fieldsByCalendar={{}}
        calendars={[{ id: CAL_A, name: "Gupit ni Nena" }]}
        query=""
        onClearQuery={clearQuery}
        emptyLabel="Wala pa."
        {...overrides}
      />
    </LocaleProvider>
  )
}

/*
  The rows, and only the rows. They are picked by the one thing that is always
  theirs: the customer's name is in the button.
*/
const rowButtons = () =>
  screen.getAllByRole("button", { name: /Suki|Juan|Maria|Nena/ })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("searching", () => {
  // The box itself now lives above the tabs; the list is handed the query.
  it("narrows to what was asked for", () => {
    renderBrowser({
      rows: [
        row(1, { customerName: "Juan dela Cruz" }),
        row(2, { customerName: "Maria Santos" }),
      ],
      query: "maria",
    })

    expect(screen.getByText("Maria Santos")).toBeInTheDocument()
    expect(screen.queryByText("Juan dela Cruz")).not.toBeInTheDocument()
  })

  it("finds a booking by its reference", () => {
    renderBrowser({
      rows: [row(1, { customerName: "Juan" }), row(2)],
      // The eight characters the customer was shown on their confirmation.
      query: "00000001",
    })

    expect(screen.getByText("Juan")).toBeInTheDocument()
    expect(screen.queryByText("Suki 2")).not.toBeInTheDocument()
  })

  it("says so when nothing matches, rather than showing an empty list", () => {
    renderBrowser({ query: "walang ganito" })
    expect(screen.getByText(/Walang booking na tugma/)).toBeInTheDocument()
  })

  it("shows what is being searched for, and offers to drop it", async () => {
    const user = userEvent.setup()
    renderBrowser({ query: "maria" })

    await user.click(screen.getByRole("button", { name: /Hinahanap: maria/ }))
    expect(clearQuery).toHaveBeenCalled()
  })

  it("reports how much of the list survived", () => {
    renderBrowser({
      rows: [
        row(1, { customerName: "Juan" }),
        row(2, { customerName: "Maria" }),
        row(3, { customerName: "Nena" }),
      ],
    })
    expect(screen.getByText("3 bookings")).toBeInTheDocument()
  })
})

describe("filtering by calendar", () => {
  const twoCalendars = {
    rows: [
      row(1, { calendarId: CAL_A, calendarName: "Gupit" }),
      row(2, { calendarId: CAL_B, calendarName: "Kulay", customerName: "Maria" }),
    ],
    calendars: [
      { id: CAL_A, name: "Gupit" },
      { id: CAL_B, name: "Kulay" },
    ],
  }

  it("offers the filter only when there is more than one to pick", () => {
    renderBrowser()
    expect(screen.queryByLabelText(/ayon sa calendar/)).not.toBeInTheDocument()

    renderBrowser(twoCalendars)
    expect(screen.getByLabelText(/ayon sa calendar/)).toBeInTheDocument()
  })
})

describe("growing the list", () => {
  const many = Array.from({ length: 60 }, (_, i) => row(i + 1))

  it("starts with a screenful rather than everything", () => {
    renderBrowser({ rows: many })
    expect(rowButtons()).toHaveLength(INITIAL_VISIBLE)
  })

  it("offers a way past the end that does not need a scroll", async () => {
    // An IntersectionObserver fires on scroll, and a keyboard never scrolls.
    const user = userEvent.setup()
    renderBrowser({ rows: many })

    const more = screen.getByRole("button", { name: /Marami pang booking/ })
    await user.click(more)
    expect(rowButtons().length).toBeGreaterThan(INITIAL_VISIBLE)
  })

  it("stops offering more once there is none", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: Array.from({ length: 25 }, (_, i) => row(i + 1)) })

    await user.click(screen.getByRole("button", { name: /Marami pang booking/ }))

    expect(rowButtons()).toHaveLength(25)
    expect(
      screen.queryByRole("button", { name: /Marami pang booking/ })
    ).not.toBeInTheDocument()
  })

  it("does not offer more when it all fits", () => {
    renderBrowser()
    expect(
      screen.queryByRole("button", { name: /Marami pang booking/ })
    ).not.toBeInTheDocument()
  })

  it("goes back to the top of the list when the search changes", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LocaleProvider locale="fil">
        <BookedBrowser
          rows={many}
          fieldsByCalendar={{}}
          calendars={[{ id: CAL_A, name: "Gupit ni Nena" }]}
          query=""
          onClearQuery={clearQuery}
          emptyLabel="Wala pa."
        />
      </LocaleProvider>
    )

    await user.click(screen.getByRole("button", { name: /Marami pang booking/ }))
    expect(rowButtons().length).toBeGreaterThan(INITIAL_VISIBLE)

    rerender(
      <LocaleProvider locale="fil">
        <BookedBrowser
          rows={many}
          fieldsByCalendar={{}}
          calendars={[{ id: CAL_A, name: "Gupit ni Nena" }]}
          query="suki"
          onClearQuery={clearQuery}
          emptyLabel="Wala pa."
        />
      </LocaleProvider>
    )

    // A new query is a new list; row 40 of the old one is nowhere.
    expect(rowButtons()).toHaveLength(INITIAL_VISIBLE)
  })
})

describe("opening a row", () => {
  it("starts closed, so the list can be scanned", () => {
    renderBrowser()
    for (const button of rowButtons()) {
      expect(button).toHaveAttribute("aria-expanded", "false")
    }
  })

  it("opens to show the detail", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: [row(1, { customerEmail: "juan@example.com" })] })

    await user.click(rowButtons()[0])

    // Written out plainly, so an owner reading it back on the phone reads a
    // line rather than a layout.
    expect(screen.getByText("Pangalan:")).toBeInTheDocument()
    expect(screen.getAllByText("Suki 1").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Kailan:")).toBeInTheDocument()
    expect(screen.getByText("Reference:")).toBeInTheDocument()
    expect(screen.getByText("Email:")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /juan@example.com/ })
    ).toBeInTheDocument()
  })

  it("keeps only one open at a time", async () => {
    // A list where every row is expanded is a list you cannot scan.
    const user = userEvent.setup()
    renderBrowser()

    await user.click(rowButtons()[0])
    expect(screen.getAllByText("Reference:")).toHaveLength(1)

    await user.click(rowButtons()[1])
    expect(screen.getAllByText("Reference:")).toHaveLength(1)
  })

  it("closes again when tapped a second time", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: [row(1)] })

    const control = rowButtons()[0]
    await user.click(control)
    expect(control).toHaveAttribute("aria-expanded", "true")

    await user.click(control)
    expect(control).toHaveAttribute("aria-expanded", "false")
  })

  it("shows the answers to the owner's own questions", async () => {
    const user = userEvent.setup()
    const field = {
      id: "f1",
      calendar_id: CAL_A,
      user_id: "u1",
      label: "Anong hairstyle",
      type: "short_text" as const,
      help: null,
      placeholder: null,
      required: false,
      options: [],
      position: 0,
      created_at: "2027-01-01T00:00:00.000Z",
      updated_at: "2027-01-01T00:00:00.000Z",
    }
    renderBrowser({
      rows: [row(1, { answers: { f1: "Fade po" } })],
      fieldsByCalendar: { [CAL_A]: [field] },
    })

    await user.click(rowButtons()[0])

    expect(screen.getByText("Anong hairstyle:")).toBeInTheDocument()
    expect(screen.getByText("Fade po")).toBeInTheDocument()
  })
})

describe("the collapsed row", () => {
  it("puts the whole time range on one line", () => {
    renderBrowser({ rows: [row(1)] })
    // 01:00Z is 09:00 in Manila, half an hour long.
    const label = rowButtons()[0].textContent ?? ""
    expect(label).toContain("9:00 AM")
    expect(label).toContain("– 9:30 AM")
  })

  it("puts the service on the same line as the name", () => {
    renderBrowser({ rows: [row(1)] })
    expect(rowButtons()[0].textContent).toContain("Suki 1 · Gupit lang")
  })

  it("gives the calendar its own slot on the right", () => {
    // Different information from who booked — it is where the booking landed.
    renderBrowser({ rows: [row(1)] })

    const button = rowButtons()[0]
    expect(button.textContent).toContain("Gupit ni Nena")
    // Its own element, not glued onto the name.
    const calendar = [...button.querySelectorAll("span")].find(
      (el) => el.textContent === "Gupit ni Nena"
    )
    expect(calendar?.className).toContain("text-right")
    expect(calendar?.textContent).not.toContain("Suki 1")
  })

  it("writes the time range as one piece, one style", () => {
    // "9:00 AM – 9:30 AM" is a single fact; splitting its styling down the
    // middle made it read as two.
    renderBrowser({ rows: [row(1)] })

    const button = rowButtons()[0]
    const range = [...button.querySelectorAll("span")].find((el) =>
      /9:00 AM – 9:30 AM|9:00 AM – 9:30 AM/.test(
        el.textContent?.replace(/s+/g, " ") ?? ""
      )
    )

    expect(range).toBeDefined()
    // One leaf — no half of it wrapped in its own styling.
    expect(range?.querySelector("span")).toBeNull()
    expect(range?.className).toContain("text-sm")
    expect(range?.className).toContain("font-semibold")
  })

  it("keeps the calendar readable but clearly secondary", () => {
    renderBrowser({ rows: [row(1)] })

    const calendar = [...rowButtons()[0].querySelectorAll("span")].find(
      (el) => el.textContent === "Gupit ni Nena"
    )
    expect(calendar?.className).toContain("text-sm")
    expect(calendar?.className).toContain("text-muted-foreground")
    expect(calendar?.className).not.toContain("text-xs")
    expect(calendar?.className).not.toMatch(/font-(medium|semibold|bold)/)
  })
})

describe("how near the day is", () => {
  const chip = (text: string | RegExp) => screen.getByText(text)

  it("says it in words and still writes the date out", () => {
    // "Bukas" on its own leaves an owner working out which day that is.
    renderBrowser({ rows: [rowDaysFromToday(1)] })

    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading).toHaveTextContent("Bukas")
    expect(heading.textContent).toMatch(
      /[0-9]+ (January|February|March|April|May|June|July|August|September|October|November|December)/
    )
  })

  it("paints today and tomorrow red, and nothing else", () => {
    renderBrowser({
      rows: [
        rowDaysFromToday(0, 1),
        rowDaysFromToday(1, 2),
        rowDaysFromToday(4, 3),
      ],
    })

    expect(chip("Ngayon").className).toContain("bg-destructive")
    expect(chip("Bukas").className).toContain("bg-destructive")
    expect(chip(/Sa loob ng apat na araw/).className).not.toContain(
      "bg-destructive"
    )
  })

  it("warms the rest of the week and lets the far ones go quiet", () => {
    renderBrowser({ rows: [rowDaysFromToday(4, 1), rowDaysFromToday(20, 2)] })

    expect(chip(/Sa loob ng apat na araw/).className).toContain("bg-warning")
    expect(chip(/Sa loob ng dalawampung araw/).className).toContain("bg-muted")
  })

  it("never paints a day that has already happened", () => {
    // The past cannot be missed; red there would spend the colour that means
    // "act" on something nobody can act on.
    renderBrowser({ rows: [rowDaysFromToday(-1, 1)], variant: "cancelled" })

    expect(chip("Kahapon").className).toContain("bg-muted")
    expect(chip("Kahapon").className).not.toContain("bg-destructive")
  })

  it("drops the count once counting days stops helping", () => {
    // row() builds 2027 dates — years out.
    renderBrowser({ rows: [row(1)] })

    const heading = screen.getByRole("heading", { level: 3 })
    expect(heading).toHaveTextContent("March")
    expect(heading.textContent).not.toMatch(/araw/)
  })

  it("adds the year only when it is not this one", () => {
    renderBrowser({ rows: [row(1)] })
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("2027")

    renderBrowser({ rows: [rowDaysFromToday(1)] })
    const thisYear = String(new Date().getFullYear())
    expect(
      screen.getAllByRole("heading", { level: 3 })[1].textContent
    ).not.toContain(thisYear)
  })
})

describe("in English", () => {
  it("says the days in English and keeps the digits", () => {
    renderBrowser({ rows: [rowDaysFromToday(1, 1), rowDaysFromToday(4, 2)] }, "en")

    expect(screen.getByText("Tomorrow")).toBeInTheDocument()
    expect(screen.getByText("In 4 days")).toBeInTheDocument()
    expect(screen.queryByText(/araw/)).not.toBeInTheDocument()
  })

  it("translates the detail panel too", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: [row(1)] }, "en")

    await user.click(rowButtons()[0])

    expect(screen.getByText("Name:")).toBeInTheDocument()
    expect(screen.getByText("When:")).toBeInTheDocument()
    expect(screen.getByText("Reference:")).toBeInTheDocument()
    expect(screen.queryByText("Pangalan:")).not.toBeInTheDocument()
  })

  it("counts in English", () => {
    renderBrowser({ rows: [row(1), row(2), row(3)] }, "en")
    expect(screen.getByText("3 bookings")).toBeInTheDocument()
  })
})

describe("the day's rows", () => {
  it("rules the whole tab as one list, a hairline above every booking", () => {
    // A card per day meant a shop with one booking a day — the common case —
    // never saw a single divider. Now the days are bands inside ONE card and
    // every row carries an inset rule above it.
    const { container } = renderBrowser({ rows: [row(1), row(21), row(2)] })

    const card = container.querySelector("section")?.parentElement
    expect(card?.className).toContain("rounded-lg")
    expect(card?.className).toContain("bg-card")

    // Three bookings, three rules — every booking gets its line, edge to
    // edge like a table's rule.
    const rules = card?.querySelectorAll("li > div[aria-hidden]") ?? []
    expect(rules).toHaveLength(3)
    for (const rule of rules) {
      expect(rule.className).toContain("border-t")
      expect(rule.className).not.toContain("mx-")
    }

    // The day headers live inside the card, and a NEW day announces itself
    // with a full-width rule while the first does not double the card's edge.
    const headers = card?.querySelectorAll("h3") ?? []
    expect(headers).toHaveLength(2)
    expect(headers[0].className).not.toContain("border-t")
    expect(headers[1].className).toContain("border-t")
  })


  it("no longer paints a card each", () => {
    const { container } = renderBrowser({ rows: [row(1)] })
    const article = container.querySelector("section ul li article")
    expect(article?.className).not.toContain("rounded-xl")
    expect(article?.className).not.toContain("ring-border")
  })
})

describe("an empty list", () => {
  it("says what the tab means rather than that a search failed", () => {
    renderBrowser({ rows: [], emptyLabel: "Wala pang natapos na booking." })
    expect(screen.getByText("Wala pang natapos na booking.")).toBeInTheDocument()
  })
})
