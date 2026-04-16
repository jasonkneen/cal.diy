"use client";

export default function RoutingFormsSettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-emphasis text-xl font-semibold">Routing Forms</h1>
      <p className="text-subtle text-sm">
        The routing forms management UI is being rebuilt. The underlying API is fully functional and
        available via tRPC at <code>viewer.routingForms.*</code>.
      </p>
      <p className="text-subtle text-sm">
        See <code>HANDOVER-routing-forms-restoration.md</code> for status and next steps.
      </p>
    </div>
  );
}
