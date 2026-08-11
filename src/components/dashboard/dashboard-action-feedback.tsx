"use client";

import { usePathname, useSearchParams } from "next/navigation";

const routeErrorMessages: Record<string, Record<string, string>> = {
  "/dashboard/catalog": {
    category: "Enter a category name of at least 2 characters.",
    "category-update": "Check the category name and template, then try again.",
    "template-not-found": "That option template is no longer available in this shop. Refresh the page and choose another template.",
    "category-exists": "A category with that name already exists in this shop. Use the existing category or choose a different name.",
  },
  "/dashboard/commerce": {
    zone: "Check the delivery-zone name, fee and estimated time, then try again.",
    coupon: "Check the coupon code and discount details. Percentage discounts cannot exceed 100%.",
    "coupon-usage-limit": "The new coupon usage limit cannot be lower than the number of times the coupon has already been used.",
    "return-workflow": "Choose a valid return status and keep the resolution note within the allowed length.",
    return: "That return request is no longer available in this shop. Refresh the page before continuing.",
    "return-transition": "That return status change is not allowed from the request's current state. Refresh and use one of the available next steps.",
    "return-changed": "That return request changed while you were working. Refresh the page and review its current state before trying again.",
  },
  "/dashboard/production-stock": {
    item: "Check the production-stock item details, quantities and unit cost, then try again.",
    variant: "That catalogue stock option is no longer available in this shop. Refresh and choose it again.",
    "item-duplicate": "That exact production-stock item already exists. Use the existing row instead of creating a duplicate.",
    adjustment: "Check the adjustment type, quantity and reason, then try again.",
    "adjustment-stock": "The stock adjustment could not be posted. The item may have changed or there may not be enough stock for that reduction. Refresh and review the current quantity.",
    payment: "Check the supplier payment amount and details, then try again.",
    supplier: "That supplier is no longer available in this shop. Refresh and choose another supplier.",
    return: "Check the supplier return item, quantity, unit cost and reason, then try again.",
    "return-tenant": "That supplier or production-stock item is no longer available in this shop. Refresh and choose again.",
    "return-stock": "The supplier return could not be posted because the stock state changed or the requested quantity is no longer available. Refresh and review the current stock.",
    cost: "Check every production-cost field and choose the reviewed job, garment stock and material stock again.",
    "cost-stock": "The reviewed job or selected production stock is no longer available. Refresh and choose the current records.",
    "cost-design": "The design linked to that reviewed production job is no longer available in this shop.",
    "cost-posted": "Inventory has already been posted for this production cost. Posted cost and stock history are locked against later edits.",
    post: "Choose a saved production cost before posting inventory.",
    "post-stock": "Inventory could not be posted for that production cost. Refresh and check that the required garment and material stock are still available.",
  },
  "/dashboard/closing": {
    invalid: "Check the business date, counted cash and closing amounts. Amounts cannot be negative and the counted cash field is required.",
  },
};

export function DashboardActionFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  if (!error) return null;

  const messages = routeErrorMessages[pathname];
  if (!messages) return null;
  const message = messages[error];
  if (!message) return null;

  return (
    <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800">
      {message}
    </div>
  );
}
