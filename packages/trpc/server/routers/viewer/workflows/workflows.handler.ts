import prisma from "@calcom/prisma";
import {
  type TimeUnit,
  type WorkflowActions,
  WorkflowTemplates,
  type WorkflowTriggerEvents,
} from "@calcom/prisma/client";
import { TRPCError } from "@trpc/server";
import type { TrpcSessionUser } from "../../../types";
import type {
  TActivateInput,
  TCreateInput,
  TDeactivateInput,
  TDeleteInput,
  TGetInput,
  TListInput,
  TTestInput,
  TUpdateInput,
} from "./workflows.schema";

type AuthenticatedTrpcSessionUser = NonNullable<TrpcSessionUser>;

type AuthenticatedContext = {
  user: AuthenticatedTrpcSessionUser;
};

// ─── Helpers ─────────────────────────────────────────────────────────

async function assertWorkflowOwnership(userId: number, workflowId: number) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, userId: true, teamId: true },
  });

  if (!workflow) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
  }

  // Direct ownership
  if (workflow.userId === userId) {
    return workflow;
  }

  // Team ownership - check membership
  if (workflow.teamId) {
    const membership = await prisma.membership.findFirst({
      where: { userId, teamId: workflow.teamId, accepted: true },
    });
    if (membership) {
      return workflow;
    }
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this workflow" });
}

// ─── Handlers ────────────────────────────────────────────────────────

