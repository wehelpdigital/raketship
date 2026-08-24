import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  FieldEditor,
  FormBuilder,
  STARTER_FIELDS,
  cleanChoices,
  draftFromField,
  moveField,
  validateFieldDraft,
  type FieldDraft,
} from "@/features/booking/form-builder"
import type { BookingFormFieldRow } from "@/lib/supabase/types"

import {
  deleteField,
  reorderFields,
  saveField,
} from "@/features/booking/actions"

vi.mock("@/features/booking/actions", () => ({
  saveField: vi.fn(),
  deleteField: vi.fn(),
  reorderFields: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveField).mockResolvedValue({ ok: true })
  vi.mocked(deleteField).mockResolvedValue({ ok: true })
  vi.mocked(reorderFields).mockResolvedValue({ ok: true })
})

function makeField(
  overrides: Partial<BookingFormFieldRow> = {}
): BookingFormFieldRow {
  return {
    id: "field-1",
    calendar_id: "cal-1",
    user_id: "user-1",
    label: "Mobile number",
    type: "phone",
    help: null,
    placeholder: null,
    required: false,
    options: [],
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeDraft(overrides: Partial<FieldDraft> = {}): FieldDraft {
  return {
    label: "What service?",
    type: "select",
    help: "",
    placeholder: "",
    required: false,
    options: ["Haircut", "Color"],
    ...overrides,
  }
}

// The label of the first question is deliberately not "Mobile number": that is
// also the *type* label of a phone question, so a card would carry the same
// text twice and every `getByText` for it would be ambiguous.
const THREE = [
  makeField({ id: "a", label: "Contact number" }),
  makeField({ id: "b", label: "What service?", type: "select", options: ["Cut"] }),
  makeField({ id: "c", label: "Any notes?", type: "long_text" }),
]

/* ------------------------------------------------------------------ *
 * The reordering helper, on its own
 * ------------------------------------------------------------------ */

describe("moveField", () => {
  const items = ["a", "b", "c", "d"]

  it("leaves the first item alone when it is asked to move up", () => {
    expect(moveField(items, 0, -1)).toEqual(["a", "b", "c", "d"])
  })

  it("leaves the last item alone when it is asked to move down", () => {
    expect(moveField(items, 3, 1)).toEqual(["a", "b", "c", "d"])
  })

  it("swaps a middle item with the one above it", () => {
    expect(moveField(items, 2, -1)).toEqual(["a", "c", "b", "d"])
  })

  it("swaps a middle item with the one below it", () => {
    expect(moveField(items, 1, 1)).toEqual(["a", "c", "b", "d"])
  })

  it("ignores an index that is not in the list", () => {
    expect(moveField(items, 9, -1)).toEqual(items)
    expect(moveField(items, -1, 1)).toEqual(items)
  })

  it("never mutates the list it was given", () => {
    const original = [...items]
    moveField(items, 1, 1)
    expect(items).toEqual(original)
  })

  it("keeps a single-item list single", () => {
    expect(moveField(["only"], 0, -1)).toEqual(["only"])
    expect(moveField(["only"], 0, 1)).toEqual(["only"])
  })
})

/* ------------------------------------------------------------------ *
 * Choices
 * ------------------------------------------------------------------ */

describe("cleanChoices", () => {
  it("trims, drops the blanks, and keeps the first of a repeat", () => {
    expect(cleanChoices(["  Haircut ", "", "   ", "Color", "Color"])).toEqual([
      "Haircut",
      "Color",
    ])
  })
})

describe("validateFieldDraft", () => {
  it("refuses a choice question with only one choice", () => {
    expect(validateFieldDraft(makeDraft({ options: ["Haircut"] }))).toBe(
      "A choice question needs at least two choices."
    )
  })

  it("counts blank rows as no choice at all", () => {
    expect(
      validateFieldDraft(makeDraft({ options: ["Haircut", "   ", ""] }))
    ).toBe("A choice question needs at least two choices.")
  })

  it("accepts a choice question once it has two real choices", () => {
    expect(validateFieldDraft(makeDraft())).toBeNull()
  })

  it("does not ask a non-choice question for choices", () => {
    expect(
      validateFieldDraft(makeDraft({ type: "short_text", options: [] }))
    ).toBeNull()
  })

  it("insists on a label", () => {
    expect(validateFieldDraft(makeDraft({ label: "   " }))).toBe(
      "Every question needs a label."
    )
  })

  it("holds the label to the length the database will take", () => {
    expect(validateFieldDraft(makeDraft({ label: "x".repeat(121) }))).toMatch(
      /under 120 characters/
    )
  })
})

describe("draftFromField", () => {
  it("opens a blank slate for a new question", () => {
    expect(draftFromField(null)).toEqual({
      label: "",
      type: "short_text",
      help: "",
      placeholder: "",
      required: false,
      options: [],
    })
  })

  it("turns the nulls of a saved row into empty strings", () => {
    const draft = draftFromField(
      makeField({ help: null, placeholder: null, label: "Mobile" })
    )
    expect(draft.help).toBe("")
    expect(draft.placeholder).toBe("")
    expect(draft.label).toBe("Mobile")
  })
})

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

describe("FieldEditor", () => {
  it("refuses to save a choice question that has only one choice", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <FieldEditor
        calendarId="cal-1"
        field={makeField({
          id: "svc",
          label: "What service?",
          type: "select",
          options: ["Just one"],
        })}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(saveField).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A choice question needs at least two choices."
    )
  })

  it("saves once a second choice is written, and drops the blanks", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <FieldEditor
        calendarId="cal-1"
        field={makeField({
          id: "svc",
          label: "What service?",
          type: "select",
          options: ["Just one"],
        })}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole("button", { name: "Add choice" }))
    await user.type(screen.getByLabelText("Choice 2"), "Walk-in")
    await user.click(screen.getByRole("button", { name: "Add choice" }))
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(saveField).toHaveBeenCalledTimes(1))
    expect(saveField).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "cal-1",
        fieldId: "svc",
        label: "What service?",
        type: "select",
        options: ["Just one", "Walk-in"],
      })
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("offers a placeholder on a single-line question", () => {
    render(
      <FieldEditor
        calendarId="cal-1"
        field={makeField({ id: "ref", label: "Reference", type: "short_text" })}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Placeholder/)).toBeInTheDocument()
  })

  it("hides the placeholder box where the server would drop it", () => {
    // `saveField` keeps a placeholder only on a single-line control, so asking
    // for one on a paragraph would look saved and come back empty.
    render(
      <FieldEditor
        calendarId="cal-1"
        field={makeField({ id: "notes", label: "Notes", type: "long_text" })}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByLabelText(/Placeholder/)).not.toBeInTheDocument()
  })

  it("previews the question as the client will meet it", () => {
    render(
      <FieldEditor
        calendarId="cal-1"
        field={makeField({
          id: "svc",
          label: "What service?",
          type: "select",
          required: true,
          options: ["Haircut", "Color"],
        })}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole("radio", { name: "Haircut" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Color" })).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

describe("FormBuilder", () => {
  it("lists the questions with their type and their choices", () => {
    render(<FormBuilder calendarId="cal-1" fields={THREE} />)

    // Scoped to the list, so the desktop preview column — which renders the
    // very same questions as a live form — can never make this ambiguous.
    const list = within(screen.getByRole("list", { name: "Booking questions" }))

    expect(list.getByText("Contact number")).toBeInTheDocument()
    expect(list.getByText("Mobile number")).toBeInTheDocument() // its type
    expect(list.getByText("What service?")).toBeInTheDocument()
    expect(list.getByText("Any notes?")).toBeInTheDocument()

    expect(list.getByText("Multiple choice")).toBeInTheDocument()
    expect(list.getByText("Paragraph")).toBeInTheDocument()
    expect(list.getByText("Cut")).toBeInTheDocument()

    expect(list.getAllByText("1 of 3")).toHaveLength(1)
  })

  it("disables the move buttons at either end of the list", () => {
    render(<FormBuilder calendarId="cal-1" fields={THREE} />)

    expect(
      screen.getByRole("button", { name: "Move Contact number up" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Move Any notes? down" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Move What service? up" })
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Move What service? down" })
    ).toBeEnabled()
  })

  it("reorders on tap and sends the new order to the server", async () => {
    const user = userEvent.setup()
    render(<FormBuilder calendarId="cal-1" fields={THREE} />)

    await user.click(
      screen.getByRole("button", { name: "Move Contact number down" })
    )

    await waitFor(() =>
      expect(reorderFields).toHaveBeenCalledWith({
        calendarId: "cal-1",
        orderedIds: ["b", "a", "c"],
      })
    )

    // The list moved before the server answered, so the first question can no
    // longer go up and the one that moved now can.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Move Contact number up" })
      ).toBeEnabled()
    )
    expect(
      screen.getByRole("button", { name: "Move What service? up" })
    ).toBeDisabled()
  })

  it("explains what is already collected when there are no questions", () => {
    render(<FormBuilder calendarId="cal-1" fields={[]} />)

    expect(screen.getByText("No extra questions yet")).toBeInTheDocument()
    expect(
      screen.getByText(/never have to ask for those/)
    ).toBeInTheDocument()

    for (const starter of STARTER_FIELDS) {
      expect(
        screen.getByRole("button", { name: starter.label })
      ).toBeInTheDocument()
    }
  })

  it("adds a sensible field from a one-tap starter", async () => {
    const user = userEvent.setup()
    render(<FormBuilder calendarId="cal-1" fields={[]} />)

    await user.click(screen.getByRole("button", { name: "What service?" }))

    await waitFor(() =>
      expect(saveField).toHaveBeenCalledWith({
        calendarId: "cal-1",
        label: "What service?",
        type: "select",
        help: "",
        placeholder: "",
        required: true,
        options: ["Consultation", "Full service", "Follow-up"],
      })
    )
  })
})
