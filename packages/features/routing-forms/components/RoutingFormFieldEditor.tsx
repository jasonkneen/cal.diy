"use client";

import type { RoutingFormField } from "../lib/types";

type RoutingFormFieldEditorProps = {
  fields: RoutingFormField[];
  onChange: (fields: RoutingFormField[]) => void;
};

// Stubbed during routing-forms restoration. Original implementation depended on
// `@calcom/ui/components/switch` (removed) and several IconName / Button.variant
// values that no longer exist in the design system. Tracked in
// HANDOVER-routing-forms-restoration.md §3.2 — restore once the design-system
// surface settles.
export function RoutingFormFieldEditor(_props: RoutingFormFieldEditorProps) {
  return (
    <div className="border-subtle bg-muted text-subtle rounded-lg border p-6 text-sm">
      The routing form field editor is temporarily disabled. See
      HANDOVER-routing-forms-restoration.md §3.2.
    </div>
  );
}
