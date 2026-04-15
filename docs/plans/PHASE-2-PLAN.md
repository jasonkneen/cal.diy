# Cal.diy Enhancement Plan — Phase 2

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Complete Teams feature gap, then build Workflows engine and Routing Forms — the three biggest missing features from the cal.com cloud platform.

**Current State:** 7 commits ahead of upstream. ~60% feature parity.

**What's Done (Phase 0 + Phase 1):**
- ✅ Cal Video recording/transcription unlocked
- ✅ OOO team redirect unlocked
- ✅ API key creation implemented
- ✅ Stale /ee/ references cleaned
- ✅ deploy.sh one-click deployment
- ✅ docker-compose hardened with health checks
- ✅ GitHub Actions CI for multi-arch Docker images
- ✅ cal.com blog + pricing monitoring cron jobs
- ✅ Teams tRPC router (12 endpoints: CRUD, invite, roles, leave)
- ✅ Teams settings UI (list, create, member management)
- ✅ Settings sidebar "Teams" section added
- ✅ Round-robin reassignment (manual + automatic) implemented
- ✅ README overhauled with parity tracker
- ✅ Team billing bypass confirmed working (IS_TEAM_BILLING_ENABLED=false)

---

## PHASE 1 COMPLETION: Team Event Types (1-2 days)

### Context

The event type system ALREADY supports teams — the listing view groups by team,
the create dialog accepts teamId + schedulingType, the form tabs handle
round-robin/collective/managed UI, and the booking flow fully supports all three
scheduling types. The only gap was that users couldn't CREATE teams, which we
fixed. What remains is verification and minor wiring.

### Task 1: Verify team event type creation works end-to-end

**Objective:** Confirm the existing create dialog works with our new teams.

**Files to check:**
- `apps/web/modules/event-types/components/CreateEventTypeDialog.tsx`
- `packages/trpc/server/routers/viewer/eventTypes/heavy/create.schema.ts`
- `packages/trpc/server/routers/loggedInViewer/teamsAndUserProfilesQuery.handler.ts`

**Steps:**
1. Read `teamsAndUserProfilesQuery.handler.ts` to confirm it returns teams with `teamId`
2. Read `CreateEventTypeDialog.tsx` to confirm it passes `teamId` to the create mutation
3. Read the event type create schema to confirm `teamId` and `schedulingType` are accepted
4. Trace the create mutation → handler → Prisma create to ensure team event types persist
5. If any wiring gaps exist, patch them

**Verification:** Creating a team, then creating a round-robin event type for that team should work. The event type should appear under the team group in the listing view.

### Task 2: Ensure the team tab in event type editor works

**Objective:** The event type editor has tabs that show team-specific settings. Verify they render.

**Files:**
- `apps/web/modules/event-types/components/tabs/EventSetupTab.tsx` (RR per-host locations)
- `apps/web/modules/event-types/components/tabs/EventAvailabilityTab.tsx` (team availability)
- `apps/web/modules/event-types/components/tabs/EventAdvancedTab.tsx` (RR booking limits)
- `apps/web/modules/event-types/components/EventTypeWebWrapper.tsx`

**Steps:**
1. Check if `CheckedTeamSelect` component still exists for host selection
2. Check if `AssignAllTeamMembers` toggle exists
3. Verify that `isTeamEvent` detection works in the tab components
4. Fix any missing imports or broken references

### Task 3: Fix team profile page SSR (currently returns notFound)

**Objective:** The team/[slug] page SSR is partially stubbed. Fix it.

**Files:**
- `apps/web/lib/team/[slug]/getServerSideProps.tsx`

**Steps:**
1. Read the file — it sets `team = null` and returns `notFound`
2. Replace with real Prisma query for team by slug
3. Return team data to render the team profile page

**Commit:** `fix: wire team event types and team profile page`

---

## PHASE 2A: Workflows / Automations Engine (1-2 weeks)

### Context

Workflows were completely removed from cal.diy. Zero workflow files exist in
`packages/features/`. This is the #2 most requested feature (after Teams).

A workflow = Trigger → (optional Condition) → Action

### Architecture

```
packages/features/workflows/
  lib/
    constants.ts          — Trigger types, action types, templates
    types.ts              — TypeScript interfaces
    engine.ts             — Core workflow evaluation engine
    reminders/
      emailReminder.ts    — Send email N minutes before/after
      smsReminder.ts      — Send SMS reminder
      webhookAction.ts    — Fire webhook on trigger
  repositories/
    WorkflowRepository.ts — Prisma CRUD for workflows
  components/
    WorkflowList.tsx      — List user's workflows
    WorkflowForm.tsx      — Create/edit workflow
    WorkflowStepEditor.tsx — Configure individual steps

packages/trpc/server/routers/viewer/workflows/
  _router.tsx             — tRPC workflow router
  workflows.schema.ts     — Zod schemas
  workflows.handler.ts    — CRUD + trigger handlers

apps/web/app/(use-page-wrapper)/settings/workflows/
  page.tsx                — Workflow list page
  new/page.tsx            — Create workflow page
  [id]/page.tsx           — Edit workflow page
```

