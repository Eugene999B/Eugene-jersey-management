export const ORDER_WORKFLOW_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const ORDER_APPROVAL_STATUSES = ["NOT_REQUIRED", "PENDING", "APPROVED", "CHANGES_REQUESTED"] as const;
export const ORDER_WORKFLOW_EVENT_TYPES = [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "PRIORITY_CHANGED",
  "DUE_DATE_CHANGED",
  "APPROVAL_CHANGED",
  "INSTRUCTIONS_CHANGED",
  "FINANCE_TARGET_CHANGED",
  "NOTE_ADDED",
  "FULFILLMENT_UPDATED",
  "CANCELLED",
] as const;

export type OrderWorkflowPriority = (typeof ORDER_WORKFLOW_PRIORITIES)[number];
export type OrderApprovalStatus = (typeof ORDER_APPROVAL_STATUSES)[number];
export type OrderWorkflowEventType = (typeof ORDER_WORKFLOW_EVENT_TYPES)[number];
