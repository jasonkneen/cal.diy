import prisma from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/client";
import { TRPCError } from "@trpc/server";
import type { TrpcSessionUser } from "../../../types";

type AuthenticatedTrpcSessionUser = NonNullable<TrpcSessionUser>;

type AuthenticatedContext = {
  user: AuthenticatedTrpcSessionUser;
};

import type {
  TChangeMemberRoleInput,
  TCreateInput,
  TDeleteInput,
  TGetInput,
  TInvitationInput,
  TInviteMemberInput,
  TListInput,
  TListMembersInput,
  TRemoveMemberInput,
  TUpdateInput,
} from "./teams.schema";

// ─── Helpers ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function assertAdminOrOwner(userId: number, teamId: number) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      role: { in: [MembershipRole.ADMIN, MembershipRole.OWNER] },
      accepted: true,
    },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You must be a team admin or owner" });
  }
  return membership;
}

async function assertOwner(userId: number, teamId: number) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      role: MembershipRole.OWNER,
      accepted: true,
    },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You must be the team owner" });
  }
  return membership;
}

async function assertMember(userId: number, teamId: number) {
  const membership = await prisma.membership.findFirst({
    where: { userId, teamId, accepted: true },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this team" });
  }
  return membership;
}

// ─── Handlers ────────────────────────────────────────────────────────

/** List all teams the current user belongs to */
export async function listHandler({ ctx, input }: { ctx: AuthenticatedContext; input?: TListInput }) {
  const memberships = await prisma.membership.findMany({
    where: { userId: ctx.user.id, accepted: true },
    select: {
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          bio: true,
          hideBranding: true,
          ...(input?.includeMembers
            ? {
                members: {
                  select: {
                    id: true,
                    userId: true,
                    role: true,
                    accepted: true,
                    user: {
                      select: { id: true, name: true, email: true, avatarUrl: true },
                    },
                  },
                },
              }
            : {}),
        },
      },
    },
    orderBy: { team: { name: "asc" } },
  });

  return memberships.map((m) => ({
    ...m.team,
    role: m.role,
  }));
}

/** Get a single team by ID */
export async function getHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TGetInput }) {
  await assertMember(ctx.user.id, input.teamId);

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      bio: true,
      hideBranding: true,
      timeZone: true,
      weekStart: true,
      timeFormat: true,
      theme: true,
      brandColor: true,
      darkBrandColor: true,
      createdAt: true,
      ...(input.includeMembers
        ? {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
                accepted: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                    username: true,
                    timeZone: true,
                  },
                },
              },
              orderBy: { role: "asc" as const },
            },
          }
        : {}),
    },
  });

  if (!team) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
  }

  return team;
}

/** Create a new team */
export async function createHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TCreateInput }) {
  const slug = input.slug || slugify(input.name);

  // Check slug uniqueness
  const existing = await prisma.team.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: `Team slug "${slug}" is already taken` });
  }

  const team = await prisma.team.create({
    data: {
      name: input.name,
      slug,
      bio: input.bio ?? null,
      logoUrl: input.logoUrl ?? null,
      hideBranding: input.hideBranding,
      members: {
        create: {
          userId: ctx.user.id,
          role: MembershipRole.OWNER,
          accepted: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      bio: true,
    },
  });

  return team;
}

/** Update team settings */
export async function updateHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TUpdateInput }) {
  await assertAdminOrOwner(ctx.user.id, input.teamId);

  const { teamId, slug, ...data } = input;

  // If changing slug, check uniqueness
  if (slug) {
    const existing = await prisma.team.findFirst({
      where: { slug, id: { not: teamId } },
      select: { id: true },
    });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: `Slug "${slug}" is already taken` });
    }
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...data,
      ...(slug ? { slug } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      bio: true,
      hideBranding: true,
    },
  });

  return team;
}

/** Delete a team (owner only) */
export async function deleteHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TDeleteInput }) {
  await assertOwner(ctx.user.id, input.teamId);

  // Delete all memberships first, then the team
  await prisma.membership.deleteMany({ where: { teamId: input.teamId } });
  await prisma.eventType.deleteMany({ where: { teamId: input.teamId } });
  await prisma.team.delete({ where: { id: input.teamId } });

  return { success: true };
}