### Prisma Models (ALREADY EXIST in schema)

The Workflow, WorkflowStep, WorkflowReminder, and WorkflowsOnEventTypes models
are already defined in the Prisma schema. We just need to build the feature code.

### Task 4: Create workflow constants and types

**Objective:** Define the trigger types, action types, and workflow interfaces.

**Files:**
- Create: `packages/features/workflows/lib/constants.ts`
- Create: `packages/features/workflows/lib/types.ts`

**Triggers (from Prisma WorkflowTriggerEvents enum):**
- BEFORE_EVENT — N minutes before booking
- EVENT_CANCELLED — When booking is cancelled
- NEW_EVENT — When new booking is created
- AFTER_EVENT — N minutes after booking ends
- RESCHEDULE_EVENT — When booking is rescheduled

**Actions (from Prisma WorkflowActions enum):**
- EMAIL_HOST — Send email to host
- EMAIL_ATTENDEE — Send email to attendee
- SMS_ATTENDEE — Send SMS to attendee
- SMS_NUMBER — Send SMS to specific number
- EMAIL_ADDRESS — Send email to specific address
- WHATSAPP_ATTENDEE — Send WhatsApp to attendee
- WHATSAPP_NUMBER — Send WhatsApp to specific number

**Templates (from Prisma WorkflowTemplates enum):**
- REMINDER — Standard reminder
- CUSTOM — Custom message
- CANCELLED — Cancellation notice
- RESCHEDULED — Reschedule notice
- COMPLETED — Post-event follow-up

### Task 5: Create workflow repository

**Objective:** Prisma CRUD operations for workflows.

**Files:**
- Create: `packages/features/workflows/repositories/WorkflowRepository.ts`

**Methods:**
- `create(userId, data)` — Create workflow with steps
- `getById(id, userId)` — Get workflow with steps
- `listByUser(userId)` — List all user workflows
- `listByTeam(teamId)` — List team workflows
- `update(id, userId, data)` — Update workflow + steps
- `delete(id, userId)` — Delete workflow + cascade steps
- `activateForEventType(workflowId, eventTypeId)` — Link workflow to event type
- `deactivateForEventType(workflowId, eventTypeId)` — Unlink

### Task 6: Create workflow engine (trigger evaluation)

**Objective:** The core engine that evaluates triggers and fires actions.

**Files:**
- Create: `packages/features/workflows/lib/engine.ts`
- Create: `packages/features/workflows/lib/reminders/emailReminder.ts`
- Create: `packages/features/workflows/lib/reminders/smsReminder.ts`
- Create: `packages/features/workflows/lib/reminders/webhookAction.ts`

**Logic:**
1. On booking event (create/cancel/reschedule), query active workflows for that event type
2. For each matching workflow, evaluate trigger conditions (timing, filters)
3. For each step in the workflow, schedule or execute the action
4. Use the existing tasker/cron system for timed actions (BEFORE_EVENT, AFTER_EVENT)

### Task 7: Create workflow tRPC router

**Objective:** API endpoints for workflow CRUD.

**Files:**
- Create: `packages/trpc/server/routers/viewer/workflows/_router.tsx`
- Create: `packages/trpc/server/routers/viewer/workflows/workflows.schema.ts`
- Create: `packages/trpc/server/routers/viewer/workflows/workflows.handler.ts`
- Modify: `packages/trpc/server/routers/viewer/_router.tsx` (add workflows)

**Endpoints:**
- `workflows.list` — List workflows for user/team
- `workflows.get` — Get single workflow with steps
- `workflows.create` — Create workflow with steps
- `workflows.update` — Update workflow + steps
- `workflows.delete` — Delete workflow
- `workflows.activate` — Link to event type
- `workflows.deactivate` — Unlink from event type
- `workflows.test` — Send test notification

### Task 8: Create workflow settings UI

**Objective:** Settings pages for managing workflows.

**Files:**
- Create: `apps/web/app/(use-page-wrapper)/settings/workflows/page.tsx`
- Create: `apps/web/app/(use-page-wrapper)/settings/workflows/new/page.tsx`
- Create: `apps/web/app/(use-page-wrapper)/settings/workflows/[id]/page.tsx`
- Modify: settings sidebar to add "Workflows" section

**UI:**
- List page: Shows all workflows with on/off toggle, trigger type badge, linked event types
- Create/edit page: Step-by-step form — select trigger → configure timing → add action steps → select event types
- Each step: Action type dropdown, recipient, message template editor

### Task 9: Wire workflows into booking flow

**Objective:** Hook the workflow engine into the booking create/cancel/reschedule paths.

