# AutoCDP — What We've Built

> An AI-native, self-evolving Customer Data Platform for auto dealerships — built on Next.js, Supabase, and Anthropic Claude.

---

## 1. Project Overview

AutoCDP is a multi-tenant SaaS platform purpose-built for auto dealerships that replaces fragmented, rules-based CRM tools with a single AI-first system. It ingests customer and service visit data, runs a coordinated five-agent Claude swarm to segment, target, personalize, and execute campaigns, and fulfills those campaigns natively through physical direct mail — with SMS and email coming next.

The core value proposition rests on three differentiators:

**Autonomous agentic execution.** Dealers don't configure drip sequences or write templates. They describe a campaign goal. The swarm plans the execution, selects the audience, writes personalized copy per customer using real service history, submits physical mail jobs to PostGrid, and logs outcomes — all without human intervention at each step.

**Native direct mail with AI copy.** AutoCDP is one of the only CRM platforms where the AI doesn't just suggest what to send — it writes the copy, generates a QR code, submits the print job, tracks scan responses, and triggers the next learning cycle automatically. Competitors like Fullpath offer AI insights but still require human execution. AutoCDP closes the loop end-to-end.

**A self-evolving swarm.** Every campaign makes the system measurably smarter. Scan rates, delivery patterns, and offer performance are analyzed by the Optimization Agent, which extracts anonymized findings and stores them in a shared `global_learnings` table. The Creative Agent reads these patterns before writing every future piece of copy. New dealers on the network benefit immediately from the intelligence accumulated by every dealer before them.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, fully server-component-first) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres + pgvector + Row Level Security) |
| Auth | Supabase Auth — email/password with SSR session management |
| AI / Agents | Anthropic SDK — Claude Opus 4.7 (Orchestrator), Claude Sonnet 4.6 (all specialists) |
| Direct Mail | PostGrid REST API — print fulfillment + USPS delivery |
| QR Codes | `qrcode` npm package (server-side PNG embed in PostGrid HTML) + api.qrserver.com (client preview) |
| Billing | Stripe (stub ready to wire) + Orb usage metering (stub) + internal `billing_events` table |
| Deployment | Vercel-ready — edge-compatible, no Docker required |

Agent models are configured in a single `src/lib/anthropic/client.ts` constant. Swapping Claude versions or providers is a one-line change.

---

## 3. Multi-Tenant Architecture

Every row in every table carries a `dealership_id` foreign key. Supabase Row Level Security (RLS) enforces isolation at the database engine level — one dealer's queries can never touch another's data, regardless of application-layer behavior.

The isolation chain:

1. **Auth → Dealership mapping.** On sign-in, a `user_dealerships` join table maps the authenticated user to one or more dealerships with role-based access (`owner`, `admin`, `member`).
2. **`auth_dealership_id()` SQL helper.** A `SECURITY DEFINER` function resolves the current user's dealership from `user_dealerships`. All RLS policies call this function — the lookup is computed once per transaction and cached by Postgres.
3. **Service role bypass.** Provisioning, agent execution, and direct mail submission use the Supabase service role key server-side only. It is never exposed to the browser or client.
4. **pgvector isolation.** Customer embeddings (`last_visit_embedding`, 1536-dim IVFFlat index) are scoped by `dealership_id`. Semantic similarity searches stay strictly within a single tenant.

Multi-user per dealership is fully supported. A dealer group can have multiple advisors sharing the same isolated workspace.

---

## 4. The 5-Agent Swarm (Self-Evolving)

The swarm is the core intelligence of AutoCDP. Five Claude agents coordinate through structured handoffs — each a separate module with its own system prompt, model assignment, and clear input/output contract. What makes it architecturally distinct is that the swarm now learns from its own outputs: every campaign closes a feedback loop that makes future campaigns more accurate.

### Orchestrator — Claude Opus 4.7

The entry point for every campaign. It plans the execution sequence, coordinates the specialist agents, and for direct mail campaigns runs a multi-turn Anthropic **tool-use loop**: Claude calls the `send_direct_mail` tool once per customer, the server executes the tool (PostGrid submission, QR code generation, billing event), feeds the result back as a `tool_result` content block, and continues until all customers are processed. After all sends complete, the Orchestrator automatically triggers the Optimization Agent in a fire-and-forget call — kicking off the learning cycle without blocking the campaign response.

