import type { RoutingAction, RoutingForm, RoutingRule } from "../lib/types";

/**
 * Evaluates routing rules against form responses to determine which actions
 * (routing destinations) should be presented to the user.
 */
export class RoutingFormEvaluator {
  /**
   * Evaluate form responses against routing rules and return matching actions.
   *
   * @param form - The routing form definition
   * @param responses - User responses to form fields
   * @returns Array of matching routing actions (ordered by position)
   */
  static evaluateRoutingResponses(form: RoutingForm, responses: Record<string, string>): RoutingAction[] {
    // If no rules exist, return all actions (or only the first if routing without rules)
    if (!form.rules || form.rules.length === 0) {
      // Default behavior: return first action or all selected actions
      return form.actions.filter((action) => action.selected);
    }

    const matchingActions: RoutingAction[] = [];

    // Evaluate each rule against the responses
    for (const rule of form.rules) {
      const responseValue = responses[rule.fieldId] || "";

      const ruleMatches = this.evaluateRule(rule, responseValue);

      if (ruleMatches) {
        // Find actions associated with this rule
        // For now, we associate rules to actions implicitly by the rule's fieldId
        // In a more advanced system, you might have rule.actionId references
        matchingActions.push(...this.getActionsForRule(form, rule));
      }
    }

    // If no rules matched, return default actions (first or all selected)
    if (matchingActions.length === 0) {
      return form.actions.filter((action) => action.selected).slice(0, 1);
    }

    // Remove duplicates and sort by position
    const uniqueActions = Array.from(
      matchingActions
        .reduce((map, action) => {
          if (!map.has(action.id)) {
            map.set(action.id, action);
          }
          return map;
        }, new Map<string, RoutingAction>())
        .values()
    );

    return uniqueActions.sort((a, b) => a.position - b.position);
  }

  /**
   * Evaluate a single routing rule against a value.
   */
  private static evaluateRule(rule: RoutingRule, value: string): boolean {
    switch (rule.operator) {
      case "equals":
        return value.toLowerCase() === rule.value.toLowerCase();

      case "not_equals":
        return value.toLowerCase() !== rule.value.toLowerCase();

      case "contains":
        return value.toLowerCase().includes(rule.value.toLowerCase());

      case "not_contains":
        return !value.toLowerCase().includes(rule.value.toLowerCase());

      case "starts_with":
        return value.toLowerCase().startsWith(rule.value.toLowerCase());

      case "ends_with":
        return value.toLowerCase().endsWith(rule.value.toLowerCase());

      case "regex":
        try {
          const regex = new RegExp(rule.value, "i");
          return regex.test(value);
        } catch (error) {
          // Invalid regex - treat as no match
          console.warn(`Invalid regex in routing rule: ${rule.value}`);
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Get actions that should be triggered for a matching rule.
   *
   * This is a simplified version. In production, you might have explicit
   * rule-to-action mappings via rule.actionId.
   */
  private static getActionsForRule(form: RoutingForm, rule: RoutingRule): RoutingAction[] {
    // For now, return selected actions that have event types defined
    // This assumes that rules are field-specific and actions are tied to fields
    return form.actions.filter((action) => action.selected && action.eventTypeIds?.length);
  }

  /**
   * Validate that all required fields in a form have non-empty responses.
   */
  static validateRequiredFields(form: RoutingForm, responses: Record<string, string>): {
    valid: boolean;
    errors: Record<string, string>; // fieldId: string -> error message
  } {
    const errors: Record<string, string> = {};

    form.fields.forEach((field) => {
      if (field.required && !responses[field.id]?.trim()) {
        errors[field.id] = `${field.label} is required`;
      }

      // Validate email format for email fields
      if (field.type === "email" && responses[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(responses[field.id])) {
          errors[field.id] = `${field.label}: Invalid email address`;
        }
      }

      // Validate phone format if validation pattern is specified
      if (field.validation?.pattern && responses[field.id]) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(responses[field.id])) {
          errors[field.id] = `${field.label}: Invalid format`;
        }
      }

      // Validate min/max for number fields
      if (field.type === "number" && responses[field.id]) {
        const value = parseFloat(responses[field.id]);
        if (!isNaN(value)) {
          if (field.validation?.min !== undefined && value < field.validation.min) {
            errors[field.id] = `${field.label}: Must be at least ${field.validation.min}`;
          }
          if (field.validation?.max !== undefined && value > field.validation.max) {
            errors[field.id] = `${field.label}: Must be at most ${field.validation.max}`;
          }
        }
      }
    });

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Substitute template variables in form field text.
   *
   * Variables supported: {{name}}, {{email}}, {{date}}, etc.
   */
  static substitutePlaceholders(text: string, context: {
    userName?: string;
    userEmail?: string;
    date?: Date;
  }): string {
    let result = text;

    if (context.userName) {
      result = result.replace(/\{\{userName\}\}/g, context.userName);
    }

    if (context.userEmail) {
      result = result.replace(/\{\{userEmail\}\}/g, context.userEmail);
    }

    if (context.date) {
      const formattedDate = context.date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      result = result.replace(/\{\{date\}\}/g, formattedDate);
    }

    return result;
  }

  /**
   * Calculate which routing action should be chosen when multiple match.
   *
   * Priority: First match wins (rules are evaluated in order).
   */
  static selectPrimaryAction(actions: RoutingAction[]): RoutingAction | null {
    if (actions.length === 0) {
      return null;
    }

    // Sort by position and return first
    return actions.sort((a, b) => a.position - b.position)[0];
  }
}