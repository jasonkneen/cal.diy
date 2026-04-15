import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";
import {
  ZListInputSchema,
  ZGetInputSchema,
  ZCreateInputSchema,
  ZUpdateInputSchema,
  ZDeleteInputSchema,
  ZActivateInputSchema,
  ZDeactivateInputSchema,
  ZTestInputSchema,
} from "./workflows.schema";

export const workflowsRouter = router({
  /** List all workflows for the current user */
  list: authedProcedure.input(ZListInputSchema).query(async ({ ctx, input }) => {
    const { listHandler } = await import("./workflows.handler");
    return listHandler({ ctx, input });
  }),

  /** Get a single workflow by ID */
  get: authedProcedure.input(ZGetInputSchema).query(async ({ ctx, input }) => {
    const { getHandler } = await import("./workflows.handler");
    return getHandler({ ctx, input });
  }),

  /** Create a new workflow */
  create: authedProcedure.input(ZCreateInputSchema).mutation(async ({ ctx, input }) => {
    const { createHandler } = await import("./workflows.handler");
    return createHandler({ ctx, input });
  }),

  /** Update a workflow */
  update: authedProcedure.input(ZUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const { updateHandler } = await import("./workflows.handler");
    return updateHandler({ ctx, input });
  }),

  /** Delete a workflow */
  delete: authedProcedure.input(ZDeleteInputSchema).mutation(async ({ ctx, input }) => {
    const { deleteHandler } = await import("./workflows.handler");
    return deleteHandler({ ctx, input });
  }),

  /** Activate a workflow on an event type */
  activate: authedProcedure.input(ZActivateInputSchema).mutation(async ({ ctx, input }) => {
    const { activateHandler } = await import("./workflows.handler");
    return activateHandler({ ctx, input });
  }),

  /** Deactivate a workflow from an event type */
  deactivate: authedProcedure.input(ZDeactivateInputSchema).mutation(async ({ ctx, input }) => {
    const { deactivateHandler } = await import("./workflows.handler");
    return deactivateHandler({ ctx, input });
  }),

  /** Send a test notification for a workflow step */
  test: authedProcedure.input(ZTestInputSchema).mutation(async ({ ctx, input }) => {
    const { testHandler } = await import("./workflows.handler");
    return testHandler({ ctx, input });
  }),
});