Two modes are exported: `runOrchestrator()` for preview-only runs (used by the Agents dashboard) and `runDirectMailOrchestrator()` for full production execution.

### Data Agent — Claude Sonnet 4.6

Ingests raw customer and service visit records and produces structured insights: churn risk scores, LTV estimates, lifecycle stage distributions, and anomaly flags. Its output — a narrative summary plus a segment breakdown — is the input the Targeting Agent uses to make audience decisions.

### Targeting Agent — Claude Sonnet 4.6

Receives the Data Agent's segment analysis alongside the campaign goal and selects the optimal audience. It reasons about propensity to respond, recency of service, and channel fit. It already accepts a `globalLearnings` parameter, meaning network-wide patterns can be injected directly into its targeting reasoning.

### Creative Agent — Claude Sonnet 4.6

The most changed agent in the current build. It now runs in two phases before generating any copy:

1. **Fetch local context.** The customer's most recent visit record (vehicle, mileage, service type, technician notes) is loaded from Supabase.
2. **Fetch network context.** The agent queries `global_learnings` for patterns relevant to this customer's vehicle model first, then pads with the highest-confidence general patterns from across the network (up to 5 total). These are injected into the system prompt as a `NETWORK LEARNINGS` block.

The result is copy that draws on both what this specific customer experienced at this specific dealership *and* what the network has learned works for customers like them. The reasoning field in every response notes which patterns were applied, creating a transparent audit trail.

### Optimization Agent — Claude Sonnet 4.6

The learning engine. It runs after every successful campaign send and on the first QR scan of each mail piece (fire-and-forget, non-blocking). Its process:

1. Loads mail pieces for the requested IDs or time window — zero PII, only aggregate stats.
2. Buckets results by `template_type × vehicle_model × service_type` and computes scan rates and delivery rates per bucket.
3. Calls Claude with the anonymized stats table plus the existing `global_learnings` for deduplication context.
4. Claude extracts 0–5 specific, actionable patterns (e.g. *"postcard_6x9 with 15%-off oil-change headline for F-150 owners → 9.2% scan rate, 3× baseline"*).
5. Patterns are written to `global_learnings` with no `dealership_id` — pure statistical signal, zero PII.
6. A per-dealership audit row is written to `learning_outcomes` for local accountability.

If fewer than two sent pieces exist, the agent skips gracefully with a `status: "skipped"` response rather than fabricating patterns from insufficient data.

---

## 5. Direct Mail Module

The direct mail module is the MVP's flagship feature and is fully wired end-to-end — from campaign builder to physical USPS delivery to QR scan tracking to learning feedback.

### PostGrid Integration

`src/lib/postgrid.ts` wraps the PostGrid REST API (`/print-mail/v1/postcards`, `/print-mail/v1/letters`). It builds server-side HTML templates: a postcard front with Caveat handwriting font, ruled-line background, and embedded QR PNG data URL; a standard USPS postcard back; and a full-page letter with dealership letterhead. PostGrid renders these via headless Chromium on their infrastructure and routes to USPS for fulfillment. Test API keys (`test_sk_…`) never produce physical mail or charges.

### Handwriting Simulation Engine

`src/components/direct-mail/template-preview.tsx` renders a CSS-based handwriting effect client-side. Each character is wrapped in a `<span>` with deterministic `rotate`, `translateY`, and `scale` transforms seeded by `(i * 7 + charCode) % 13`. The result convincingly simulates robotic-pen output on uncoated paper — suitable for live demos without calling PostGrid.

### QR Code Tracking

Each mail piece is inserted into `mail_pieces` with `status: "pending"` before the PostGrid call, securing a stable UUID for the tracking URL. A server-side QR code (`qrcode` npm, PNG data URL) encoding `https://[app]/track/[id]` is embedded in the PostGrid HTML. When a customer scans the code:

- `/app/track/[id]` logs a `mail_scans` row (IP, user agent, referrer, timestamp)
- A Postgres trigger increments `mail_pieces.scanned_count`
- On the **first scan**, the Optimization Agent fires fire-and-forget to log the response signal
- The customer sees a branded landing page with a phone CTA, offer callout, and dealership address

