"use client";

import Link from "next/link";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { Icon } from "@calcom/ui/components/icon";
import { showToast } from "@calcom/ui/components/toast";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";

const TRIGGER_LABELS: Record<string, string> = {
  BEFORE_EVENT: "Before Event",
  EVENT_CANCELLED: "Event Cancelled",
  NEW_EVENT: "New Event",
  AFTER_EVENT: "After Event",
  RESCHEDULE_EVENT: "Rescheduled",
};

const TRIGGER_VARIANTS: Record<string, "success" | "error" | "blue" | "orange" | "gray"> = {
  BEFORE_EVENT: "blue",
  EVENT_CANCELLED: "error",
  NEW_EVENT: "success",
  AFTER_EVENT: "orange",
  RESCHEDULE_EVENT: "gray",
};

export default function WorkflowsSettingsPage() {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const { data: workflows, isLoading } = trpc.viewer.workflows.list.useQuery();

  const deleteWorkflow = trpc.viewer.workflows.delete.useMutation({
    onSuccess: () => {
      showToast("Workflow deleted", "success");
      utils.viewer.workflows.list.invalidate();
    },
    onError: (err) => {
      showToast(err.message, "error");
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
    <SettingsHeader
      title="Workflows"
      description="Automate notifications and reminders for your events."
      CTA={
        <Button href="/settings/workflows/new" StartIcon="plus" color="primary">
          New workflow
        </Button>
      }>
      {!workflows || workflows.length === 0 ? (
        <EmptyScreen
          Icon="zap"
          headline="No workflows yet"
          description="Create a workflow to automate email notifications, SMS reminders, and more for your events."
          buttonRaw={
            <Button href="/settings/workflows/new" StartIcon="plus" color="primary">
              Create your first workflow
            </Button>
          }
        />
      ) : (
        <div className="bg-default border-subtle divide-subtle divide-y rounded-lg border">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="hover:bg-subtle flex items-center justify-between p-4 transition-colors">
              <Link href={`/settings/workflows/new?edit=${workflow.id}`} className="flex flex-1 items-center gap-4">
                <div className="bg-emphasis flex h-10 w-10 items-center justify-center rounded-full">
                  <Icon name="zap" className="text-emphasis h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-emphasis font-medium">{workflow.name}</p>
                  <div className="text-subtle flex items-center gap-2 text-sm">
                    <Badge variant={TRIGGER_VARIANTS[workflow.trigger] || "gray"}>
                      {TRIGGER_LABELS[workflow.trigger] || workflow.trigger}
                    </Badge>
                    {workflow.time && workflow.timeUnit && (
                      <span>
                        {workflow.time} {workflow.timeUnit.toLowerCase()}
                        {workflow.time !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span>·</span>
                    <span>
                      {workflow.stepCount} step{workflow.stepCount !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>
                      {workflow.isActiveOnAll
                        ? "All event types"
                        : `${workflow.activeOnCount} event type${workflow.activeOnCount !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  color="destructive"
                  StartIcon="trash-2"
                  variant="icon"
                  loading={deleteWorkflow.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm("Are you sure you want to delete this workflow?")) {
                      deleteWorkflow.mutate({ workflowId: workflow.id });
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsHeader>
  );
}
