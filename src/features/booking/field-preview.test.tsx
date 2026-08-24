import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  FieldPreview,
  answerToBool,
  answerToList,
  answerToText,
} from "@/features/booking/field-preview"
import type { BookingFormFieldRow } from "@/lib/supabase/types"

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

describe("FieldPreview", () => {
  it("renders a multiple choice question with its options and a required marker", () => {
    render(
      <FieldPreview
        field={makeField({
          id: "svc",
          label: "What service?",
          type: "select",
          required: true,
          options: ["Haircut", "Color", "Rebond"],
        })}
      />
    )

    expect(screen.getByText("What service?")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Haircut" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Color" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Rebond" })).toBeInTheDocument()

    // The asterisk carries the title so it is announced, not just seen.
    expect(screen.getByTitle("Required")).toBeInTheDocument()
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-required",
      "true"
    )
  })

  it("says so plainly when a choice question has no choices yet", () => {
    render(
      <FieldPreview field={makeField({ type: "select", options: [] })} />
    )

    expect(screen.getByText("No choices yet.")).toBeInTheDocument()
  })

  it("asks for the right mobile keyboard per type", () => {
    const { rerender } = render(
      <FieldPreview field={makeField({ label: "Email", type: "email" })} />
    )
    const email = screen.getByLabelText("Email")
    expect(email).toHaveAttribute("type", "email")
    expect(email).toHaveAttribute("inputmode", "email")

    rerender(
      <FieldPreview field={makeField({ label: "Mobile", type: "phone" })} />
    )
    const phone = screen.getByLabelText("Mobile")
    expect(phone).toHaveAttribute("type", "tel")
    expect(phone).toHaveAttribute("inputmode", "tel")

    rerender(
      <FieldPreview field={makeField({ label: "How many?", type: "number" })} />
    )
    expect(screen.getByLabelText("How many?")).toHaveAttribute(
      "inputmode",
      "decimal"
    )
  })

  it("is inert with no onChange, and live with one", async () => {
    const { rerender } = render(
      <FieldPreview field={makeField({ label: "Notes", type: "long_text" })} />
    )
    expect(screen.getByLabelText("Notes")).toHaveAttribute("readonly")

    const onChange = vi.fn()
    rerender(
      <FieldPreview
        field={makeField({ label: "Notes", type: "long_text" })}
        value=""
        onChange={onChange}
      />
    )
    const box = screen.getByLabelText("Notes")
    expect(box).not.toHaveAttribute("readonly")

    await userEvent.type(box, "Hi")
    expect(onChange).toHaveBeenCalled()
  })

  it("adds and removes from a checkbox list", async () => {
    const onChange = vi.fn()
    render(
      <FieldPreview
        field={makeField({
          label: "Add-ons",
          type: "multi_select",
          options: ["Blow dry", "Massage"],
        })}
        value={["Blow dry"]}
        onChange={onChange}
      />
    )

    await userEvent.click(screen.getByRole("checkbox", { name: "Massage" }))
    expect(onChange).toHaveBeenCalledWith(["Blow dry", "Massage"])

    await userEvent.click(screen.getByRole("checkbox", { name: "Blow dry" }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("spells out what an upload will take", () => {
    render(
      <FieldPreview field={makeField({ label: "Proof", type: "upload" })} />
    )

    expect(screen.getByText("Photo or PDF, up to 10MB")).toBeInTheDocument()
    expect(screen.getByLabelText(/Proof/)).toHaveAttribute(
      "accept",
      "image/*,application/pdf"
    )
  })

  it("shows the hint and the error, and wires them to the control", () => {
    render(
      <FieldPreview
        field={makeField({
          id: "mob",
          label: "Mobile",
          help: "We only text about this booking.",
          required: true,
        })}
        error="Mobile is required."
      />
    )

    expect(
      screen.getByText("We only text about this booking.")
    ).toBeInTheDocument()
    expect(screen.getByText("Mobile is required.")).toBeInTheDocument()
    expect(screen.getByLabelText(/Mobile/)).toHaveAttribute(
      "aria-describedby",
      "mob-help mob-error"
    )
  })
})

describe("answer coercion", () => {
  it("never throws on a shape it did not expect", () => {
    expect(answerToText(null)).toBe("")
    expect(answerToText(undefined)).toBe("")
    expect(answerToText(12)).toBe("12")
    expect(answerToText(["a", "b"])).toBe("a, b")

    expect(answerToList("solo")).toEqual(["solo"])
    expect(answerToList(null)).toEqual([])
    expect(answerToList(["a"])).toEqual(["a"])

    expect(answerToBool(true)).toBe(true)
    expect(answerToBool("on")).toBe(true)
    expect(answerToBool(null)).toBe(false)
  })
})
