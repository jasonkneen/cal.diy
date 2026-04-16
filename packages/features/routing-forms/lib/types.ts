import { ZotActorType } from "@calcom/prisma/enums";

export type RoutingFormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiSelect"
  | "phone"
  | "email"
  | "number"
  | "date"
  | "radio"
  | "checkbox"
  | "hidden";

export interface RoutingFormField {
  id: string;
  label: string;
  type: RoutingFormFieldType;
  required: boolean;
  options?: string[]; // For select/multiSelect/radio/checkbox
  placeholder?: string;
  defaultValue?: string;
  description?: string;
  validation?: {
    pattern?: string; // Regex for validation
    min?: number;
    max?: number;
  };
}

export interface RoutingAction {
  id: string;
  actorType: ZotActorType;
  actorId?: number | null; // Team id (null if individual)
  userId?: number | null; // User id (null if team)
  eventTypeIds?: number[]; // Route to specific event types
  position: number; // Order for display
  selected: boolean;
}

export interface RoutingRule {
  id: string;
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "starts_with" | "ends_with" | "regex";
  value: string;
}

export interface RoutingForm {
  id: string;
  name: string;
  description?: string;
  fields: RoutingFormField[];
  actions: RoutingAction[];
  rules?: RoutingRule[]; // Conditional routing rules
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingFormResponse {
  id: string;
  formId: string;
  responses: Record<string, string>; // fieldId → value
  userId?: number;
  createdAt: Date;
}

export type RoutingFormSaveInput = {
  name: string;
  description?: string;
  fields: RoutingFormField[];
  actions: RoutingAction[];
  rules?: RoutingRule[];
};

export type RoutingFormUpdateInput = Partial<RoutingFormSaveInput>;