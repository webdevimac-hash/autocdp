# AutoCDP — AI-Powered Multi-Tenant Customer Data Platform for Auto Dealerships

AutoCDP is a production-ready SaaS foundation that combines a 5-agent Claude AI swarm, direct mail personalization, hybrid billing, and Supabase multi-tenancy with Row Level Security.

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│  Dealers (multi-tenant, isolated via Supabase RLS)            │
│                                                               │
│  Dashboard → [Direct Mail] → Direct Mail Orchestrator        │
│                                  ↓  (Anthropic tool_use loop) │
│              Creative Agent → send_direct_mail tool          │
│                                  ↓                            │
│              PostGrid REST API → Print + USPS fulfillment    │
│                  ↓                                            │
│              QR Code (qrcode pkg) → /track/[id] landing page │
│                  ↓                                            │
│              mail_scans table → Analytics                     │
│                                                               │
│  Classic flow: [Campaigns] → Orchestrator → Data / Targeting │
│              → Creative → Optimization → Global Learnings     │
└──────────────────────────────────────────────────────────────┘
```

---

## PostGrid Direct Mail Setup

### 1. Sign up for PostGrid

1. Go to [postgrid.com](https://postgrid.com) → **Sign Up for free**
2. Dashboard → **Developers** → **API Keys**
3. Copy your **Test API Key** (`test_sk_...`) — no mail is printed in test mode, no charge
4. Paste it into `.env.local`:
   ```
   POSTGRID_API_KEY=test_sk_your_key_here
   ```
5. For production: use your **Live API Key** (`live_sk_...`)

### 2. Configure webhook (for status updates)

1. PostGrid Dashboard → **Developers** → **Webhooks** → **Add Endpoint**
2. URL: `https://your-domain.com/api/webhooks/postgrid`
3. Select events: `mail.in_transit`, `mail.processed_for_delivery`, `mail.delivered`, `mail.returned_to_sender`
4. Copy the signing secret → add to `.env.local`:
   ```
   POSTGRID_WEBHOOK_SECRET=whsec_...
   ```

### 3. Run the migration

In Supabase SQL Editor, run:
```
supabase/migrations/003_mail_pieces.sql
```

### 4. Test direct mail

1. Add customers with full addresses in Supabase Table Editor
2. Go to **Dashboard → Direct Mail → Campaign Builder**
3. Select customers, choose **6×9 Postcard**, enter a campaign goal
4. Click **Generate AI Copy** — Creative Agent personalizes per customer
5. Preview the rendered postcard with handwriting simulation
6. Click **Run Dry Run** to see what Claude would generate and send (no PostGrid call)
7. Toggle off Dry Run and click **Send** to submit real PostGrid jobs

### 5. How agents trigger real mail

```
User clicks "Send Campaign"
    ↓
POST /api/mail/send
    ↓
runDirectMailOrchestrator()
    ↓  (per customer, Anthropic tool_use loop)
Claude (claude-sonnet-4-6) writes personalized copy
    ↓
Claude calls send_direct_mail tool
    ↓
executeSendDirectMailTool()
    ├── Creates mail_pieces row (pending)
    ├── Generates QR code (qrcode npm pkg) → /track/{id}
    ├── Calls PostGrid REST API → submits print job
    ├── Updates mail_pieces (processing + PostGrid IDs)
    └── Records billing_event (mail_piece_sent, $1.50)
    ↓
PostGrid prints + mails → USPS → customer doorstep (2–5 days)
    ↓
Customer scans QR → /track/{id} logs scan → analytics
    ↓
PostGrid webhook → /api/webhooks/postgrid → updates status
```

---

## Quick Start

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the Supabase SQL Editor, run all migration files **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_mail_pieces.sql`  ← direct mail tables
3. Enable the `vector` extension: SQL Editor → `CREATE EXTENSION IF NOT EXISTS vector;`
4. In Auth → URL Configuration, set:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: `http://localhost:3000/auth/callback`

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Create your first account

1. Go to `/signup` — enter your dealership name and email
2. Check your email for the confirmation link
3. Sign in → you'll land on the Onboarding page
4. Enter your dealership website URL and complete setup
5. Explore the dashboard!

---

## Testing the AI Agents

1. Add some sample customers directly via Supabase Table Editor
2. Go to **Dashboard → Agents → Test Run**
3. Enter a campaign goal, click **Run Agent Swarm**
4. Review the AI-generated personalized messages

### Direct Mail Preview

On the Agents page, click the **Direct Mail Preview** tab to see the CSS-based handwriting engine — character-level rotation, scale, and opacity variation that simulates a robotic pen on uncoated paper.

---

## Project Structure

```
autocdp/
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # Supabase Auth login
│   │   ├── (auth)/signup/        # Signup + dealership provisioning
│   │   ├── auth/callback/        # Supabase email confirmation handler
│   │   ├── onboarding/           # Website scrape + dealership setup
│   │   ├── dashboard/            # Protected dealer workspace
│   │   │   ├── page.tsx          # Home / overview
│   │   │   ├── customers/        # Customer table with lifecycle stages
│   │   │   ├── campaigns/        # Campaign cards + status
│   │   │   ├── agents/           # 5-agent swarm + direct mail preview
│   │   │   ├── analytics/        # Metrics + cross-dealer learnings
│   │   │   ├── billing/          # Plans + usage metering
│   │   │   └── settings/         # Dealership profile + API keys
│   │   └── api/
│   │       ├── agents/test/      # POST — runs orchestrator pipeline
│   │       ├── billing/webhook/  # Stripe webhook receiver
│   │       └── onboarding/
│   │           ├── scrape/       # Website scraper (Claude Phase 1, Puppeteer Phase 2)
│   │           └── provision/    # Creates dealership + user_dealerships row
│   ├── lib/
│   │   ├── supabase/             # Browser + server + service-role clients
│   │   ├── anthropic/
│   │   │   └── agents/           # 5 agents: orchestrator, data, targeting, creative, optimization
│   │   └── billing/              # Metering helpers + Stripe webhook stub
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # Sidebar + Header
│   │   └── direct-mail/          # Handwriting preview component
│   └── types/                    # Shared TypeScript types
└── supabase/migrations/          # SQL schema + RLS policies
```