### Campaign Builder

`src/components/direct-mail/campaign-builder.tsx` is a five-step wizard: customer multi-select with lifecycle filters → template choice (6×9 Postcard, 6×9 Letter, 8.5×11 Letter) → campaign goal entry → AI copy preview with handwriting render → send with dry-run toggle.

Above the wizard sits a **Send Test Mail** panel: pick one customer, generate AI copy, view the handwriting preview, then optionally send live to PostGrid with `isTest = true`. On success, a toast shows the PostGrid tracking ID. The last five test pieces appear in a **Recent Test Mails** card for quick QA.

### Dry Run Safety

The orchestrator defaults to `dryRun: true`. In dry run mode, the full Claude tool-use loop runs — copy is generated, the `send_direct_mail` tool is invoked — but PostGrid is never called. Dealers see exactly what would be sent and at what cost before committing.

### Webhooks

`/api/webhooks/postgrid` receives PostGrid lifecycle events (`mail.in_transit`, `mail.processed_for_delivery`, `mail.delivered`, `mail.returned_to_sender`) and updates the `mail_pieces` row status in real time.

### Direct Mail Database Tables

| Table | Purpose |
|---|---|
| `mail_pieces` | One row per job: template, AI copy, PostGrid IDs, status, QR URLs, cost, `is_test` flag |
| `mail_scans` | One row per QR scan event; Postgres trigger increments `scanned_count` on parent row |

---

## 6. Cross-Dealer Learning and Network Effects

The global learning system is the long-term moat. Every dealer on AutoCDP contributes to a shared intelligence layer — and benefits from it — without any PII ever leaving their account.

The data flow is:

```
Campaign executes → mail pieces sent → QR scans logged
        ↓
Optimization Agent aggregates stats (anonymized — no customer data)
        ↓
Claude extracts patterns → global_learnings (no dealership_id, no PII)
        ↓
Creative Agent queries global_learnings before every copy generation
        ↓
Future campaigns are measurably more personalized and effective
```

The anonymization is enforced in the Optimization Agent: vehicle data is reduced to the model token only (e.g. "F-150", not "2019 Ford F-150 with VIN..."), offers are truncated to 60 characters, and no names, emails, addresses, or `dealership_id` values are written to `global_learnings`. Claude is instructed in its system prompt to reject vague patterns and only accept findings specific enough to be injected into a Creative Agent prompt and immediately actionable.

A new dealer with zero campaign history immediately accesses patterns learned from thousands of campaigns across the network. This is the network-effect flywheel: the platform becomes more accurate with every additional dealer, making it harder for point solutions to compete at scale.

---

## 7. Hybrid Billing Stubs

The billing layer is structurally complete and wired to real usage data. Every metered action records to `billing_events`:

```
event_type       | unit_cost_cents | metadata
-----------------+-----------------+--------------------------------
agent_run        | ~0.003¢/token   | {agent, tokens}
mail_piece_sent  | 150             | {template, postgrid_id, is_test}
sms_sent         | 2               | —
email_sent       | 0               | — (included in base tier)
```

The `UNIT_COSTS` map in `src/lib/billing/metering.ts` drives all calculations. Changing pricing requires editing one constant.

The `/dashboard/billing` page renders plan cards and usage summaries. Stripe checkout and the Customer Portal are structurally stubbed — route handlers exist, signature verification is implemented, the webhook handler parses `invoice.paid` and `invoice.payment_failed` events. Orb usage metering is architecturally designed to consume `billing_events` when wired. Neither requires schema changes to activate.

---

## 8. Key Unique Features

**Truly self-learning, self-evolving swarm.** The feedback loop is closed in code today. Every campaign send triggers the Optimization Agent, every first QR scan triggers a learning update, and every future Creative Agent call reads from the accumulated network intelligence. The swarm does not require manual retraining or prompt engineering updates to improve — it learns from production data automatically.

**Hyper-personalized last-visit memory.** The Creative Agent receives the customer's full service history (vehicle, mileage, technician notes, service type) and uses it to write copy that references real, specific details — not generic "we miss you" templates. The `last_visit_embedding` pgvector column enables future semantic search across service notes for targeting decisions that no keyword-based CRM can replicate.

