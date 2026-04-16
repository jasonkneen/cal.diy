"use client";

import { useState } from "react";
import { Icon } from "@calcom/ui/components/icon";
import { Button } from "@calcom/ui/components/button";
import { TextField } from "@calcom/ui/components/form";
import { TextAreaField } from "@calcom/ui/components/form";
import { SelectField } from "@calcom/ui/components/form";
import { CheckboxField } from "@calcom/ui/components/form";
import { Switch } from "@calcom/ui/components/switch";
import type { RoutingFormField, RoutingFormFieldType } from "@calcom/features/routing-forms/lib/types";
import { ROUTING_FORM_FIELD_TYPES, DEFAULT_ROUTING_ACTIONS } from "@calcom/features/routing-forms/lib/constants";

interface RoutingFormFieldEditorProps {
  fields: RoutingFormField[];
  onChange: (fields: RoutingFormField[]) => void;
}

export function RoutingFormFieldEditor({ fields, onChange }: RoutingFormFieldEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addField = () => {
    const newField: RoutingFormField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      options: [],
    };

    onChange([...fields, newField]);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  const updateField = (index: number, updates: Partial<RoutingFormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= fields.length) return;

    const newFields = [...fields];
    const [moved] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, moved);

    onChange(newFields);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveField(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="border-subtle flex items-center justify-between border-b pb-3">
        <h3 className="text-default font-semibold">Form Fields</h3>
        <Button size="sm" onClick={addField} StartIcon="plus">
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="bg-muted border-subtle rounded-lg border p-6 text-center">
          <Icon name="list" className="text-subtle mx-auto h-8 w-8" />
          <p className="text-subtle mt-2 text-sm">No fields yet. Add your first question.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`bg-muted border-subtle rounded-lg border p-4 transition-all ${
                draggedIndex === index ? "ring-2 ring-default opacity-50" : ""
              }`}>
              <div className="flex gap-4">
                {/* Drag handle */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <Icon name="grip-vertical" className="text-subtle h-4 w-4 cursor-grab" />
                </div>

                {/* Field config */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <TextField
                        label="Label"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Question label"
                        required
                      />
                    </div>

                    <SelectField
                      label="Type"
                      value={field.type}
                      onChange={(e) => {
                        const newType = e.target.value as RoutingFormFieldType;
                        const isSelectBased = ROUTING_FORM_FIELD_TYPES[newType].needsOptions;

                        updateField(index, {
                          type: newType,
                          options: isSelectBased ? ["Option 1", "Option 2"] : [],
                        });
                      }}
                      options={Object.keys(ROUTING_FORM_FIELD_TYPES).map((type) => ({
                        value: type,
                        label: ROUTING_FORM_FIELD_TYPES[type as RoutingFormFieldType].label,
                      }))}
                    />
                  </div>

                  {/* Placeholder */}
                  <TextField
                    label="Placeholder"
                    value={field.placeholder}
                    onChange={(e) => updateField(index, { placeholder: e.target.value })}
                    placeholder={ROUTING_FORM_FIELD_TYPES[field.type].placeholder}
                  />

                  {/* Required switch */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) => updateField(index, { required: checked })}
                    />
                    <label className="text-sm">This field is required</label>
                  </div>

                  {/* Options for select-based fields */}
                  {ROUTING_FORM_FIELD_TYPES[field.type].needsOptions && (
                    <div className="border-subtle rounded-lg border bg-white p-3">
                      <label className="text-subtle mb-2 block text-sm">Options</label>
                      <div className="space-y-2">
                        {(field.options ?? []).map((option, optionIndex) => (
                          <div key={optionIndex} className="flex gap-2">
                            <TextField
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(field.options ?? [])];
                                newOptions[optionIndex] = e.target.value;
                                updateField(index, { options: newOptions });
                              }}
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                            <Button
                              variant="minimal"
                              onClick={() => {
                                const newOptions = (field.options ?? []).filter(
                                  (_, i) => i !== optionIndex
                                );
                                updateField(index, { options: newOptions });
                              }}>
                              <Icon name="trash-2" className="text-subtle h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="minimal"
                          size="sm"
                          onClick={() => {
                            const newOptions = [...(field.options ?? []), `Option ${((field.options?.length ?? 0) + 1)}`];
                            updateField(index, { options: newOptions });
                          }}
                          StartIcon="plus">
                          Add Option
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <TextAreaField
                    label="Description (optional)"
                    value={field.description}
                    onChange={(e) => updateField(index, { description: e.target.value })}
                    placeholder="Help text for this field..."
                    rows={2}
                  />
                </div>

                {/* Remove button */}
                <div className="pr-2">
                  <Button
                    variant="minimal"
                    onClick={() => removeField(index)}
                    title="Delete field">
                    <Icon name="trash-2" className="text-muted-foreground hover:text-destructive h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}