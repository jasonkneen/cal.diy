"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";
import { Meta } from "@calcom/ui/components/meta";
import { Avatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@calcom/ui/components/dialog";
import {
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Dropdown,
} from "@calcom/ui/components/form/dropdown";
import {
  Select,
} from "@calcom/ui/components/form";

export default function TeamMembersPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams();
  const teamId = Number(params?.id);
  const utils = trpc.useUtils();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: team, isLoading } = trpc.viewer.teams.get.useQuery({
    teamId,
    includeMembers: true,
  });

  const { data: members } = trpc.viewer.teams.listMembers.useQuery({ teamId });

  const inviteMember = trpc.viewer.teams.inviteMember.useMutation({
    onSuccess: (result) => {
      showToast(result.message, "success");
      setInviteEmail("");
      setShowInviteDialog(false);
      utils.viewer.teams.listMembers.invalidate({ teamId });
      utils.viewer.teams.get.invalidate({ teamId });
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const removeMember = trpc.viewer.teams.removeMember.useMutation({
    onSuccess: () => {
      showToast("Member removed", "success");
      utils.viewer.teams.listMembers.invalidate({ teamId });
      utils.viewer.teams.get.invalidate({ teamId });
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const changeMemberRole = trpc.viewer.teams.changeMemberRole.useMutation({
    onSuccess: () => {
      showToast("Role updated", "success");
      utils.viewer.teams.listMembers.invalidate({ teamId });
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const deleteTeam = trpc.viewer.teams.delete.useMutation({
    onSuccess: () => {
      showToast("Team deleted", "success");
      router.push("/settings/teams");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const leaveTeam = trpc.viewer.teams.leave.useMutation({
    onSuccess: () => {
      showToast("Left team", "success");
      router.push("/settings/teams");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  if (isLoading || !team) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader" className="text-subtle h-6 w-6 animate-spin" />
      </div>
    );
  }

  const roleOptions = [
    { value: "MEMBER", label: "Member" },
    { value: "ADMIN", label: "Admin" },
    { value: "OWNER", label: "Owner" },
  ];

  return (
    <>
      <Meta
        title={`${team.name} — Members`}
        description={`Manage members of ${team.name}`}
        CTA={
          <div className="flex gap-2">
            <Button color="secondary" onClick={() => setShowDeleteDialog(true)} StartIcon="trash-2">
              Delete team
            </Button>
            <Button color="primary" onClick={() => setShowInviteDialog(true)} StartIcon="plus">
              Invite member
            </Button>
          </div>
        }
      />

      {/* Members list */}
      <div className="bg-default border-subtle divide-subtle divide-y rounded-lg border">
        {members?.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Avatar
                size="sm"
                imageSrc={member.user.avatarUrl ?? undefined}
                alt={member.user.name ?? ""}
              />
              <div>
                <p className="text-emphasis text-sm font-medium">
                  {member.user.name || member.user.username}
                </p>
                <p className="text-subtle text-xs">{member.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={member.accepted ? "green" : "orange"}>
                {member.accepted ? member.role : "Pending"}
              </Badge>

              {member.accepted && (
                <Dropdown>
                  <DropdownMenuTrigger asChild>
                    <Button color="minimal" size="sm" StartIcon="ellipsis" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {roleOptions.map((role) => (
                      <DropdownMenuItem
                        key={role.value}
                        onClick={() =>
                          changeMemberRole.mutate({
                            teamId,
                            memberId: member.userId,
                            role: role.value as "MEMBER" | "ADMIN" | "OWNER",
                          })
                        }>
                        <span className={member.role === role.value ? "font-bold" : ""}>
                          Set as {role.label}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => removeMember.mutate({ teamId, memberId: member.userId })}
                      className="text-red-500">
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </Dropdown>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader title="Invite a team member" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteMember.mutate({
                teamId,
                usernameOrEmail: inviteEmail,
                role: inviteRole,
              });
            }}
            className="space-y-4">
            <TextField
              label="Email or username"
              placeholder="colleague@example.com"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <div>
              <label className="text-default mb-1 block text-sm font-medium">Role</label>
              <select
                className="border-default bg-default text-emphasis w-full rounded-md border p-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "ADMIN")}>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <Button color="secondary" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={inviteMember.isPending} disabled={!inviteEmail.trim()}>
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader title="Delete team" />
          <p className="text-subtle text-sm">
            Are you sure you want to delete <strong>{team.name}</strong>? This will remove all members and
            team event types. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button color="secondary" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button color="destructive" loading={deleteTeam.isPending} onClick={() => deleteTeam.mutate({ teamId })}>
              Delete team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
