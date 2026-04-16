// Routing form field types with their labels and configuration
export const ROUTING_FORM_FIELD_TYPES = {
  text: {
    label: "Text",
    icon: "type",
    placeholder: "Enter your answer",
  },
  textarea: {
    label: "Paragraph",
    icon: "file-text",
    placeholder: "Enter a longer answer",
  },
  select: {
    label: "Dropdown",
    icon: "chevron-down",
    multiple: false,
    needsOptions: true,
  },
  multiSelect: {
    label: "Multiple Choice",
    icon: "check-square",
    multiple: true,
    needsOptions: true,
  },
  radio: {
    label: "Radio Buttons",
    icon: "radio",
    multiple: false,
    needsOptions: true,
  },
  checkbox: {
    label: "Checkboxes",
    icon: "check",
    multiple: true,
    needsOptions: true,
  },
  phone: {
    label: "Phone Number",
    icon: "phone",
    placeholder: "+1 (555) 000-0000",
    validation: {
      pattern: "^[+]?[0-9\\s-()]+$",
    },
  },
  email: {
    label: "Email Address",
    icon: "mail",
    placeholder: "you@example.com",
    validation: {
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    },
  },
  number: {
    label: "Number",
    icon: "hash",
    placeholder: "0",
    validation: {
      min: 0,
    },
  },
  date: {
    label: "Date",
    icon: "calendar",
  },
  hidden: {
    label: "Hidden",
    icon: "eye-off",
  },
} as const;

// Operator types for conditional routing
export const ROUTING_RULE_OPERATORS = {
  equals: {
    label: "is",
    description: "Exact match",
  },
  not_equals: {
    label: "is not",
    description: "Does not match",
  },
  contains: {
    label: "contains",
    description: "Contains text",
  },
  not_contains: {
    label: "does not contain",
    description: "Doesn't contain text",
  },
  starts_with: {
    label: "starts with",
    description: "Starts with text",
  },
  ends_with: {
    label: "ends with",
    description: "Ends with text",
  },
  regex: {
    label: "matches pattern",
    description: "Regex pattern match",
  },
} as const;

// Default action options
export const DEFAULT_ROUTING_ACTIONS = {
  position: 0,
  selected: false,
};

// Template routing forms
export const ROUTING_FORM_TEMPLATES = {
  BASIC: {
    name: "Basic Contact Form",
    description: "Simple routing form to collect name, email, and route to team members",
    fields: [
      {
        id: "name",
        label: "Your Name",
        type: "text",
        required: true,
        placeholder: "John Doe",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: true,
        placeholder: "john@example.com",
      },
    ],
    actions: [],
    rules: [],
  },
  DETAILED: {
    name: "Detailed Inquiry Form",
    description: "Collects detailed information with multi-step routing",
    fields: [
      {
        id: "name",
        label: "Your Name",
        type: "text",
        required: true,
        placeholder: "John Doe",
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: true,
        placeholder: "john@example.com",
      },
      {
        id: "topic",
        label: "What is this about?",
        type: "select",
        required: true,
        options: [
          "General Inquiry",
          "Technical Support",
          "Sales Question",
          "Billing Issue",
        ],
      },
      {
        id: "details",
        label: "Please provide more details",
        type: "textarea",
        required: true,
        placeholder: "Describe your request in detail...",
      },
    ],
    actions: [],
    rules: [],
  },
} as const;