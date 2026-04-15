import { z } from "zod";

// --- List workflows ---
export const ZListInputSchema = z
  .object({
    teamId: z.number().optional(),
  })
  .optional();
export type TListInput = z.infer<typeof ZListInputSchema>;

// --- Get workflow ---
export const ZGetInputSchema = z.object({
  workflowId: z.number(),
});
export type TGetInput = z.infer<typeof ZGetInputSchema>;

// --- Step schema (reusable) ---
const ZStepSchema = z.object({
  stepNumber: z.number(),
  action: z.enum([
    "EMAIL_HOST",
    "EMAIL_ATTENDEE",
    "SMS_ATTENDEE",
    "SMS_NUMBER",
    "EMAIL_ADDRESS",
    "WHATSAPP_ATTENDEE",
    "WHATSAPP_NUMBER",
  ]),
  sendTo: z.string().optional(),
  reminderBody: z.string().optional(),
  emailSubject: z.string().optional(),
  template: z.enum(["REMINDER", "CUSTOM", "CANCELLED", "RESCHEDULED", "COMPLETED"]).optional().default("CUSTOM"),
  sender: z.string().optional(),
  includeCalendarEvent: z.boolean().optional().default(false),
});

// --- Create workflow ---
export const ZCreateInputSchema = z.object({
  name: z.string().min(1).max(250),
  trigger: z.enum(["BEFORE_EVENT", "EVENT_CANCELLED", "NEW_EVENT", "AFTER_EVENT", "RESCHEDULE_EVENT"]),
  time: z.number().optional(),
  timeUnit: z.enum(["DAY", "HOUR", "MINUTE"]).optional(),
  teamId: z.number().optional(),
  isActiveOnAll: z.boolean().optional().default(false),
  steps: z.array(ZStepSchema).min(1),
  activeOnEventTypeIds: z.array(z.number()).optional(),
});
export type TCreateInput = z.infer<typeof ZCreateInputSchema>;

// --- Update workflow ---
export const ZUpdateInputSchema = z.object({
  workflowId: z.number(),
  name: z.string().min(1).max(250),
  trigger: z.enum(["BEFORE_EVENT", "EVENT_CANCELLED", "NEW_EVENT", "AFTER_EVENT", "RESCHEDULE_EVENT"]),
  time: z.number().optional(),
  timeUnit: z.enum(["DAY", "HOUR", "MINUTE"]).optional(),
  teamId: z.number().optional(),
  isActiveOnAll: z.boolean().optional().default(false),
  steps: z.array(ZStepSchema).min(1),
  activeOnEventTypeIds: z.array(z.number()).optional(),
});
export type TUpdateInput = z.infer<typeof ZUpdateInputSchema>;

// --- Delete workflow ---
export const ZDeleteInputSchema = z.object({
  workflowId: z.number(),
});
export type TDeleteInput = z.infer<typeof ZDeleteInputSchema>;

// --- Activate workflow on event type ---
export const ZActivateInputSchema = z.object({
  workflowId: z.number(),
  eventTypeId: z.number(),
});
export type TActivateInput = z.infer<typeof ZActivateInputSchema>;

// --- Deactivate workflow on event type ---
export const ZDeactivateInputSchema = z.object({
  workflowId: z.number(),
  eventTypeId: z.number(),
});
export type TDeactivateInput = z.infer<typeof ZDeactivateInputSchema>;

// --- Test workflow ---
export const ZTestInputSchema = z.object({
  workflowId: z.number(),
  stepNumber: z.number(),
});
export type TTestInput = z.infer<typeof ZTestInputSchema>;
