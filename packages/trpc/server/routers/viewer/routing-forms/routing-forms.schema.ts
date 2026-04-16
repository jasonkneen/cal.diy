import type {
  RoutingAction,
  RoutingField,
  RoutingForm,
  RoutingFormResponse,
  RoutingFormSaveInput,
  RoutingRule,
} from "@calcom/features/routing-forms/lib/types";
import { z } from "zod";

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
const RoutingFormFieldSchema = z
  .object({
    id: z.string().min(1),
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
  })
  .transform(
    (field): RoutingField => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options,
      placeholder: field.placeholder,
      defaultValue: field.defaultValue,
      description: field.description,
      validation: field.validation,
    })
  );

/* Routing action schema */
const RoutingActionSchema = z
  .object({
    id: z.string(),
    actorType: z.enum(["User", "Team"]),
    actorId: z.number().nullable().optional(),
    userId: z.number().nullable().optional(),
    eventTypeIds: z.array(z.number()).nullable().optional(),
    position: z.number(),
    selected: z.boolean(),
  })
  .transform(
    (action): RoutingAction => ({
      id: action.id,
      actorType: action.actorType,
      actorId: action.actorId === null ? undefined : action.actorId,
      userId: action.userId === null ? undefined : action.userId,
      eventTypeIds:
        action.eventTypeIds === null || action.eventTypeIds === undefined ? undefined : action.eventTypeIds,
      position: action.position,
      selected: action.selected,
    })
  );

/* Routing rule schema */
const RoutingRuleSchema = z
  .object({
    id: z.string(),
    fieldId: z.string(),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "starts_with",
      "ends_with",
      "regex",
    ]),
    value: z.string(),
  })
  .transform(
    (rule): RoutingRule => ({
      id: rule.id,
      fieldId: rule.fieldId,
      operator: rule.operator,
      value: rule.value,
    })
  );

/* Routing form input schema (for create) */
export const RoutingFormInputSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    fields: RoutingFormFieldSchema.array().min(1),
    actions: RoutingActionSchema.array(),
    rules: RoutingRuleSchema.array().optional(),
  })
  .transform(
    (form): RoutingFormSaveInput => ({
      name: form.name,
      description: form.description,
      fields: form.fields,
      actions: form.actions,
      rules: form.rules,
    })
  );

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
export const RoutingFormQuerySchema = z
  .object({
    limit: z.number().min(1).max(100).default(50),
  })
  .default({ limit: 50 });

export const RoutingFormUpdateWithIdSchema = RoutingFormIdSchema.merge(RoutingFormUpdateSchema);

export type TRoutingForm = RoutingForm;
export type TRoutingFormInput = z.infer<typeof RoutingFormInputSchema>;
export type TRoutingFormUpdateInput = z.infer<typeof RoutingFormUpdateSchema>;
export type TRoutingFormUpdateWithIdInput = z.infer<typeof RoutingFormUpdateWithIdSchema>;
export type TGetInput = z.infer<typeof RoutingFormIdSchema>;
export type TListInput = z.infer<typeof RoutingFormQuerySchema>;
export type TListOutput = { items: RoutingForm[] };
export type TResponseInput = z.infer<typeof RoutingFormResponseInputSchema>;
export type TGetResponseOutput = { items: RoutingFormResponse[] };
