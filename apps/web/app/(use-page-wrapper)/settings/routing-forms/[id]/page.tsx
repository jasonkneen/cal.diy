"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";
import { Meta } from "@calcom/ui/components/meta";
import { TextField } from "@calcom/ui/components/form";
import { TextAreaField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

type ActiveTab = "info" | "fields" | "actions" | "rules";

export default function RoutingFormEditorPage({
  params,
}: {
  params: { id?: string };
}) {
  const { t } = useLocale();
  const router = useRouter();
  const isNew = !params.id;

  const [activeTab, setActiveTab] = useState<ActiveTab>("info");

  // For existing form, fetch it
  const { data: existingForm } = trpc.viewer.routingForms.get.useQuery(
    { id: params.id || "" },
    { enabled: !isNew, refetchOnWindowFocus: false }
  );

  const createMutation = trpc.viewer.routingForms.create.useMutation({
    onSuccess: (result) => {
      showToast("Routing form created", "success");
      router.push(`/settings/routing-forms`);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const updateMutation = trpc.viewer.routingForms.update.useMutation({
    onSuccess: (result) => {
      showToast("Routing form updated", "success");
      router.push(`/settings/routing-forms`);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  if (!isNew && !existingForm) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader" className="text-subtle h-6 w-6 animate-spin" />
      </div>
    );
  }

  const form = existingForm || { id: "", name: "", description: "" };
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNew) {
      createMutation.mutate({
        name: form.name,
        description: form.description,
        fields: [],
        actions: [],
        rules: [],
      });
    } else {
      updateMutation.mutate({
        id: form.id,
        name: form.name,
        description: form.description,
      });
    }
  };

  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "info", label: "Info", icon: "info" },
    { id: "fields", label: "Fields", icon: "list" },
    { id: "actions", label: "Actions", icon: "arrow-right" },
    { id: "rules", label: "Rules", icon: "git-branch" },
  ];

  return (
    <div className="flex h-full max-w-5xl flex-col">
      <Meta
        title={isNew ? "New routing form" : form.name}
        description="Create and manage routing forms to direct bookings."
        borderInBottom
      />

      <div className="flex flex-1 flex-col gap-6 pt-6">
        {/* Tabs */}
        <div className="border-subtle flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-default text-default"
                  : "border-transparent text-subtle hover:text-default"
              }`}>
              <span className="mr-2">
                <Icon name={tab.icon as any} className="inline h-4 w-4" />
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "info" && (
          <div className="max-w-2xl space-y-4">
            <TextField label="Name" value={form.name} onChange={(e) => form.name = e.target.value} />

            <TextAreaField
              label="Description"
              value={form.description}
              onChange={(e) => form.description = e.target.value}
              placeholder="Describe what this routing form collects and where it routes bookings..."
              rows={4}
            />
          </div>
        )}

        {activeTab === "fields" && (
          <div className="bg-muted border-subtle rounded-lg border p-8 text-center">
            <Icon name="list" className="text-subtle mx-auto h-12 w-12" />
            <h3 className="text-default mt-4 text-lg font-medium">Fields editor coming soon</h3>
            <p className="text-subtle mt-2">
              Add questions to collect information from bookers. Supports text, email, phone, dropdown, etc.
            </p>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="bg-muted border-subtle rounded-lg border p-8 text-center">
            <Icon name="arrow-right" className="text-subtle mx-auto h-12 w-12" />
            <h3 className="text-default mt-4 text-lg font-medium">Actions editor coming soon</h3>
            <p className="text-subtle mt-2">
              Configure where bookings route: to specific event types, team members, or organizations.
            </p>
          </div>
        )}

        {activeTab === "rules" && (
          <div className="bg-muted border-subtle rounded-lg border p-8 text-center">
            <Icon name="git-branch" className="text-subtle mx-auto h-12 w-12" />
            <h3 className="text-default mt-4 text-lg font-medium">Rules editor coming soon</h3>
            <p className="text-subtle mt-2">
              Define conditional routing: if a user selects X, route to Y.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="minimal" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} loading={isPending} color="primary">
            {isNew ? "Create routing form" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}