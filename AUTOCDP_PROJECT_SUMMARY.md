# AutoCDP — Complete Project Summary

> **Purpose of this document:** A fully self-contained reference for any Claude instance (or human contributor) who needs to understand the system before touching code. Read this before adding any feature, route, or component.

---

## 1. Project Overview & Goals

**AutoCDP** is a multi-tenant SaaS **Customer Data Platform (CDP) for automotive dealerships**. Dealers sign up, connect their DMS (Dealer Management System), and a 5-agent Claude AI swarm autonomously plans, segments, personalises, and executes omnichannel marketing campaigns (direct mail, SMS, email).

**Core value propositions:**
- **Autonomous execution** — dealers describe a goal in plain English; agents handle the rest end-to-end
- **Native direct mail with AI copy** — copy generation → PostGrid print submission → USPS delivery → QR scan tracking
- **Self-evolving network effect** — every campaign produces anonymised patterns stored in `global_learnings` that improve future campaigns across all dealers on the platform
- **DMS-connected** — syncs real customer + vehicle + service history data from CDK, Reynolds, VinSolutions, Vauto, and 700Credit

**Location on disk:** `C:\Users\webde\autocdp` (also `C:\Users\webde\OneDrive\Desktop\autocdp`)

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Framework** | Next.js | 15 (App Router, Server Actions enabled) |
| **Language** | TypeScript | 5.7.2, strict mode, ES2017 target |
| **Runtime** | React | 19 |
| **Database** | Supabase (PostgreSQL) | pgvector extension for 1536-dim embeddings; pg_trgm for fuzzy search |
| **Auth** | Supabase Auth | Email/password, SSR session via `@supabase/ssr` |
| **AI / Agents** | Anthropic SDK | `@anthropic-ai/sdk`; Opus 4.7 (orchestrator), Sonnet 4.6 (specialists) |
| **Direct Mail** | PostGrid | REST API; test vs live key modes |
| **SMS** | Twilio | REST API via `twilio` npm package |
| **Email** | Resend | SDK via `resend` npm package |
| **Styling** | Tailwind CSS | Custom config — indigo brand, navy sidebar, premium shadows |
| **Component Library** | shadcn/ui + Radix UI | Avatar, Badge, Button, Card, Dialog, Tabs, Toast, etc. |
| **QR Codes** | `qrcode` npm | Server-side PNG data URL generation |
| **Billing** | Stripe (stubbed) + Orb (metering) | Checkout and webhook handlers wired but not yet activated |
| **Package Manager** | npm | |
| **Deployment** | Vercel | Push to GitHub → auto-deploy (sometimes unreliable — see § 8) |

