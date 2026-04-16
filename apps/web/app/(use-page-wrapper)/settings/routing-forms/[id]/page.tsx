"use client";

export default function RoutingFormEditorPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-emphasis text-xl font-semibold">Routing Form Editor</h1>
      <p className="text-subtle text-sm">
        The routing form editor UI is being rebuilt. Use the tRPC API
        <code className="ml-1">viewer.routingForms.create</code> /
        <code className="ml-1">viewer.routingForms.update</code> in the meantime.
      </p>
      <p className="text-subtle text-sm">
        See <code>HANDOVER-routing-forms-restoration.md</code> §3.2 for the list of UI errors that
        need fixing before this view can be re-enabled.
      </p>
    </div>
  );
}