**Files:**
- Modify: `packages/features/bookings/lib/service/RegularBookingService.ts`
- Modify: `packages/features/bookings/lib/handleCancelBooking.ts`

**Logic:**
After a booking is created/cancelled/rescheduled, call `workflowEngine.evaluate(event, trigger)` which queries active workflows for the event type and schedules actions.

**Commit:** `feat: workflows engine with email/SMS/webhook actions`

---

## PHASE 2B: Routing Forms (1-2 weeks)

### Context

Routing forms let you ask questions before booking and route to different
event types or team members based on answers. Completely removed from cal.diy.

### Architecture

```
packages/features/routing-forms/
  lib/
    types.ts              — Form field types, routing rule types
    evaluator.ts          — Rule evaluation engine
  repositories/
    RoutingFormRepository.ts — Prisma CRUD
  components/
    RoutingFormBuilder.tsx  — Drag-and-drop form builder
    RoutingFormPreview.tsx  — Preview/test the form
    RoutingFormPublic.tsx   — Public-facing form for bookers

packages/trpc/server/routers/viewer/routingForms/
  _router.tsx
  routingForms.schema.ts
  routingForms.handler.ts

apps/web/app/(use-page-wrapper)/settings/routing-forms/
  page.tsx
  new/page.tsx
  [id]/page.tsx

apps/web/app/(use-page-wrapper)/routing/[formId]/
  page.tsx                — Public routing form page
```

### Prisma Models

The App_RoutingForms_Form, App_RoutingForms_FormResponse models exist in schema.

### Tasks 10-15: Follow same pattern as workflows
- Task 10: Types and constants
- Task 11: Repository
- Task 12: Rule evaluation engine
- Task 13: tRPC router
- Task 14: Builder UI + settings pages
- Task 15: Public form rendering + booking integration

**Commit:** `feat: routing forms with rule-based question routing`

---

## PHASE 3: Insights Dashboard (1 week)

### Context

Built-in analytics showing booking stats, conversion rates, popular times.
No insights code exists in cal.diy.

### Architecture

Simple server-side aggregation queries + chart UI.

```
packages/features/insights/
  lib/
    queries.ts            — Prisma aggregation queries
    types.ts              — Report types
  components/
    InsightsDashboard.tsx  — Main dashboard
    BookingChart.tsx       — Bookings over time
    PopularTimesHeatmap.tsx — Demand heatmap
    TeamPerformance.tsx    — Per-member stats
    ConversionFunnel.tsx   — Page view → booking conversion

apps/web/app/(use-page-wrapper)/insights/
  page.tsx
```

### Tasks 16-19:
- Task 16: Aggregation queries (bookings by date, by member, by event type)
- Task 17: tRPC router for insights data
- Task 18: Dashboard UI with charts (use recharts, already a dependency)
- Task 19: Add to main navigation

**Commit:** `feat: insights dashboard with booking analytics`

---

## PHASE 4: Enterprise Features (2-3 weeks)

### Task 20-21: SSO/SAML
SAML env vars already exist. Use `@boxyhq/saml-jackson` (was the original provider).
- Task 20: Install and configure SAML Jackson
- Task 21: Add SSO settings UI in org/team settings

### Task 22-23: Booking Audit Trail
- Task 22: Create audit log service (writes to BookingAudit table, already in schema)
- Task 23: Add audit log viewer in settings

### Task 24-25: Instant Booking
- Task 24: Add `instantMeetingEnabled` toggle to event type settings
- Task 25: Skip confirmation step when enabled for trusted contacts

### Task 26-27: PBAC (Permission-Based Access Control)
- Task 26: Replace the always-true PBAC guard with real role checks
- Task 27: Add permission management UI in team settings

---

## TIMELINE

```
Week 1 (now):
  Day 1-2: Task 1-3 — Complete team event types + verification
  Day 3-5: Task 4-6 — Workflow engine core

Week 2:
  Day 1-2: Task 7-8 — Workflow tRPC + UI
  Day 3:   Task 9   — Wire workflows into booking flow
  Day 4-5: Task 10-12 — Routing forms core

Week 3:
  Day 1-2: Task 13-15 — Routing forms tRPC + UI + public form
  Day 3-5: Task 16-19 — Insights dashboard

Week 4:
  Day 1-5: Task 20-27 — Enterprise features (SSO, audit, instant, PBAC)

TOTAL: 4 weeks to ~95% parity with cal.com cloud
```

---

## PRIORITY ORDER (if time is limited)

1. **Verify team event types work** (Task 1-3) — minutes of work, huge value
2. **Workflows** (Task 4-9) — #1 requested feature after teams
3. **Routing forms** (Task 10-15) — #2 requested feature
4. **Insights** (Task 16-19) — differentiator
5. **SSO/SAML** (Task 20-21) — enterprise requirement
6. **Audit trail** (Task 22-23) — compliance
7. **Instant booking** (Task 24-25) — nice to have
8. **PBAC** (Task 26-27) — enterprise polish
