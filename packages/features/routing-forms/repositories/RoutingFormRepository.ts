import prisma from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";
import type {
  RoutingAction,
  RoutingField,
  RoutingForm,
  RoutingFormResponse,
  RoutingFormSaveInput,
  RoutingFormUpdateInput,
  RoutingRule,
} from "../lib/types";

const ROUTING_FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "multiSelect",
  "radio",
  "checkbox",
  "phone",
  "email",
  "number",
  "date",
  "hidden",
] as const;

const ROUTING_RULE_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "regex",
] as const;

type RoutingFormRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  fields: unknown;
  routes: unknown;
};

type RoutingFormResponseRow = {
  id: number;
  formId: string;
  response: unknown;
  formFillerId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
};

export const ROUTING_FORMS_TABLES_MISSING_ERROR =
  "Routing forms feature is unavailable because required database tables are missing.";

type StoredRoutes = {
  actions?: unknown;
  rules?: unknown;
};

export class RoutingFormRepository {
  private static toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private static toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  private static toNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private static toNumberArray(value: unknown): number[] {
    return RoutingFormRepository.toArray(value)
      .map((item) => RoutingFormRepository.toNumber(item))
      .filter((item): item is number => item !== undefined);
  }

  private static async executeQuery<T>(query: () => Promise<T>): Promise<T> {
    try {
      return await query();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "42P01") {
        throw new Error(ROUTING_FORMS_TABLES_MISSING_ERROR);
      }
      throw error;
    }
  }

  private static toBoolean(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback;
  }

  private static toRoutingFieldType(value: unknown): RoutingField["type"] {
    const rawType = RoutingFormRepository.toString(value);

    if ((ROUTING_FORM_FIELD_TYPES as readonly string[]).includes(rawType)) {
      return rawType as RoutingField["type"];
    }

    return "text";
  }

  private static toRoutingRuleOperator(value: unknown): RoutingRule["operator"] {
    const rawOperator = RoutingFormRepository.toString(value);

    if ((ROUTING_RULE_OPERATORS as readonly string[]).includes(rawOperator)) {
      return rawOperator as RoutingRule["operator"];
    }

    return "equals";
  }

  private static toOptionalId(value: unknown, fallback: string): string {
    const parsed = RoutingFormRepository.toString(value);

    return parsed || fallback;
  }

  private static parseFieldValidation(value: unknown): RoutingField["validation"] {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const typed = value as Record<string, unknown>;
    const min = RoutingFormRepository.toNumber(typed.min);
    const max = RoutingFormRepository.toNumber(typed.max);
    const pattern = typeof typed.pattern === "string" ? typed.pattern : undefined;

    if (pattern === undefined && min === undefined && max === undefined) {
      return undefined;
    }

    return {
      pattern,
      min,
      max,
    };
  }

  private static parseField(raw: unknown, index: number): RoutingField {
    if (!raw || typeof raw !== "object") {
      return {
        id: `field-${index}`,
        label: "",
        type: "text",
        required: false,
      };
    }

    const value = raw as Record<string, unknown>;

    return {
      id: RoutingFormRepository.toOptionalId(value.id, `field-${index}`),
      label: RoutingFormRepository.toString(value.label),
      type: RoutingFormRepository.toRoutingFieldType(value.type),
      required: RoutingFormRepository.toBoolean(value.required),
      options: RoutingFormRepository.toArray(value.options).filter(
        (option): option is string => typeof option === "string"
      ),
      placeholder: RoutingFormRepository.toString(value.placeholder) || undefined,
      defaultValue: RoutingFormRepository.toString(value.defaultValue) || undefined,
      description: RoutingFormRepository.toString(value.description) || undefined,
      validation: RoutingFormRepository.parseFieldValidation(value.validation),
    };
  }

  private static parseAction(raw: unknown, index: number): RoutingAction {
    if (!raw || typeof raw !== "object") {
      return {
        id: `action-${index}`,
        actorType: "User",
        actorId: undefined,
        userId: undefined,
        eventTypeIds: undefined,
        position: index,
        selected: false,
      };
    }

    const value = raw as Record<string, unknown>;
    const actorType = value.actorType === "Team" ? "Team" : "User";

    return {
      id: RoutingFormRepository.toOptionalId(value.id, `action-${index}`),
      actorType,
      actorId: RoutingFormRepository.toNumber(value.actorId),
      userId: RoutingFormRepository.toNumber(value.userId),
      eventTypeIds: RoutingFormRepository.toNumberArray(value.eventTypeIds),
      position: RoutingFormRepository.toNumber(value.position) ?? index,
      selected: RoutingFormRepository.toBoolean(value.selected),
    };
  }

  private static parseRule(raw: unknown, index: number): RoutingRule {
    if (!raw || typeof raw !== "object") {
      return {
        id: `rule-${index}`,
        fieldId: "",
        operator: "equals",
        value: "",
      };
    }

    const value = raw as Record<string, unknown>;

    return {
      id: RoutingFormRepository.toOptionalId(value.id, `rule-${index}`),
      fieldId: RoutingFormRepository.toString(value.fieldId),
      operator: RoutingFormRepository.toRoutingRuleOperator(value.operator),
      value: RoutingFormRepository.toString(value.value),
    };
  }

  private static parseRoutes(raw: unknown): { actions: RoutingAction[]; rules: RoutingRule[] } {
    if (!raw || typeof raw !== "object") {
      return {
        actions: [],
        rules: [],
      };
    }

    const value = raw as StoredRoutes;

    const actions = RoutingFormRepository.toArray(value.actions).map((action, index) =>
      RoutingFormRepository.parseAction(action, index)
    );
    const rules = RoutingFormRepository.toArray(value.rules).map((rule, index) =>
      RoutingFormRepository.parseRule(rule, index)
    );

    return {
      actions,
      rules,
    };
  }

  private static normalizeActions(actions: RoutingAction[]): RoutingAction[] {
    return actions.map((action, index) => ({
      ...action,
      id: action.id || `action-${index}`,
      actorType: action.actorType,
      actorId: action.actorId,
      userId: action.userId,
      eventTypeIds: action.eventTypeIds,
      position: action.position ?? index,
      selected: action.selected ?? false,
    }));
  }

  private static normalizeRules(rules: RoutingRule[]): RoutingRule[] {
    return rules.map((rule, index) => ({
      ...rule,
      id: rule.id || `rule-${index}`,
      fieldId: rule.fieldId || `field-${index}`,
      operator: RoutingFormRepository.toRoutingRuleOperator(rule.operator),
      value: rule.value || "",
    }));
  }

  private static normalizeResponseValues(raw: unknown): Record<string, string> {
    let value = raw;

    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, itemValue]) => {
        if (typeof key === "string") {
          if (typeof itemValue === "string") {
            acc[key] = itemValue;
          } else if (itemValue !== undefined && itemValue !== null) {
            acc[key] = String(itemValue);
          } else {
            acc[key] = "";
          }
        }

        return acc;
      },
      {}
    );
  }

  private static parseUserId(formFillerId: string | null): number | undefined {
    if (!formFillerId) {
      return undefined;
    }

    const maybeNumber = Number(formFillerId);

    return Number.isNaN(maybeNumber) || !Number.isFinite(maybeNumber) ? undefined : maybeNumber;
  }

  private static toRoutingForm(row: RoutingFormRow): RoutingForm {
    const { actions, rules } = RoutingFormRepository.parseRoutes(row.routes);

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      fields: RoutingFormRepository.toArray(row.fields).map((field, index) =>
        RoutingFormRepository.parseField(field, index)
      ),
      actions,
      rules,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private static toRoutingFormResponse(row: RoutingFormResponseRow): RoutingFormResponse {
    return {
      id: row.id,
      formId: row.formId,
      responses: RoutingFormRepository.normalizeResponseValues(row.response),
      formFillerId: row.formFillerId ?? undefined,
      userId: RoutingFormRepository.parseUserId(row.formFillerId),
      createdAt: row.createdAt,
    };
  }

  private static async getFormByIdAndUser(formId: string, userId: number): Promise<RoutingForm | null> {
    const rows = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormRow[]>(Prisma.sql`
        SELECT id, name, description, "fields", routes, "createdAt", "updatedAt"
        FROM "App_RoutingForms_Form"
        WHERE id = ${formId}
          AND (
            "userId" = ${userId}
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(COALESCE(routes -> 'actions', '[]'::jsonb)) AS action
              WHERE action ->> 'actorType' = 'User'
                AND CASE
                  WHEN (action ->> 'userId') ~ '^-?\\d+$'
                    THEN (action ->> 'userId')::int
                  ELSE NULL
                END = ${userId}
            )
          )
        LIMIT 1
      `)
    );

    const [row] = rows;

    if (!row) {
      return null;
    }

    return RoutingFormRepository.toRoutingForm(row);
  }

  private static async getFormByOwner(formId: string, userId: number): Promise<RoutingForm | null> {
    const rows = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormRow[]>(Prisma.sql`
        SELECT id, name, description, "fields", routes, "createdAt", "updatedAt"
        FROM "App_RoutingForms_Form"
        WHERE id = ${formId}
          AND "userId" = ${userId}
        LIMIT 1
      `)
    );

    const [row] = rows;

    if (!row) {
      return null;
    }

    return RoutingFormRepository.toRoutingForm(row);
  }

  static async listByUser(userId: number, limit?: number): Promise<RoutingForm[]> {
    const rows = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormRow[]>(Prisma.sql`
        SELECT id, name, description, "fields", routes, "createdAt", "updatedAt"
        FROM "App_RoutingForms_Form"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT ${limit ?? 50}
      `)
    );

    return rows.map((row) => RoutingFormRepository.toRoutingForm(row));
  }

  static async getById(id: string, userId: number): Promise<RoutingForm | null> {
    return RoutingFormRepository.getFormByIdAndUser(id, userId);
  }

  static async create(userId: number, data: RoutingFormSaveInput): Promise<RoutingForm> {
    const payload = {
      actions: RoutingFormRepository.normalizeActions(data.actions),
      rules: RoutingFormRepository.normalizeRules(data.rules ?? []),
    };

    const created = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormRow[]>(Prisma.sql`
        INSERT INTO "App_RoutingForms_Form" (name, description, "userId", fields, routes)
        VALUES (${data.name}, ${data.description ?? null}, ${userId}, ${data.fields}, ${payload})
        RETURNING id, name, description, "fields", routes, "createdAt", "updatedAt"
      `)
    );

    const [row] = created;

    if (!row) {
      throw new Error("Failed to create routing form");
    }

    return RoutingFormRepository.toRoutingForm(row);
  }

  static async update(id: string, userId: number, data: RoutingFormUpdateInput): Promise<RoutingForm> {
    const currentForm = await RoutingFormRepository.getFormByOwner(id, userId);

    if (!currentForm) {
      throw new Error(`Routing form ${id} not found`);
    }

    const fields = data.fields
      ? data.fields.map((field, index) => RoutingFormRepository.parseField(field, index))
      : currentForm.fields;
    const actions = data.actions ? RoutingFormRepository.normalizeActions(data.actions) : currentForm.actions;
    const rules = data.rules ? RoutingFormRepository.normalizeRules(data.rules) : currentForm.rules;

    const payload = {
      actions,
      rules,
    };

    const updated = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormRow[]>(Prisma.sql`
        UPDATE "App_RoutingForms_Form"
        SET name = ${data.name ?? currentForm.name},
            description = ${data.description ?? currentForm.description ?? null},
            fields = ${fields},
            routes = ${payload}
        WHERE id = ${id}
          AND "userId" = ${userId}
        RETURNING id, name, description, "fields", routes, "createdAt", "updatedAt"
      `)
    );

    const [row] = updated;

    if (!row) {
      throw new Error(`Routing form ${id} not found`);
    }

    return RoutingFormRepository.toRoutingForm(row);
  }

  static async delete(id: string, userId: number): Promise<void> {
    const deletedCount = await RoutingFormRepository.executeQuery(
      () =>
        prisma.$executeRaw`
        DELETE FROM "App_RoutingForms_Form"
        WHERE id = ${id}
          AND "userId" = ${userId}
      `
    );

    if (deletedCount === 0) {
      throw new Error(`Routing form ${id} not found`);
    }
  }

  static async saveResponse(
    formId: string,
    responses: Record<string, string>,
    userId: number
  ): Promise<RoutingFormResponse> {
    // formFillerId must be unique per (formId, formFillerId). Using userId.toString()
    // would block a user from submitting the same form twice. Use a per-submission UUID
    // and persist the userId separately via response payload if attribution is needed.
    const formFillerId = crypto.randomUUID();
    const [inserted] = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormResponseRow[]>(Prisma.sql`
        INSERT INTO "App_RoutingForms_FormResponse" ("formId", response, "formFillerId")
        VALUES (${formId}, ${responses}, ${formFillerId})
        RETURNING id, "formId", response, "formFillerId", "createdAt", "updatedAt"
      `)
    );

    if (!inserted) {
      throw new Error("Failed to save routing form response");
    }

    return RoutingFormRepository.toRoutingFormResponse(inserted);
  }

  static async getResponses(formId: string, userId: number): Promise<RoutingFormResponse[]> {
    const rows = await RoutingFormRepository.executeQuery(() =>
      prisma.$queryRaw<RoutingFormResponseRow[]>(Prisma.sql`
        SELECT r.id, r."formId", r.response, r."formFillerId", r."createdAt", r."updatedAt"
        FROM "App_RoutingForms_FormResponse" r
        INNER JOIN "App_RoutingForms_Form" f
          ON f.id = r."formId"
        WHERE r."formId" = ${formId}
          AND f."userId" = ${userId}
        ORDER BY r."createdAt" DESC
      `)
    );

    return rows.map((row) => RoutingFormRepository.toRoutingFormResponse(row));
  }
}
