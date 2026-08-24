import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ImageField } from "./image-field"

const actions = vi.hoisted(() => ({
  setBusinessImage: vi.fn(),
  setImageCrop: vi.fn(),
  removeBusinessImage: vi.fn(),
}))
vi.mock("@/features/business/actions", () => actions)

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
}))
const supabase = vi.hoisted(() => ({ value: null as unknown }))

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => supabase.value,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const URL_STORED = "https://example.test/storage/logo.png"

beforeEach(() => {
  vi.clearAllMocks()
  actions.setBusinessImage.mockResolvedValue({ ok: true })
  actions.setImageCrop.mockResolvedValue({ ok: true })
  actions.removeBusinessImage.mockResolvedValue({ ok: true })
  storage.upload.mockResolvedValue({ error: null })
  storage.remove.mockResolvedValue({ error: null })
  supabase.value = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    storage: { from: () => storage },
  }

  // jsdom has no object URLs.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview")
  globalThis.URL.revokeObjectURL = vi.fn()
})

function pngFile(name = "logo.png", type = "image/png") {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

/** The hidden input is sr-only, so it is found by its accept list. */
function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

describe("ImageField with nothing uploaded yet", () => {
  it("invites an upload instead of showing an empty frame", () => {
    render(
      <ImageField kind="logo" label="Logo" hint="Bilog ang hugis" url={null} />
    )
    expect(screen.getByText("Bilog ang hugis")).toBeInTheDocument()
  })

  it("has no manage controls to offer yet", () => {
    render(<ImageField kind="logo" label="Logo" hint="x" url={null} />)
    expect(
      screen.queryByRole("button", { name: /Baguhin ang logo/ })
    ).not.toBeInTheDocument()
  })
})

describe("choosing a file", () => {
  it("frames it BEFORE uploading anything", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ImageField kind="logo" label="Logo" hint="x" url={null} />
    )

    await user.upload(fileInput(container), pngFile())

    // The framing step is on screen...
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Okay, i-upload/ })).toBeInTheDocument()
    // ...and nothing has been sent. Uploading first would put the wrong crop
    // on a public page and spend mobile data on a picture about to be moved.
    expect(storage.upload).not.toHaveBeenCalled()
    expect(actions.setBusinessImage).not.toHaveBeenCalled()
  })

  it("uploads only once the framing is confirmed", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ImageField kind="logo" label="Logo" hint="x" url={null} />
    )

    await user.upload(fileInput(container), pngFile())
    await user.click(await screen.findByRole("button", { name: /Okay, i-upload/ }))

    await waitFor(() => expect(storage.upload).toHaveBeenCalled())
    expect(actions.setBusinessImage).toHaveBeenCalled()

    // The path and the framing travel together, so the picture is never live
    // in a crop nobody chose.
    const sent = actions.setBusinessImage.mock.calls[0][0]
    expect(sent.kind).toBe("logo")
    expect(sent.path).toMatch(/^user-1\/logo-\d+\.png$/)
    expect(sent.crop).toEqual({ zoom: 1, x: 50, y: 50 })
  })

  it("sends the canonical type, not the one the browser reported", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ImageField kind="logo" label="Logo" hint="x" url={null} />
    )

    // image/jpg is refused by the bucket; image/jpeg is not.
    await user.upload(fileInput(container), pngFile("shop.jpg", "image/jpg"))
    await user.click(await screen.findByRole("button", { name: /Okay, i-upload/ }))

    await waitFor(() => expect(storage.upload).toHaveBeenCalled())
    const [path, , options] = storage.upload.mock.calls[0]
    expect(options.contentType).toBe("image/jpeg")
    expect(path).toMatch(/\.jpg$/)
  })

  it("abandons the file if the framing is cancelled", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ImageField kind="logo" label="Logo" hint="x" url={null} />
    )

    await user.upload(fileInput(container), pngFile())
    await user.click(await screen.findByRole("button", { name: "Cancel" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(storage.upload).not.toHaveBeenCalled()
    // The blob URL is released; leaving it would pin the file in memory.
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview")
  })

  it("refuses a file the bucket would refuse, before spending the upload", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ImageField kind="logo" label="Logo" hint="x" url={null} />
    )

    await user.upload(fileInput(container), pngFile("notes.pdf", "application/pdf"))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("does not leave an orphan when the row will not point at the file", async () => {
    const user = userEvent.setup()
    actions.setBusinessImage.mockResolvedValue({ ok: false, message: "no" })
    const { container } = render(
      <ImageField kind="logo" label="Logo" hint="x" url={null} />
    )

    await user.upload(fileInput(container), pngFile())
    await user.click(await screen.findByRole("button", { name: /Okay, i-upload/ }))

    await waitFor(() => expect(storage.remove).toHaveBeenCalled())
  })
})

