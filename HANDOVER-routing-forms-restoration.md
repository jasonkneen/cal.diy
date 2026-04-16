# Handover: Routing-Forms Restoration + Adjacent TRPC Handler Cleanup

**Branch state:** dirty working tree (not committed). No PR opened yet.
**Handover target:** next agent (Claude / Codex / human engineer) to finish end-to-end production readiness.
**Date of handover:** 2026-04-16

---

## 1. TL;DR

Routing-forms was previously removed by migration `20260305043434_remove_routing_forms`, but a lot of runtime code (raw-SQL repository, TRPC router, evaluator, app-store integrations, UI) still assumes the legacy tables exist. This branch restores the feature **without** changing the Prisma schema, by:

1. Adding a **restore migration** that recreates `App_RoutingForms_Form` + `App_RoutingForms_FormResponse` with the legacy columns/indexes/FKs.
2. Re-aligning the **routing-forms TRPC router** to the modern `router` + `authedProcedure` pattern.
3. Hardening the raw-SQL **`RoutingFormRepository`** for legacy data shapes + missing-table runtime errors.
4. Fixing a few **auth-context typing** issues in the adjacent `teams` and `workflows` viewer handlers, plus some minor `RegularBookingService` / `handleCancelBooking` workflow-trigger non-blocking wiring that was already half-applied.

**TRPC package typecheck is green.** `apps/web` and `packages/features` still have **pre-existing** unrelated compile errors that are outside the scope of this branch but will need to be addressed before ship.

---

## 2. What is done ✅

### 2.1 Migration (new)
- `packages/prisma/migrations/20260306000000_restore_routing_forms_tables/migration.sql`
- Recreates:
  - `App_RoutingForms_Form` (id, name, description, routes jsonb, fields jsonb, userId, teamId, updatedById, position, settings, disabled, createdAt, updatedAt) with FKs to `users` / `Team`.
  - `App_RoutingForms_FormResponse` (id serial, formFillerId TEXT NOT NULL, formId FK, response jsonb, routedToBookingUid, createdAt, updatedAt).
- Recreates indexes used in raw SQL:
  - `App_RoutingForms_Form_userId_idx`, `_disabled_idx`
  - `App_RoutingForms_FormResponse_formFillerId_idx`, `_formId_idx`, `_formId_createdAt_idx`
  - Unique: `_formFillerId_formId_key`, `_routedToBookingUid_key`
- Idempotent (`IF NOT EXISTS`) so it is safe to re-run and safe even if some tables partially exist in a staging DB.

### 2.2 TRPC routing-forms router
- `packages/trpc/server/routers/viewer/routing-forms/_router.tsx`
  - Migrated from old `createTRPCRouter` + `defaultProcedures` pattern to **`router` + `authedProcedure`**.
  - Routes: `list`, `get`, `create`, `update`, `delete`, `saveResponse`, `getResponses`.
  - `update` uses the merged schema `RoutingFormUpdateWithIdSchema` (id + partial update) — avoids the inline `.merge(...)` inference parse issue we hit before.

### 2.3 Schemas & types
- `packages/trpc/server/routers/viewer/routing-forms/routing-forms.schema.ts`
  - Clean zod schemas with transforms → domain types (`RoutingField`, `RoutingAction`, `RoutingRule`).
  - Explicit:
    - `RoutingFormInputSchema` (create)
    - `RoutingFormUpdateSchema` (partial update)
    - `RoutingFormUpdateWithIdSchema = RoutingFormIdSchema.merge(RoutingFormUpdateSchema)`
    - `RoutingFormQuerySchema` (list w/ `limit`, default 50)
    - `RoutingFormResponseInputSchema` (formId + responses)
  - Inferred types exported: `TRoutingFormInput`, `TRoutingFormUpdateInput`, `TRoutingFormUpdateWithIdInput`, `TGetInput`, `TListInput`, `TListOutput`, `TResponseInput`, `TGetResponseOutput`, `TRoutingForm`.

