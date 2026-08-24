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
  `gray-*`/`slate-*`/`bg-white`.

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

The forged-owner case is why the insert policy matches `c.user_id = bookings.user_id`
— without it anyone could file bookings into someone else's account. `public-actions.ts`
must keep recomputing the slot with `buildSlots()` rather than trusting the posted
`startsAt`, and re-validating answers server-side with `validateAnswers()`.

Adding a question type is one entry in `src/lib/booking/fields.ts` — the builder's
type picker, the public renderer and validation all read from it.
