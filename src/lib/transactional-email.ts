import "server-only";

import { createHash } from "node:crypto";
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

export function emailAddressFromHeader(value: string | null) {
  if (!value) return null;
  const match = value.match(/<([^<>]+)>\s*$/);
  const email = normaliseEmail(match?.[1] ?? value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function transactionalEmailConfig() {
  const from = process.env.EMAIL_FROM?.trim() || null;
  return {
    provider: (process.env.EMAIL_PROVIDER ?? "console").trim().toLowerCase(),
    apiKey: process.env.RESEND_API_KEY?.trim() || null,
    from,
    senderEmail: emailAddressFromHeader(from),
    gmailClientId: process.env.GMAIL_CLIENT_ID?.trim() || null,
    gmailClientSecret: process.env.GMAIL_CLIENT_SECRET?.trim() || null,
    gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN?.trim() || null,
  };
}

export function isEmailDeliveryConfigured() {
  const config = transactionalEmailConfig();
  if (config.provider === "resend") return Boolean(config.apiKey && config.from && config.senderEmail);
  if (config.provider === "gmail") {
    return Boolean(config.from && config.senderEmail && config.gmailClientId && config.gmailClientSecret && config.gmailRefreshToken);
  }
  return false;
}

export function configuredSenderDomain() {
  const sender = transactionalEmailConfig().senderEmail;
  return sender ? emailAddressDomain(sender) : null;
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

function safeProviderMessage(value: unknown, fallback: string) {
  return (typeof value === "string" ? value : fallback).replace(/[\r\n\t]+/g, " ").slice(0, 180);
}

function safeHeader(value: string, max = 998) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function encodedHeader(value: string) {
  const safe = safeHeader(value, 500);
  return /^[\x20-\x7E]*$/.test(safe) ? safe : `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

function wrappedBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function gmailMimeMessage(input: TransactionalEmailInput, from: string, senderEmail: string) {
  const digest = createHash("sha256").update(input.idempotencyKey).digest("hex");
  const boundary = `ejm-${digest.slice(0, 32)}`;
  const senderDomain = emailAddressDomain(senderEmail) ?? "gmail.com";
  const messageId = `<ejm-${digest.slice(0, 40)}@${senderDomain}>`;

  return [
    `From: ${safeHeader(from)}`,
    `To: ${safeHeader(normaliseEmail(input.to))}`,
    `Subject: ${encodedHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `X-ESM-Idempotency-Key: ${safeHeader(input.idempotencyKey, 256)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(input.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrappedBase64(input.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function gmailAccessToken() {
  const config = transactionalEmailConfig();
  if (!config.gmailClientId || !config.gmailClientSecret || !config.gmailRefreshToken) {
    throw new Error("GMAIL_OAUTH_NOT_CONFIGURED");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.gmailClientId,
      client_secret: config.gmailClientSecret,
      refresh_token: config.gmailRefreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(`GMAIL_OAUTH_${safeProviderMessage(payload?.error_description ?? payload?.error, `HTTP_${response.status}`)}`);
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? null,
    scope: payload.scope ?? "",
  };
}

export async function gmailAuthenticatedIdentity(accessToken?: string) {
  const token = accessToken ?? (await gmailAccessToken()).accessToken;
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    email?: string;
    email_verified?: boolean;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !payload?.email) {
    throw new Error(`GMAIL_IDENTITY_${safeProviderMessage(payload?.error_description ?? payload?.error, `HTTP_${response.status}`)}`);
  }
  return { email: normaliseEmail(payload.email), verified: payload.email_verified === true };
}

async function sendWithResend(input: TransactionalEmailInput, to: string) {
  const config = transactionalEmailConfig();
  if (!config.apiKey || !config.from) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
      "User-Agent": "Eugene-Shop-Management/1.0",
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
    throw new Error(`EMAIL_PROVIDER_${safeProviderMessage(payload?.message, `HTTP_${response.status}`)}`);
  }
  return { providerReference: payload.id, recipient: to };
}

async function sendWithGmail(input: TransactionalEmailInput, to: string) {
  const config = transactionalEmailConfig();
  if (!config.from || !config.senderEmail) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  const token = await gmailAccessToken();
  const raw = Buffer.from(gmailMimeMessage(input, config.from, config.senderEmail), "utf8").toString("base64url");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Eugene-Shop-Management/1.0",
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    id?: string;
    threadId?: string;
    error?: { message?: string; status?: string };
  } | null;
  if (!response.ok || !payload?.id) {
    throw new Error(`EMAIL_PROVIDER_${safeProviderMessage(payload?.error?.message ?? payload?.error?.status, `HTTP_${response.status}`)}`);
  }
  return { providerReference: payload.id, recipient: to };
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const config = transactionalEmailConfig();
  if (!isEmailDeliveryConfigured()) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

  const to = normaliseEmail(input.to);
  if (!(await recipientDomainAcceptsMail(to))) throw new Error("EMAIL_DOMAIN_NOT_DELIVERABLE");

  if (config.provider === "resend") return sendWithResend(input, to);
  if (config.provider === "gmail") return sendWithGmail(input, to);
  throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
}
