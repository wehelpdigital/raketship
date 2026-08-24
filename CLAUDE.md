# RaketShip — working notes

Mobile-first SaaS for Filipino MSMEs. Free tier → Basic subscription → buy individual
marketplace **modules** → upgrade each module through its own tier ladder ("tingi" pricing).
The centrepiece is **Build your Raket**: an outer drag-and-drop canvas of modules, each of
which opens an inner canvas. Booking ships pre-wired Booking → Timer → Email.

## Stack facts that bite

- **Next.js 16.** `middleware.ts` is deprecated — this repo uses **`src/proxy.ts`** exporting
  a function named `proxy`. The proxy runtime is nodejs and is not configurable.
- `params` and `searchParams` are **Promises**. So are `cookies()` and `headers()`.
- Turbopack is the default for `next dev` and `next build`.
- `<html>` carries `data-scroll-behavior="smooth"` because Next 16 no longer overrides
  `scroll-behavior` on navigation and `globals.css` sets it.
- **Tailwind v4** — CSS-first. Tokens live in `src/app/globals.css`. There is **no**
  `tailwind.config.*`. Dark mode is the `.dark` class via `@custom-variant`.
- **shadcn/ui sits on `@base-ui/react`, not Radix.** Radix-only props will not work.
  There is **no `form` component** and no `react-hook-form` — use server actions with
  `useActionState`, or controlled inputs.
