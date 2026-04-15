import type { WorkflowTriggerEvents, WorkflowActions, WorkflowMethods } from "@calcom/prisma/enums";

import { getTasker } from "@calcom/features/tasker/tasker-factory";
import logger from "@calcom/lib/logger";
import { serverConfig } from "@calcom/lib/serverConfig";
import prisma from "@calcom/prisma";

import { isTimeBased } from "./constants";
import { WorkflowRepository } from "../repositories/WorkflowRepository";

// ─── Types ─────────────────────────────────────────────────────────────

interface BookingData {
  uid: string;
  eventTypeId: number;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{
    email: string;
    name: string;
    timeZone: string;
  }>;
  organizer: {
    email: string;
    name: string;
    timeZone: string;
  };
  additionalNotes?: string;
}

interface EvaluateWorkflowsParams {
  trigger: WorkflowTriggerEvents;
  booking: BookingData;
}

interface WorkflowStepData {
  id: number;
  stepNumber: number;
  action: WorkflowActions;
  sendTo: string | null;
  reminderBody: string | null;
  emailSubject: string | null;
  template: string;
  sender: string | null;
  includeCalendarEvent: boolean;
  numberRequired: boolean | null;
  numberVerificationPending: boolean;
  workflowId: number;
}

interface WorkflowData {
  id: number;
  name: string;
  trigger: WorkflowTriggerEvents;
  time: number | null;
  timeUnit: string | null;
  steps: WorkflowStepData[];
}

const log = logger.getSubLogger({ prefix: ["workflow-engine"] });

// ─── Template Variable Replacement ────────────────────────────────────

function replaceTemplateVariables(template: string, booking: BookingData): string {
  const attendee = booking.attendees[0];
  const replacements: Record<string, string> = {
    "{eventName}": booking.title,
    "{attendeeName}": attendee?.name ?? "",
    "{attendeeEmail}": attendee?.email ?? "",
    "{organizerName}": booking.organizer.name,
    "{organizerEmail}": booking.organizer.email,
    "{eventDate}": booking.startTime.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    "{eventTime}": booking.startTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    "{eventEndTime}": booking.endTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    "{timezone}": attendee?.timeZone ?? booking.organizer.timeZone,
    "{additionalNotes}": booking.additionalNotes ?? "",
    "{name}": attendee?.name ?? booking.organizer.name,
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }
  return result;
}

// ─── Action Helpers ────────────────────────────────────────────────────

function getMethodForAction(action: WorkflowActions): WorkflowMethods {
  switch (action) {
    case "EMAIL_HOST":
    case "EMAIL_ATTENDEE":
    case "EMAIL_ADDRESS":
      return "EMAIL";
    case "SMS_ATTENDEE":
    case "SMS_NUMBER":
    case "WHATSAPP_ATTENDEE":
    case "WHATSAPP_NUMBER":
      return "SMS";
    default:
      return "EMAIL";
  }
}

function getRecipientEmail(step: WorkflowStepData, booking: BookingData): string | null {
  switch (step.action) {
    case "EMAIL_HOST":
      return booking.organizer.email;
    case "EMAIL_ATTENDEE":
      return booking.attendees[0]?.email ?? null;
    case "EMAIL_ADDRESS":
      return step.sendTo;
    default:
      return null;
  }
}

function isEmailAction(action: WorkflowActions): boolean {
  return action === "EMAIL_HOST" || action === "EMAIL_ATTENDEE" || action === "EMAIL_ADDRESS";
}

// ─── Time Calculation ──────────────────────────────────────────────────

function calculateScheduledDate(
  trigger: WorkflowTriggerEvents,
  booking: BookingData,
  time: number | null,
  timeUnit: string | null
): Date | null {
  if (!isTimeBased(trigger) || time === null || timeUnit === null) {
    return null;
  }

  const referenceDate = trigger === "BEFORE_EVENT" ? booking.startTime : booking.endTime;
  const multiplierMs = getTimeUnitMs(timeUnit);
  const offsetMs = time * multiplierMs;

  if (trigger === "BEFORE_EVENT") {
    return new Date(referenceDate.getTime() - offsetMs);
  }
  return new Date(referenceDate.getTime() + offsetMs);
}

function getTimeUnitMs(timeUnit: string): number {
  switch (timeUnit) {
    case "DAY":
      return 24 * 60 * 60 * 1000;
    case "HOUR":
      return 60 * 60 * 1000;
    case "MINUTE":
      return 60 * 1000;
    default:
      return 60 * 1000;
  }
}

// ─── Email Sending ─────────────────────────────────────────────────────

async function sendWorkflowEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): Promise<void> {
  const { createTransport } = await import("nodemailer");
  const transport = createTransport(serverConfig.transport);

  await transport.sendMail({
    from: params.from ?? serverConfig.from,
    to: params.to,
    subject: params.subject,
    html: params.body.replace(/\n/g, "<br>"),
    headers: serverConfig.headers,
  });
}

// ─── Step Execution ────────────────────────────────────────────────────

