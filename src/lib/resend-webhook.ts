import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export type ParsedResendWebhook = {
  eventType: string;
  occurredAt: Date;
  providerReference: string | null;
  detail: string | null;
  safePayload: Record<string, unknown>;
};

function signingKey(secret: string) {
  const value = secret.trim();
  if (!value.startsWith("whsec_")) throw new Error("INVALID_RESEND_WEBHOOK_SECRET");
  const encoded = value.slice("whsec_".length);
  const key = Buffer.from(encoded, "base64");
  if (!key.length) throw new Error("INVALID_RESEND_WEBHOOK_SECRET");
  return key;
}

function signatureCandidates(header: string) {
  return header
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const separator = part.indexOf(",");
      if (separator <= 0 || part.slice(0, separator) !== "v1") return [];
      const encoded = part.slice(separator + 1);
      try {
        return [Buffer.from(encoded, "base64")];
      } catch {
        return [];
      }
    });
}

export function verifyResendWebhookSignature(input: {
  payload: string;
  headers: ResendWebhookHeaders;
  secret: string;
  nowSeconds?: number;
}) {
  if (!input.headers.id || !input.headers.timestamp || !input.headers.signature) return false;
  const timestamp = Number(input.headers.timestamp);
  if (!Number.isInteger(timestamp)) return false;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  let expected: Buffer;
  try {
    expected = createHmac("sha256", signingKey(input.secret))
      .update(`${input.headers.id}.${input.headers.timestamp}.${input.payload}`)
      .digest();
  } catch {
    return false;
  }

  return signatureCandidates(input.headers.signature).some(
    (candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected),
  );
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").slice(0, 300) : null;
}

export function parseResendWebhookPayload(payload: string): ParsedResendWebhook | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const eventType = safeText(record.type);
  const occurredAt = typeof record.created_at === "string" ? new Date(record.created_at) : null;
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : {};
  if (!eventType || !occurredAt || Number.isNaN(occurredAt.getTime())) return null;

  const providerReference = safeText(data.email_id);
  const bounce = data.bounce && typeof data.bounce === "object" && !Array.isArray(data.bounce)
    ? data.bounce as Record<string, unknown>
    : {};
  const detail = safeText(bounce.message)
    ?? safeText(data.message)
    ?? safeText(data.error)
    ?? safeText(data.reason);
  const tags = data.tags && typeof data.tags === "object" && !Array.isArray(data.tags)
    ? Object.fromEntries(Object.entries(data.tags as Record<string, unknown>).flatMap(([key, value]) => {
        const safeValue = safeText(value);
        return safeValue ? [[key.slice(0, 100), safeValue]] : [];
      }))
    : {};

  return {
    eventType,
    occurredAt,
    providerReference,
    detail,
    safePayload: {
      type: eventType,
      emailId: providerReference,
      occurredAt: occurredAt.toISOString(),
      detail,
      tags,
    },
  };
}