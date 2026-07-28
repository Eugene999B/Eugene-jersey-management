import "server-only";

import { resolveMx } from "node:dns/promises";

const EMAIL_TIMEOUT_MS = Math.max(3_000, Math.min(30_000, Number(process.env.EMAIL_PROVIDER_TIMEOUT_MS ?? 12_000)));

export type TransactionalEmailInput = {
  to: string;
  recipientName: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  tags?: Record<string, string>;
};

export function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailAddressDomain(value: string) {
  const email = normaliseEmail(value);
  const at = email.lastIndexOf("@");
  return at > 0 && at < email.length - 1 ? email.slice(at + 1) : null;
}

export function transactionalEmailConfig() {
  return {
    provider: (process.env.EMAIL_PROVIDER ?? "console").trim().toLowerCase(),
    apiKey: process.env.RESEND_API_KEY?.trim() || null,
    from: process.env.EMAIL_FROM?.trim() || null,
  };
}

export function isEmailDeliveryConfigured() {
  const config = transactionalEmailConfig();
  return config.provider === "resend" && Boolean(config.apiKey && config.from);
}

export function configuredSenderDomain() {
  const from = transactionalEmailConfig().from;
  if (!from) return null;
  const match = from.match(/<([^<>]+)>\s*$/);
  return emailAddressDomain(match?.[1] ?? from);
}

export async function recipientDomainAcceptsMail(value: string) {
  const domain = emailAddressDomain(value);
  if (!domain) return false;
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MX_TIMEOUT")), EMAIL_TIMEOUT_MS)),
    ]);
    return records.some((record) => Boolean(record.exchange));
  } catch {
    return false;
  }
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const config = transactionalEmailConfig();
  if (config.provider !== "resend" || !config.apiKey || !config.from) {
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  const to = normaliseEmail(input.to);
  if (!(await recipientDomainAcceptsMail(to))) throw new Error("EMAIL_DOMAIN_NOT_DELIVERABLE");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
      "User-Agent": "Eugene-Jersey-Management/1.0",
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      tags: input.tags
        ? Object.entries(input.tags).map(([name, value]) => ({ name: name.slice(0, 256), value: value.slice(0, 256) }))
        : undefined,
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  if (!response.ok || !payload?.id) {
    const message = payload?.message?.replace(/[\r\n\t]+/g, " ").slice(0, 160) ?? `HTTP_${response.status}`;
    throw new Error(`EMAIL_PROVIDER_${message}`);
  }
  return { providerReference: payload.id, recipient: to };
}