async function executeStep(step: WorkflowStepData, booking: BookingData): Promise<void> {
  const subject = step.emailSubject
    ? replaceTemplateVariables(step.emailSubject, booking)
    : `Workflow notification: ${booking.title}`;
  const body = step.reminderBody
    ? replaceTemplateVariables(step.reminderBody, booking)
    : "";

  if (isEmailAction(step.action)) {
    const to = getRecipientEmail(step, booking);
    if (!to) {
      log.warn("No recipient email for workflow step", { stepId: step.id, action: step.action });
      return;
    }

    await sendWorkflowEmail({
      to,
      subject,
      body,
      from: step.sender ?? undefined,
    });

    log.info("Sent workflow email", { stepId: step.id, to });
  } else {
    // SMS/WhatsApp: use the Tasker to dispatch
    const tasker = getTasker();
    const smsPayload = JSON.stringify({
      to: step.sendTo ?? booking.attendees[0]?.email,
      body,
      action: step.action,
    });
    await tasker.create("sendSms", smsPayload);
    log.info("Dispatched workflow SMS/WhatsApp", { stepId: step.id, action: step.action });
  }
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Evaluate all active workflows for a booking event.
 * Finds matching workflows, evaluates each step, and either executes immediately
 * or schedules future actions depending on the trigger type.
 */
export async function evaluateWorkflows(params: EvaluateWorkflowsParams): Promise<void> {
  const { trigger, booking } = params;

  const workflows = await WorkflowRepository.getActiveForEventType(booking.eventTypeId, trigger);

  if (workflows.length === 0) {
    log.debug("No active workflows for event type", {
      eventTypeId: booking.eventTypeId,
      trigger,
    });
    return;
  }

  log.info("Evaluating workflows", {
    count: workflows.length,
    trigger,
    bookingUid: booking.uid,
  });

  for (const workflow of workflows) {
    try {
      if (isTimeBased(trigger)) {
        // Schedule future actions for BEFORE_EVENT / AFTER_EVENT
        const scheduledDate = calculateScheduledDate(
          workflow.trigger,
          booking,
          workflow.time,
          workflow.timeUnit
        );

        if (!scheduledDate) {
          log.warn("Could not calculate scheduled date for time-based workflow", {
            workflowId: workflow.id,
          });
          continue;
        }

        // If the scheduled date is in the past, execute immediately
        if (scheduledDate.getTime() <= Date.now()) {
          for (const step of workflow.steps) {
            await executeStep(step, booking);
          }
        } else {
          for (const step of workflow.steps) {
            await scheduleWorkflowReminder(step, booking, scheduledDate);
          }
        }
      } else {
        // Execute immediately for NEW_EVENT, EVENT_CANCELLED, RESCHEDULE_EVENT
        for (const step of workflow.steps) {
          await executeStep(step, booking);
        }
      }
    } catch (error) {
      log.error("Error evaluating workflow", {
        workflowId: workflow.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Schedule a workflow reminder for a future date.
 * Creates a WorkflowReminder record and schedules via the Tasker.
 */
export async function scheduleWorkflowReminder(
  step: WorkflowStepData,
  booking: BookingData,
  scheduledDate: Date
): Promise<void> {
  const method = getMethodForAction(step.action);
  const referenceId = `workflow-${step.workflowId}-step-${step.id}-booking-${booking.uid}`;

  // Create the WorkflowReminder record
  const reminder = await prisma.workflowReminder.create({
    data: {
      bookingUid: booking.uid,
      method,
      workflowStepId: step.id,
      referenceId,
      scheduledDate,
      scheduled: true,
      cancelled: false,
    },
    select: {
      id: true,
      referenceId: true,
    },
  });

  // Build the task payload
  const payload = JSON.stringify({
    reminderId: reminder.id,
    stepId: step.id,
    bookingUid: booking.uid,
    action: step.action,
    sendTo: step.sendTo,
    emailSubject: step.emailSubject,
    reminderBody: step.reminderBody,
    sender: step.sender,
    booking: {
      uid: booking.uid,
      title: booking.title,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      attendees: booking.attendees,
      organizer: booking.organizer,
      additionalNotes: booking.additionalNotes,
    },
  });

  // Schedule the task via Tasker
  const tasker = getTasker();

  if (isEmailAction(step.action)) {
    // Use sendWebhook as a generic task type for scheduled email delivery
    // (the actual email sending logic runs when the task is consumed)
    await tasker.create("sendWebhook", payload, {
      scheduledAt: scheduledDate,
      referenceUid: referenceId,
    });
  } else {
    await tasker.create("sendSms", payload, {
      scheduledAt: scheduledDate,
      referenceUid: referenceId,
    });
  }

  log.info("Scheduled workflow reminder", {
    reminderId: reminder.id,
    stepId: step.id,
    scheduledDate: scheduledDate.toISOString(),
    action: step.action,
  });
}

/**
 * Cancel all pending workflow reminders for a booking.
 * Used when a booking is cancelled or rescheduled.
 */
export async function cancelWorkflowReminders(bookingUid: string): Promise<void> {
  // Find all pending (non-cancelled) reminders for this booking
  const reminders = await prisma.workflowReminder.findMany({
    where: {
      bookingUid,
      cancelled: false,
      scheduled: true,
    },
    select: {
      id: true,
      referenceId: true,
      method: true,
    },
  });

  if (reminders.length === 0) {
    return;
  }

  const tasker = getTasker();

  for (const reminder of reminders) {
    try {
      // Cancel the scheduled task in the Tasker
      if (reminder.referenceId) {
        const taskType = reminder.method === "EMAIL" ? "sendWebhook" : "sendSms";
        await tasker.cancelWithReference(reminder.referenceId, taskType);
      }
    } catch (error) {
      log.warn("Failed to cancel tasker task for reminder", {
        reminderId: reminder.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Mark all reminders as cancelled in the database
  await prisma.workflowReminder.updateMany({
    where: {
      bookingUid,
      cancelled: false,
      scheduled: true,
    },
    data: {
      cancelled: true,
    },
  });

  log.info("Cancelled workflow reminders", {
    bookingUid,
    count: reminders.length,
  });
}