/** List all workflows for the current user (and optionally filter by team) */
export async function listHandler({ ctx, input }: { ctx: AuthenticatedContext; input?: TListInput }) {
  const where: Record<string, unknown> = {};

  if (input?.teamId) {
    // Filter by team - check user is a member
    const membership = await prisma.membership.findFirst({
      where: { userId: ctx.user.id, teamId: input.teamId, accepted: true },
    });
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this team" });
    }
    where.teamId = input.teamId;
  } else {
    // All workflows the user owns or belongs to via team
    const teamIds = await prisma.membership.findMany({
      where: { userId: ctx.user.id, accepted: true },
      select: { teamId: true },
    });

    where.OR = [{ userId: ctx.user.id }, { teamId: { in: teamIds.map((t) => t.teamId) } }];
  }

  const workflows = await prisma.workflow.findMany({
    where,
    select: {
      id: true,
      name: true,
      trigger: true,
      time: true,
      timeUnit: true,
      isActiveOnAll: true,
      teamId: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          steps: true,
          activeOn: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return workflows.map((w) => ({
    id: w.id,
    name: w.name,
    trigger: w.trigger,
    time: w.time,
    timeUnit: w.timeUnit,
    isActiveOnAll: w.isActiveOnAll,
    teamId: w.teamId,
    userId: w.userId,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    stepCount: w._count.steps,
    activeOnCount: w._count.activeOn,
  }));
}

/** Get a single workflow with full steps and active event types */
export async function getHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TGetInput }) {
  await assertWorkflowOwnership(ctx.user.id, input.workflowId);

  const workflow = await prisma.workflow.findUnique({
    where: { id: input.workflowId },
    select: {
      id: true,
      name: true,
      trigger: true,
      time: true,
      timeUnit: true,
      isActiveOnAll: true,
      teamId: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      steps: {
        select: {
          id: true,
          stepNumber: true,
          action: true,
          sendTo: true,
          reminderBody: true,
          emailSubject: true,
          template: true,
          sender: true,
          includeCalendarEvent: true,
        },
        orderBy: { stepNumber: "asc" },
      },
      activeOn: {
        select: {
          id: true,
          eventTypeId: true,
          eventType: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!workflow) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
  }

  return workflow;
}

/** Create a new workflow with nested steps */
export async function createHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TCreateInput }) {
  // If team workflow, verify membership
  if (input.teamId) {
    const membership = await prisma.membership.findFirst({
      where: { userId: ctx.user.id, teamId: input.teamId, accepted: true },
    });
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this team" });
    }
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: input.name,
      trigger: input.trigger as WorkflowTriggerEvents,
      time: input.time ?? null,
      timeUnit: input.timeUnit ? (input.timeUnit as TimeUnit) : null,
      userId: input.teamId ? null : ctx.user.id,
      teamId: input.teamId ?? null,
      isActiveOnAll: input.isActiveOnAll ?? false,
      steps: {
        create: input.steps.map((step) => ({
          stepNumber: step.stepNumber,
          action: step.action as WorkflowActions,
          sendTo: step.sendTo ?? null,
          reminderBody: step.reminderBody ?? null,
          emailSubject: step.emailSubject ?? null,
          template: (step.template as WorkflowTemplates) ?? WorkflowTemplates.CUSTOM,
          sender: step.sender ?? null,
          includeCalendarEvent: step.includeCalendarEvent ?? false,
        })),
      },
      ...(input.activeOnEventTypeIds && input.activeOnEventTypeIds.length > 0
        ? {
            activeOn: {
              create: input.activeOnEventTypeIds.map((eventTypeId) => ({
                eventTypeId,
              })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      trigger: true,
      steps: {
        select: {
          id: true,
          stepNumber: true,
          action: true,
        },
      },
    },
  });

  return workflow;
}

/** Update a workflow - replaces steps entirely */
export async function updateHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TUpdateInput }) {
  await assertWorkflowOwnership(ctx.user.id, input.workflowId);

  // Delete old steps (cascade will handle reminders)
  await prisma.workflowStep.deleteMany({
    where: { workflowId: input.workflowId },
  });

  // Delete old event type links
  await prisma.workflowsOnEventTypes.deleteMany({
    where: { workflowId: input.workflowId },
  });

  const workflow = await prisma.workflow.update({
    where: { id: input.workflowId },
    data: {
      name: input.name,
      trigger: input.trigger as WorkflowTriggerEvents,
      time: input.time ?? null,
      timeUnit: input.timeUnit ? (input.timeUnit as TimeUnit) : null,
      isActiveOnAll: input.isActiveOnAll ?? false,
      steps: {
        create: input.steps.map((step) => ({
          stepNumber: step.stepNumber,
          action: step.action as WorkflowActions,
          sendTo: step.sendTo ?? null,
          reminderBody: step.reminderBody ?? null,
          emailSubject: step.emailSubject ?? null,
          template: (step.template as WorkflowTemplates) ?? WorkflowTemplates.CUSTOM,
          sender: step.sender ?? null,
          includeCalendarEvent: step.includeCalendarEvent ?? false,
        })),
      },
      ...(input.activeOnEventTypeIds && input.activeOnEventTypeIds.length > 0
        ? {
            activeOn: {
              create: input.activeOnEventTypeIds.map((eventTypeId) => ({
                eventTypeId,
              })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      trigger: true,
      steps: {
        select: {
          id: true,
          stepNumber: true,
          action: true,
        },
      },
    },
  });

  return workflow;
}

/** Delete a workflow (check ownership) */
export async function deleteHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TDeleteInput }) {
  await assertWorkflowOwnership(ctx.user.id, input.workflowId);

  // Cascade delete will handle steps, reminders, and event type links
  await prisma.workflow.delete({
    where: { id: input.workflowId },
  });

  return { success: true };
}

/** Activate (link) a workflow on an event type */
export async function activateHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TActivateInput }) {
  await assertWorkflowOwnership(ctx.user.id, input.workflowId);

  // Check event type exists and belongs to user or their team
  const eventType = await prisma.eventType.findUnique({
    where: { id: input.eventTypeId },
    select: { id: true, userId: true, teamId: true },
  });

  if (!eventType) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event type not found" });
  }

  // Check if already linked
  const existing = await prisma.workflowsOnEventTypes.findFirst({
    where: {
      workflowId: input.workflowId,
      eventTypeId: input.eventTypeId,
    },
  });

  if (existing) {
    return { success: true, message: "Already active" };
  }

  await prisma.workflowsOnEventTypes.create({
    data: {
      workflowId: input.workflowId,
      eventTypeId: input.eventTypeId,
    },
  });

  return { success: true };
}

/** Deactivate (unlink) a workflow from an event type */
export async function deactivateHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input: TDeactivateInput;
}) {
  await assertWorkflowOwnership(ctx.user.id, input.workflowId);

  await prisma.workflowsOnEventTypes.deleteMany({
    where: {
      workflowId: input.workflowId,
      eventTypeId: input.eventTypeId,
    },
  });

  return { success: true };
}

/** Send a test notification for a workflow step */
export async function testHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TTestInput }) {
  await assertWorkflowOwnership(ctx.user.id, input.workflowId);

  const step = await prisma.workflowStep.findFirst({
    where: {
      workflowId: input.workflowId,
      stepNumber: input.stepNumber,
    },
    select: {
      id: true,
      action: true,
      sendTo: true,
      reminderBody: true,
      emailSubject: true,
      template: true,
      sender: true,
    },
  });

  if (!step) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workflow step not found" });
  }

  // For now, return success with a message indicating what would be sent.
  // In production this would integrate with email/SMS providers.
  const actionType = step.action.startsWith("EMAIL")
    ? "email"
    : step.action.startsWith("SMS")
      ? "SMS"
      : "WhatsApp";

  return {
    success: true,
    message: `Test ${actionType} would be sent${step.sendTo ? ` to ${step.sendTo}` : " to the attendee"} with subject "${step.emailSubject || "(no subject)"}"`,
  };
}
