import { TRPCError } from "@trpc/server";

import { RoutingFormRepository } from "@calcom/features/routing-forms/repositories/RoutingFormRepository";
import type { RoutingForm, RoutingFormResponse } from "@calcom/features/routing-forms/lib/types";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";
import type {
  TGetInputSchema,
  TListOutputSchema,
  TRoutingFormInputSchema,
  TRoutingFormResponseInputSchema,
  TRoutingFormUpdateSchema,
} from "./routing-forms.schema";

/* Handlers for routing forms tRPC router */

export async function listHandler({ ctx }: { ctx: { user: TrpcSessionUser } }): Promise<TListOutputSchema> {
  const forms = await RoutingFormRepository.listByUser(ctx.user.id);

  return {
    items: forms.map(({ createdAt, updatedAt, ...rest }) => ({
      ...rest,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })),
  };
}

export async function getHandler({ input, ctx }: { input: TGetInputSchema; ctx: { user: TrpcSessionUser } }): Promise<RoutingForm> {
  const form = await RoutingFormRepository.getById(input.id, ctx.user.id);

  if (!form) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Routing form not found",
    });
  }

  return {
    ...form,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
  } as unknown as RoutingForm;
}

export async function createHandler({
  input,
  ctx,
}: {
  input: TRoutingFormInputSchema;
  ctx: { user: TrpcSessionUser };
}): Promise<RoutingForm> {
  const newForm = await RoutingFormRepository.create(ctx.user.id, input as any);

  return {
    ...newForm,
    createdAt: newForm.createdAt.toISOString(),
    updatedAt: newForm.updatedAt.toISOString(),
  } as unknown as RoutingForm;
}

export async function updateHandler({
  input,
  ctx,
}: {
  input: TRoutingFormUpdateSchema & { id: string };
  ctx: { user: TrpcSessionUser };
}): Promise<RoutingForm> {
  const updatedForm = await RoutingFormRepository.update(input.id, ctx.user.id, input as any);

  return {
    ...updatedForm,
    createdAt: updatedForm.createdAt.toISOString(),
    updatedAt: updatedForm.updatedAt.toISOString(),
  } as unknown as RoutingForm;
}

export async function deleteHandler({
  input,
  ctx,
}: {
  input: TGetInputSchema;
  ctx: { user: TrpcSessionUser };
}): Promise<void> {
  await RoutingFormRepository.delete(input.id, ctx.user.id);
}

export async function saveResponseHandler({
  input,
  ctx,
}: {
  input: TRoutingFormResponseInputSchema & { userId?: number };
  ctx: { user: TrpcSessionUser };
}): Promise<RoutingFormResponse> {
  return RoutingFormRepository.saveResponse(
    input.formId,
    input.responses,
    input.userId || ctx.user.id
  );
}

export async function getResponsesHandler({
  input,
  ctx,
}: {
  input: TGetInputSchema;
  ctx: { user: TrpcSessionUser };
}): Promise<{
  items: RoutingFormResponse[];
}> {
  const responses = await RoutingFormRepository.getResponses(input.id, ctx.user.id);

  return {
    items: responses.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}