/** Invite a member to the team */
export async function inviteMemberHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input: TInviteMemberInput;
}) {
  await assertAdminOrOwner(ctx.user.id, input.teamId);

  // Find user by email or username
  const invitee = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.usernameOrEmail }, { username: input.usernameOrEmail }],
    },
    select: { id: true, email: true, name: true },
  });

  if (!invitee) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found. They must have a Cal.diy account first.",
    });
  }

  // Check if already a member
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: invitee.id, teamId: input.teamId },
  });

  if (existingMembership) {
    if (existingMembership.accepted) {
      throw new TRPCError({ code: "CONFLICT", message: "User is already a member of this team" });
    }
    // Re-send invitation (update existing pending membership)
    return { success: true, message: "Invitation already pending" };
  }

  // Create membership (pending acceptance)
  await prisma.membership.create({
    data: {
      userId: invitee.id,
      teamId: input.teamId,
      role: input.role as MembershipRole,
      accepted: false,
    },
  });

  return { success: true, message: `Invitation sent to ${invitee.email}` };
}

/** Remove a member from the team */
export async function removeMemberHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input: TRemoveMemberInput;
}) {
  // Can't remove yourself (use leave instead)
  if (input.memberId === ctx.user.id) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use the leave endpoint to leave a team" });
  }

  const callerMembership = await assertAdminOrOwner(ctx.user.id, input.teamId);

  // Can't remove an owner unless you're an owner
  const targetMembership = await prisma.membership.findFirst({
    where: { userId: input.memberId, teamId: input.teamId },
  });

  if (!targetMembership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Member not found in this team" });
  }

  if (targetMembership.role === MembershipRole.OWNER && callerMembership.role !== MembershipRole.OWNER) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can remove another owner" });
  }

  await prisma.membership.delete({ where: { id: targetMembership.id } });

  return { success: true };
}

/** Change a member's role */
export async function changeMemberRoleHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input: TChangeMemberRoleInput;
}) {
  await assertOwner(ctx.user.id, input.teamId);

  const membership = await prisma.membership.findFirst({
    where: { userId: input.memberId, teamId: input.teamId },
  });

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Member not found in this team" });
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { role: input.role as MembershipRole },
  });

  return { success: true };
}

/** Accept a team invitation */
export async function acceptInviteHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input: TInvitationInput;
}) {
  const membership = await prisma.membership.findFirst({
    where: { userId: ctx.user.id, teamId: input.teamId, accepted: false },
  });

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No pending invitation found" });
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { accepted: true },
  });

  return { success: true };
}

/** Decline / leave a team */
export async function leaveHandler({ ctx, input }: { ctx: AuthenticatedContext; input: TInvitationInput }) {
  const membership = await prisma.membership.findFirst({
    where: { userId: ctx.user.id, teamId: input.teamId },
  });

  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "You are not a member of this team" });
  }

  // Don't allow the last owner to leave
  if (membership.role === MembershipRole.OWNER) {
    const otherOwners = await prisma.membership.count({
      where: {
        teamId: input.teamId,
        role: MembershipRole.OWNER,
        accepted: true,
        userId: { not: ctx.user.id },
      },
    });
    if (otherOwners === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You are the last owner. Transfer ownership or delete the team.",
      });
    }
  }

  await prisma.membership.delete({ where: { id: membership.id } });

  return { success: true };
}

/** List team members */
export async function listMembersHandler({
  ctx,
  input,
}: {
  ctx: AuthenticatedContext;
  input: TListMembersInput;
}) {
  await assertMember(ctx.user.id, input.teamId);

  const members = await prisma.membership.findMany({
    where: { teamId: input.teamId },
    select: {
      id: true,
      userId: true,
      role: true,
      accepted: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          avatarUrl: true,
          timeZone: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
  });

  return members;
}

/** Get pending invitations for the current user */
export async function pendingInvitesHandler({ ctx }: { ctx: AuthenticatedContext }) {
  const invites = await prisma.membership.findMany({
    where: { userId: ctx.user.id, accepted: false },
    select: {
      id: true,
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      },
    },
  });

  return invites;
}