- Supabase has the **new API key system** enabled: prefer
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`). The legacy anon JWT still
  authenticates, but it is the deprecated path.
  When probing with curl, note that `GET /rest/v1/` answers `Invalid API key` for any key
  except `service_role` — that is the endpoint's rule, not a broken key. Probe a real
  table instead.

## Non-negotiables

- **Never crash on empty.** The app must render when Supabase is unconfigured or the
  tables are missing. `getSupabaseServerClient()` and `getSupabaseBrowserClient()` return
  `null` in that case; queries return `null`/`[]`. Show `SetupNotice`, not a stack trace.
- **Every server action re-checks `getCurrentUser()`** and scopes writes by `user_id`.
  Never trust an id from the client. `SUPABASE_SECRET_KEY` is server-only and bypasses RLS.
- **Never interpolate Tailwind class names** (`` bg-${accent} ``). The scanner cannot see
  them. Use a static lookup map.
- **Tokens only** — `bg-card`, `text-muted-foreground`, `bg-chart-1/12`. No raw hex, no
  `gray-*`/`slate-*`/`bg-white`. The one exception is a palette swatch, which IS the
  colour and is painted with an inline `style`.

## Spacing scale (the user cares about this)

| Context | Class |
|---|---|
| Page gutter | `px-4 sm:px-6` |
| Page vertical | `py-6` |
| Between sections | `space-y-6` |
| Within a section | `space-y-3` |
| Card padding | `p-4 sm:p-5` |
| Clear the bottom nav | `pb-24 md:pb-6` |
| Primary action height | `h-11` (≥44px tap target) |

Design at 390px first. No horizontal scroll, ever.

## Adding a builder element

One entry in `src/lib/flow/registry.ts` — the palette, node card, inspector form and tier
gating all read from it. To sell it, add its `type` to the relevant tier's `node_types` in
`supabase/migrations/0002_seed_catalog.sql`.

## Database

`flows.kind` discriminates the two canvases: `'raket'` is the outer board (one per raket),
`'module'` is an inner board linked back via `parent_node_id`. One `flow_nodes`/`flow_edges`
schema serves both.

Apply migrations with `npm run db:push` (needs `SUPABASE_DB_URL`), or paste
`supabase/setup.sql` into the Supabase SQL Editor. Both are idempotent.
`npm run db:seed-admin` creates the pre-confirmed demo admin behind the one-click login.

## Before calling anything done

```bash
npm run verify   # typecheck + lint + test
```

## Your Business module

Every account has it — `modules.is_default = true` and `sort_order = -1`, so
provisioning hands it out and it sorts above Booking. `/modules/business` is a
static segment shadowing `/modules/[moduleId]`, exactly like `/modules/booking`.

`business_profiles` is one row per user (`0007_business_profile.sql`): identity,
logo and cover paths, palette key, contact, payment, address.

**`business_name` exists twice, on purpose.** `profiles` is owner-only under RLS
and also holds the email and the admin flag, and RLS grants access by ROW rather
than by column — so opening it to the anonymous booking page would hand out the
email with the shop name. `saveBusinessProfile()` writes both copies in one call.

**Address visibility defaults to `area`**, which drops the street **and the
landmark** — "katapat ng Mercury Drug, kulay dilaw na gate" locates a house as
precisely as a street number, so gating one without the other defeats the
setting for exactly the person it protects. It governs the PUBLIC PAGE only;
the form always shows every address box, because hiding an input someone has
already typed into reads as data loss.

**The logo is always a circle.** `LogoMask` is the single component for every
place one appears, and `lib/business/logo.ts` holds the framing: `object-fit:
cover` guarantees the mask is filled whatever the aspect ratio, `object-position`
picks which part shows, and `transform-origin` tracks it so zooming stays on the
chosen point. Three numbers, no clamping invariant to get wrong, and no crop can
leave a gap. The original file is never re-encoded, so framing stays adjustable.

**Colour themes.** `src/lib/theme/palettes.ts` is generated and then reviewed.
Every pair is measured, never eyeballed: `primaryForeground` clears 4.5:1 on
`primary` in both modes, `accentForeground` clears 7:1 on `accent`, nothing
clips out of sRGB, and every dark primary is lifted because full-chroma colour on
near-black vibrates. `palettes.test.ts` re-derives the contrast maths
independently so a bug in the generator cannot certify its own output. `pula` is
pinned to the tokens already in `globals.css` — the default must repaint nothing.

Applying one is `<PaletteStyle preset={key} />`, server-rendered in both the app
shell and `/book/[slug]`, so the colour is in the first byte and never flashes red
first. Two details are load-bearing:

- The CSS selector is `html:root` (0,1,1), which beats `globals.css`'s `:root`
  (0,1,0) on **specificity, not source order** — React hoists style tags, so
  order is not ours to depend on.
- The properties land on the root element. Dialogs and dropdowns portal to
  `document.body`, so a theme scoped to a wrapper would leave every one of them
  in the default red.

An unknown key falls back to the brand rather than rendering nothing, so removing
a palette cannot break the pages of everyone who chose it.

**What the browser calls a file is not what the bucket lists.** Measured against
the live bucket: `image/jpeg` and `image/webp` are accepted, but `image/jpg`,
`image/pjpeg` and `application/octet-stream` are all refused with a 400 — and
those are what a plain .jpg reports on some systems, and what anything that has
been through a chat app reports everywhere. `normaliseImageType()` canonicalises
from the reported type, then from the filename, before anything is checked or
uploaded. Add a format in one place: the map there AND the bucket's
`allowed_mime_types`, which matches literally.

**Uploads go browser -> Supabase, never through a server action.** Next caps a
server action request body at 1MB by default and enforces it in the transport,
so a 2MB phone photo threw before the action ran and the client could only say
"something went wrong". The browser now uploads with its own session and sends
only the resulting PATH to `setBusinessImage`, which re-checks that the path is
in the caller's own folder — a path from a browser is a claim, not a fact. The
real guards were never in our code anyway: the bucket enforces 5MB and the
allowed MIME types, and its RLS policy enforces the folder.

**Storage.** `business-media` is **public**, unlike `booking-uploads` — these
images sit in links people paste into Facebook, and a signed URL expires long
before the post does. Objects live under `<uid>/`, and the bucket needs a
**select** policy as well as insert/update/delete: the storage API resolves the
row before deleting it, and without select the owner's own remove came back 403
while every replaced logo stayed behind as an orphan.

## Booking module

Six tables: `booking_calendars`, `booking_availability`, `booking_blackouts`,
`booking_form_fields`, `bookings` (`0004_booking_module.sql`) and
`booking_services` (`0006_booking_services.sql`).

**Routing:** `/modules/booking` is a static segment and deliberately shadows the
dynamic `/modules/[moduleId]`. Booking gets a bespoke home; every other module
falls through to the generic one. Don't "tidy" the duplicate away.

**Times.** Availability is stored as **minutes from midnight** (540 = 09:00) and
means nothing without the calendar's `timezone`. Weekday 0 = Sunday, matching JS
`getDay()`. Never interpret those minutes in the server's or the browser's zone.
Zone maths lives in `src/lib/booking/slots.ts` and goes through `Intl` — there is
no date library to keep current with tzdata.

**How long a booking runs** has two answers, chosen by
`booking_calendars.length_mode`:

- `fixed` — `duration_minutes` applies to everything. Picked as hours plus
  minutes in tens (`MINUTE_STEPS` in `slots.ts`); a stored value that predates
  the picker is kept in the list rather than rounded away.
- `catalog` — `booking_services` rows each carry their own price and length,
  and **the customer's choice decides the length**. That is why the service step
  comes before the date on the public page: without a length there are no slots
  to compute at all. The owner's weekly hours still bound everything — a
  two-hour service simply finds no room in a one-hour window.

Never trust a length or a price from the browser. `resolveService()` in
`public-actions.ts` reads both off the stored row; `bookings` then **snapshots**
`service_name` and `service_price_centavos` so renaming or deleting a service
cannot rewrite what someone already agreed to (`service_id` is
`on delete set null`, the snapshot survives).

Switching to `catalog` with an empty list is refused server-side, and deleting
the last service falls the calendar back to `fixed` — a live page must never be
left with nothing to offer and no way forward.

**The public surface.** `/book/[slug]` is unauthenticated and outside the app
shell, so RLS is the only guard. Verified against the live database:

| Anonymous attempt | Result |
|---|---|
| Read a draft calendar | `[]` |
| Read it once published | visible |
| Read anyone's bookings | `[]` |
| Book a published calendar | `201` |
| Book the same slot twice | `409` |
| Book an unpublished calendar | `401` |
| Book under a forged `user_id` | `401` |
| Read services of a draft calendar | `[]` |
| Read them once published | visible |
| Insert a service | `401` |
| Read a business profile with no live calendar | `[]` |
| Read it once a calendar is published | visible |
| Read `profiles` (the email) | `[]` |
| Write a business profile | refused |
| Upload into another user's media folder | `400` |

The forged-owner case is why the insert policy matches `c.user_id = bookings.user_id`
— without it anyone could file bookings into someone else's account. `public-actions.ts`
must keep recomputing the slot with `buildSlots()` rather than trusting the posted
`startsAt`, and re-validating answers server-side with `validateAnswers()`.

Adding a question type is one entry in `src/lib/booking/fields.ts` — the builder's
type picker, the public renderer and validation all read from it.
