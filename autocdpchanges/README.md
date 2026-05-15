# AutoCDP — DriveCentric-Inspired UI Pack

This bundle adds DriveCentric-style pages to AutoCDP, layered on top of the
existing navy + emerald theme. Everything is additive — no existing files are
overwritten.

## What you're getting

| Component / Page | File | Purpose |
|---|---|---|
| `CustomerDetailPanel` | `src/components/customers/customer-detail-panel.tsx` | The right-side overlay that opens on lead click. Two stacked cards: summary rail + activity workspace. |
| `LeadsList` | `src/components/customers/leads-list.tsx` | Sortable lead table with clickable rows. Loads detail via callback. |
| `SalesEngagementHub` | `src/components/pipeline/sales-engagement-hub.tsx` | Horizontal funnel: Engaged → Visit → Proposal → Sold → Delivered + channel totals. |
| `MiningKPIGrid` | `src/components/mining/mining-kpi-grid.tsx` | Grid of saved-query tiles with counts. |
| `AppointmentsTable` | `src/components/appointments/appointments-table.tsx` | Day-bucketed appointment list. |
| `EmailBlastTable` | `src/components/email-blast/email-blast-table.tsx` | Campaign log with AI score badge per blast. |
| `ReputationDashboard` | `src/components/reputation/reputation-dashboard.tsx` | Total reviews, avg rating + 5/4/3/2/1 distribution, channel cards, review list. |
| `WorkplanPage` | `src/components/workplan/workplan-page.tsx` | Daily action list with progress bars + celebration state. |
| `PageHeader` | `src/components/shared/page-header.tsx` | Standard page header — coloured icon tile + title + actions. Used by every new page. |

## Route entry points (already wired)

- `src/app/dashboard/pipeline/page.tsx`
- `src/app/dashboard/customers/page.tsx` ← **replaces** the existing customers page
- `src/app/dashboard/mining/page.tsx`
- `src/app/dashboard/appointments/page.tsx`
- `src/app/dashboard/email-blast/page.tsx`
- `src/app/dashboard/reputation/page.tsx`
- `src/app/dashboard/workplan/page.tsx`

Each route file currently uses a stub fetcher (clearly marked `// TODO`).
Swap them for real Supabase queries when you're ready — the component
contracts won't change.

## How to apply

1. **Copy the file tree** under `src/` into the same paths in your repo. The
   directories are: `components/customers`, `components/pipeline`,
   `components/mining`, `components/appointments`, `components/email-blast`,
   `components/reputation`, `components/workplan`, `components/shared`, and
   `app/dashboard/{pipeline,mining,appointments,email-blast,reputation,workplan}`.
2. **Replace** `src/app/dashboard/customers/page.tsx` with the new version
   (it preserves your existing Supabase fetch pattern; you just need to point
   `fetchLeadsList()` and `loadCustomerDetail()` at real queries).
3. **Merge** the entries from `src/components/layout/sidebar-additions.ts`
   into your existing `src/components/layout/sidebar.tsx`. The file has
   inline guidance on exactly which group each item belongs in.

That's it. No migrations, no env var changes, no agent changes.

## Design conventions that this UI respects

These come straight from `AUTOCDP_PROJECT_SUMMARY.md` § 7 and § 8 — none of
the rules below are broken by this UI pack:

- **Palette**: brand indigo, emerald success, navy sidebar, slate text. The
  DriveCentric "primary green" is mapped to your existing `emerald-500` so
  the look feels native.
- **Cards**: `rounded-xl shadow-sm` with `hover:shadow-md` transitions, as
  defined in your existing convention.
- **Badges**: pill-shaped, colour-coded by lifecycle stage or status.
- **AI affordances**: every place an agent could help (Genius Summary,
  composer, Ask AI button on the Pipeline page, AI Draft inside the
  composer) uses the `Sparkles` icon and the indigo→fuchsia gradient that
  you already use for AI features in other parts of the app. Hooks are
  marked but **no agent endpoints are called yet** — you wire those when
  ready, going through `/api/agents/test` per the rules in § 8.
- **Multi-tenancy**: every data fetcher in the route files is a server-side
  function. Replace stubs with `createServerClient()` calls that go through
  RLS, exactly as documented.
- **Compliance / metering**: no UI in this pack sends messages, so no rate
  limit / billing event call is required. When you wire the composer's
  Save button to `/api/sms/send` or `/api/email/send`, those endpoints
  already handle `checkRateLimit()` + `recordBillingEvent()`.

## Customer detail panel — UX behaviour

This is the centerpiece, so here's exactly how it works:

1. User clicks a row in `LeadsList`.
2. `LeadsList` calls the parent-provided `loadDetail(id)` and shows a small
   spinner overlay while the fetch is in flight.
3. When the data resolves, `CustomerDetailPanel` mounts as a fixed overlay
   anchored to the right edge of the viewport.
4. The overlay has a darkened backdrop. Clicking the backdrop closes the
   panel. The X button in the panel header also closes it.
5. Inside the overlay, two cards sit side by side:
   - **Summary rail** (360px wide): identity, contact rows, Genius Summary
     button (or rendered summary), Wish List, Best Contact Method radial,
     Details (Sales 1/2, BDC, Service BDC), Open Deal, Garage, Customer
     Notes.
   - **Workspace** (fills remaining width): name + email + phone header,
     tabs (Activity / Conversation / Open / Deals / Value), composer
     (Note / Call / Email / Text / Video / Task / Appt) with an AI Draft
     button, PLANNED divider + planned task cards, PAST divider + filter
     pills + timeline entries, and a right-edge Actions sidebar (Add
     Vehicles / Trade In / Credit App; Check In / Documents / Portal /
     Push / Mark as Sold / Dead).
6. The composer's `Save` button is wired to local state. Hooking it up to
   real send routes is left to you — see § 8 of the project summary for
   the rate-limit + audit-log requirements.

## What is intentionally NOT done

So you know what to wire next:

- **Real Supabase queries** in the seven route files. The shape each one
  must return is fully typed by the props of the component it renders, so
  TypeScript will catch any drift.
- **Genius Summary generation** — currently a placeholder button. Hook it
  to `/api/agents/test` with a single-customer prompt that uses the
  existing Creative Agent.
- **Best contact method scoring** — currently visual-only. The radial
  reads `customer.best_contact_method`, which you should compute from
  `communications.status='delivered'` aggregations per channel.
- **AI Draft in the composer** — hook to your existing agent endpoint when
  ready. The Sonnet 4.6 specialist used elsewhere is the right model.
- **Email score grader** — same pattern: a single Sonnet call evaluating
  subject + body; cache the result on the campaign row.

Everything else (visuals, layout, animation, responsive behaviour, keyboard
nav for close, table sort affordances, theme alignment) is in place.