**Native direct mail with autonomous AI execution.** This is the clearest competitive gap versus Fullpath, Digital Air Strike, and similar platforms. Those tools can surface AI-generated insights, but a human still writes the copy and submits the mail job. AutoCDP executes the full stack: Claude writes personalized copy per customer, the orchestrator calls PostGrid via tool use, and physical mail goes to USPS — without a human in the loop. The dealer describes a goal. The swarm handles everything else.

**Closed feedback loop.** The system doesn't stop at "sent." QR scans feed back into the Optimization Agent, which feeds into `global_learnings`, which feeds into the next Creative Agent run. The longer AutoCDP runs at a dealership, the better the copy it generates — and that improvement compounds across the entire network.

---

## 9. Omnichannel Engine

AutoCDP is now a true multi-channel platform. The same AI swarm that writes direct mail copy writes SMS messages and HTML emails — per-customer, from service history, with network learnings injected — and executes all three channels in one tool-use loop.

### Architecture

`runOmnichannelOrchestrator()` in `orchestrator.ts` accepts `channels: OmnichannelChannel[]` and assembles a dynamic tool list:

| Channel | Tool | Provider |
|---|---|---|
| `direct_mail` | `send_direct_mail` | PostGrid |
| `sms` | `send_sms` | Twilio |
| `email` | `send_email` | Resend |
| `multi_channel` | All three | Best per customer |

Claude picks which tool to call per customer. In `multi_channel` mode it reasons about which channel fits that customer's data (phone vs email vs address availability) and calls the most appropriate tool. All three work in dry-run mode — copy is generated, tools are invoked, but no provider API calls are made.

### Twilio SMS

`src/lib/twilio.ts` wraps the Twilio REST client with graceful degradation when credentials are missing. `src/lib/anthropic/tools/send-sms.ts` is a full Anthropic tool implementation:

1. Validates customer belongs to this dealership
2. Checks `phone` field exists
3. Inserts `communications` row (`channel: "sms"`, `status: "pending"`)
4. Calls Twilio — on success, updates status to `"sent"`, stores `provider_id` (Twilio SID)
5. Records a `sms_sent` billing event

Messages support merge variables via the Creative Agent: last vehicle, service type, mileage, and named technician are injected into the system prompt so Claude can write copy like *"Hi James — your F-150 is due for service. Reply STOP to opt out."*

### Resend Email

`src/lib/resend-client.ts` wraps the Resend SDK. `src/lib/anthropic/tools/send-email.ts` follows the same insert → send → update → bill pattern. The `from_name` is the dealership name. Claude generates:

- A personalized subject line (no spammy words)
- A 2–3 paragraph HTML body with inline styles
- A CTA section linking to `tel:{{phone}}` or `{{website_url}}`

The Creative Agent is already channel-aware: when `channel === "email"`, its system prompt requests `subject` and `body_html` as separate JSON fields.

### Email Open/Click Webhooks

`/api/webhooks/resend` receives Svix-signed Resend events and updates the `communications` row:

| Event | Status update |
|---|---|
| `email.delivered` | `status = "delivered"`, `delivered_at` |
| `email.opened` | `status = "opened"`, `opened_at` |
| `email.clicked` | `status = "clicked"`, `clicked_at` |
| `email.bounced` | `status = "bounced"` |
| `email.complained` | `status = "failed"` |

Optional `RESEND_WEBHOOK_SECRET` in `.env.local` enables HMAC-SHA256 signature verification. Configure the webhook URL in Resend Dashboard → Webhooks → `https://[app]/api/webhooks/resend`.

### Campaign Builder — Omnichannel UI

The five-step campaign builder was redesigned. Step 2 is now **Channel & Format**:

- Four channel cards: Direct Mail, SMS, Email, All Channels (multi)
- Availability warnings: *"14 of 20 customers have no phone number — will be skipped for SMS"*
- Mail template selector only shown when a mail channel is selected
- Channel-aware copy hint in the goal step
- **Preview step** adapts per channel:
  - Direct Mail → handwriting simulation (existing)
  - SMS → phone bubble mockup with 160-char counter and over-limit warning
  - Email → mock inbox header (from + subject) + rendered body
  - Multi → email preview + note that Claude picks per customer
