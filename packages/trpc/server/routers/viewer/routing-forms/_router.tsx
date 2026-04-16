import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";
import {
  createHandler,
  deleteHandler,
  getHandler,
  getResponsesHandler,
  listHandler,
  saveResponseHandler,
  updateHandler,
} from "./routing-forms.handler";
import {
  RoutingFormIdSchema,
  RoutingFormInputSchema,
  RoutingFormQuerySchema,
  RoutingFormResponseInputSchema,
  RoutingFormUpdateWithIdSchema,
} from "./routing-forms.schema";

export const routingFormsRouter = router({
  list: authedProcedure.input(RoutingFormQuerySchema).query(async ({ ctx, input }) => {
    return listHandler({ ctx, input });
  }),

  get: authedProcedure.input(RoutingFormIdSchema).query(async ({ input, ctx }) => {
    return getHandler({ input, ctx });
  }),

  create: authedProcedure.input(RoutingFormInputSchema).mutation(async ({ input, ctx }) => {
    return createHandler({ input, ctx });
  }),

  update: authedProcedure.input(RoutingFormUpdateWithIdSchema).mutation(async ({ input, ctx }) => {
    return updateHandler({ input, ctx });
  }),

  delete: authedProcedure.input(RoutingFormIdSchema).mutation(async ({ input, ctx }) => {
    return deleteHandler({ input, ctx });
  }),

  saveResponse: authedProcedure.input(RoutingFormResponseInputSchema).mutation(async ({ input, ctx }) => {
    return saveResponseHandler({ input, ctx });
  }),

  getResponses: authedProcedure.input(RoutingFormIdSchema).query(async ({ input, ctx }) => {
    return getResponsesHandler({ input, ctx });
  }),
});
