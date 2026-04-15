import type { WorkflowTriggerEvents, WorkflowActions, WorkflowTemplates, TimeUnit } from "@calcom/prisma/enums";

import prisma from "@calcom/prisma";

// ─── Types ─────────────────────────────────────────────────────────────

interface CreateStepInput {
  stepNumber: number;
  action: WorkflowActions;
  sendTo?: string;
  reminderBody?: string;
  emailSubject?: string;
  template?: WorkflowTemplates;
  sender?: string;
  includeCalendarEvent?: boolean;
}

interface CreateWorkflowInput {
  name: string;
  trigger: WorkflowTriggerEvents;
  time?: number;
  timeUnit?: TimeUnit;
  isActiveOnAll?: boolean;
  steps: CreateStepInput[];
}

interface UpdateWorkflowInput {
  name?: string;
  trigger?: WorkflowTriggerEvents;
  time?: number | null;
  timeUnit?: TimeUnit | null;
  isActiveOnAll?: boolean;
  steps?: CreateStepInput[];
}

// ─── Select Clauses ────────────────────────────────────────────────────

const workflowStepSelect = {
  id: true,
  stepNumber: true,
  action: true,
  sendTo: true,
  reminderBody: true,
  emailSubject: true,
  template: true,
  sender: true,
  includeCalendarEvent: true,
  numberRequired: true,
  numberVerificationPending: true,
  workflowId: true,
} as const;

const workflowSelect = {
  id: true,
  name: true,
  userId: true,
  teamId: true,
  trigger: true,
  time: true,
  timeUnit: true,
  isActiveOnAll: true,
  createdAt: true,
  updatedAt: true,
} as const;

const workflowWithStepsSelect = {
  ...workflowSelect,
  steps: { select: workflowStepSelect },
} as const;

const workflowWithStepsAndActiveOnSelect = {
  ...workflowWithStepsSelect,
  activeOn: {
    select: {
      id: true,
      eventTypeId: true,
      workflowId: true,
      eventType: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  },
} as const;

// ─── Repository ────────────────────────────────────────────────────────

export const WorkflowRepository = {
  /**
   * Create a new workflow with nested steps.
   */
  async create(userId: number, data: CreateWorkflowInput) {
    return prisma.workflow.create({
      data: {
        name: data.name,
        userId,
        trigger: data.trigger,
        time: data.time,
        timeUnit: data.timeUnit,
        isActiveOnAll: data.isActiveOnAll ?? false,
        steps: {
          create: data.steps.map((step) => ({
            stepNumber: step.stepNumber,
            action: step.action,
            sendTo: step.sendTo,
            reminderBody: step.reminderBody,
            emailSubject: step.emailSubject,
            template: step.template ?? "CUSTOM",
            sender: step.sender,
            includeCalendarEvent: step.includeCalendarEvent ?? false,
          })),
        },
      },
      select: workflowWithStepsSelect,
    });
  },

  /**
   * Get a workflow by ID, scoped to the user.
   * Returns the workflow with its steps and active event types.
   */
  async getById(id: number, userId: number) {
    return prisma.workflow.findFirst({
      where: { id, userId },
      select: workflowWithStepsAndActiveOnSelect,
    });
  },

  /**
   * List all workflows belonging to a user.
   * Includes step count and active event type count for display purposes.
   */
  async listByUser(userId: number) {
    return prisma.workflow.findMany({
      where: { userId },
      select: {
        ...workflowSelect,
        _count: {
          select: {
            steps: true,
            activeOn: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * List all workflows belonging to a team.
   */
  async listByTeam(teamId: number) {
    return prisma.workflow.findMany({
      where: { teamId },
      select: {
        ...workflowSelect,
        _count: {
          select: {
            steps: true,
            activeOn: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Update a workflow and replace its steps.
   * Steps are deleted and recreated to simplify reordering.
   */
  async update(id: number, userId: number, data: UpdateWorkflowInput) {
    // Verify ownership first
    const existing = await prisma.workflow.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    // If steps are being replaced, delete existing ones first
    if (data.steps !== undefined) {
      await prisma.workflowStep.deleteMany({
        where: { workflowId: id },
      });
    }

    return prisma.workflow.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.time !== undefined && { time: data.time }),
        ...(data.timeUnit !== undefined && { timeUnit: data.timeUnit }),
        ...(data.isActiveOnAll !== undefined && { isActiveOnAll: data.isActiveOnAll }),
        ...(data.steps !== undefined && {
          steps: {
            create: data.steps.map((step) => ({
              stepNumber: step.stepNumber,
              action: step.action,
              sendTo: step.sendTo,
              reminderBody: step.reminderBody,
              emailSubject: step.emailSubject,
              template: step.template ?? "CUSTOM",
              sender: step.sender,
              includeCalendarEvent: step.includeCalendarEvent ?? false,
            })),
          },
        }),
      },
      select: workflowWithStepsSelect,
    });
  },

  /**
   * Delete a workflow, scoped to the user.
   */
  async delete(id: number, userId: number) {
    // Verify ownership first
    const existing = await prisma.workflow.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.workflow.delete({
      where: { id },
      select: { id: true },
    });
  },

  /**
   * Get all workflows active on a specific event type for a given trigger.
   * Used by the workflow engine to evaluate which workflows to run.
   */
  async getActiveForEventType(eventTypeId: number, trigger: WorkflowTriggerEvents) {
    // Get workflows explicitly linked to this event type
    const linkedWorkflows = await prisma.workflow.findMany({
      where: {
        trigger,
        activeOn: {
          some: { eventTypeId },
        },
      },
      select: workflowWithStepsSelect,
    });

    // Get workflows marked as active on all event types for the same user(s)
    const activeOnAllWorkflows = await prisma.workflow.findMany({
      where: {
        trigger,
        isActiveOnAll: true,
        // Only get workflows belonging to the event type's owner/team
        OR: [
          {
            userId: {
              not: null,
            },
            user: {
              eventTypes: {
                some: { id: eventTypeId },
              },
            },
          },
          {
            teamId: {
              not: null,
            },
            team: {
              eventTypes: {
                some: { id: eventTypeId },
              },
            },
          },
        ],
      },
      select: workflowWithStepsSelect,
    });

    // Deduplicate by workflow ID
    const seen = new Set<number>();
    const result = [];
    for (const workflow of [...linkedWorkflows, ...activeOnAllWorkflows]) {
      if (!seen.has(workflow.id)) {
        seen.add(workflow.id);
        result.push(workflow);
      }
    }
    return result;
  },

  /**
   * Activate a workflow for an event type (create the join record).
   */
  async activateForEventType(workflowId: number, eventTypeId: number) {
    return prisma.workflowsOnEventTypes.create({
      data: { workflowId, eventTypeId },
      select: {
        id: true,
        workflowId: true,
        eventTypeId: true,
      },
    });
  },

  /**
   * Deactivate a workflow for an event type (delete the join record).
   */
  async deactivateForEventType(workflowId: number, eventTypeId: number) {
    return prisma.workflowsOnEventTypes.delete({
      where: {
        workflowId_eventTypeId: { workflowId, eventTypeId },
      },
      select: {
        id: true,
        workflowId: true,
        eventTypeId: true,
      },
    });
  },
};
