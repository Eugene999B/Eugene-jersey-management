import { format } from "date-fns";

export function currency(amount: number | string, code = "GHS") {
  const value = typeof amount === "string" ? Number(amount) : amount;

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function shortDate(value: Date | string) {
  return format(new Date(value), "MMM d, yyyy");
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
