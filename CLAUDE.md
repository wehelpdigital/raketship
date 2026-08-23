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
