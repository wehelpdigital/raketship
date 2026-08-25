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

**`supabase/setup.sql` is GENERATED** by `npm run db:setup`, and `npm run verify`
fails when it is stale. It is a second source of truth for the schema, and it
drifted twice before the check existed — the second time omitting the migration
that adds `cancel_notice_hours`, a column every calendar insert names
unconditionally, so a paste-provisioned project could not create a calendar at
all. Never hand-edit it.

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

**The logo is always a circle; the cover is always a 3:1 banner.** Both throw
away most of a phone photo, so both are framed by the owner. `lib/business/crop.ts`
holds it: `object-fit: cover` guarantees the frame is filled whatever the aspect
ratio, `object-position` picks which part shows, and `transform-origin` tracks it
so zooming stays on the chosen point. Three numbers per picture, no clamping
invariant to get wrong, and no crop can leave a gap. `dragCrop` takes width AND
height — sharing one number made a vertical drag across the banner move three
times as far as a horizontal one. The original file is never re-encoded.

**The public header is one block: photo left, facts right.** Logo, then the
name, what is being booked, the length, the zone and the location. The COVER is
not on the public page — it was a 3:1 band that pushed all of that below the
fold on a phone to show a picture answering none of it. It is still uploadable
and still previewed in the module, so it is there for whatever wants it next.

**One gate for where a business is.** `lib/business/address.ts` owns both
`addressLine` (header) and `landmarkLine` (footer). They are together because if
they ever disagreed about what "hidden" means, the disagreement would be
someone's home address on a public page.

**Framing is a step in the upload, not a repair afterwards.** Choose a file ->
frame it -> confirm, and only then does it upload, with the path and the crop
saved in one call. Uploading first would put the wrong crop on a public page
until someone noticed, and spend a raketero's mobile data on a picture they were
about to move. Once a picture exists, the picture IS the control: tapping it
opens Ayusin / Mag-upload ng bago / Tanggalin. One large target beats a row of
small buttons at 390px.

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

## Language

The app speaks Filipino by default and English by choice. The choice is a
plain COOKIE (`raketship-locale`), not a URL segment — booking links get
pasted into Facebook, and a /en/ in the link would fork every share into two.
The root layout reads it once server-side and hands it down through
`LocaleProvider`; client components use `useT()`, server components
`getT()`. The toggle sits beside the theme toggle and draws its flags as
inline SVG because Windows renders flag emoji as boxed letters.

Messages live in `src/lib/i18n/messages/*` with BOTH languages on the same
line — a split fil/en file drifts the first time somebody adds a string in a
hurry. Filipino counted phrases go through `tagalogCount()` in
`lib/i18n/numbers.ts`, which spells the number and picks the linker ("tatlong
araw", "apat NA araw") — getting the linker wrong is not a typo, it is a
foreign accent. The two languages are allowed different shapes: "Sa loob ng
tatlong araw" vs "In 3 days".

Most of the app is still hard-coded Filipino. New user-facing strings in the
areas already converted (the Booked page, the shell) must go through the
dictionary; converting the rest is incremental work.

**The `animate-in` / `fade-in-0` / `zoom-in-95` classes used in
dialog.tsx, dropdown-menu.tsx and select.tsx DO NOT EXIST** — the plugin that
defines them was never installed, so those are dead classes and the components
simply appear. Animations here are hand-written keyframes in `globals.css`
(`pop-in`, `step-enter`, the confirm family) or Base UI's measured-height
collapsible (`--collapsible-panel-height`).

## Booking module

Six tables: `booking_calendars`, `booking_availability`, `booking_blackouts`,
`booking_form_fields`, `bookings` (`0004_booking_module.sql`) and
`booking_services` (`0006_booking_services.sql`).

**Booked** searches, filters and pages IN THE BROWSER over rows already loaded.
A raket has tens or hundreds of bookings, not millions, and instant beats a
round trip per keystroke. Rows collapse to a scannable line and open one at a
time — a list where every row is expanded is a list you cannot scan. The pure
parts (matching, paging, the page window) live in `lib/booking/booked-filter.ts`
so they are testable without rendering.

**Booked** (`/modules/booking/booked`) lists what came in through the public
pages, split into upcoming, finished and cancelled around ONE clock read — a
booking is upcoming until it ENDS, so the one in progress is still today's
problem. A confirmed booking is unbookable twice over: `getTakenSlots` counts
only confirmed rows, and a partial unique index on `(calendar_id, starts_at)
where status = 'confirmed'` makes a second one a 409. Cancelling sets the status
rather than deleting the row, which is what hands the slot back to both.

The badge count lives in the app LAYOUT, which the client router cache holds
for the life of the tab — and a booking arrives in somebody ELSE's browser, so
nothing here can be told about it. Two things keep it honest: submitBooking()
revalidates the owner-facing paths including `("/", "layout")`, and `StaleRefresh`
refetches when the tab is looked at again after being away. Without both, an
owner who left the app open kept seeing whatever the count was when they loaded
it.

Sub-navigation lives in `moduleSubItems()` in `components/shell/module-nav.ts` —
written out per module, because these are bespoke routes the generic module page
knows nothing about. `isModuleActive()` excludes the children so the parent and
the child never light up together. The desktop rail folds them away; the badge
beside Booked counts bookings still to come and is a head count, not a fetch.

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

**Every public booking passes an anti-robot check.** Not optional, not in the
form builder: a raketero should not have to know what a bot is, and an owner who
could switch it off would eventually be the one who did. No third-party captcha
either — those want an account, two keys and a script from someone else's domain.
`lib/booking/captcha.ts` mints an HMAC-signed, time-limited nonce; the browser
spends ~65k SHA-256 hashes finding a 16-bit proof-of-work while the customer is
still picking a date; the server re-checks signature, age, work, a honeypot and
a minimum fill time, then CONSUMES the nonce in `booking_challenges` so it
cannot be replayed. Every failure returns the same sentence — naming the check
would tell a script what to fix. The hash is our own `sha256.ts` rather than
`crypto.subtle`, which does not exist on the plain-http LAN address a raketero
tests from; it is verified against node:crypto in a test.

**Bookings are written by the SERVER, not by the visitor.** 0012 removed the
anonymous insert policy that 0004 added. Measured first: an anonymous POST
naming the calendar's own owner returned 201, and the owner id is on the public
page — so a script could skip the form and the check with it. `submitBooking()`
now writes with the service key after its own checks. Reads are untouched; RLS
still decides what a stranger may SEE.

**The public surface.** `/book/[slug]` is unauthenticated and outside the app
shell, so RLS is the only guard. Verified against the live database:

| Anonymous attempt | Result |
|---|---|
| Read a draft calendar | `[]` |
| Read it once published | visible |
| Read anyone's bookings | `[]` |
| Book a published calendar via the server action | `201` |
| Insert a booking directly | `401` |
| Spend a captcha nonce directly | `401` |
| Replay a spent nonce | `409` |
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
