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
import { RoutingFormFieldEditor } from "@calcom/features/routing-forms/components/RoutingFormFieldEditor";

import type { RoutingForm, RoutingFormField } from "@calcom/features/routing-forms/lib/types";
import { ROUTING_FORM_TEMPLATES } from "@calcom/features/routing-forms/lib/constants";

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
  const [editingForm, setEditingForm] = useState<RoutingForm>({
    id: crypto.randomUUID(),
    name: "",
    description: "",
    fields: [],
    actions: [],
    rules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // For existing forms, fetch it
  const { data: existingForm, isLoading } = trpc.viewer.routingForms.get.useQuery(
    { id: params.id || "" },
    {
      enabled: !isNew,
      refetchOnWindowFocus: false,
      onSuccess: (data) => {
        if (data) {
          setEditingForm({
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          });
        }
      },
    }
  );

  const createMutation = trpc.viewer.routingForms.create.useMutation({
    onSuccess: (result) => {
      showToast(`Routing form "${editingForm.name}" created`, "success");
      router.push(`/settings/routing-forms`);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const updateMutation = trpc.viewer.routingForms.update.useMutation({
    onSuccess: (result) => {
      showToast(`Routing form "${editingForm.name}" updated`, "success");
      router.push(`/settings/routing-forms`);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader" className="text-subtle h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const loadTemplate = (templateKey: keyof typeof ROUTING_FORM_TEMPLATES) => {
    const template = ROUTING_FORM_TEMPLATES[templateKey];
    setEditingForm({
      ...editingForm,
      name: template.name,
      description: template.description,
      fields: template.fields,
      actions: template.actions,
      rules: template.rules || [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formToSubmit = {
      name: editingForm.name,
      description: editingForm.description,
      fields: editingForm.fields,
      actions: editingForm.actions,
      rules: editingForm.rules,
    };

    if (isNew) {
      createMutation.mutate(formToSubmit as any);
    } else {
      updateMutation.mutate({
        id: editingForm.id,
        ...formToSubmit,
      });
    }
  };

  const tabs: { id: ActiveTab; label: string; icon: string }[] = [
    { id: "info", label: "Info", icon: "info" },
    { id: "fields", label: "Fields", icon: "list" },
    { id: "actions", label: "Actions", icon: "arrow-right" },
    { id: "rules", label: "Rules", icon: "git-branch" },
  ];

  const saveDisabled = !editingForm.name.trim() || editingForm.fields.length === 0;

  return (
    <div className="flex h-full max-w-5xl flex-col">
      <Meta
        title={isNew ? "New routing form" : editingForm.name}
        description="Create and manage routing forms to direct bookings."
        borderInBottom
        trailingAccessory={
          !isPending && (
            <div className="flex gap-2">
              <Button
                variant="minimal"
                onClick={() => { /* Save as template feature */ }}
                color="minimal">
                Save as Template
              </Button>
              <div className="relative">
                <Button
                  variant="minimal"
                  onClick={() => { /* Load template dropdown logic */ }}
                  color="minimal">
                  <Icon name="file-text" className="mr-2 h-4 w-4" />
                  Load Template
                </Button>
              </div>
            </div>
          )
        }
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
            <TextField
              label="Form Name"
              value={editingForm.name}
              onChange={(e) =>
                setEditingForm({
                  ...editingForm,
                  name: e.target.value,
                })
              }
              placeholder="Contact Form, Support Inquiry, etc."
              required
            />

            <TextAreaField
              label="Description (optional)"
              value={editingForm.description}
              onChange={(e) =>
                setEditingForm({
                  ...editingForm,
                  description: e.target.value,
                })
              }
              placeholder="Describe what this form collects and how it routes bookings..."
              rows={4}
            />
          </div>
        )}

        {activeTab === "fields" && (
          <div className="max-w-5xl">
            <RoutingFormFieldEditor
              fields={editingForm.fields}
              onChange={(fields) =>
                setEditingForm({
                  ...editingForm,
                  fields,
                })
              }
            />
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
          <Button
            type="button"
            onClick={handleSubmit}
            loading={isPending}
            disabled={saveDisabled}
            color="primary">
            {saveDisabled && "Add at least one field to "}
            {isNew ? "Create" : "Save"} Routing Form
          </Button>
        </div>
      </div>
    </div>
  );
}