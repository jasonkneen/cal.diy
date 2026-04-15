import { z } from "zod";

// --- List teams ---
export const ZListInputSchema = z
  .object({
    includeMembers: z.boolean().optional().default(false),
  })
  .optional();
export type TListInput = z.infer<typeof ZListInputSchema>;

// --- Get team ---
export const ZGetInputSchema = z.object({
  teamId: z.number(),
  includeMembers: z.boolean().optional().default(true),
});
export type TGetInput = z.infer<typeof ZGetInputSchema>;

// --- Create team ---
export const ZCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  logoUrl: z.string().url().optional().nullable(),
  hideBranding: z.boolean().optional().default(false),
});
export type TCreateInput = z.infer<typeof ZCreateInputSchema>;

// --- Update team ---
export const ZUpdateInputSchema = z.object({
  teamId: z.number(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  hideBranding: z.boolean().optional(),
  timeZone: z.string().optional(),
  weekStart: z.string().optional(),
  timeFormat: z.number().optional(),
  theme: z.string().optional().nullable(),
  brandColor: z.string().optional(),
  darkBrandColor: z.string().optional(),
});
export type TUpdateInput = z.infer<typeof ZUpdateInputSchema>;

// --- Delete team ---
export const ZDeleteInputSchema = z.object({
  teamId: z.number(),
});
export type TDeleteInput = z.infer<typeof ZDeleteInputSchema>;

// --- Invite member ---
export const ZInviteMemberInputSchema = z.object({
  teamId: z.number(),
  usernameOrEmail: z.string().min(1),
  role: z.enum(["MEMBER", "ADMIN", "OWNER"]).default("MEMBER"),
});
export type TInviteMemberInput = z.infer<typeof ZInviteMemberInputSchema>;

// --- Remove member ---
export const ZRemoveMemberInputSchema = z.object({
  teamId: z.number(),
  memberId: z.number(), // userId of the member to remove
});
export type TRemoveMemberInput = z.infer<typeof ZRemoveMemberInputSchema>;

// --- Change member role ---
export const ZChangeMemberRoleInputSchema = z.object({
  teamId: z.number(),
  memberId: z.number(),
  role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
});
export type TChangeMemberRoleInput = z.infer<typeof ZChangeMemberRoleInputSchema>;

// --- Accept/decline invitation ---
export const ZInvitationInputSchema = z.object({
  teamId: z.number(),
});
export type TInvitationInput = z.infer<typeof ZInvitationInputSchema>;

// --- List members ---
export const ZListMembersInputSchema = z.object({
  teamId: z.number(),
});
export type TListMembersInput = z.infer<typeof ZListMembersInputSchema>;

// --- Get team invites (pending) ---
export const ZGetInvitesInputSchema = z.object({
  teamId: z.number(),
});
export type TGetInvitesInput = z.infer<typeof ZGetInvitesInputSchema>;
