import { z } from "zod";
import type { RoutingField, RoutingAction, RoutingRule } from "@calcom/features/routing-forms/lib/types";
import { RoutingFormFieldType } from "@calcom/features/routing-forms/lib/types";

/* Routing field types */
export const RoutingFormFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "select",
  "multiSelect",
  "phone",
  "email",
  "number",
  "date",
  "radio",
  "checkbox",
  "hidden",
]);

/* Routing field schema */
const RoutingFormFieldSchema: z.ZodType<RoutingField> = z.object({
  id: z.string(),
  label: z.string().min(1),
  type: RoutingFormFieldTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
});

/* Routing action schema */
const RoutingActionSchema: z.ZodType<RoutingAction> = z.object({
  id: z.string(),
  actorType: z.enum(["User", "Team"]),
  actorId: z.number().nullable().optional(),
  userId: z.number().nullable().optional(),
  eventTypeIds: z.array(z.number()).nullable().optional(),
  position: z.number(),
  selected: z.boolean(),
});

/* Routing rule schema */
const RoutingRuleSchema: z.ZodType<RoutingRule> = z.object({
  id: z.string(),
  fieldId: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "regex"]),
  value: z.string(),
});

/* Routing form input schema (for create) */
export const RoutingFormInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  fields: RoutingFormFieldSchema.array().min(1),
  actions: RoutingActionSchema.array(),
  rules: RoutingRuleSchema.array().optional(),
});

/* Routing form update schema (for update) */
export const RoutingFormUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  fields: RoutingFormFieldSchema.array().min(1).optional(),
  actions: RoutingActionSchema.array().optional(),
  rules: RoutingRuleSchema.array().optional(),
});

/* Routing form response input schema */
export const RoutingFormResponseInputSchema = z.object({
  formId: z.string(),
  responses: z.record(z.string()),
});

/* Routing form ID schema */
export const RoutingFormIdSchema = z.object({
  id: z.string(),
});

/* Routing form query schema (for list) */
export const RoutingFormQuerySchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
});