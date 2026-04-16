import type { RoutingForm, RoutingFormResponse } from "@calcom/features/routing-forms/lib/types";
import {
  ROUTING_FORMS_TABLES_MISSING_ERROR,
  RoutingFormRepository,
} from "@calcom/features/routing-forms/repositories/RoutingFormRepository";
import { TRPCError } from "@trpc/server";
import type { TrpcSessionUser } from "../../../types";
import type {
  TGetInput,
  TGetResponseOutput,
  TListInput,
  TListOutput,
  TResponseInput,
  TRoutingForm,
  TRoutingFormInput,
  TRoutingFormUpdateWithIdInput,
} from "./routing-forms.schema";

type AuthenticatedTrpcSessionUser = NonNullable<TrpcSessionUser>;

type AuthenticatedContext = {
  user: AuthenticatedTrpcSessionUser;
};

async function withRoutingFormsAvailability<T>({ operation }: { operation: () => Promise<T> }): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.message === ROUTING_FORMS_TABLES_MISSING_ERROR) {
      throw new TRPCError({ code: "NOT_FOUND", message: error.message });
    }

    throw error;
  }
}

function toPublicForm(form: RoutingForm): TRoutingForm {
  return {
    ...form,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  };
}

function toPublicResponse(response: RoutingFormResponse): RoutingFormResponse {
  return {
    ...response,
    createdAt: response.createdAt,
  };
}

/**
 * List all routing forms for the authenticated user
 */
export async function listHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input?: TListInput;
}): Promise<TListOutput> {
  const forms = await withRoutingFormsAvailability({
    operation: () => RoutingFormRepository.listByUser(ctx.user.id, input?.limit),
  });

  return {
    items: forms.map((form) => toPublicForm(form)),
  };
}

/**
 * Get a routing form by ID
 */
export async function getHandler({
  input,
  ctx,
}: {
  input: TGetInput;
  ctx: AuthenticatedContext;
}): Promise<RoutingForm> {
  const form = await withRoutingFormsAvailability({
    operation: () => RoutingFormRepository.getById(input.id, ctx.user.id),
  });

  if (!form) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Routing form not found" });
  }

  return toPublicForm(form);
}

/**
 * Create a new routing form
 */
export async function createHandler({
  input,
  ctx,
}: {
  input: TRoutingFormInput;
  ctx: AuthenticatedContext;
}): Promise<RoutingForm> {
  return withRoutingFormsAvailability({
    operation: () => RoutingFormRepository.create(ctx.user.id, input),
  });
}

/**
 * Update a routing form
 */
export async function updateHandler({
  input,
  ctx,
}: {
  input: TRoutingFormUpdateWithIdInput;
  ctx: AuthenticatedContext;
}): Promise<RoutingForm> {
  const { id, ...rest } = input;

  return withRoutingFormsAvailability({
    operation: () => RoutingFormRepository.update(id, ctx.user.id, rest),
  });
}

/**
 * Delete a routing form
 */
export async function deleteHandler({
  input,
  ctx,
}: {
  input: TGetInput;
  ctx: AuthenticatedContext;
}): Promise<void> {
  await withRoutingFormsAvailability({
    operation: () => RoutingFormRepository.delete(input.id, ctx.user.id),
  });
}

/**
 * Save form response
 */
export async function saveResponseHandler({
  input,
  ctx,
}: {
  input: TResponseInput & { userId?: number };
  ctx: AuthenticatedContext;
}): Promise<RoutingFormResponse> {
  return withRoutingFormsAvailability({
    operation: () =>
      RoutingFormRepository.saveResponse(input.formId, input.responses, input.userId ?? ctx.user.id),
  });
}

/**
 * Get all responses for a routing form
 */
export async function getResponsesHandler({
  input,
  ctx,
}: {
  input: TGetInput;
  ctx: AuthenticatedContext;
}): Promise<TGetResponseOutput> {
  const responses = await withRoutingFormsAvailability({
    operation: () => RoutingFormRepository.getResponses(input.id, ctx.user.id),
  });

  return {
    items: responses.map((r) => toPublicResponse(r)),
  };
}
