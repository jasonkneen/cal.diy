import { z } from "zod";
import { createTRPCRouter } from "@calcom/trpc/server";
import { defaultProcedures } from "@calcom/trpc/server/routers/_default Procedures";

import type { TGetInputSchema, TListOutputSchema } from "./routing-forms.schema";
import {
  deleteHandler,
  getHandler,
  getResponsesHandler,
  listHandler,
  saveResponseHandler,
  createHandler,
  updateHandler,
} from "./routing-forms.handler";
import {
  RoutingFormIdSchema,
  RoutingFormInputSchema,
  RoutingFormResponseInputSchema,
  RoutingFormQuerySchema,
  RoutingFormUpdateSchema,
} from "./routing-forms.schema";

export const routingFormsRouter = createTRPCRouter({
  // List routing forms
  list: defaultProcedures.list.query(({ ctx }) => listHandler({ ctx })),

  // Get routing form by ID
  get: defaultProcedures.get.input(RoutingFormIdSchema).query(({ input, ctx }) => {
    return getHandler({ input: input as TGetInputSchema, ctx });
  }),

  // Create routing form
  create: defaultProcedures.create.input(RoutingFormInputSchema).mutation(({ input, ctx }) => {
    return createHandler({ input: input as any, ctx });
  }),

  // Update routing form
  update: defaultProcedures.update
    .input(RoutingFormIdSchema.merge(RoutingFormUpdateSchema))
    .mutation(({ input, ctx }) => {
      return updateHandler({ input: input as any, ctx });
    }),

  // Delete routing form
  delete: defaultProcedures.delete.input(RoutingFormIdSchema).mutation(({ input, ctx }) => {
    return deleteHandler({ input: input as TGetInputSchema, ctx });
  }),

  // Save form response
  saveResponse: defaultProcedures.create
    .input(RoutingFormResponseInputSchema)
    .mutation(({ input, ctx }) => {
      return saveResponseHandler({ input: input as any, ctx });
    }),

  // Get responses for a routing form
  getResponses: defaultProcedures.get.input(RoutingFormIdSchema).query(({ input, ctx }) => {
    return getResponsesHandler({ input: input as TGetInputSchema, ctx });
  }),
});