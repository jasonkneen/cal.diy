"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";
import { TextField } from "@calcom/ui/components/form";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { TextAreaField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

const TRIGGERS = [
  { value: "BEFORE_EVENT", label: "Before Event" },
  { value: "EVENT_CANCELLED", label: "Event Cancelled" },
  { value: "NEW_EVENT", label: "New Event" },
  { value: "AFTER_EVENT", label: "After Event" },
  { value: "RESCHEDULE_EVENT", label: "Rescheduled Event" },
] as const;

const TIME_UNITS = [
  { value: "MINUTE", label: "Minutes" },
  { value: "HOUR", label: "Hours" },
  { value: "DAY", label: "Days" },
] as const;

const ACTIONS = [
  { value: "EMAIL_HOST", label: "Email to Host" },
  { value: "EMAIL_ATTENDEE", label: "Email to Attendee" },
  { value: "EMAIL_ADDRESS", label: "Email to Address" },
  { value: "SMS_ATTENDEE", label: "SMS to Attendee" },
  { value: "SMS_NUMBER", label: "SMS to Number" },
  { value: "WHATSAPP_ATTENDEE", label: "WhatsApp to Attendee" },
  { value: "WHATSAPP_NUMBER", label: "WhatsApp to Number" },
] as const;

const TEMPLATES = [
  { value: "CUSTOM", label: "Custom" },
  { value: "REMINDER", label: "Reminder" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "COMPLETED", label: "Completed" },
] as const;

type StepInput = {
  stepNumber: number;
  action: string;
  sendTo: string;
  reminderBody: string;
  emailSubject: string;
  template: string;
  sender: string;
  includeCalendarEvent: boolean;
};

function emptyStep(stepNumber: number): StepInput {
  return {
    stepNumber,
    action: "EMAIL_HOST",
    sendTo: "",
    reminderBody: "",
    emailSubject: "",
    template: "CUSTOM",
    sender: "",
    includeCalendarEvent: false,
  };
}

export default function CreateWorkflowPage() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<string>("NEW_EVENT");
  const [time, setTime] = useState<number>(10);
  const [timeUnit, setTimeUnit] = useState<string>("MINUTE");
  const [isActiveOnAll, setIsActiveOnAll] = useState(false);
  const [steps, setSteps] = useState<StepInput[]>([emptyStep(1)]);
  const [loaded, setLoaded] = useState(!editId);

  // Load existing workflow data if editing
  const { isLoading: isLoadingWorkflow } = trpc.viewer.workflows.get.useQuery(
    { workflowId: Number(editId) },
    {
      enabled: !!editId,
      onSuccess: (data) => {
        if (data && !loaded) {
          setName(data.name);
          setTrigger(data.trigger);
          setTime(data.time ?? 10);
          setTimeUnit(data.timeUnit ?? "MINUTE");
          setIsActiveOnAll(data.isActiveOnAll);
          setSteps(
            data.steps.map((s) => ({
              stepNumber: s.stepNumber,
              action: s.action,
              sendTo: s.sendTo ?? "",
              reminderBody: s.reminderBody ?? "",
              emailSubject: s.emailSubject ?? "",
              template: s.template ?? "CUSTOM",
              sender: s.sender ?? "",
              includeCalendarEvent: s.includeCalendarEvent ?? false,
            }))
          );
          setLoaded(true);
        }
      },
    }
  );

  const createWorkflow = trpc.viewer.workflows.create.useMutation({
    onSuccess: (workflow) => {
      showToast(`Workflow "${workflow.name}" created!`, "success");
      router.push("/settings/workflows");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const updateWorkflow = trpc.viewer.workflows.update.useMutation({
    onSuccess: (workflow) => {
      showToast(`Workflow "${workflow.name}" updated!`, "success");
      router.push("/settings/workflows");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const showTimeFields = trigger === "BEFORE_EVENT" || trigger === "AFTER_EVENT";

  const addStep = () => {
    setSteps((prev) => [...prev, emptyStep(prev.length + 1)]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const updateStep = (index: number, field: keyof StepInput, value: string | boolean) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const needsSendTo = (action: string) =>
    action === "EMAIL_ADDRESS" || action === "SMS_NUMBER" || action === "WHATSAPP_NUMBER";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name,
      trigger: trigger as "BEFORE_EVENT" | "EVENT_CANCELLED" | "NEW_EVENT" | "AFTER_EVENT" | "RESCHEDULE_EVENT",
      ...(showTimeFields ? { time, timeUnit: timeUnit as "DAY" | "HOUR" | "MINUTE" } : {}),
      isActiveOnAll,
      steps: steps.map((s) => ({
        stepNumber: s.stepNumber,
        action: s.action as "EMAIL_HOST" | "EMAIL_ATTENDEE" | "SMS_ATTENDEE" | "SMS_NUMBER" | "EMAIL_ADDRESS" | "WHATSAPP_ATTENDEE" | "WHATSAPP_NUMBER",
        ...(s.sendTo ? { sendTo: s.sendTo } : {}),
        ...(s.reminderBody ? { reminderBody: s.reminderBody } : {}),
        ...(s.emailSubject ? { emailSubject: s.emailSubject } : {}),
        template: s.template as "REMINDER" | "CUSTOM" | "CANCELLED" | "RESCHEDULED" | "COMPLETED",
        ...(s.sender ? { sender: s.sender } : {}),
        includeCalendarEvent: s.includeCalendarEvent,
      })),
    };

    if (editId) {
      updateWorkflow.mutate({ ...payload, workflowId: Number(editId) });
    } else {
      createWorkflow.mutate(payload);
    }
  };

  if (editId && !loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="loader" className="text-subtle h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <SettingsHeader
      title={editId ? "Edit Workflow" : "Create Workflow"}
      description={editId ? "Edit your automation workflow." : "Set up a new automation workflow for your events."}>
      <div className="bg-default border-subtle mx-auto max-w-2xl rounded-lg border p-6">
        <h2 className="text-emphasis mb-6 text-xl font-semibold">
          {editId ? "Edit workflow" : "Create a new workflow"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <TextField
            label="Workflow name"
            placeholder="e.g., Meeting reminder"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Trigger */}
          <div>
            <label className="text-emphasis mb-1 block text-sm font-medium">Trigger</label>
            <select
              className="border-default bg-default text-emphasis w-full rounded-md border px-3 py-2 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time fields - only for BEFORE_EVENT / AFTER_EVENT */}
          {showTimeFields && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-emphasis mb-1 block text-sm font-medium">Time</label>
                <input
                  type="number"
                  min={1}
                  className="border-default bg-default text-emphasis w-full rounded-md border px-3 py-2 text-sm"
                  value={time}
                  onChange={(e) => setTime(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex-1">
                <label className="text-emphasis mb-1 block text-sm font-medium">Unit</label>
                <select
                  className="border-default bg-default text-emphasis w-full rounded-md border px-3 py-2 text-sm"
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(e.target.value)}>
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Active on all toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActiveOnAll"
              checked={isActiveOnAll}
              onChange={(e) => setIsActiveOnAll(e.target.checked)}
              className="border-default rounded"
            />
            <label htmlFor="isActiveOnAll" className="text-emphasis text-sm font-medium">
              Active on all event types
            </label>
          </div>

          {/* Steps */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-emphasis text-base font-semibold">Steps</h3>
              <Button type="button" size="sm" color="secondary" StartIcon="plus" onClick={addStep}>
                Add step
              </Button>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="border-subtle bg-subtle rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-emphasis text-sm font-medium">Step {step.stepNumber}</span>
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        color="destructive"
                        variant="icon"
                        StartIcon="trash-2"
                        onClick={() => removeStep(index)}
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Action */}
                    <div>
                      <label className="text-emphasis mb-1 block text-sm font-medium">Action</label>
                      <select
                        className="border-default bg-default text-emphasis w-full rounded-md border px-3 py-2 text-sm"
                        value={step.action}
                        onChange={(e) => updateStep(index, "action", e.target.value)}>
                        {ACTIONS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Template */}
                    <div>
                      <label className="text-emphasis mb-1 block text-sm font-medium">Template</label>
                      <select
                        className="border-default bg-default text-emphasis w-full rounded-md border px-3 py-2 text-sm"
                        value={step.template}
                        onChange={(e) => updateStep(index, "template", e.target.value)}>
                        {TEMPLATES.map((tmpl) => (
                          <option key={tmpl.value} value={tmpl.value}>
                            {tmpl.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Send to - only for specific actions */}
                    {needsSendTo(step.action) && (
                      <TextField
                        label={step.action === "EMAIL_ADDRESS" ? "Email address" : "Phone number"}
                        placeholder={step.action === "EMAIL_ADDRESS" ? "user@example.com" : "+1234567890"}
                        value={step.sendTo}
                        onChange={(e) => updateStep(index, "sendTo", e.target.value)}
                      />
                    )}

                    {/* Subject - for email actions */}
                    {step.action.startsWith("EMAIL") && (
                      <TextField
                        label="Email subject"
                        placeholder="Your upcoming meeting reminder"
                        value={step.emailSubject}
                        onChange={(e) => updateStep(index, "emailSubject", e.target.value)}
                      />
                    )}

                    {/* Body */}
                    <TextAreaField
                      label="Message body"
                      placeholder="Hi {ATTENDEE_NAME}, this is a reminder about your upcoming meeting..."
                      value={step.reminderBody}
                      onChange={(e) => updateStep(index, "reminderBody", e.target.value)}
                      rows={3}
                    />

                    {/* Sender name */}
                    <TextField
                      label="Sender name (optional)"
                      placeholder="Cal.diy"
                      value={step.sender}
                      onChange={(e) => updateStep(index, "sender", e.target.value)}
                    />

                    {/* Include calendar event */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`includeCalEvent-${index}`}
                        checked={step.includeCalendarEvent}
                        onChange={(e) => updateStep(index, "includeCalendarEvent", e.target.checked)}
                        className="border-default rounded"
                      />
                      <label htmlFor={`includeCalEvent-${index}`} className="text-emphasis text-sm">
                        Include calendar event (.ics)
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" color="secondary" onClick={() => router.push("/settings/workflows")}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createWorkflow.isPending || updateWorkflow.isPending}
              disabled={!name.trim() || steps.length === 0}>
              {editId ? "Update workflow" : "Create workflow"}
            </Button>
          </div>
        </form>
      </div>
    </SettingsHeader>
  );
}
