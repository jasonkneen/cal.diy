-- Restore the legacy routing form tables removed in a later migration.
-- This keeps the current raw-SQL based repository implementation functional without
-- changing Prisma schema definitions in this branch.

CREATE TABLE IF NOT EXISTS "App_RoutingForms_Form" (
  "id" TEXT NOT NULL,
  "description" TEXT,
  "routes" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "userId" INTEGER NOT NULL,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "settings" JSONB,
  "teamId" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "updatedById" INTEGER,

  CONSTRAINT "App_RoutingForms_Form_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "App_RoutingForms_Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "App_RoutingForms_Form_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "App_RoutingForms_Form_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "App_RoutingForms_FormResponse" (
  "id" SERIAL NOT NULL,
  "formFillerId" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "routedToBookingUid" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "App_RoutingForms_FormResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "App_RoutingForms_FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "App_RoutingForms_Form"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "App_RoutingForms_Form_userId_idx" ON "App_RoutingForms_Form" ("userId");
CREATE INDEX IF NOT EXISTS "App_RoutingForms_Form_disabled_idx" ON "App_RoutingForms_Form" ("disabled");
CREATE INDEX IF NOT EXISTS "App_RoutingForms_FormResponse_formFillerId_idx" ON "App_RoutingForms_FormResponse" ("formFillerId");
CREATE INDEX IF NOT EXISTS "App_RoutingForms_FormResponse_formId_idx" ON "App_RoutingForms_FormResponse" ("formId");
CREATE INDEX IF NOT EXISTS "App_RoutingForms_FormResponse_formId_createdAt_idx" ON "App_RoutingForms_FormResponse" ("formId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "App_RoutingForms_FormResponse_formFillerId_formId_key" ON "App_RoutingForms_FormResponse" ("formFillerId", "formId");
CREATE UNIQUE INDEX IF NOT EXISTS "App_RoutingForms_FormResponse_routedToBookingUid_key" ON "App_RoutingForms_FormResponse" ("routedToBookingUid");
