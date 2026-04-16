/**
 * Smoke test for routing-forms restoration.
 *
 * Exercises RoutingFormRepository against a live local Postgres to validate:
 *   1. Restored tables (App_RoutingForms_Form / FormResponse) accept inserts.
 *   2. The saveResponse UUID fix — same user submitting twice no longer
 *      collides with the (formId, formFillerId) unique index.
 *   3. The 42P01 → ROUTING_FORMS_TABLES_MISSING_ERROR mapping works when the
 *      tables are absent (simulated by renaming the form table).
 *
 * Run with:
 *   yarn ts-node --transpile-only scripts/smoke-routing-forms.ts <userId>
 *
 * The user must already exist (seed with the SQL in HANDOVER §9 or
 * `INSERT INTO users (uuid, username, email, ...) VALUES (gen_random_uuid(), ...)`).
 */
import dotEnv from "dotenv";
import path from "node:path";

dotEnv.config({ path: path.resolve(__dirname, "../.env") });

import prisma from "@calcom/prisma";
import {
  ROUTING_FORMS_TABLES_MISSING_ERROR,
  RoutingFormRepository,
} from "@calcom/features/routing-forms/repositories/RoutingFormRepository";

const USER_ID = Number(process.argv[2] ?? 2);

type Step = { name: string; run: () => Promise<void> };

const results: { name: string; ok: boolean; detail?: string }[] = [];

async function step(name: string, run: () => Promise<void>) {
  process.stdout.write(`▶ ${name} ... `);
  try {
    await run();
    results.push({ name, ok: true });
    console.log("PASS");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, detail });
    console.log(`FAIL\n   ${detail}`);
  }
}

async function main() {
  const createdId = { value: "" };
  let secondResponseId = 0;

  await step("create form", async () => {
    const form = await RoutingFormRepository.create(USER_ID, {
      name: "Smoke Test Form",
      description: "Created by scripts/smoke-routing-forms.ts",
      fields: [
        { id: "f1", label: "Your name", type: "text", required: true },
      ],
      actions: [
        { id: "a1", actorType: "User", userId: USER_ID, position: 0, selected: true },
      ],
      rules: [],
    });
    if (!form.id) throw new Error("create returned no id");
    createdId.value = form.id;
  });

  await step("list includes the new form", async () => {
    const forms = await RoutingFormRepository.listByUser(USER_ID);
    if (!forms.some((f) => f.id === createdId.value)) {
      throw new Error("created form not in list");
    }
  });

  await step("getById returns the form", async () => {
    const form = await RoutingFormRepository.getById(createdId.value, USER_ID);
    if (!form || form.id !== createdId.value) throw new Error("getById missed it");
  });

  await step("update persists name change", async () => {
    const updated = await RoutingFormRepository.update(createdId.value, USER_ID, {
      name: "Smoke Test Form (renamed)",
    });
    if (updated.name !== "Smoke Test Form (renamed)") {
      throw new Error(`update did not persist: got "${updated.name}"`);
    }
  });

  await step("saveResponse #1", async () => {
    const r = await RoutingFormRepository.saveResponse(
      createdId.value,
      { f1: "Ada Lovelace" },
      USER_ID
    );
    if (!r.id) throw new Error("no id");
  });

  await step("saveResponse #2 (validates UUID fix; pre-fix this would crash)", async () => {
    const r = await RoutingFormRepository.saveResponse(
      createdId.value,
      { f1: "Ada Lovelace (again)" },
      USER_ID
    );
    if (!r.id) throw new Error("no id");
    secondResponseId = r.id;
  });

  await step("getResponses returns both", async () => {
    const rows = await RoutingFormRepository.getResponses(createdId.value, USER_ID);
    if (rows.length !== 2) {
      throw new Error(`expected 2 responses, got ${rows.length}`);
    }
    const ids = new Set(rows.map((r) => r.formFillerId));
    if (ids.size !== 2) {
      throw new Error(`formFillerIds should be unique per submission, got ${ids.size}`);
    }
  });

  await step("missing-table maps to ROUTING_FORMS_TABLES_MISSING_ERROR", async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "App_RoutingForms_Form" RENAME TO "App_RoutingForms_Form__hidden";`
    );
    try {
      await RoutingFormRepository.listByUser(USER_ID).then(
        () => {
          throw new Error("expected error, got success");
        },
        (err: Error) => {
          if (err.message !== ROUTING_FORMS_TABLES_MISSING_ERROR) {
            throw new Error(`wrong error: ${err.message}`);
          }
        }
      );
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "App_RoutingForms_Form__hidden" RENAME TO "App_RoutingForms_Form";`
      );
    }
  });

  await step("delete removes the form", async () => {
    await RoutingFormRepository.delete(createdId.value, USER_ID);
    const after = await RoutingFormRepository.getById(createdId.value, USER_ID);
    if (after !== null) throw new Error("form still present after delete");
  });

  console.log();
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`Result: ${passed}/${results.length} passed`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
