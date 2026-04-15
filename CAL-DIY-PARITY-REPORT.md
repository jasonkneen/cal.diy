# Cal.diy vs Cal.com: Full Parity Report & Battle Plan

## Executive Summary

On April 14, 2026, Cal.com announced they are **going closed source**. The public repo
was renamed from `calcom/cal.com` to `calcom/cal.diy`. The production codebase moved to
a private repository. Their stated reason: "AI-driven security threats."

**The refactor PR (#28903) deleted ~400,000 lines of code from the open-source version.**

Cal.diy is now described by them as being for "hobbyists" and "personal, non-production
use." They claim the production codebase has "significantly diverged."

**Our mission: Prove them wrong. Build a fully-featured, one-click deployable,
production-ready open-source scheduling platform that matches and exceeds Cal.com.**

---

## PART 1: FEATURE GAP ANALYSIS

### What Cal.diy ALREADY HAS (solid foundation)

| Category | Features | Status |
|----------|----------|--------|
| Core Scheduling | Event types, slots, availability, booking lifecycle | ✅ Working |
| Calendar Sync | Google, Apple, CalDAV, Exchange, Office365, Zoho, ICS, Lark, Feishu | ✅ Working |
| Video Conferencing | Daily.co, Zoom, Google Meet, MS Teams, Jitsi + 15 more | ✅ Working |
| App Store | 100+ integrations across all categories | ✅ Working |
| Payments | Stripe, PayPal, HitPay, BTCPay | ✅ Working |
| CRM | HubSpot, Salesforce, Close, Pipedrive, Attio, Zoho | ✅ Working |
| Automation | Zapier, Make, n8n, Pipedream webhooks | ✅ Working |
| Analytics | GA4, Matomo, Fathom, Plausible, PostHog, Umami | ✅ Working |
| AI Voice Agents | Retell AI, ElevenLabs, Bolna, Fonio, Greetmate, Millis, Synthflow, Telli | ✅ Working |
| Embeds | Inline, popup, floating button widgets | ✅ Working |
| API | REST API v2 (NestJS) | ✅ Working |
| Auth | NextAuth.js, email/password, OAuth | ✅ Working |
| Webhooks | 21 trigger events | ✅ Working |
| Feature Flags | Full admin-controlled flag system | ✅ Working |
| Notifications | Web push (VAPID), email | ✅ Working |
| Scheduling Types | Round Robin, Collective, Managed | ✅ Schema exists |
| Out of Office | Calendar-aware OOO | ✅ Working |
| Bot Detection | Cloudflare Turnstile | ✅ Working |
| Form Builder | Dynamic booking forms | ✅ Working |
| i18n | Multi-language support | ✅ Working |
| Docker | docker-compose with Postgres + Redis + Web + API | ✅ Basic |

### What Was REMOVED (the ~400K lines they deleted)

| # | Feature | Cal.com Tier | Effort to Rebuild | Priority |
|---|---------|-------------|-------------------|----------|
| 1 | **Teams & Team Scheduling** | Teams ($12/mo) | HIGH (3-4 weeks) | 🔴 CRITICAL |
| 2 | **Organizations / Multi-tenant** | Orgs ($28/mo) | HIGH (4-6 weeks) | 🟡 HIGH |
| 3 | **Routing Forms** | Teams ($12/mo) | MEDIUM (2-3 weeks) | 🔴 CRITICAL |
| 4 | **Workflows (Automations)** | Teams ($12/mo) | MEDIUM (2-3 weeks) | 🔴 CRITICAL |
| 5 | **Insights / Analytics Dashboard** | Teams ($12/mo) | MEDIUM (2 weeks) | 🟡 HIGH |
| 6 | **SSO / SAML** | Orgs ($28/mo) | LOW-MEDIUM (1-2 weeks) | 🟡 HIGH |
| 7 | **Instant Booking** | Teams ($12/mo) | LOW (3-5 days) | 🟢 MEDIUM |
| 8 | **AI Phone Agent** | Enterprise | MEDIUM (2-3 weeks) | 🟢 MEDIUM |
| 9 | **Attributes & Segments** | Orgs ($28/mo) | MEDIUM (2 weeks) | 🟡 HIGH |
| 10 | **PBAC (Permission-Based Access)** | Enterprise | MEDIUM (2-3 weeks) | 🟡 HIGH |
| 11 | **Round Robin Reassignment** | Teams ($12/mo) | LOW (3-5 days) | 🔴 CRITICAL |
| 12 | **Delegation Credentials** | Orgs ($28/mo) | MEDIUM (1-2 weeks) | 🟢 MEDIUM |
| 13 | **Booking Audit Trail** | Enterprise | LOW (1 week) | 🟢 MEDIUM |
| 14 | **Admin Impersonation** | Enterprise | LOW (2-3 days) | 🟢 MEDIUM |
| 15 | **API v1** | All tiers | LOW (already have v2) | ⚪ LOW |
| 16 | **Phone Verification** | Orgs ($28/mo) | LOW (3-5 days) | 🟢 MEDIUM |
| 17 | **Premium Usernames** | Hosted only | N/A (not needed) | ⚪ SKIP |

### What's BROKEN / HALF-WORKING in Cal.diy

| Issue | Location | Fix Effort |
|-------|----------|-----------|
| Cal Video advanced settings hardcoded off | `CalVideoSettings.tsx` — `hasTeamPlan = false` | 5 minutes |
| Org branding hardcoded to null everywhere | Multiple components | 30 minutes |
| Round Robin reassignment is a no-op stub | `packages/platform/libraries/index.ts` | 3-5 days |
| Stripe webhook returns 404 | `apps/web/pages/api/stripe/webhook.ts` | 1-2 days |
| API key creation throws "not available" | `packages/platform/libraries/index.ts` | 1 day |
| `createNewUsersConnectToOrgIfExists` throws | `packages/platform/libraries/index.ts` | Part of Orgs |
| PBAC guard always returns true (no-op) | `apps/api/v2/src/modules/auth/guards/pbac/` | 2-3 weeks |
| Stale /ee/ references in config files | trigger.config.ts, AGENTS.md | 30 minutes |

---

## PART 2: THE WORK REQUIRED

### Phase 0: Quick Wins (Week 1) — Low-hanging fruit
**Goal: Fix everything that's broken but easy**

1. Fix Cal Video settings — remove `hasTeamPlan = false` hardcoding
2. Fix Stripe webhook endpoint — re-implement basic payment webhook handling
3. Fix API key creation stub — implement the handler
4. Clean up stale /ee/ references
5. Fix org branding null hardcoding (make it configurable)
6. Enable round-robin and collective scheduling (schema already exists)
7. Improve Docker deployment (see Phase 5)

**Estimated effort: 1 developer, 1 week**

### Phase 1: Teams & Core Collaboration (Weeks 2-5)
**Goal: Full team scheduling — the #1 missing feature**

1. **Team Management UI** — Create/edit teams, invite members, roles
2. **Team Event Types** — Round robin, collective, managed event types
3. **Team Availability** — Merged availability views
4. **Round Robin Reassignment** — Full implementation (not the stub)
5. **Team Billing Bypass** — Already free for self-hosted, just wire it up
6. **Member Directory** — Team member pages

**Estimated effort: 2 developers, 4 weeks**

### Phase 2: Workflows & Routing (Weeks 4-7)
**Goal: Automation engine — the #2 most requested feature**

1. **Workflow Engine** — Trigger → Condition → Action pipeline
2. **Built-in Triggers** — Before/after event, new booking, cancellation, no-show, reschedule
3. **Built-in Actions** — Send email, send SMS, send webhook, create calendar event
4. **Workflow Templates** — Pre-built reminder, follow-up, and notification workflows
5. **Routing Forms** — Dynamic question → route to team member/event type
6. **Route Builder UI** — Visual drag-and-drop routing logic

**Estimated effort: 2 developers, 4 weeks (overlaps with Phase 1)**

### Phase 3: Insights & Analytics (Weeks 6-8)
**Goal: Data-driven scheduling insights**

1. **Booking Analytics Dashboard** — Charts for bookings over time, conversion rates
2. **Team Performance** — Per-member booking stats, response times
3. **Popular Times** — Heatmap of booking demand
4. **No-show Tracking** — No-show rates, patterns
5. **Export** — CSV/PDF reports

**Estimated effort: 1 developer, 2 weeks**

### Phase 4: Enterprise Features (Weeks 7-12)
**Goal: Feature parity with Cal.com Organizations tier**

1. **Organizations / Multi-tenant** — Org-level settings, sub-teams, unified billing
2. **SSO/SAML** — Enterprise identity provider integration (SAML env vars already exist)
3. **PBAC** — Real permission-based access control (replace the always-true stub)
4. **Attributes & Segments** — Member attributes, segment-based routing
5. **Delegation Credentials** — Shared OAuth credentials across org
6. **Booking Audit Trail** — Full audit logging
7. **Admin Impersonation** — Support-style user impersonation
8. **Instant Booking** — Skip confirmation for trusted contacts

**Estimated effort: 2-3 developers, 6 weeks**

### Phase 5: One-Click Deployment (Parallel Track, Weeks 1-4)
**Goal: Deploy in 60 seconds, not 60 minutes**

See detailed plan in Part 4 below.

---

## PART 3: AGENT-S CONTINUOUS MONITORING PLAN

### Architecture: Automated Feature Parity Monitoring

```
┌─────────────────────────────────────────────────────┐
│                   AGENT-S MONITOR                    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Blog     │  │ Platform │  │ Feature Matrix   │  │
│  │ Monitor  │  │ Tester   │  │ Diff Generator   │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│       ▼              ▼                 ▼             │
│  ┌──────────────────────────────────────────────┐   │
│  │           REPORT GENERATOR                    │   │
│  │  - New features detected                      │   │
│  │  - UI/UX changes                              │   │
│  │  - API endpoint changes                       │   │
│  │  - Blog post summaries                        │   │
│  │  - Priority-ranked backlog updates            │   │
│  └──────────────────────────────────────────────┘   │
│                       │                              │
│                       ▼                              │
│             GitHub Issue / PR Creation               │
│             Discord/Slack Notification                │
└─────────────────────────────────────────────────────┘
```

### Component 1: Blog Monitor (Weekly)
- Scrape cal.com/blog RSS feed
- Detect new posts about features, product updates, changelog
- Summarize with AI and create GitHub issues tagged `upstream-feature`
- Track: blog post URL, date, features mentioned, estimated effort

### Component 2: Platform Tester (Bi-weekly)
Using test accounts on cal.com cloud (free tier + trial):

**Automated E2E Tests:**
- Login/signup flow — detect auth changes
- Event type creation — detect new options/fields
- Booking flow — detect new booking UI elements
- Settings pages — screenshot diff for new settings
- App store — detect new integrations
- API endpoints — probe for new/changed endpoints
- Embed widget — detect new embed options

**Tool: Playwright test suite running against cal.com production**
- Screenshot comparison (pixelmatch) for UI drift detection
- API response schema diffing for endpoint changes
- DOM structure comparison for feature additions

### Component 3: Feature Matrix Diff (Monthly)
- Scrape cal.com/pricing and feature comparison pages
- Compare against our tracked feature matrix
- Generate diff report: new features, changed tiers, removed features
- Auto-update our internal tracking spreadsheet

### Cron Schedule

| Job | Frequency | What |
|-----|-----------|------|
| Blog scrape | Weekly (Monday 9am) | New blog posts → GitHub issues |
| Free tier smoke test | Bi-weekly (1st & 15th) | E2E tests against cal.com free |
| Pricing page diff | Monthly (1st) | Feature matrix comparison |
| API schema probe | Monthly (1st) | New/changed API endpoints |
| Full screenshot diff | Monthly (15th) | Visual comparison of all pages |

### Implementation

```
scripts/
  agent-s/
    blog-monitor.py          # RSS scraper + AI summarizer
    platform-tester/
      playwright.config.ts   # E2E test config targeting cal.com
      tests/
        auth.spec.ts         # Login/signup flow tests
        booking.spec.ts      # Booking flow tests
        event-types.spec.ts  # Event type creation tests
        settings.spec.ts     # Settings page screenshots
        app-store.spec.ts    # App store catalog
        api-probe.spec.ts    # API endpoint probing
    feature-matrix-diff.py   # Pricing page scraper + diff
    report-generator.py      # Compile all findings into report
    notify.py                # GitHub issue + Discord notification
```

---

## PART 4: ONE-CLICK DEPLOYMENT PLAN

### The Vision
```
curl -fsSL https://get.cal.diy | bash
```
Or click a button on GitHub → Running instance in 90 seconds.

### Deployment Options (all must be supported)

#### Option A: Docker Compose (Self-hosted, any VPS)
**Current state:** Exists but requires manual .env setup, DB migration, and build
**Target state:** Single command, auto-generates secrets, runs migrations, starts everything

```bash
# What it should be:
git clone https://github.com/cal-diy/cal.diy && cd cal.diy
./deploy.sh
# That's it. Open http://localhost:3000
```

**What deploy.sh does:**
1. Check Docker + Docker Compose installed
2. Generate random NEXTAUTH_SECRET and CALENDSO_ENCRYPTION_KEY
3. Copy .env.example → .env with sane defaults
4. Pull pre-built images (not build from source — 10x faster)
5. `docker compose up -d`
6. Wait for DB health check
7. Run Prisma migrations
8. Seed admin user
9. Print URL + admin credentials

#### Option B: One-Click Cloud Deploy Buttons

```
[Deploy to Railway]  [Deploy to Render]  [Deploy to DigitalOcean]
[Deploy to Fly.io]   [Deploy to Coolify]  [Deploy to Vercel+Neon]
```

Each button pre-configures:
- Postgres database provisioning
- Redis provisioning
- Environment variables (auto-generated secrets)
- Domain/SSL setup
- Automatic migrations

**Implementation:** `deploy/` directory with platform-specific configs:
```
deploy/
  railway/
    railway.toml
    Procfile
  render/
    render.yaml
  digitalocean/
    app.yaml
  fly/
    fly.toml
  coolify/
    docker-compose.coolify.yml
  vercel/
    vercel.json
```

#### Option C: Pre-built Docker Images (Docker Hub / GHCR)
**Publish multi-arch images on every release:**
```bash
docker pull ghcr.io/cal-diy/cal-diy:latest
docker pull ghcr.io/cal-diy/cal-diy-api:latest
```

**CI/CD Pipeline (GitHub Actions):**
```
on release:
  → Build linux/amd64 + linux/arm64 images
  → Push to ghcr.io
  → Push to Docker Hub
  → Update deploy templates with new tag
  → Run smoke tests against deployed image
```

#### Option D: Kubernetes / Helm Chart
```
helm repo add cal-diy https://charts.cal.diy
helm install my-cal cal-diy/cal-diy \
  --set postgres.enabled=true \
  --set redis.enabled=true \
  --set ingress.hostname=cal.mycompany.com
```

**Helm chart includes:**
- Postgres (Bitnami subchart) or external DB config
- Redis (Bitnami subchart) or external Redis config  
- Web deployment + service
- API v2 deployment + service
- Ingress with TLS (cert-manager)
- CronJob for DB maintenance
- HPA (Horizontal Pod Autoscaler)
- PDB (Pod Disruption Budget)

### Pre-built Image Strategy

The **biggest deployment pain point** is building from source. The Dockerfile runs
`yarn install` + `turbo build` which takes 10-20 minutes and needs 6GB+ RAM.

**Solution: Publish pre-built images on every commit to main + every release tag.**

GitHub Actions workflow:
```yaml
name: Build & Publish Docker Images
on:
  push:
    branches: [main]
    tags: ['v*']
  schedule:
    - cron: '0 0 * * 0'  # Weekly rebuild for security patches

jobs:
  build:
    strategy:
      matrix:
        component: [web, api-v2]
    steps:
      - uses: docker/build-push-action@v5
        with:
          platforms: linux/amd64,linux/arm64
          tags: ghcr.io/cal-diy/${{ matrix.component }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Deployment Configuration Wizard

Interactive setup for non-technical users:
```bash
$ ./deploy.sh

🗓️  Cal.diy Deployment Wizard

? Your domain name: cal.mycompany.com
? Email for SSL certs: admin@mycompany.com  
? Enable email notifications? (Y/n): Y
? SMTP server: smtp.gmail.com
? SMTP user: cal@mycompany.com
? SMTP password: ****
? Enable Google Calendar integration? (Y/n): Y
? Google OAuth Client ID: ...
? Google OAuth Client Secret: ...

✅ Configuration saved to .env
✅ Docker containers starting...
✅ Database migrations complete
✅ SSL certificate provisioned via Let's Encrypt

🎉 Cal.diy is running at https://cal.mycompany.com
   Admin login: admin@mycompany.com / [generated password]
```

---

## PART 5: MAKING IT BETTER THAN CAL.COM

### Features Cal.com Doesn't Have (our differentiators)

| Feature | Description | Why It Matters |
|---------|-------------|----------------|
| **One-click deploy** | 90-second deployment | Cal.com says self-hosting is hard — we make it trivial |
| **Full data sovereignty** | Zero telemetry, zero phoning home | They moved closed-source citing "security" |
| **Plugin system** | Community-contributed integrations | Not locked to their app store review process |
| **Multi-provider video** | Jitsi/BBB self-hosted video, not just Daily.co | No dependency on a single SaaS video provider |
| **White-label ready** | Complete rebranding in config, not code | Companies can deploy as their own product |
| **Offline-first PWA** | Service worker for booking page | Works without internet for viewing schedules |
| **CalDAV server mode** | Act as a CalDAV server, not just client | Replace entire calendar infrastructure |
| **Webhook IDE** | In-app webhook testing and debugging | Developer experience Cal.com lacks |
| **Multi-region** | Deploy across regions with DB replication guide | Enterprise requirement Cal.com charges $$$$ for |
| **Community marketplace** | Community-built event type templates | Share and discover scheduling patterns |
| **Open telemetry** | Built-in Grafana/Prometheus dashboards | Full observability without their "Insights" paywall |

---

## PART 6: IMPLEMENTATION TIMELINE

```
WEEK  1  ────────── Phase 0: Quick Wins + Deployment v1
                     - Fix all stubs and broken features
                     - deploy.sh script
                     - Pre-built Docker images CI
                     - README overhaul

WEEK  2  ┐
WEEK  3  │──────── Phase 1a: Teams Core
WEEK  4  │          - Team CRUD, member management
WEEK  5  ┘          - Team event types, round robin

WEEK  4  ┐
WEEK  5  │──────── Phase 2a: Workflows Core  
WEEK  6  │          - Workflow engine, triggers, actions
WEEK  7  ┘          - Routing forms

WEEK  6  ┐──────── Phase 3: Insights
WEEK  8  ┘          - Analytics dashboard, reports

WEEK  7  ┐
WEEK  8  │
WEEK  9  │──────── Phase 4: Enterprise
WEEK 10  │          - Orgs, SSO, PBAC, audit
WEEK 11  │
WEEK 12  ┘

WEEK  1  ┐
WEEK  2  │──────── Phase 5: Deployment (parallel)
WEEK  3  │          - Helm chart, cloud deploy buttons
WEEK  4  ┘          - Wizard, documentation

WEEK  2  ┐──────── Agent-S Setup (parallel)
WEEK  3  ┘          - Blog monitor, platform tester, cron jobs

ONGOING  ────────── Agent-S runs weekly/monthly
                     - Detects new Cal.com features
                     - Creates backlog issues
                     - Maintains parity
```

### Team Requirements

| Role | Count | Duration |
|------|-------|----------|
| Full-stack dev (Next.js/TypeScript) | 2 | 12 weeks |
| DevOps / Infrastructure | 1 | 4 weeks (part-time after) |
| Agent-S setup & maintenance | 1 | 2 weeks (then automated) |

**Total: ~3 developers, 12 weeks to full parity.**
**With aggressive AI-assisted coding: 1-2 developers, 8-10 weeks.**

---

## PART 7: CODING PLAN FOR AGENT-S (HERMES CRON JOBS)

### Job 1: Blog Monitor
```
Schedule: Every Monday at 9:00 AM UTC
Action:
  1. Fetch https://cal.com/blog RSS feed
  2. Extract posts from last 7 days
  3. For each new post:
     a. Extract content with web_extract
     b. AI-analyze for: new features, API changes, pricing changes
     c. If feature-relevant: create GitHub issue with label "upstream-feature"
  4. Generate weekly digest report
```

### Job 2: Platform Smoke Test  
```
Schedule: 1st and 15th of each month at 6:00 AM UTC
Action:
  1. Navigate to cal.com with test account
  2. Run Playwright E2E suite:
     - Screenshot every settings page
     - Screenshot booking flow
     - Screenshot event type creation (check for new fields)
     - Screenshot app store (count integrations)
     - Probe API v2 endpoints (check for new routes)
  3. Compare screenshots against baseline (pixelmatch)
  4. Diff API responses against stored schemas
  5. Generate diff report
  6. If significant changes detected: create GitHub issue with screenshots
```

### Job 3: Feature Matrix Sync
```
Schedule: 1st of each month at 12:00 PM UTC
Action:
  1. Scrape cal.com/pricing
  2. Extract feature lists per tier
  3. Compare against our tracked matrix (this document)
  4. Generate parity percentage score
  5. Update PARITY-TRACKER.md in repo
  6. If new features found: create prioritized GitHub issues
```

---

## PART 8: IMMEDIATE NEXT STEPS

### Right Now (Today)

1. **Fix the 5-minute wins:**
   - `CalVideoSettings.tsx` → remove `hasTeamPlan = false`
   - Clean up stale /ee/ references
   - Fix org branding null hardcoding

2. **Create the deployment script:**
   - `deploy.sh` with secrets auto-generation
   - Improve docker-compose.yml with health checks
   - Add Caddy/Traefik for automatic SSL

3. **Set up CI for pre-built Docker images:**
   - GitHub Actions workflow
   - Multi-arch builds (amd64 + arm64)
   - Push to GHCR

4. **Set up Agent-S blog monitor cron job**

### This Week

5. Start Phase 1 (Teams) — the single biggest gap
6. Create Helm chart skeleton
7. Add one-click deploy buttons for Railway + Render

### The Message

Cal.com went closed-source claiming open-source is a security liability.
Cal.diy will prove that open-source scheduling can be:
- **More feature-complete** than their paid tiers
- **Easier to deploy** than their cloud signup
- **More secure** through transparency, not obscurity
- **Community-driven** and improving faster than a closed team

**Open source isn't dead. It's just getting started.**