---

## 5-Agent Swarm Design

| Agent | Model | Role |
|-------|-------|------|
| **Orchestrator** | claude-opus-4-7 | Plans execution sequence, coordinates specialists |
| **Data Agent** | claude-sonnet-4-6 | Segments customers, scores churn risk, LTV |
| **Targeting Agent** | claude-sonnet-4-6 | Selects optimal audience, propensity scoring |
| **Creative Agent** | claude-sonnet-4-6 | Writes personalized messages per customer |
| **Optimization Agent** | claude-sonnet-4-6 | Analyzes outcomes, extracts global patterns |

All agents are in `src/lib/anthropic/agents/`. Swap models in `src/lib/anthropic/client.ts`.

---

## Database Schema Overview

| Table | Purpose |
|-------|---------|
| `dealerships` | Dealer profile, settings |
| `user_dealerships` | Multi-user, role-based access per dealer |
| `customers` | Profiles with pgvector embedding for semantic memory |
| `visits` | Service history (VIN, mileage, notes) |
| `campaigns` | Campaign definitions + stats |
| `communications` | Individual message log (SMS/email/mail) |
| `learning_outcomes` | Per-dealership campaign outcome data |
| `global_learnings` | **Anonymized** cross-dealer patterns (no PII) |
| `agent_runs` | Audit trail for AI agent executions |
| `billing_events` | Usage metering for hybrid billing |

Row Level Security isolates every row by `dealership_id` — dealers can never see each other's data.

---

## Next Steps After This Boilerplate

### Phase 2 — Core Functionality

- [ ] **DMS Import**: Build a CSV/DMS connector (CDK, Reynolds & Reynolds, Tekion) to bulk-import customers and visits
- [ ] **pgvector Embeddings**: Generate `last_visit_embedding` via OpenAI `text-embedding-3-small` after each visit record insert
- [ ] **Campaign Launch Flow**: Wire the "Launch" button to actually create `communications` rows and send via providers
- [ ] **Puppeteer Scraper**: Replace the Claude-only onboarding scraper with Puppeteer + Claude for accurate logo/address/hours extraction
- [ ] **Lob.com Integration**: Replace the direct mail preview with real Lob API calls for physical mail fulfillment
- [ ] **Twilio SMS**: Implement SMS delivery using the Twilio Node SDK
- [ ] **Resend Email**: Implement email delivery with React Email templates

### Phase 3 — Billing & Growth

- [ ] **Stripe Billing**: Implement the subscription checkout flow + Stripe Customer Portal
- [ ] **Orb Metering**: Wire `billing_events` → Orb for real usage-based billing
- [ ] **Dunning Flow**: Handle `invoice.payment_failed` webhook to gracefully degrade access
- [ ] **Referral Program**: Dealer-to-dealer referrals with attribution

### Phase 4 — Intelligence

- [ ] **Cross-Dealer Anonymization Pipeline**: Background job that aggregates `learning_outcomes` → `global_learnings` with PII stripped
- [ ] **A/B Testing**: Campaign variant tracking with statistical significance calculation
- [ ] **Predictive Scheduling**: Optimization Agent suggests optimal send time per customer
- [ ] **Vehicle Lifecycle Triggers**: Automatic campaign triggers at 3k, 6k, 12k mile service intervals

### Phase 5 — Scale

- [ ] **Supabase Edge Functions**: Move heavy agent runs to Edge Functions for better cold-start performance
- [ ] **Queue System**: Add BullMQ / Inngest for reliable background agent execution
- [ ] **White-Label**: Per-dealership custom domains and branding for dealer groups
- [ ] **Mobile App**: React Native companion for service advisors

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (never expose client-side) |
| `ANTHROPIC_API_KEY` | ✅ | For AI agent swarm |
| `NEXT_PUBLIC_APP_URL` | ✅ | Full URL of your app (for redirects) |
| `STRIPE_SECRET_KEY` | Phase 2 | Stripe subscription billing |
| `STRIPE_WEBHOOK_SECRET` | Phase 2 | Stripe webhook signature verification |
| `LOB_API_KEY` | Phase 2 | Direct mail fulfillment |
| `TWILIO_ACCOUNT_SID` | Phase 2 | SMS delivery |
| `RESEND_API_KEY` | Phase 2 | Email delivery |

---

## Deployment (Vercel)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "Initial AutoCDP boilerplate"
git remote add origin https://github.com/yourorg/autocdp.git
git push -u origin main

# 2. Import to Vercel
# vercel.com → New Project → Import from GitHub

# 3. Add environment variables in Vercel Dashboard
# (All variables from .env.example)

# 4. Deploy
vercel --prod
```

---

## Security Notes

- All Supabase queries use Row Level Security — dealers are isolated at the database level
- `SUPABASE_SERVICE_ROLE_KEY` is used server-side only (bypasses RLS for provisioning)
- Agent runs are audited in `agent_runs` table
- `global_learnings` never contains PII — only anonymized statistical patterns
- Stripe webhook signature is verified before processing billing events

---

Built with Next.js 15 (App Router) · Supabase · Anthropic Claude · Tailwind CSS · shadcn/ui
