"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";
import { Meta } from "@calcom/ui/components/meta";
import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { showToast } from "@calcom/ui/components/toast";

export default function TeamsSettingsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: teams, isLoading } = trpc.viewer.teams.list.useQuery({ includeMembers: true });
  const { data: pendingInvites } = trpc.viewer.teams.pendingInvites.useQuery();

  const acceptInvite = trpc.viewer.teams.acceptInvite.useMutation({
    onSuccess: () => {
      showToast("Invitation accepted!", "success");
      utils.viewer.teams.list.invalidate();
      utils.viewer.teams.pendingInvites.invalidate();
    },
  });

  const leaveTeam = trpc.viewer.teams.leave.useMutation({
    onSuccess: () => {
      showToast("Left team", "success");
      utils.viewer.teams.list.invalidate();
      utils.viewer.teams.pendingInvites.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader" className="text-subtle h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Meta
        title="Teams"
        description="Create and manage teams to collaborate on scheduling."
        CTA={
          <Button href="/settings/teams/new" StartIcon="plus" color="primary">
            {t("new_team")}
          </Button>
        }
      />

      {/* Pending invitations */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="border-subtle bg-subtle mb-6 rounded-lg border p-4">
          <h3 className="text-emphasis mb-3 text-sm font-semibold">Pending Invitations</h3>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="bg-default flex items-center justify-between rounded-md p-3">
                <div className="flex items-center gap-3">
                  {invite.team.logoUrl ? (
                    <Avatar size="sm" imageSrc={invite.team.logoUrl} alt={invite.team.name} />
                  ) : (
                    <div className="bg-emphasis flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                      {invite.team.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-emphasis text-sm font-medium">{invite.team.name}</p>
                    <p className="text-subtle text-xs">
                      Invited as <Badge variant="gray">{invite.role}</Badge>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color="primary"
                    loading={acceptInvite.isPending}
                    onClick={() => acceptInvite.mutate({ teamId: invite.team.id })}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    color="secondary"
                    loading={leaveTeam.isPending}
                    onClick={() => leaveTeam.mutate({ teamId: invite.team.id })}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams list */}
      {!teams || teams.length === 0 ? (
        <EmptyScreen
          Icon="users"
          headline="No teams yet"
          description="Create a team to collaborate on scheduling with your colleagues."
          buttonRaw={
            <Button href="/settings/teams/new" StartIcon="plus" color="primary">
              Create your first team
            </Button>
          }
        />
      ) : (
        <div className="bg-default border-subtle divide-subtle divide-y rounded-lg border">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/settings/teams/${team.id}/members`}
              className="hover:bg-subtle flex items-center justify-between p-4 transition-colors">
              <div className="flex items-center gap-4">
                {team.logoUrl ? (
                  <Avatar size="md" imageSrc={team.logoUrl} alt={team.name} />
                ) : (
                  <div className="bg-emphasis flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold">
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-emphasis font-medium">{team.name}</p>
                  <p className="text-subtle text-sm">
                    {"members" in team && Array.isArray(team.members)
                      ? `${team.members.length} member${team.members.length !== 1 ? "s" : ""}`
                      : ""}
                    {" · "}
                    <Badge variant="gray">{team.role}</Badge>
                  </p>
                </div>
              </div>
              <Icon name="chevron-right" className="text-subtle h-5 w-5" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
