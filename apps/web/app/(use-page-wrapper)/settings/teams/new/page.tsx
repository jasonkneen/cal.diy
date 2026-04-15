"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Meta } from "@calcom/ui/components/meta";
import { TextField } from "@calcom/ui/components/form";
import { TextAreaField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default function CreateTeamPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const createTeam = trpc.viewer.teams.create.useMutation({
    onSuccess: (team) => {
      showToast(`Team "${team.name}" created!`, "success");
      router.push(`/settings/teams/${team.id}/members`);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  return (
    <>
      <Meta title="Create a Team" description="Set up a new team for collaborative scheduling." />

      <div className="bg-default border-subtle mx-auto max-w-lg rounded-lg border p-6">
        <h2 className="text-emphasis mb-6 text-xl font-semibold">Create a new team</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTeam.mutate({
              name,
              slug: slug || slugify(name),
              bio: bio || undefined,
            });
          }}
          className="space-y-4">
          <TextField
            label="Team name"
            placeholder="My Team"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugManuallyEdited) {
                setSlug(slugify(e.target.value));
              }
            }}
          />

          <TextField
            label="Team URL"
            addOnLeading={`${typeof window !== "undefined" ? window.location.origin : ""}/team/`}
            placeholder="my-team"
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugManuallyEdited(true);
            }}
          />

          <TextAreaField
            label="About (optional)"
            placeholder="Tell people about your team..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button color="secondary" onClick={() => router.push("/settings/teams")}>
              Cancel
            </Button>
            <Button type="submit" loading={createTeam.isPending} disabled={!name.trim()}>
              Create team
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