**Key environment variables (see `.env.example` for full list):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
POSTGRID_API_KEY
POSTGRID_WEBHOOK_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
RESEND_API_KEY
ENCRYPTION_KEY          # 32-byte hex, used for DMS token envelope encryption
```

---

## 3. Folder Structure

```
autocdp/
├── supabase/
│   └── migrations/          # 001–023 SQL migration files (run in order)
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login + signup pages (Supabase Auth)
│   │   ├── auth/callback/   # Supabase email confirmation handler
│   │   ├── onboarding/      # Website scrape + initial dealership setup flow
│   │   ├── track/[id]/      # QR scan landing page (logs mail_scans, shows branded CTA)
│   │   ├── dashboard/       # ALL protected dealer workspace (layout.tsx wraps everything)
│   │   │   ├── page.tsx              # Home overview — stats, recent activity
│   │   │   ├── layout.tsx            # Protected layout: Sidebar + Header + banners
│   │   │   ├── customers/            # Customer table, lifecycle stage filters
│   │   │   ├── campaigns/            # Campaign cards + status; campaigns/new/ for creation
│   │   │   ├── direct-mail/          # 5-step campaign builder + test mail panel
│   │   │   ├── agents/               # Agent swarm UI + test run panel
│   │   │   ├── analytics/            # Metrics, cross-dealer learnings display
│   │   │   ├── billing/              # Plans, usage metering, invoice history
│   │   │   ├── integrations/         # DMS connector cards (CDK, Reynolds, Vauto, etc.)
│   │   │   ├── communications/       # SMS / email / mail log
│   │   │   ├── templates/            # Message template library
│   │   │   ├── health/               # Service history + health scores per customer
│   │   │   ├── newsletter/           # Email newsletter builder
│   │   │   ├── voice/                # IVR announcement builder (Twilio)
│   │   │   ├── conquest/             # Competitor lead capture
│   │   │   ├── inventory/            # Vehicle inventory management
│   │   │   ├── audit/                # Compliance audit trail
│   │   │   ├── admin/                # Super-admin provisioning panel
│   │   │   ├── onboard/              # Multi-step data import wizard
│   │   │   └── settings/             # Dealership profile, API keys, preferences
│   │   └── api/                      # ~40 API route handlers
│   │       ├── agents/test/          # POST — preview-only agent run
│   │       ├── mail/send/            # POST — full orchestration with tool use
│   │       ├── mail/preview/         # POST — HTML preview without sending
│   │       ├── campaign/             # CRUD + approval flow
│   │       ├── communications/       # Message log queries
│   │       ├── integrations/         # DMS sync engines (CDK, Reynolds, 700Credit, Vauto, VinSolutions, xTime)
│   │       ├── webhook/              # PostGrid, Resend, Stripe, CDK webhooks
│   │       ├── onboarding/           # Scrape, provision, upload handlers
│   │       ├── health/               # Health recommendation endpoints
│   │       ├── billing/              # Invoices, metering, Stripe webhook
│   │       ├── admin/                # Provision-client endpoint (super-admin only)
│   │       ├── dealership/           # Profile, memories, insights, limits, baseline examples, co-op programs
│   │       ├── demo/toggle/          # Demo mode toggle (admin-only)
│   │       ├── email/send/           # Email send via Resend
│   │       ├── sms/send/             # SMS send via Twilio
│   │       ├── leads/                # ADF inbound, reply, opt-out
│   │       ├── newsletter/           # Newsletter CRUD, send, generate section
│   │       └── rsvp/                 # Event RSVP tracking
│   ├── components/
│   │   ├── ui/                       # shadcn/ui primitives (button, card, input, dialog, tabs, badge, …)
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # Navy sidebar, nav groups, dealership switcher
│   │   │   ├── header.tsx            # Top bar with user menu
│   │   │   ├── demo-banner.tsx       # Demo mode notice strip
│   │   │   └── usage-banner.tsx      # Billing threshold alert
│   │   ├── dashboard/                # Stat panels (DMS ROI, Cadence, Campaign Impact, etc.)
│   │   ├── direct-mail/
│   │   │   ├── campaign-builder.tsx  # 5-step wizard
│   │   │   ├── handwriting-preview.tsx   # CSS character-level transform simulation
│   │   │   ├── template-preview.tsx  # Postcard / letter render
│   │   │   └── learn-button.tsx      # Baseline examples modal
│   │   ├── agents/                   # Agent test UI panels
│   │   ├── campaigns/                # Campaign card components
│   │   ├── communications/           # Message log table
│   │   ├── settings/                 # Profile, memories, insights, limits, training data tabs
│   │   ├── integrations/             # DMS connection cards
│   │   ├── templates/                # Template library components
│   │   ├── health/                   # Health score cards
│   │   ├── leads/                    # Conquest lead table
│   │   ├── billing/                  # Plan + usage display
│   │   ├── onboard/                  # Multi-step import wizard components
│   │   └── customers/                # Customer list, detail, lifecycle filters
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser SSR Supabase client
│   │   │   └── server.ts             # Server-side Supabase client
│   │   ├── anthropic/
│   │   │   ├── client.ts             # Singleton Anthropic SDK + model name constants
│   │   │   ├── agents/               # All 7 agent files (see § 5)
│   │   │   ├── tools/                # send-direct-mail.ts, send-sms.ts, send-email.ts
│   │   │   ├── baseline.ts           # Loads baseline copy examples for Creative Agent
│   │   │   └── guardrails.ts         # Regex + Haiku rewrite safety checks
│   │   ├── billing/
│   │   │   ├── metering.ts           # recordBillingEvent() + unit cost map
│   │   │   └── invoices.ts           # Invoice generation
│   │   ├── compliance/
│   │   │   └── disclaimers.ts        # TCPA / CAN-SPAM text appended to all messages
│   │   ├── dms/                      # DMS provider wrappers + sync engine + token encryption
│   │   ├── email-templates/          # Approval request, controller alert, invoice (HTML strings)
│   │   ├── integrations/             # 700Credit FCRA, Reynolds DealerVault
│   │   ├── leads/                    # ADF XML parser + sender
│   │   ├── newsletter/               # Newsletter template engine + types
│   │   ├── print/
│   │   │   └── vendor-router.ts      # PostGrid vs Lob routing logic
│   │   ├── admin.ts                  # Super-admin utilities + email whitelist
│   │   ├── aged-inventory.ts         # Vehicle matching for aged inventory campaigns
│   │   ├── audit.ts                  # logAudit() — writes to audit_log table
│   │   ├── cadence.ts                # Contact frequency rules (prevents over-messaging)
│   │   ├── campaign-approval.ts      # Approval workflow helpers
│   │   ├── csv.ts                    # CSV parsing / export
│   │   ├── dealership.ts             # getAllUserDealerships(), dealership helpers
│   │   ├── demo.ts                   # isDemoMode() flag
│   │   ├── demo-data.ts              # DEMO_CUSTOMERS_DATA, DEMO_CAMPAIGNS, DEMO_COMMS, etc.
│   │   ├── errors.ts                 # toApiError() — consistent error shape
│   │   ├── insights.ts               # loadDealershipInsights() + formatInsightsForPrompt()
│   │   ├── memories.ts               # loadDealershipMemories() + formatMemoriesForPrompt()
│   │   ├── postgrid.ts               # PostGrid REST API wrapper
│   │   ├── qrcode-gen.ts             # QR code PNG generation + tracking URL builder
│   │   ├── rate-limit.ts             # checkRateLimit() — daily limits per dealership
│   │   ├── resend-client.ts          # Resend SDK singleton
│   │   ├── scoring.ts                # Customer scoring + filterAndRankCustomers()
│   │   ├── tracking.ts               # QR scan event logging
│   │   ├── twilio.ts                 # Twilio SMS wrapper
│   │   └── utils.ts                  # formatCurrency(), formatRelativeDate(), cn(), etc.
│   ├── hooks/                        # Custom React hooks
│   └── types/
│       ├── index.ts                  # All shared TypeScript interfaces (~503 lines)
│       └── supabase.ts               # Supabase generated types
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── README.md
└── BUILT_SO_FAR.md                   # Detailed feature inventory + tech decisions
```

---

## 4. Supabase Schema

### RLS Overview
- **Every table has RLS enabled** — no exceptions.
- All policies resolve the current user's dealership via the `auth_dealership_id()` SQL function.
- Isolation is enforced at the database engine level; there is no application-layer fallback.
- The **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) is only used server-side for provisioning, agent execution, and webhooks — never exposed to the browser.

### Core Tables

#### `dealerships` — Tenant root, isolation boundary
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | Dealership display name |
| slug | text unique | URL-safe identifier |
| website_url | text | Scraped during onboarding |
| logo_url | text | Uploaded or scraped |
| address | jsonb | `{street, city, state, zip}` |
| phone | text | |
| hours | jsonb | `{monday: "9am-7pm", …}` |
| settings | jsonb | Preferences, feature flags |
| onboarded_at | timestamptz | Null until onboarding complete |

#### `user_dealerships` — Multi-user RBAC per tenant
| Column | Type | Notes |
|---|---|---|
| user_id | uuid FK → auth.users | |
| dealership_id | uuid FK → dealerships | |
| role | text | `owner` / `admin` / `member` |

#### `customers` — Customer profiles + pgvector embedding
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | RLS anchor |
| first_name, last_name | text | |
| email | text | |
| phone | text | |
| address | jsonb | `{street, city, state, zip}` |
| tags | text[] | e.g. `["VIP", "truck-owner"]` |
| lifecycle_stage | text | `vip` / `active` / `at_risk` / `lapsed` / `new` |
| last_visit_embedding | vector(1536) | pgvector, IVFFlat index |
| total_visits | int | |
| total_spend | numeric | |
| last_visit_date | date | |
| metadata | jsonb | DMS-source fields, credit tier, etc. |

#### `visits` — Service history
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| customer_id | uuid FK | |
| vin | text | |
| make, model, year | text / int | |
| mileage | int | |
| service_type | text | e.g. `oil_change`, `brake_service` |
| service_notes | text | Technician notes |
| technician | text | |
| ro_number | text | Repair order number |
| total_amount | numeric | |
| visit_date | date | |

#### `campaigns` — Campaign definitions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| name | text | |
| description | text | |
| channel | text | `sms` / `email` / `direct_mail` / `multi_channel` |
| status | text | `draft` / `scheduled` / `active` / `completed` / `paused` |
| target_segment | jsonb | Segment filter parameters |
| message_template | text | |
| ai_instructions | text | Plain-English goal fed to agents |
| stats | jsonb | `{targeted, sent, delivered, opened, clicked, converted, revenue_attributed}` |

#### `communications` — Individual message log
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id / customer_id / campaign_id | uuid FK | |
| channel | text | `sms` / `email` / `direct_mail` |
| status | text | `pending` → `queued` → `sent` → `delivered` → `opened` → `clicked` → `converted` → `bounced` / `failed` |
| subject | text | Email only |
| content | text | Message body |
| ai_generated | bool | |
| provider_id | text | Twilio SID, Resend ID, or PostGrid mail ID |
| sent_at, delivered_at, opened_at, clicked_at | timestamptz | |

#### `mail_pieces` — Direct mail jobs
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id / customer_id / campaign_id | uuid FK | |
| template_type | text | `postcard_6x9` / `letter_6x9` / `letter_8.5x11` |
| personalized_text | text | AI-generated copy |
| variables | jsonb | Merge variables used |
| qr_code_url | text | Tracking URL embedded in piece |
| qr_image_data_url | text | PNG data URL for PostGrid HTML |
| postgrid_mail_id | text | PostGrid internal ID |
| postgrid_order_id | text | |
| postgrid_status | text | Raw PostGrid lifecycle status |
| postgrid_pdf_url | text | Proof PDF URL |
| status | text | `pending` → `processing` → `in_production` → `in_transit` → `delivered` → `returned` / `cancelled` / `error` |
| is_test | bool | True = no physical print |
| cost_cents | int | |
| estimated_delivery | date | |
| scanned_count | int | Incremented by Postgres trigger on each QR scan |
| first_scanned_at / last_scanned_at | timestamptz | |
| created_by / created_at / sent_at / delivered_at | various | |

#### `mail_scans` — QR scan events
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| mail_piece_id / dealership_id | uuid FK | |
| ip_address | text | |
| user_agent | text | |
| referrer | text | |
| scanned_at | timestamptz | |

#### `inventory` — Vehicle inventory
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| vin | text | |
| year, make, model, trim | text / int | |
| color | text | |
| mileage | int | |
| condition | text | `new` / `used` / `certified` |
| price | numeric | |
| days_on_lot | int | |
| status | text | `available` / `sold` / `reserved` / `pending` |
| metadata | jsonb | |

#### `agent_runs` — AI execution audit trail
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id / campaign_id | uuid FK | |
| agent_type | text | `orchestrator` / `data` / `targeting` / `creative` / `optimization` / `coop` / `template` / `health` |
| status | text | `running` / `completed` / `failed` / `skipped` |
| input_tokens / output_tokens | int | |
| duration_ms | int | |
| input_summary / output_summary | text | Non-PII summary |
| error | text | |

#### `global_learnings` — Anonymised cross-dealer patterns (NO PII, NO dealership_id)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| pattern_type | text | e.g. `copy_style`, `offer_type`, `send_time` |
| pattern_data | jsonb | Anonymised signal |
| description | text | Human-readable summary |
| confidence | numeric(3,2) | 0.0 – 1.0 |
| sample_size | int | Number of campaigns contributing |
| region | text | Optional geographic segment |
| vehicle_segment | text | Model-level only (e.g. "F-150") |
| created_at | timestamptz | |

#### `dealership_memories` — Dealer guidance for agents
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| title | text | Short label |
| context | text | When to apply this guidance |
| guidance | text | What the agent should do |
| created_by | uuid | |
| created_at / updated_at | timestamptz | |

#### `dealership_insights` — Aggregated insights per dealership
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| insight_type | text | |
| data | jsonb | |
| confidence | numeric | |
| created_at | timestamptz | |

#### `dealership_limits` — Usage limits per plan
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| limit_type | text | `daily_mail_pieces` / `daily_agent_runs` / etc. |
| limit_value | int | |
| current_count | int | |
| reset_at | timestamptz | Midnight UTC |

#### `billing_events` — Usage metering
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| event_type | text | `agent_run` / `sms_sent` / `email_sent` / `mail_piece_sent` / `api_call` |
| quantity | int | |
| unit_cost_cents | int | |
| metadata | jsonb | |
| billed_at / created_at | timestamptz | |

#### `dms_connections` — External DMS integration state
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| dealership_id | uuid FK | |
| provider | text | `cdk_fortellis` / `reynolds` / `vinsolutions` / `vauto` / `seven_hundred_credit` / `general_crm` |
| status | text | `pending` / `active` / `error` / `disconnected` |
| encrypted_tokens | text | Envelope-encrypted, never plaintext in DB |
| last_sync_at | timestamptz | |
| last_error | text | |
| metadata | jsonb | |

#### Other notable tables
- `conquest_leads` — competitor lead capture (first_name, last_name, email, phone, vehicle_interest, score, status)
- `audit_log` — compliance audit trail (action, resource_type, resource_id, metadata)
- `learning_outcomes` — per-dealership campaign learning records (not shared cross-dealer)
- `sync_jobs` / `sync_logs` — DMS sync execution history
- `templates` — message template library
- `newsletters` — email newsletter drafts + sends

### Database Extensions
- `uuid-ossp` — UUID generation
- `vector` — pgvector (1536-dim, IVFFlat index on `customers.last_visit_embedding`)
- `pg_trgm` — fuzzy text search on customer names

---

## 5. 5-Agent Swarm Architecture

All agents are in `src/lib/anthropic/agents/`. Entry points are `src/app/api/agents/test/route.ts` (preview) and `src/app/api/mail/send/route.ts` (production execution).

### Model Assignment
- **Claude Opus 4.7** — Orchestrator only (complex multi-step reasoning + tool-use loop)
- **Claude Sonnet 4.6** — All specialist agents (cost-effective, fast)
- Constants defined in `src/lib/anthropic/client.ts`

---

### Agent 1: Orchestrator (`orchestrator.ts`)
**Role:** Campaign conductor — sequences all other agents and executes sends via tool use.

**Two operating modes:**

| Mode | Function | Sends? |
|---|---|---|
| Preview | `runOrchestrator()` | No — generates sample copy only |
| Production | `runDirectMailOrchestrator()` | Yes — full Claude tool-use loop |

**Production flow:**
1. Load dealership profile, memories, insights, baseline examples
2. Call Data Agent → get segmentation + churn scores
3. Call Targeting Agent → select audience
4. Call Creative Agent per customer → personalised copy
5. Enter Claude tool-use loop: invoke `send_direct_mail` / `send_sms` / `send_email` tools
6. Receive `tool_result` blocks (PostGrid IDs, Twilio SIDs, Resend IDs) and continue
7. After all customers processed, fire-and-forget call to Optimization Agent
8. Return `OrchestratorOutput` with stats + preview messages

**Key type:**
```typescript
interface OrchestratorOutput {
  agentRunId: string;
  dataInsights: string;
  targetedCount: number;
  messagesGenerated: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  previewMessages: PreviewMessage[];
  status: 'completed' | 'partial' | 'failed';
  error?: string;
}
```

---

### Agent 2: Data Agent (`data-agent.ts`)
**Role:** Segment customers, score churn risk, estimate LTV, flag anomalies.

**Input:** `dealershipId`, `customers[]`, `recentVisits[]`, `dealershipInsights` (formatted string)

**Output:**
- `dataInsights` — narrative summary (fed verbatim to Orchestrator prompt)
- `segmentSummary.segments[]` — labelled groups with counts
- `segmentSummary.anomalies[]` — unusual patterns worth surfacing
- `segmentSummary.trends[]`
- `tokensUsed`

---

### Agent 3: Targeting Agent (`targeting-agent.ts`)
**Role:** Select optimal audience given campaign goal + data insights.

**Input:** `campaignGoal`, `channel`, `segmentStats`, `dealershipInsights`

**Output:** `targetedCustomers[]`, `reasoning`, `propensityScores`, `tokensUsed`

---

### Agent 4: Creative Agent (`creative-agent.ts`)
**Role:** Generate personalised copy per customer. The most context-rich agent.

**Two-phase context loading:**
1. **Local context** — customer's most recent visit (vehicle, mileage, service type, technician notes)
2. **Network context** — query `global_learnings` for vehicle-model-specific patterns first, then general patterns (up to 5 total)

**Full input bundle per customer:**
- `customer` — profile + lifecycle stage
- `recentVisit` — vehicle, mileage, service type, notes
- `channel` — `sms` / `email` / `direct_mail`
- `campaignGoal` — free-text dealer instruction
- `template` — selected template
- `dealershipProfile` — phone, hours, logo, website, xtime_url
- `assignedVehicle` — aged inventory vehicle (optional, for inventory push campaigns)
- `baselineExamples` — dealer-approved sample copy
- `dealerMemories` — dealer guidance fragments
- `designStyle` — visual style preferences
- `customerCreditTier` — from 700Credit (never mentioned to customer, used to calibrate offer aggressiveness)

**Output per customer:**
```typescript
interface PersonalizedMessage {
  customerId: string;
  channel: string;
  subject?: string;         // Email only
  content: string;
  reasoning: string;        // Why this angle was chosen
  confidence: number;       // 0–1
}
```
Also returns `layoutSpec` (advanced PostGrid layout), `tokensUsed`, `guardrailsApplied`, `guardrailViolations`.

**Guardrails** (`src/lib/anthropic/guardrails.ts`):
- Regex patterns block: false urgency, FCRA violations, credit score mentions, prohibited claims
- Violations trigger Haiku rewrite (fast, cheap) before content reaches PostGrid/Twilio/Resend

---

### Agent 5: Optimization Agent (`optimization-agent.ts`)
**Role:** Extract anonymised patterns from campaign outcomes → write to `global_learnings`.

**Process:**
1. Load mail pieces stats — zero PII (no names, emails, addresses)
2. Bucket by `template_type × vehicle_model × service_type`
3. Compute scan rates, delivery rates per bucket
4. Call Claude Sonnet with anonymised table + existing patterns (for deduplication)
5. Extract 0–5 new patterns with confidence scores
6. Write to `global_learnings` (no `dealership_id`, no PII)
7. Write per-dealership record to `learning_outcomes` (audit only)

**Anonymisation enforced:**
- Vehicle reduced to model token only: `"F-150"` not `"2019 Ford F-150 VIN..."`
- Offers truncated to 60 characters
- No names, emails, addresses, or `dealership_id` written to `global_learnings`
- Claude instructed to reject vague/unprovable patterns

---

### Supporting Agents

#### Coop Agent (`coop-agent.ts`)
- Handles manufacturer co-op programs (OEM compliance, required disclaimers, copy guidelines)
- Returns `coopInstructions`, `approvedCopy[]`, `complianceNotes`

#### Template Agent (`template-agent.ts`)
- Suggests templates based on campaign type + dealership style
- Returns ranked template options with reasoning

#### Health Agent (`health-agent.ts`)
- Service interval + maintenance triggers (6k / 12k / 24k mile intervals)
- Generates personalised service reminder copy referencing actual vehicle history

---

### Agent Communication Pattern
Agents do **not** communicate peer-to-peer at runtime. All coordination flows through the Orchestrator:
```
Orchestrator
  ├─→ Data Agent       (blocking — needs insights before targeting)
  ├─→ Targeting Agent  (blocking — needs data insights)
  ├─→ Creative Agent   (once per customer, can be parallelised in future)
  ├─→ Tool-use loop    (Claude drives, tools execute)
  └─→ Optimization Agent (fire-and-forget, non-blocking)