- **Send step** routes correctly: Direct Mail → `/api/mail/send`; SMS/Email/Multi → `/api/campaign/omnichannel`
- Result list shows channel badge per row and Twilio SID / Resend ID when available

### Communications History Tab

The Direct Mail page now has a third tab: **SMS & Email**. It shows every outbound communication from the `communications` table with channel badge, message preview (subject for email, first 80 chars for SMS), status with open/click timestamps from Resend webhooks, provider ID, and relative send time.

---

## 10. Data Onboarding

`/dashboard/onboard` (Import page) is a full CSV import wizard for customers and service visits:

- **Quote-aware CSV parser** — custom implementation, no external library. Handles escaped quotes, varied column names, Windows/Unix line endings.
- **Customer import**: deduplicates on email or phone per dealership. Flexible column mapping covers CDK, Reynolds, Dealertrack export formats.
- **Visit import**: matches customers by email, phone, or UUID. Inserts repair orders with VIN, make, model, year, mileage, service type, technician, RO number, and amount. Deduplicates on `(customer_id, visit_date)`.
- **`CsvUploader` component**: drag-and-drop zone, inline preview of first 5 rows × 8 columns, row count, import button with live progress, success/error toast.

---

## 11. Inventory Integration

Migration `005_inventory.sql` creates the `inventory` table with RLS. The Creative Agent now fetches up to 3 available vehicles (prioritizing aged 60+ days) from the dealership's inventory before generating copy and injects them as an `IN-STOCK INVENTORY` block in the system prompt. This enables copy like *"We just got a certified F-150 on the lot at $38,500 — thought of you immediately."*

`/dashboard/inventory` shows stats (available units, 60+ day aged vehicles, avg days on lot, total value), accepts CSV uploads via `/api/inventory/upload` (VIN-based upsert), and displays the full inventory table with condition/status badges.

---

## 12. Voice Agent (Placeholder)

Migration `006_call_logs.sql` creates the `call_logs` table: direction, duration, outcome (appointment_booked, callback_requested, voicemail, etc.), AI summary, Twilio call SID.

`/dashboard/voice` shows stats, a roadmap card (Twilio Programmable Voice → real-time transcript → Claude outcome summary → lifecycle update), and the call log table. The page detects whether Twilio is configured and shows a status banner.

---

## 13. Conquest Data Feed

Migration `007_conquest.sql` creates `conquest_leads`: prospect records from external data providers with name, contact, vehicle interest, lead score (0–100), and status lifecycle. `/dashboard/conquest` shows stats, a CSV import panel (via `/api/conquest/upload`), and the full leads table with score progress bars.

---

## 14. DMS Integrations — CDK Fortellis & Reynolds & Reynolds

### New Database Tables (Migration 008)

- **`dms_connections`** — One row per dealership/provider pair. Stores AES-256-GCM encrypted tokens (CDK OAuth tokens or Reynolds API key), `status` (`pending|active|error|disconnected`), `last_sync_at`, and `last_error`. Unique constraint on `(dealership_id, provider)`.
- **`sync_jobs`** — One row per sync run. Tracks `job_type` (full/delta), `status` (running/completed/failed), `records_synced` JSON (customers/visits/inventory counts), and a `cursor` (ISO timestamp) for incremental deltas.
- **`sync_logs`** — Log lines per sync job (`info|warn|error` level). Used for debugging failed syncs in the dashboard.

### Token Security (`src/lib/dms/encrypt.ts`)

AES-256-GCM encryption for all stored credentials. Format: `base64(iv[12] || tag[16] || ciphertext)`. Uses Web Crypto API (`crypto.subtle`). Key sourced from `ENCRYPTION_KEY` env var (64 hex chars / 32 bytes). Both OAuth token bundles and API keys pass through `encryptTokens()` before DB write and `decryptTokens()` before API calls.

### CDK Fortellis (`src/lib/dms/cdk-fortellis.ts`)