### 2.4 Handlers
- `packages/trpc/server/routers/viewer/routing-forms/routing-forms.handler.ts`
  - Handlers typed against `AuthenticatedContext = { user: NonNullable<TrpcSessionUser> }`.
  - Introduced `withRoutingFormsAvailability({ operation })` helper:
    - If the repository throws `ROUTING_FORMS_TABLES_MISSING_ERROR`, returns `TRPCError({ code: "NOT_FOUND" })` instead of leaking a raw Prisma error.
  - `toPublicForm` / `toPublicResponse` passthrough mappers (kept for future API-safe shaping).

### 2.5 Repository
- `packages/features/routing-forms/repositories/RoutingFormRepository.ts`
  - Raw-SQL (preserved) — no Prisma model reliance.
  - Exports:
    - `ROUTING_FORMS_TABLES_MISSING_ERROR = "Routing forms feature is unavailable because required database tables are missing."`
  - Centralized `executeQuery<T>(query)`:
    - Catches `Prisma.PrismaClientKnownRequestError` with code `42P01` (undefined_table) and rethrows as `Error(ROUTING_FORMS_TABLES_MISSING_ERROR)`.
  - Defensive parsing helpers for all legacy JSON shapes:
    - `toArray`, `toString`, `toNumber`, `toNumberArray`, `toBoolean`
    - `toRoutingFieldType`, `toRoutingRuleOperator`, `toOptionalId`
    - `parseField`, `parseAction`, `parseRule`, `parseRoutes`, `parseFieldValidation`
    - `normalizeActions`, `normalizeRules`, `normalizeResponseValues`, `parseUserId`
  - `getFormByIdAndUser` (ownership + actor-based access): hardened JSON cast to prevent SQL failure on malformed `userId`:
    ```sql
    CASE
      WHEN (action ->> 'userId') ~ '^-?\d+$'
        THEN (action ->> 'userId')::int
      ELSE NULL
    END = ${userId}
    ```
  - `saveResponse` writes `userId.toString()` into required `formFillerId TEXT NOT NULL`.
  - `getResponses` joins on form ownership to enforce access.

### 2.6 Domain types
- `packages/features/routing-forms/lib/types.ts`
  - No longer imports from `@calcom/prisma/enums`. Local enum-like:
    - `export type RoutingActorType = "User" | "Team"`
  - `RoutingAction.actorType: RoutingActorType`.
  - Added back-compat alias `export type RoutingField = RoutingFormField`.
  - `RoutingFormResponse.id: number`, optional `formFillerId?: string`.

### 2.7 Adjacent viewer handler hardening
- `packages/trpc/server/routers/viewer/teams/teams.handler.ts`
  - Auth context strengthened via `AuthenticatedContext = { user: NonNullable<TrpcSessionUser> }`.
  - Unused `Prisma` import dropped.
- `packages/trpc/server/routers/viewer/workflows/workflows.handler.ts`
  - Same `AuthenticatedContext` pattern.
  - Adjusted type-only imports (`type TimeUnit`, `type WorkflowActions`, `type WorkflowTriggerEvents`) and kept `WorkflowTemplates` as value import.

### 2.8 Bookings workflow evaluation (non-blocking)
- `packages/features/bookings/lib/handleCancelBooking.ts`
  - `WorkflowTriggerEvents` now imported alongside `BookingStatus` from `@calcom/prisma/enums`.
  - `evaluateWorkflows` call in the cancel path is inside try/catch; failures **do not block cancellation**, only warn.
  - Minor fixes: `iCalSequence: evt.iCalSequence ?? 0`, `eventTypeId: bookingToDelete.eventTypeId ?? 0`, `additionalNotes: bookingToDelete.description ?? undefined` (there is no `additionalNotes` column on booking in current schema — see Risks §6).
  - Added `import process from "node:process"` (used for `NEXT_PUBLIC_WEBAPP_URL` fallback).
- `packages/features/bookings/lib/service/RegularBookingService.ts`
  - Same non-blocking workflow-evaluation wrapping on the new/reschedule path.
  - `eventTypeId: booking.eventTypeId ?? eventTypeId` fallback, `additionalNotes: additionalNotes ?? undefined`.