```

### Memories & Guidance System
- Dealers write guidance fragments in Settings → Memories (`dealership_memories` table)
- `src/lib/memories.ts` → `loadDealershipMemories()` → `formatMemoriesForPrompt()` returns a formatted string injected into Creative Agent + Orchestrator system prompts
- Example: "Never offer discounts on F-150 service — our tech team is premium-positioned"

### Insights Engine
- `src/lib/insights.ts` → `loadDealershipInsights()` → `formatInsightsForPrompt()` returns aggregated insight narrative
- Insights are stored in `dealership_insights` (type + JSONB data + confidence)
- Fed to Data Agent, Targeting Agent, and Orchestrator as background context

---

## 6. Key Existing Pages & Components

### Dashboard Home (`/dashboard`)
- Stats grid: total customers, campaigns sent, revenue attributed, AI cost
- Recent campaigns table
- DMS ROI Panel — mail, SMS, email sent counts with response rates
- Cadence Panel — contact frequency visualisation (prevents over-messaging)
- Campaign Impact Panel — performance metrics over time

### Customers (`/dashboard/customers`)
- Full customer table with sorting + search (pg_trgm fuzzy match on backend)
- Lifecycle stage filter chips: VIP / Active / At Risk / Lapsed / New
- Click through to customer detail: visit history, communications log, mail pieces

### Direct Mail (`/dashboard/direct-mail`)
- **5-step Campaign Builder** (`src/components/direct-mail/campaign-builder.tsx`):
  1. Customer multi-select (lifecycle filter + bulk select)
  2. Template choice: 6×9 Postcard / 6×9 Letter / 8.5×11 Letter
  3. Campaign goal (free-text)
  4. AI copy preview with handwriting render + cost estimate
  5. Send with dry-run toggle (default: dry run)
- **Send Test Mail panel** — single customer → AI copy → handwriting preview → optional PostGrid send with `is_test: true`
- **Recent Test Mails** — last 5 test pieces with status + PostGrid tracking ID
- **Learn Button** — opens baseline examples modal

### Agents (`/dashboard/agents`)
- Agent swarm status panel
- Test run input (campaign goal + channel)
- Preview output panel (copy samples, token usage, cost estimate)
- Agent run history table

### Analytics (`/dashboard/analytics`)
- Campaign performance metrics (open rate, click rate, conversion rate, revenue)
- Cross-dealer learnings display (anonymised `global_learnings` patterns)
- Channel comparison charts

### Settings (`/dashboard/settings`)
- **Profile tab** — dealership name, address, phone, hours, logo
- **Memories tab** — CRUD for agent guidance fragments
- **Insights tab** — view aggregated insights + confidence scores
- **Limits tab** — view/edit daily usage limits per plan tier
- **Training Data tab** — upload baseline copy examples

### Integrations (`/dashboard/integrations`)
- Connection card per DMS provider (CDK, Reynolds, VinSolutions, Vauto, 700Credit, General CRM)
- Connect / Disconnect / Sync Now actions
- Last sync timestamp + error display

### Billing (`/dashboard/billing`)
- Current plan display
- Usage meters (mail pieces, agent runs, SMS, email) vs daily limits
- Invoice history (Stripe)

### Campaigns (`/dashboard/campaigns`)
- Campaign cards with status badges
- Create new campaign (channel selector + goal input)
- Campaign detail with approval status, stats, communications log

---

## 7. Design System & Theme

### Colour Palette
```
Primary / Brand:  Indigo  #6366F1 (Tailwind indigo-500)
Sidebar BG:       Navy    #0B1526
Success:          Emerald #10B981
Warning:          Amber   #F59E0B
Error:            Red     #EF4444
Card BG:          White   #FFFFFF (light) / #1E293B (dark)
Muted text:       Slate   #64748B
```

### Typography
- Body: System font stack (Tailwind default)
- Handwriting simulation: **Caveat** (Google Font) — used in postcard previews
- Monospace: Fira Code / system mono for code blocks

### Component Conventions
- **Stat cards**: white background, coloured left border (`border-l-4 border-indigo-500`), subtle shadow
- **Sidebar nav items**: navy BG, indigo active indicator, white/slate text
- **Buttons**: indigo primary, slate secondary, red destructive
- **Badges**: pill-shaped, colour-coded by lifecycle stage or status
- **Cards**: `rounded-xl shadow-sm` with `hover:shadow-md` transition
- **Tables**: `divide-y divide-slate-100`, alternating subtle row backgrounds

### Animation Classes (defined in `globals.css`)
```css
.animate-fade-up       /* slide in from below */
.animate-float         /* gentle vertical bob */
.animate-shimmer       /* loading skeleton shimmer */
.animate-ping-slow     /* slow pulse ring */
.animate-count-up      /* numeric count-up effect */
```

### Handwriting CSS Transform Pattern
Character-level transforms applied in `handwriting-preview.tsx` using deterministic seed `(i * 7 + charCode) % 13`:
- Rotation: −0.5° to +0.8° per character
- Y translate: −0.8px to +1px
- Font size: 0.97em to 1.02em
- Font: Caveat, ~22px

---

## 8. Important Rules — Things NOT to Break

### Multi-Tenancy & RLS
- **Never bypass RLS.** All queries must go through the Supabase client with the user's session, or explicitly use the service role only in server-side API routes.
- **Never add a `dealership_id` column to `global_learnings`.** That table is intentionally dealership-agnostic.
- **Never write PII to `global_learnings`.** The anonymisation pipeline is a core trust feature.
- `auth_dealership_id()` must remain the single source of truth for tenant isolation.

### Agent Architecture
- **Do not call agents directly from client components.** All agent invocations must go through API routes (`/api/agents/test` or `/api/mail/send`).
- **Dry run mode must remain the default.** The `dryRun: true` default in the campaign builder prevents accidental live sends.
- **The tool-use loop in the Orchestrator must remain atomic per customer.** Each customer gets exactly one tool call; the loop must handle `tool_result` blocks before proceeding.
- **Optimization Agent must always fire after production sends** — even partially. It is non-blocking but must be invoked.
- **Never log PII in `agent_runs`.** `input_summary` and `output_summary` fields must remain non-PII summaries.

### Direct Mail
- **PostGrid `is_test` flag** — always set `isTest: true` in the test mail panel. Only explicitly set to `false` for confirmed production sends.
- **QR code data URLs** must be embedded in PostGrid HTML at send time — they cannot be referenced as external URLs (PostGrid renders HTML server-side without outbound requests).
- **`mail_pieces.scanned_count`** is incremented by a Postgres trigger, not application code — do not double-increment in API routes.
- **Handwriting preview CSS** in `handwriting-preview.tsx` uses a deterministic seed. Changing the seed formula will visually change existing previews that dealers have approved.

### Billing & Rate Limits
- **Always call `checkRateLimit()` before any metered action.** Return HTTP 429 if exceeded.
- **Always call `recordBillingEvent()` after every successful metered action.** Missing this breaks usage metering and Orb feed.
- **Never hardcode unit costs** — they live in `metering.ts`'s cost map.

### DMS Tokens
- **Never store plaintext DMS credentials.** Always use `src/lib/dms/encrypt.ts` for envelope encryption before writing to `dms_connections.encrypted_tokens`.
- **700Credit data is FCRA-regulated.** The `customerCreditTier` value can inform copy aggressiveness but must never appear in the message copy itself.

### Compliance
- **TCPA/CAN-SPAM disclaimers** (`src/lib/compliance/disclaimers.ts`) must be appended to all SMS and email messages. Do not remove them.
- **Guardrails** (`src/lib/anthropic/guardrails.ts`) must run on all AI-generated copy before it reaches PostGrid/Twilio/Resend.
- **Opt-out handling** (`/api/leads/opt-out`) must update the customer record immediately — never suppress or delay.
- **`audit_log`** — every privileged action must call `logAudit()`. Do not remove existing `logAudit` calls.

### Deployment
- **Frontend deploys: always `git push`** — Vercel auto-deploy is unreliable; also trigger via Vercel REST API after pushing (see `feedback_autocdp_deploy.md`).
- **Backend (if Fly.io is used for any workers): `fly deploy`.**
- **`next.config.ts`** has `ignoreBuildErrors: true` for demo mode. Do not remove this without first fixing all TypeScript errors.

---

## 9. Current UI/UX State

The following are implemented and should be preserved as-is:

### Navigation (Sidebar)
- Navy sidebar (`#0B1526`) with grouped nav items
- Groups: Main (Dashboard, Customers, Campaigns), Channels (Direct Mail, SMS/Email, Newsletter), Intelligence (Agents, Analytics, Health), Operations (Integrations, Inventory, Conquest, Audit), Account (Settings, Billing)
- Active route highlighted with indigo left border
- Dealership name + logo in sidebar header
- User email + logout in sidebar footer
- Demo banner strip at top when demo mode is active

