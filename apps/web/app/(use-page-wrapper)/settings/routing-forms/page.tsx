"use client";

import Link from "next/link";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { Icon } from "@calcom/ui/components/icon";
import { Meta } from "@calcom/ui/components/meta";
import { showToast } from "@calcom/ui/components/toast";

export default function RoutingFormsSettingsPage() {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const { data: forms, isLoading } = trpc.viewer.routingForms.list.useQuery();

  const deleteForm = trpc.viewer.routingForms.delete.useMutation({
    onSuccess: () => {
      showToast("Routing form deleted", "success");
      utils.viewer.routingForms.list.invalidate();
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
    <>
      <Meta
        title={t("routing_forms")}
        description="Create routing forms to collect information and route bookings to the right event type or team member."
        CTA={
          <Button href="/settings/routing-forms/new" StartIcon="plus" color="primary">
            New routing form
          </Button>
        }
      />

      {!forms || forms.items.length === 0 ? (
        <EmptyScreen
          Icon="layout-grid"
          headline="No routing forms yet"
          description="Create a routing form to ask questions before booking and intelligently route to event types or team members."
          buttonRaw={
            <Button href="/settings/routing-forms/new" StartIcon="plus" color="primary">
              Create your first routing form
            </Button>
          }
        />
      ) : (
        <div className="bg-default border-subtle divide-subtle divide-y rounded-lg border">
          {forms.items.map((form) => (
            <div
              key={form.id}
              className="hover:bg-subtle flex items-center justify-between p-4 transition-colors">
              <Link href={`/settings/routing-forms/${form.id}`} className="flex flex-1 items-center gap-4">
                <div className="bg-emphasis flex h-10 w-10 items-center justify-center rounded-full">
                  <Icon name="layout-grid" className="text-emphasis h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-emphasis font-medium">{form.name}</p>
                  {form.description && (
                    <p className="text-subtle line-clamp-1 text-sm">{form.description}</p>
                  )}
                  <div className="text-subtle flex items-center gap-4 text-sm">
                    <span>{form.fields.length} fields</span>
                    {form.actions.length > 0 && <span>· {form.actions.length} actions</span>}
                    {form.rules && form.rules.length > 0 && <span>· {form.rules.length} rules</span>}
                  </div>
                </div>
              </Link>
              <Button
                variant="minimal"
                onClick={() => {
                  if (window.confirm("Delete this routing form?")) {
                    deleteForm.mutate({ id: form.id });
                  }
                }}>
                <Icon name="trash-2" className="h-4 w-4 text-default" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}