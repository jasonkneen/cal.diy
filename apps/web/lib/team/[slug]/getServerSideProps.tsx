import { IS_CALCOM } from "@calcom/lib/constants";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import logger from "@calcom/lib/logger";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import slugify from "@calcom/lib/slugify";
import { stripMarkdown } from "@calcom/lib/stripMarkdown";
import prisma from "@calcom/prisma";
import type { OrganizationSettings, Team } from "@calcom/prisma/client";
import { RedirectType } from "@calcom/prisma/enums";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";
import { handleOrgRedirect } from "@lib/handleOrgRedirect";
import type { GetServerSidePropsContext } from "next";

const log = logger.getSubLogger({ prefix: ["team/[slug]"] });

function getOrgProfileRedirectToVerifiedDomain(
  team: {
    isOrganization: boolean;
  },
  settings: Pick<OrganizationSettings, "orgAutoAcceptEmail" | "orgProfileRedirectsToVerifiedDomain">
) {
  if (!team.isOrganization) {
    return null;
  }
  // when this is not on a Cal.diy page we don't auto redirect -
  // good for diagnosis purposes.
  if (!IS_CALCOM) {
    return null;
  }

  const verifiedDomain = null;

  if (!settings.orgProfileRedirectsToVerifiedDomain || !verifiedDomain) {
    return null;
  }

  return {
    redirect: {
      permanent: false,
      destination: `https://${verifiedDomain}`,
    },
  };
}

const getTheLastArrayElement = (value: ReadonlyArray<string> | string | undefined): string | undefined => {
  if (value === undefined || typeof value === "string") {
    return value;
  }

  return value.at(-1);
};

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const slug = getTheLastArrayElement(context.query.slug) ?? getTheLastArrayElement(context.query.orgSlug);

  const currentOrgDomain = null;
  const isValidOrgDomain = false;

  // Provided by Rewrite from next.config.js
  const isOrgProfile = context.query?.isOrgProfile === "1";
  const organizationsEnabled = false;

  log.debug("getServerSideProps", {
    isOrgProfile,
    isOrganizationFeatureEnabled: organizationsEnabled,
    isValidOrgDomain,
    currentOrgDomain,
  });

  // Cal.diy: Actually query the team from the database instead of hardcoding null
  const team = slug
    ? await prisma.team.findFirst({
        where: {
          OR: [{ slug }, { metadata: { path: ["requestedSlug"], equals: slug } }],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          bio: true,
          hideBranding: true,
          isOrganization: true,
          metadata: true,
          theme: true,
          brandColor: true,
          darkBrandColor: true,
          parent: {
            select: {
              slug: true,
              name: true,
              isOrganization: true,
            },
          },
          members: {
            where: { accepted: true },
            select: {
              role: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  bio: true,
                  avatarUrl: true,
                  organizationId: true,
                },
              },
            },
          },
        },
      })
    : null;

  if (slug) {
    const redirect = await handleOrgRedirect({
      slugs: [slug],
      redirectType: RedirectType.Team,
      eventTypeSlug: null,
      context,
      currentOrgDomain: isValidOrgDomain ? currentOrgDomain : null,
    });

    if (redirect) {
      return redirect;
    }
  }

  const metadata = teamMetadataSchema.parse(team?.metadata ?? {});

  // Taking care of sub-teams and orgs
  // Cal.diy: Only block if this is an org-related request on a non-org setup
  // Regular teams should pass through
  if (team && !team.isOrganization) {
    // Regular team — build the response with members
    const members = team.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      username: m.user.username,
      bio: m.user.bio,
      avatarUrl: m.user.avatarUrl ?? null,
      organizationId: m.user.organizationId,
      safeBio: markdownToSafeHTML(m.user.bio),
      role: m.role,
    }));

    return {
      props: {
        team: {
          id: team.id,
          name: team.name,
          slug: team.slug,
          logoUrl: team.logoUrl,
          bio: team.bio,
          hideBranding: team.hideBranding,
          theme: team.theme,
          brandColor: team.brandColor,
          darkBrandColor: team.darkBrandColor,
          members,
        },
      },
    };
  }

  if (
    (!isValidOrgDomain && team?.parent) ||
    (!isValidOrgDomain && !!team?.isOrganization) ||
    (!organizationsEnabled && !team)
  ) {
    return { notFound: true } as const;
  }

  if (!team) {
    const unpublishedTeam = await prisma.team.findFirst({
      where: {
        metadata: {
          path: ["requestedSlug"],
          equals: slug,
        },
      },
      include: {
        parent: {
          select: {
            id: true,
            slug: true,
            name: true,
            isPrivate: true,
            isOrganization: true,
            metadata: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!unpublishedTeam) return { notFound: true } as const;
    const teamParent = unpublishedTeam.parent ? getTeamWithoutMetadata(unpublishedTeam.parent) : null;
    return {
      props: {
        considerUnpublished: true,
        team: {
          ...unpublishedTeam,
          parent: teamParent,
          createdAt: null,
        },
      },
    } as const;
  }

  return { notFound: true } as const;
};

/**
 * Removes metadata from team and just adds requestedSlug
 */
function getTeamWithoutMetadata<T extends Pick<Team, "metadata">>(team: T) {
  const { metadata, ...rest } = team;
  const teamMetadata = teamMetadataSchema.parse(metadata);
  return {
    ...rest,
    ...(typeof teamMetadata?.requestedSlug !== "undefined"
      ? { requestedSlug: teamMetadata?.requestedSlug }
      : {}),
  };
}