### 2.9 Typecheck status
- ✅ `yarn --cwd packages/trpc exec tsc --noEmit -p tsconfig.json --pretty false`
- ✅ `yarn --cwd packages/trpc exec tsc --noEmit -p tsconfig.server.json --pretty false`

---

## 3. What is NOT done ❌

These are the items a next agent should finish before this is production-ready.

### 3.1 Migration deployment
- The migration has **not** been applied to any environment yet.
- Verify in staging first: `yarn prisma migrate deploy` (or the project's equivalent).
- Run a smoke test: create → list → update → save response → list responses via the TRPC router.

### 3.2 `apps/web` routing-forms UI — pre-existing compile failures
Remaining blockers in `apps/web/app/(use-page-wrapper)/settings/routing-forms/[id]/page.tsx` (and siblings):
- `Cannot find module '@calcom/ui/components/meta'` — the `Meta` component path has changed. Multiple pages (`teams/`, `workflows/`, `routing-forms/`, etc.) still import it; needs a repo-wide fix OR a shim re-export.
- `trpc.useQuery({...}, { onSuccess })` — v11 removed `onSuccess` from query options. Refactor to `useEffect`-on-data pattern or `select`.
- Icon-name typing: strings like `"list"`, `"grip-vertical"`, `"layout-grid"` are not part of the current `IconName` union (settings layout + routing-forms field editor).
  - Either extend `IconName` union or swap for supported icons.
- `RoutingFormFieldEditor.tsx` has several TS errors:
  - `@calcom/ui/components/switch` missing.
  - Type guards on discriminated `ROUTING_FORM_TEMPLATES[type]` shape (`needsOptions`, `placeholder` etc.) need narrowing.
  - Select options need `GroupBase`-shaped values.
  - `Button.variant` values `"minimal"` no longer valid — use current union.
  - `TextAreaField` now requires `name`.

### 3.3 `packages/features` — pre-existing compile noise
Not caused by this branch; flagged for visibility:
- `@hookform/resolvers/zod` package.json `exports` issue.
- `dayjs` `business-days-plugin` types missing.
- `booking-audit` tasker producer service (type regression on payload typing).
- Various integration tests missing `rrResetInterval`, `rrTimestampBasis`, `userLevelSelectedCalendars` etc.
- `features/di/webhooks/{Webhooks.tokens,webhooks.tokens}.ts` filename-casing collision (pick one canonical filename).
- `tasker/redis-tasker.ts` no longer matches `Tasker` interface after `TaskPayloads` typing changed.

### 3.4 Tests
- No routing-forms-specific unit tests exist yet. Recommend adding at least:
  - `RoutingFormRepository.executeQuery` returns `ROUTING_FORMS_TABLES_MISSING_ERROR` on Prisma error `42P01`.
  - `getFormByIdAndUser` actor-based access (owner, routed-to-user, unauthorized).
  - `withRoutingFormsAvailability` → TRPC `NOT_FOUND` mapping.
  - Schema transform round-trips (input parse ↔ domain type).
- Handler smoke tests mirroring existing `routers/viewer/*/*.handler.test.ts` patterns.

### 3.5 UX hardening (optional but nice)
- Pre-migration environments: the settings UI should show a clear "Routing forms feature is unavailable" message when the TRPC call returns `NOT_FOUND` with the well-known error string instead of a generic error toast.

### 3.6 Housekeeping
- Commit + open a **draft PR** (per `AGENTS.md` PR size rules — this PR is ~880 LOC across 10 files and may need splitting; see §7).
- Run `yarn biome check --write .` on the modified files before commit.
- Remove any leftover scratch files (none at the time of this handover).

---

## 4. Exact file list (working tree)

```
 M packages/features/bookings/lib/handleCancelBooking.ts
 M packages/features/bookings/lib/service/RegularBookingService.ts
 M packages/features/routing-forms/lib/types.ts
 M packages/features/routing-forms/repositories/RoutingFormRepository.ts
 A packages/prisma/migrations/20260306000000_restore_routing_forms_tables/migration.sql
 M packages/trpc/server/routers/viewer/routing-forms/_router.tsx
 M packages/trpc/server/routers/viewer/routing-forms/routing-forms.handler.ts
 M packages/trpc/server/routers/viewer/routing-forms/routing-forms.schema.ts
 M packages/trpc/server/routers/viewer/teams/teams.handler.ts
 M packages/trpc/server/routers/viewer/workflows/workflows.handler.ts
```

Line change totals: **+881 / −573** across 10 files.

---

## 5. Architecture decisions (and why)

| Decision | Why |
|---|---|
| **Restore via migration, not Prisma model rewrite** | The repo runtime already assumes legacy table shape via raw SQL; aligning Prisma models is a far larger change. A targeted restore unblocks everything. |
| **Raw-SQL repository preserved** | Same reason — many call sites depend on existing behavior; we harden rather than rewrite. |
| **Missing-table → `NOT_FOUND`** | The feature can be rolled out gradually; environments without the migration applied should degrade gracefully, not 500. |
| **Explicit `RoutingFormUpdateWithIdSchema`** | Inline `z.infer<typeof A.merge(B)>` tripped the TS parser. Naming the composite keeps types simple. |
| **Local `RoutingActorType` (not prisma enum)** | `ZotActorType`/equivalent has been removed from `@calcom/prisma/enums`; keep the domain self-contained. |
| **`AuthenticatedContext` pattern** | TRPC handlers are declared `authedProcedure`, so `ctx.user` is non-null. Typing it as such removes defensive `!` / optional chains and aligns with `_router.tsx`. |
| **Workflow evaluation wrapped in try/catch (non-blocking)** | Bookings must not fail when workflow engine/side-effects fail. |
| **Safer JSON userId cast in SQL** | A bad legacy `action.userId` (e.g. UUID string) would throw at cast; the regex-gated `CASE` returns NULL instead. |

---

## 6. Known risks / gotchas

1. **`additionalNotes` on booking**
   - The current Prisma `Booking` model doesn’t have an `additionalNotes` column — existing code uses `description`. I mapped workflow `additionalNotes` → `booking.description ?? undefined` in `handleCancelBooking`, and to a local `additionalNotes` variable in `RegularBookingService`.
   - If the workflow engine expects a different field semantic (e.g. the full response payload), this mapping may need to change.

2. **`formFillerId` is `TEXT NOT NULL`**
   - We insert `userId.toString()`. For anonymous/public form fills (if that path is ever added), the repo currently has no branch for `userId = undefined` — it must be supplied. The old product supported anonymous responses with UUIDs for `formFillerId`; if that feature is reintroduced, update `saveResponse` accordingly.

3. **Migration is restore-only**
   - It does **not** attempt to repopulate data that was dropped by `20260305043434_remove_routing_forms`. If your env ran that migration with real data, you’ve already lost it unless you have a backup.

4. **Typecheck scope**
   - `packages/trpc` tsc is green. `packages/features` and `apps/web` tsc have unrelated errors that exist on `main` too. Do not block this work on those, but they do block a clean `yarn type-check:ci --force` at repo level.

5. **PR size**
   - Current diff is ~881 LOC — over the 500-LOC guideline in `AGENTS.md`. Consider the suggested split in §7.

6. **Auth on `saveResponse`**
   - `saveResponse` is behind `authedProcedure`. If the product needs to accept **public** (unauthenticated) submissions, this will need a dedicated public procedure (e.g. `publicProcedure`) + anonymous `formFillerId` generation path.

---

## 7. Suggested PR splits (per `AGENTS.md`)

To stay under 500 LOC per PR, split into 4:

1. **PR 1 — DB restore migration** (small, foundational)
   - `packages/prisma/migrations/20260306000000_restore_routing_forms_tables/migration.sql`

2. **PR 2 — Routing-forms repository + types hardening**
   - `packages/features/routing-forms/lib/types.ts`
   - `packages/features/routing-forms/repositories/RoutingFormRepository.ts`

3. **PR 3 — Routing-forms TRPC router/handler/schema**
   - `packages/trpc/server/routers/viewer/routing-forms/_router.tsx`
   - `packages/trpc/server/routers/viewer/routing-forms/routing-forms.handler.ts`
   - `packages/trpc/server/routers/viewer/routing-forms/routing-forms.schema.ts`

4. **PR 4 — Adjacent handler + bookings non-blocking workflow wiring**
   - `packages/trpc/server/routers/viewer/teams/teams.handler.ts`
   - `packages/trpc/server/routers/viewer/workflows/workflows.handler.ts`
   - `packages/features/bookings/lib/handleCancelBooking.ts`
   - `packages/features/bookings/lib/service/RegularBookingService.ts`

Each PR should be draft, labeled conventionally (e.g. `feat(routing-forms): restore persistence migration`, `refactor(trpc/routing-forms): migrate router to authedProcedure`, `fix(bookings): non-blocking workflow evaluation on cancel/new`, etc.).

---

## 8. Validation commands

```bash
# TRPC type health (must stay green)
yarn --cwd packages/trpc exec tsc --noEmit -p tsconfig.json --pretty false
yarn --cwd packages/trpc exec tsc --noEmit -p tsconfig.server.json --pretty false

# Repo-wide type check (expected: unrelated errors remain)
yarn type-check:ci --force

# Lint / format touched files
yarn biome check --write \
  packages/features/bookings/lib/handleCancelBooking.ts \
  packages/features/bookings/lib/service/RegularBookingService.ts \
  packages/features/routing-forms/lib/types.ts \
  packages/features/routing-forms/repositories/RoutingFormRepository.ts \
  packages/trpc/server/routers/viewer/routing-forms/_router.tsx \
  packages/trpc/server/routers/viewer/routing-forms/routing-forms.handler.ts \
  packages/trpc/server/routers/viewer/routing-forms/routing-forms.schema.ts \
  packages/trpc/server/routers/viewer/teams/teams.handler.ts \
  packages/trpc/server/routers/viewer/workflows/workflows.handler.ts

# Prisma (after pulling the branch)
yarn prisma generate
# In a staging DB:
yarn prisma migrate deploy
```

---

## 9. Smoke-test checklist (post-migration deploy)

Against a dev/staging env with the restore migration applied and seeded user:

- [ ] `trpc.viewer.routingForms.create` with fields + actions → returns a form with generated id.
- [ ] `trpc.viewer.routingForms.list` → includes the created form.
- [ ] `trpc.viewer.routingForms.get({ id })` → returns it.
- [ ] `trpc.viewer.routingForms.update({ id, name })` → persists.
- [ ] `trpc.viewer.routingForms.saveResponse({ formId, responses })` → persists `formFillerId = userId.toString()`.
- [ ] `trpc.viewer.routingForms.getResponses({ id })` → returns prior response.
- [ ] `trpc.viewer.routingForms.delete({ id })` → success.
- [ ] Flipping tables missing (rename one for the test) → all endpoints return `TRPCError.code === "NOT_FOUND"` instead of 500.

---

## 10. Starter prompt for the next agent

> Continue the routing-forms restoration branch. Working tree state and context are in `HANDOVER-routing-forms-restoration.md`. Please:
> 1. Review §2 (done), §3 (open), §6 (risks).
> 2. Apply the restore migration in staging and run the §9 smoke checklist.
> 3. Address `apps/web` routing-forms UI TS errors listed in §3.2 (`Meta` import path, `onSuccess` query option, icon-name union, `RoutingFormFieldEditor` typing).
> 4. Add the focused tests in §3.4.
> 5. Split into 4 draft PRs per §7, following `AGENTS.md` conventions.
> 6. Do **not** touch unrelated pre-existing compile errors in §3.3 unless blocking.
>
> Preserve the raw-SQL repository. Do not refactor the Prisma schema. Keep workflow side effects non-blocking. Keep `authedProcedure` as the default auth boundary; any public `saveResponse` path must be a separate, explicit procedure.
