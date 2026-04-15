import authedProcedure from "../../../procedures/authedProcedure";
import { router } from "../../../trpc";
import {
  ZListInputSchema,
  ZGetInputSchema,
  ZCreateInputSchema,
  ZUpdateInputSchema,
  ZDeleteInputSchema,
  ZInviteMemberInputSchema,
  ZRemoveMemberInputSchema,
  ZChangeMemberRoleInputSchema,
  ZInvitationInputSchema,
  ZListMembersInputSchema,
} from "./teams.schema";

export const teamsRouter = router({
  /** List all teams for the current user */
  list: authedProcedure.input(ZListInputSchema).query(async ({ ctx, input }) => {
    const { listHandler } = await import("./teams.handler");
    return listHandler({ ctx, input });
  }),

  /** Get a single team by ID */
  get: authedProcedure.input(ZGetInputSchema).query(async ({ ctx, input }) => {
    const { getHandler } = await import("./teams.handler");
    return getHandler({ ctx, input });
  }),

  /** Create a new team */
  create: authedProcedure.input(ZCreateInputSchema).mutation(async ({ ctx, input }) => {
    const { createHandler } = await import("./teams.handler");
    return createHandler({ ctx, input });
  }),

  /** Update team settings */
  update: authedProcedure.input(ZUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const { updateHandler } = await import("./teams.handler");
    return updateHandler({ ctx, input });
  }),

  /** Delete a team */
  delete: authedProcedure.input(ZDeleteInputSchema).mutation(async ({ ctx, input }) => {
    const { deleteHandler } = await import("./teams.handler");
    return deleteHandler({ ctx, input });
  }),

  /** Invite a member */
  inviteMember: authedProcedure.input(ZInviteMemberInputSchema).mutation(async ({ ctx, input }) => {
    const { inviteMemberHandler } = await import("./teams.handler");
    return inviteMemberHandler({ ctx, input });
  }),

  /** Remove a member */
  removeMember: authedProcedure.input(ZRemoveMemberInputSchema).mutation(async ({ ctx, input }) => {
    const { removeMemberHandler } = await import("./teams.handler");
    return removeMemberHandler({ ctx, input });
  }),

  /** Change member role */
  changeMemberRole: authedProcedure.input(ZChangeMemberRoleInputSchema).mutation(async ({ ctx, input }) => {
    const { changeMemberRoleHandler } = await import("./teams.handler");
    return changeMemberRoleHandler({ ctx, input });
  }),

  /** Accept an invitation */
  acceptInvite: authedProcedure.input(ZInvitationInputSchema).mutation(async ({ ctx, input }) => {
    const { acceptInviteHandler } = await import("./teams.handler");
    return acceptInviteHandler({ ctx, input });
  }),

  /** Leave / decline a team */
  leave: authedProcedure.input(ZInvitationInputSchema).mutation(async ({ ctx, input }) => {
    const { leaveHandler } = await import("./teams.handler");
    return leaveHandler({ ctx, input });
  }),

  /** List members of a team */
  listMembers: authedProcedure.input(ZListMembersInputSchema).query(async ({ ctx, input }) => {
    const { listMembersHandler } = await import("./teams.handler");
    return listMembersHandler({ ctx, input });
  }),

  /** Get pending invitations for current user */
  pendingInvites: authedProcedure.query(async ({ ctx }) => {
    const { pendingInvitesHandler } = await import("./teams.handler");
    return pendingInvitesHandler({ ctx });
  }),
});
