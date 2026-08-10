import type { Prisma } from "@prisma/client";
import type { ProductionGarmentSpec, ProductionPlacementSpec } from "@/lib/production-specs";

export const MAX_CUSTOMER_ARTWORK_BYTES = 5 * 1024 * 1024;
export const CUSTOMER_ARTWORK_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function customerArtworkMimeAllowed(mimeType: string) {
  return CUSTOMER_ARTWORK_MIME_TYPES.includes(mimeType.toLowerCase() as (typeof CUSTOMER_ARTWORK_MIME_TYPES)[number]);
}

export function customerArtworkBytesMatchMime(bytes: Uint8Array, mimeType: string) {
  const type = mimeType.toLowerCase();
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function placementBox(location: string) {
  const code = location.toUpperCase();
  if (code.includes("BACK")) return { x: 118, y: 145, width: 164, height: 170, label: "Back" };
  if (code.includes("LEFT") && code.includes("CHEST")) return { x: 120, y: 126, width: 82, height: 80, label: "Left chest" };
  if (code.includes("RIGHT") && code.includes("CHEST")) return { x: 198, y: 126, width: 82, height: 80, label: "Right chest" };
  if (code.includes("SLEEVE")) return { x: 62, y: 150, width: 58, height: 90, label: "Sleeve" };
  return { x: 105, y: 118, width: 190, height: 190, label: "Front" };
}

export function buildCustomerProductionPreview(input: {
  title: string;
  garment: Pick<ProductionGarmentSpec, "name" | "colour" | "garmentType">;
  size: string;
  placement: Pick<ProductionPlacementSpec, "name" | "location">;
  requestedText?: string | null;
  requestedNumber?: string | null;
  previewNote?: string | null;
}) {
  const box = placementBox(input.placement.location);
  const text = escapeXml(input.requestedText?.trim() || "ARTWORK");
  const number = escapeXml(input.requestedNumber?.trim() || "");
  const garmentName = escapeXml(`${input.garment.name} · ${input.size}`);
  const placementName = escapeXml(input.placement.name || box.label);
  const title = escapeXml(input.title);
  const note = escapeXml(input.previewNote?.trim() || "Concept preview — final production follows the approved Design Studio artwork and production brief.");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" role="img" aria-label="${title}">
  <rect width="400" height="520" fill="#f8fafc"/>
  <text x="24" y="34" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#0f172a">${title}</text>
  <text x="24" y="56" font-family="Arial,sans-serif" font-size="12" fill="#475569">${garmentName}</text>
  <path d="M145 82 L112 108 L50 144 L76 224 L112 209 L112 445 L288 445 L288 209 L324 224 L350 144 L288 108 L255 82 C244 103 224 114 200 114 C176 114 156 103 145 82 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/>
  <rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="8" fill="#ffffff" fill-opacity="0.72" stroke="#0891b2" stroke-width="3" stroke-dasharray="8 6"/>
  <text x="${box.x + box.width / 2}" y="${box.y + 24}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#0e7490">${placementName}</text>
  <text x="${box.x + box.width / 2}" y="${box.y + box.height / 2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.max(12, Math.min(24, 220 / Math.max(text.length, 5)))}" font-weight="800" fill="#111827">${text}</text>
  ${number ? `<text x="${box.x + box.width / 2}" y="${box.y + box.height / 2 + 38}" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="900" fill="#111827">${number}</text>` : ""}
  <rect x="24" y="466" width="352" height="34" rx="8" fill="#ecfeff" stroke="#a5f3fc"/>
  <text x="34" y="487" font-family="Arial,sans-serif" font-size="10" fill="#155e75">${note.slice(0, 125)}</text>
</svg>`;
}

export function jsonSnapshot<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export function paidOrderAmount(payments: Array<{ amount: { toString(): string } | number; status: string }>) {
  return payments
    .filter((payment) => payment.status === "SUCCESS")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

export function customerProductionBalance(input: { quotedTotal: number; depositAmount: number; paidAmount: number }) {
  const quotedTotal = Math.max(0, input.quotedTotal);
  const depositAmount = Math.min(quotedTotal, Math.max(0, input.depositAmount));
  const paidAmount = Math.max(0, input.paidAmount);
  return {
    quotedTotal,
    depositAmount,
    paidAmount,
    depositDue: Math.max(0, depositAmount - paidAmount),
    balanceDue: Math.max(0, quotedTotal - paidAmount),
    depositSatisfied: paidAmount + 0.005 >= depositAmount,
    fullyPaid: paidAmount + 0.005 >= quotedTotal,
  };
}