### Dashboard Home
- Stat cards row: Customers, Campaigns Sent, Revenue Attributed, AI Spend
- Recent Campaigns table with status badges
- DMS ROI Panel, Cadence Panel, Campaign Impact Panel (all built, data-wired)

### Direct Mail Builder
- Full 5-step wizard functional (customer select → template → goal → preview → send)
- Handwriting preview renders correctly (Caveat font + CSS transforms)
- Test mail panel works end-to-end (AI copy → PostGrid test send)
- Cost estimate shown before confirming production send
- QR tracking URL shown in preview

### Customer Table
- Lifecycle stage chips (filter by VIP / Active / At Risk / Lapsed)
- Search by name/email
- Click-through to detail view

### Settings
- Memories CRUD working (add / edit / delete guidance fragments)
- Insights display working
- Limits display working

### Agents Panel
- Test run panel functional (enter goal, click Run, see preview output)
- Token usage + estimated cost displayed after each run
- Agent run history table

### Integrations
- Connection cards for all 6 DMS providers
- Connect flow functional for CDK and VinSolutions
- Last sync timestamp + error state displayed

### Demo Mode
- Toggle via `/api/demo/toggle`
- Persistent banner at top of all dashboard pages
- Returns `demo-data.ts` fixtures instead of Supabase queries
- No rate limits applied in demo mode

---

*End of AUTOCDP_PROJECT_SUMMARY.md — last updated 2026-05-11*