- **OAuth 2.0** Authorization Code flow via `https://identity.fortellis.io`
- `getCdkAuthUrl(state)` builds the authorization URL with `offline_access` scope
- `exchangeCodeForTokens(code)` and `refreshCdkTokens(refreshToken)` handle the token lifecycle
- `cdkFetch<T>(path, opts)` — auto-refreshes tokens when they expire within 60s, exponential backoff on 429s
- Paginated fetchers: `fetchCdkCustomers`, `fetchCdkServiceROs`, `fetchCdkInventory`, `fetchCdkDeals`

### Reynolds & Reynolds (`src/lib/dms/reynolds.ts`)

- **API key auth** via `X-API-Key` header (dealer provides key from ERA-IGNITE portal)
- `reynoldsFetch<T>` — same retry/backoff pattern as CDK
- Parallel paginated fetchers matching CDK interface shapes for uniform sync-engine mapping

### Sync Engine (`src/lib/dms/sync-engine.ts`)

Shared data-mapping and upsert layer used by both providers:
- `mapCdkCustomer/mapReynoldsCustomer` → `customers` table row (with `metadata.dms_source.{provider, id}`)
- `mapCdkRo/mapReynoldsRo` → `visits` table row (type=`service`)
- `mapCdkVehicle/mapReynoldsVehicle` → `inventory` table (upsert on VIN)
- Deals mapped as visits with `type=sale`
- `buildCustomerIdMap()` — resolves DMS customer IDs to DB UUIDs for RO/deal FK joins
- `paginateAll()` — generic paginator that exhausts `nextPageToken` chain
- Upsert conflict keys: `(dealership_id, metadata->dms_source->id)` for customers/visits, `(dealership_id, vin)` for inventory
- `runSync(ctx)` — public function: creates `sync_jobs` row, dispatches to CDK or Reynolds engine, updates job/connection status on success/failure
- **Post-sync Data Agent trigger**: after every completed sync, fires `runDataAgent()` in background to re-analyze with fresh data and update segment distribution

### OAuth + API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/integrations/cdk/connect` | GET | Redirect to Fortellis identity server (stores OAuth state in DB) |
| `/api/integrations/cdk/callback` | GET | Exchange auth code for tokens → encrypt → store → fire initial full sync |
| `/api/integrations/cdk/sync` | POST | Manual delta/full sync trigger |
| `/api/integrations/cdk/webhook` | POST | Receive CDK change webhooks → trigger delta sync (HMAC-SHA256 verified) |
| `/api/integrations/reynolds/connect` | POST | Accept API key → validate → encrypt → store → fire initial full sync |
| `/api/integrations/reynolds/sync` | POST | Manual delta/full sync trigger |
| `/api/integrations/sync-history` | GET | Last 20 sync jobs for the current dealership |

### Integrations Dashboard (`/dashboard/integrations`)

- Two provider cards (CDK Fortellis, Reynolds & Reynolds) with status indicator, last sync time, and record counts
- CDK: "Connect with CDK Fortellis" button → full OAuth redirect flow
- Reynolds: "Connect Reynolds" button → modal for API key entry with live validation
- Connected state: "Sync Now" button (triggers delta) + "Disconnect" button
- Sync history table: provider, type (full/delta), status badge, record counts, timestamp
- Info banner: explains auto sync schedule and Data Agent trigger
- Toast notifications for OAuth callback success/error params

### Key Design Decisions

- **Delta sync cursor**: `last_sync_at` timestamp from `dms_connections` is passed as `modifiedSince` on subsequent syncs — only changed records are fetched
- **Fire-and-forget initial sync**: OAuth callback and Reynolds connect both kick off full sync in background (`void runSync().catch(...)`) so the redirect/response is instant
- **Graceful upsert**: All records use conflict-resolution upsert, not insert. Re-running a sync never creates duplicates
- **RLS compliance**: All three new tables have RLS with `auth_dealership_id()` — no service-role bypass needed for dashboard reads

---

## 15. Current Status

### Fully Working Today

**Core platform**
- Multi-tenant auth, RLS isolation, dealership provisioning, multi-user per dealership
- 8 SQL migrations — 10 core tables + mail_pieces + mail_scans + inventory + call_logs + conquest_leads + dms_connections + sync_jobs + sync_logs

