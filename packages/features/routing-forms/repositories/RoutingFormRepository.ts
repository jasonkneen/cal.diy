import type { Prisma } from "@calcom/prisma";
import prisma from "@calcom/prisma";
import { ZotActorType } from "@calcom/prisma/enums";
import type {
  RoutingAction,
  RoutingField,
  RoutingForm,
  RoutingFormResponse,
  RoutingFormSaveInput,
  RoutingFormUpdateInput,
  RoutingRule,
} from "../lib/types";

// Type-safe select clause for routing forms queries
const routingFormSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  fields: {
    select: {
      id: true,
      label: true,
      type: true,
      required: true,
      options: true,
      placeholder: true,
      defaultValue: true,
      description: true,
      validation: true,
      position: true,
    },
    orderBy: { position: "asc" as const },
  },
  actions: {
    select: {
      id: true,
      actorType: true,
      actorId: true,
      userId: true,
      eventTypeIds: true,
      position: true,
      selected: true,
    },
    orderBy: { position: "asc" as const },
  },
  rules: {
    select: {
      id: true,
      fieldId: true,
      operator: true,
      value: true,
    },
  },
} satisfies Prisma.App_RoutingForms_FormSelect;

/**
 * Repository for Routing Forms CRUD operations
 */
export class RoutingFormRepository {
  /**
   * Create a new routing form
   */
  static async create(userId: number, data: RoutingFormSaveInput): Promise<RoutingForm> {
    const form = await prisma.app_RoutingForms_Form.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        fields: {
          create: data.fields.map((field, index) => ({
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options,
            placeholder: field.placeholder,
            defaultValue: field.defaultValue,
            description: field.description,
            validation: field.validation,
            position: index,
          })),
        },
        actions: {
          create: data.actions.map((_) => ({
            actorType: _.actorType,
            actorId: _.actorId,
            userId: _.userId,
            eventTypeIds: _.eventTypeIds,
            position: _.position,
            selected: _.selected,
          })),
        },
        rules: data.rules
          ? {
              create: data.rules.map((_) => ({
                fieldId: _.fieldId,
                operator: _.operator,
                value: _.value,
              })),
            }
          : undefined,
      },
      select: routingFormSelect,
    });

    return this.transformToAppModel(form);
  }

  /**
   * Get routing form by ID with ownership check
   */
  static async getById(id: string, userId: number): Promise<RoutingForm | null> {
    const form = await prisma.app_RoutingForms_Form.findFirst({
      where: {
        id,
        OR: [{ userId }, { actions: { some: { actorType: ZotActorType.USER, userId } } }],
      },
      select: routingFormSelect,
    });

    return form ? this.transformToAppModel(form) : null;
  }

  /**
   * Get routing form by ID (no ownership check - for public use)
   */
  static async getPublicById(id: string): Promise<RoutingForm | null> {
    const form = await prisma.app_RoutingForms_Form.findUnique({
      where: { id },
      select: routingFormSelect,
    });

    return form ? this.transformToAppModel(form) : null;
  }

  /**
   * List all routing forms for a user
   */
  static async listByUser(userId: number): Promise<RoutingForm[]> {
    const forms = await prisma.app_RoutingForms_Form.findMany({
      where: { userId },
      select: routingFormSelect,
      orderBy: { createdAt: "desc" as const },
    });

    return forms.map((f) => this.transformToAppModel(f));
  }

  /**
   * Update routing form
   */
  static async update(id: string, userId: number, data: RoutingFormUpdateInput): Promise<RoutingForm> {
    // Build Prisma update data
    const updateData: Prisma.App_RoutingForms_FormUpdateInput = {
      name: data.name,
      description: data.description,
    };

    // Update fields if provided
    if (data.fields) {
      // Delete existing fields and recreate
      await prisma.app_RoutingForms_Field.deleteMany({ where: { formId: id } });

      updateData.fields = {
        create: data.fields.map((field, index) => ({
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options,
          placeholder: field.placeholder,
          defaultValue: field.defaultValue,
          description: field.description,
          validation: field.validation,
          position: index,
        })),
      };
    }

    // Update actions if provided
    if (data.actions) {
      await prisma.app_RoutingForms_Action.deleteMany({ where: { formId: id } });

      updateData.actions = {
        create: data.actions.map((_) => ({
          actorType: _.actorType,
          actorId: _.actorId,
          userId: _.userId,
          eventTypeIds: _.eventTypeIds,
          position: _.position,
          selected: _.selected,
        })),
      };
    }

    // Update rules if provided
    if (data.rules !== undefined) {
      await prisma.app_RoutingForms_Rule.deleteMany({ where: { formId: id } });

      if (data.rules.length > 0) {
        updateData.rules = {
          create: data.rules.map((_) => ({
            fieldId: _.fieldId,
            operator: _.operator,
            value: _.value,
          })),
        };
      }
    }

    const form = await prisma.app_RoutingForms_Form.update({
      where: { id },
      data: updateData,
      select: routingFormSelect,
    });

    return this.transformToAppModel(form);
  }

  /**
   * Delete routing form
   */
  static async delete(id: string, userId: number): Promise<void> {
    const form = await this.getById(id, userId);
    if (!form) {
      throw new Error(`Routing form ${id} not found or access denied`);
    }

    await prisma.app_RoutingForms_Form.delete({
      where: { id },
    });
  }

  /**
   * Save response to a routing form
   */
  static async saveResponse(formId: string, responses: Record<string, string>, userId?: number): Promise<RoutingFormResponse> {
    const created = await prisma.app_RoutingForms_FormResponse.create({
      data: {
        formId,
        responses: responses as Prisma.InputJsonValue,
        userId,
      },
      select: {
        id: true,
        formId: true,
        responses: true,
        userId: true,
        createdAt: true,
      },
    });

    return created as RoutingFormResponse;
  }

  /**
   * Get responses for a routing form
   */
  static async getResponses(formId: string, userId: number): Promise<RoutingFormResponse[]> {
    const responses = await prisma.app_RoutingForms_FormResponse.findMany({
      where: {
        formId,
        form: { userId },
      },
      orderBy: { createdAt: "desc" as const },
    });

    return responses as RoutingFormResponse[];
  }

  /**
   * Transform Prisma model to app model
   */
  private static transformToAppModel(
    data: Prisma.App_RoutingForms_FormGetPayload<{ select: typeof routingFormSelect }>
  ): RoutingForm {
    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      fields: data.fields
        .sort((a, b) => a.position - b.position)
        .map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options as string[] | undefined,
          placeholder: f.placeholder || undefined,
          defaultValue: f.defaultValue || undefined,
          description: f.description || undefined,
          validation: f.validation as {
            pattern?: string;
            min?: number;
            max?: number;
          } | undefined,
        })),
      actions: data.actions
        .sort((a, b) => a.position - b.position)
        .map((a) => ({
          id: a.id,
          actorType: a.actorType,
          actorId: a.actorId || undefined,
          userId: a.userId || undefined,
          eventTypeIds: (a.eventTypeIds as number[]) || undefined,
          position: a.position,
          selected: a.selected,
        })),
      rules: data.rules.map((r) => ({
        id: r.id,
        fieldId: r.fieldId,
        operator: r.operator,
        value: r.value,
      })),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}