describe("a picture that is already there", () => {
  it("is itself the control", async () => {
    const user = userEvent.setup()
    render(<ImageField kind="logo" label="Logo" hint="x" url={URL_STORED} />)

    // One large target rather than a row of small buttons above it.
    await user.click(screen.getByRole("button", { name: /Baguhin ang logo/ }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Ayusin ang pagkakalagay/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Mag-upload ng bago/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Tanggalin/ })).toBeInTheDocument()
  })

  it("no longer carries Ayusin and Tanggalin beside its label", () => {
    render(<ImageField kind="logo" label="Logo" hint="x" url={URL_STORED} />)
    // They live in the modal now; nothing but the label and the picture is on
    // the page itself.
    expect(
      screen.queryByRole("button", { name: /Ayusin ang pagkakalagay/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Tanggalin$/ })
    ).not.toBeInTheDocument()
  })

  it("re-frames without moving any bytes", async () => {
    const user = userEvent.setup()
    render(
      <ImageField
        kind="logo"
        label="Logo"
        hint="x"
        url={URL_STORED}
        crop={{ zoom: 2, x: 30, y: 70 }}
      />
    )

    await user.click(screen.getByRole("button", { name: /Baguhin ang logo/ }))
    await user.click(
      await screen.findByRole("button", { name: /Ayusin ang pagkakalagay/ })
    )
    await user.click(await screen.findByRole("button", { name: "I-save" }))

    await waitFor(() => expect(actions.setImageCrop).toHaveBeenCalled())
    expect(actions.setImageCrop).toHaveBeenCalledWith({
      kind: "logo",
      crop: { zoom: 2, x: 30, y: 70 },
    })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it("deletes from the same modal", async () => {
    const user = userEvent.setup()
    render(<ImageField kind="logo" label="Logo" hint="x" url={URL_STORED} />)

    await user.click(screen.getByRole("button", { name: /Baguhin ang logo/ }))
    await user.click(await screen.findByRole("button", { name: /Tanggalin/ }))

    await waitFor(() =>
      expect(actions.removeBusinessImage).toHaveBeenCalledWith("logo")
    )
  })
})

describe("the cover photo behaves the same way", () => {
  it("offers the same three choices", async () => {
    const user = userEvent.setup()
    render(
      <ImageField kind="cover" label="Cover photo" hint="x" url={URL_STORED} />
    )

    await user.click(screen.getByRole("button", { name: /Baguhin ang cover photo/ }))

    expect(
      await screen.findByRole("button", { name: /Ayusin ang pagkakalagay/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Mag-upload ng bago/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Tanggalin/ })).toBeInTheDocument()
  })

  it("frames before uploading, and saves against the cover", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ImageField kind="cover" label="Cover photo" hint="x" url={null} />
    )

    await user.upload(fileInput(container), pngFile())
    expect(storage.upload).not.toHaveBeenCalled()

    await user.click(await screen.findByRole("button", { name: /Okay, i-upload/ }))
    await waitFor(() => expect(actions.setBusinessImage).toHaveBeenCalled())
    expect(actions.setBusinessImage.mock.calls[0][0].kind).toBe("cover")
  })
})