**AI swarm**
- Orchestrator (Claude Opus 4.7) with Anthropic tool-use loop
- Data, Targeting, Creative (with global_learnings + inventory injection), Optimization agents (all Sonnet 4.6)
- Self-learning feedback loop: post-campaign trigger → QR scan trigger → manual button → `global_learnings` → Creative Agent reads before every copy generation

**Direct Mail**
- PostGrid integration, HTML template builders (postcard + letter), CSS handwriting simulation
- QR code tracking — server-side generation, scan landing page, webhook status updates
- Send Test Mail panel — single-customer preview → PostGrid live → toast → Recent Test Mails card

**SMS Channel** ✅
- Twilio client wrapper with graceful degradation
- `send_sms` Anthropic tool — validates customer, writes `communications` row, calls Twilio, updates status, bills
- Per-customer personalization: last vehicle, service type, mileage, tech name in Creative Agent prompt
- Dry-run mode: full tool-use loop, no Twilio call

**Email Channel** ✅
- Resend client wrapper
- `send_email` Anthropic tool — same pattern as SMS; generates HTML body with inline styles and CTA
- Resend webhook handler at `/api/webhooks/resend`: delivered, opened, clicked, bounced, complained events update `communications` row
- HMAC-SHA256 Svix signature verification (optional)

**Omnichannel Campaign Builder** ✅
- Step 2 is now **Channel & Format**: Direct Mail / SMS / Email / All Channels cards
- Availability warnings per channel (missing phone, email, address counts)
- Channel-aware preview: SMS bubble (160-char counter), email inbox mockup (subject + rendered body), handwriting (direct mail)
- Sends route correctly: direct mail → `/api/mail/send`; others → `/api/campaign/omnichannel`
- Result list shows channel badge + Twilio SID / Resend ID per row
- **Communications History tab**: SMS & email history with open/click timestamps

**Other features**
- CSV import: customers + visits, custom parser, deduplication, `CsvUploader` component
- Inventory: CSV upsert, Creative Agent injection of aged stock, table with condition/status badges
- Conquest: lead import, score visualization, status lifecycle
- Voice: `call_logs` schema + placeholder dashboard + roadmap
- Analytics: real DB data, QR scan trend chart, channel breakdown bars, spend breakdown
- Full navigation: 13 pages

**DMS Integrations** ✅
- CDK Fortellis OAuth 2.0 flow: connect → callback → encrypt tokens → full sync → delta syncs
- Reynolds & Reynolds API key flow: modal entry → validation → encrypt → full sync
- AES-256-GCM token encryption (`ENCRYPTION_KEY` env var)
- Sync engine: paginated fetch → upsert (no duplicates) → Data Agent trigger post-sync
- CDK webhook receiver with HMAC-SHA256 verification
- `/dashboard/integrations` with provider cards, sync history table, status indicators

### Stubbed / Ready to Wire

| Feature | Status |
|---|---|
| Stripe checkout + Customer Portal | Route handlers + webhook verification exist; checkout session creation not wired |
| Orb usage metering | `billing_events` table live and fully populated; Orb API call not added |
| pgvector embedding generation | Column, index, and dimension ready; `text-embedding-3-small` not triggered on visit insert |
| Twilio Programmable Voice | `call_logs` table ready; voice call initiation not wired |
| DMS native connectors | ✅ CDK Fortellis (OAuth) + Reynolds (API key) — full and delta sync, webhook support |

### Recommended Next Milestones

1. **pgvector Embedding Generation** — Trigger `text-embedding-3-small` on visit insert. The Creative Agent gains semantic memory immediately, enabling copy that references behavioral patterns rather than just structured fields.
2. **Stripe Billing** — One afternoon. Infrastructure is complete; needs `stripe.checkout.sessions.create` call and a portal redirect.
3. **Twilio Programmable Voice** — Wire outbound calling with Deepgram real-time transcript → Claude outcome summary → `call_logs` row → customer lifecycle update.
4. **pgvector Embedding Generation** — Trigger `text-embedding-3-small` on visit insert for semantic Creative Agent memory.

---

*Built with Next.js 15 · Supabase · Anthropic Claude · Tailwind CSS · shadcn/ui · PostGrid · Twilio · Resend*
