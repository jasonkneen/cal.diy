import type {
  WorkflowActions,
  WorkflowTemplates,
  WorkflowTriggerEvents,
  TimeUnit,
} from "@calcom/prisma/enums";

// ─── Trigger Event Labels ──────────────────────────────────────────────

export const WORKFLOW_TRIGGER_EVENTS_LABELS: Record<WorkflowTriggerEvents, string> = {
  BEFORE_EVENT: "Before Event",
  AFTER_EVENT: "After Event",
  NEW_EVENT: "New Event",
  EVENT_CANCELLED: "Event Cancelled",
  RESCHEDULE_EVENT: "Event Rescheduled",
};

// ─── Action Labels ─────────────────────────────────────────────────────

export const WORKFLOW_ACTION_LABELS: Record<WorkflowActions, string> = {
  EMAIL_HOST: "Email Host",
  EMAIL_ATTENDEE: "Email Attendee",
  EMAIL_ADDRESS: "Email Address",
  SMS_ATTENDEE: "SMS Attendee",
  SMS_NUMBER: "SMS Number",
  WHATSAPP_ATTENDEE: "WhatsApp Attendee",
  WHATSAPP_NUMBER: "WhatsApp Number",
};

// ─── Default Templates ─────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Record<WorkflowTemplates, { subject: string; body: string }> = {
  REMINDER: {
    subject: "Reminder: {eventName} with {attendeeName}",
    body: "Hi {name},\n\nThis is a reminder that you have {eventName} on {eventDate} at {eventTime} ({timezone}).\n\n{additionalNotes}",
  },
  CUSTOM: {
    subject: "",
    body: "",
  },
  CANCELLED: {
    subject: "Cancelled: {eventName} with {attendeeName}",
    body: "Hi {name},\n\nYour event {eventName} on {eventDate} at {eventTime} ({timezone}) has been cancelled.\n\n{additionalNotes}",
  },
  RESCHEDULED: {
    subject: "Rescheduled: {eventName} with {attendeeName}",
    body: "Hi {name},\n\nYour event {eventName} has been rescheduled to {eventDate} at {eventTime} ({timezone}).\n\n{additionalNotes}",
  },
  COMPLETED: {
    subject: "Completed: {eventName} with {attendeeName}",
    body: "Hi {name},\n\nYour event {eventName} on {eventDate} at {eventTime} ({timezone}) has been completed. Thank you!\n\n{additionalNotes}",
  },
};

// ─── Time Unit Labels ──────────────────────────────────────────────────

export const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  DAY: "Days",
  HOUR: "Hours",
  MINUTE: "Minutes",
};

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the given trigger is time-based (BEFORE_EVENT or AFTER_EVENT).
 * Time-based triggers require a `time` and `timeUnit` to schedule actions in the future.
 */
export function isTimeBased(trigger: WorkflowTriggerEvents): boolean {
  return trigger === "BEFORE_EVENT" || trigger === "AFTER_EVENT";
}

/**
 * Maps a trigger event to the most appropriate default template key.
 */
function getTemplateKeyForTrigger(trigger: WorkflowTriggerEvents): WorkflowTemplates {
  switch (trigger) {
    case "BEFORE_EVENT":
      return "REMINDER";
    case "AFTER_EVENT":
      return "COMPLETED";
    case "EVENT_CANCELLED":
      return "CANCELLED";
    case "RESCHEDULE_EVENT":
      return "RESCHEDULED";
    case "NEW_EVENT":
      return "REMINDER";
    default:
      return "CUSTOM";
  }
}

/**
 * Returns the appropriate default template content for a given trigger and action.
 * For SMS/WhatsApp actions, only the body is relevant (no subject line).
 */
export function getDefaultTemplate(
  trigger: WorkflowTriggerEvents,
  _action: WorkflowActions
): { subject: string; body: string } {
  const key = getTemplateKeyForTrigger(trigger);
  return DEFAULT_TEMPLATES[key];
}
