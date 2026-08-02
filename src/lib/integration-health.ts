import "server-only";

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { platformDb } from "@/lib/platform-db";
import { getScheduledJobState, RESERVATION_RELEASE_JOB_KEY } from "@/lib/scheduled-jobs";

export type IntegrationHealthState = "healthy" | "attention" | "unconfigured" | "unreachable";

export type IntegrationHealthCheck = {
  key: "database" | "paystack" | "arkesel" | "whatsapp" | "media" | "reservations";
  label: string;
  state: IntegrationHealthState;
  configured: boolean;
  reachable: boolean | null;
  detail: string;
  checkedAt: string;
  responseTimeMs: number;
  metadata: Record<string, unknown>;
};

export type ShopPaystackHealth = {
  state: IntegrationHealthState;
  detail: string;
  checkedAt: string;
  responseTimeMs: number;
  metadata: {
    subaccountCode?: string;
    businessName?: string;
    settlementBank?: string;
    settlementAccountMasked?: string;
    settlementAccountName?: string;
    currency?: string;
    percentageCharge?: number;
    active?: boolean;
    verified?: boolean;
    domain?: string;
  };
};

const DEFAULT_TIMEOUT_MS = 8_000;

function timeoutMs() {
  const configured = Number(process.env.INTEGRATION_HEALTH_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.max(3_000, Math.min(20_000, configured)) : DEFAULT_TIMEOUT_MS;
}

function nowIso() {
  return new Date().toISOString();
}

function safeMessage(value: unknown, fallback: string) {
  const message = typeof value === "string" ? value : fallback;
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}

function maskAccount(value: unknown) {
  if (typeof value !== "string" || value.length < 4) return undefined;
  return `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY?.trim() || null;
}

function paystackMode(secret: string) {
  if (secret.startsWith("sk_live_")) return "live";
  if (secret.startsWith("sk_test_")) return "test";
  return "unknown";
}

async function providerJson(url: string, headers: HeadersInit) {
  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs()),
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  return { response, payload };
}

export async function checkDatabaseHealth(): Promise<IntegrationHealthCheck> {
  const started = Date.now();
  try {
    await platformDb.$queryRaw`SELECT 1`;
    return {
      key: "database",
      label: "PostgreSQL database",
      state: "healthy",
      configured: true,
      reachable: true,
      detail: "The production database accepted a read-only query.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: {},
    };
  } catch {
    return {
      key: "database",
      label: "PostgreSQL database",
      state: "unreachable",
      configured: true,
      reachable: false,
      detail: "The production database did not accept the health query.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: {},
    };
  }
}

export async function checkPaystackHealth(): Promise<IntegrationHealthCheck> {
  const started = Date.now();
  const secret = paystackSecret();
  const accountLabel = process.env.PAYSTACK_PLATFORM_ACCOUNT_LABEL?.trim() || "ESM administrator main account";
  if (!secret) {
    return {
      key: "paystack",
      label: "Paystack platform account",
      state: "unconfigured",
      configured: false,
      reachable: null,
      detail: "The administrator Paystack secret key is missing.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { accountLabel },
    };
  }

  try {
    const { response, payload } = await providerJson("https://api.paystack.co/balance", {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    });
    const status = payload?.status === true;
    if (!response.ok || !status) {
      return {
        key: "paystack",
        label: "Paystack platform account",
        state: "unreachable",
        configured: true,
        reachable: false,
        detail: safeMessage(payload?.message, `Paystack rejected the read-only balance check with HTTP ${response.status}.`),
        checkedAt: nowIso(),
        responseTimeMs: Date.now() - started,
        metadata: { accountLabel, mode: paystackMode(secret), httpStatus: response.status },
      };
    }

    const balances = Array.isArray(payload?.data)
      ? payload.data.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const record = entry as Record<string, unknown>;
          if (typeof record.currency !== "string" || typeof record.balance !== "number") return [];
          return [{ currency: record.currency.toUpperCase(), amount: record.balance / 100 }];
        })
      : [];

    return {
      key: "paystack",
      label: "Paystack platform account",
      state: "healthy",
      configured: true,
      reachable: true,
      detail: "The administrator main Paystack account accepted a read-only authenticated request.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { accountLabel, mode: paystackMode(secret), balances },
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      key: "paystack",
      label: "Paystack platform account",
      state: "unreachable",
      configured: true,
      reachable: false,
      detail: timedOut ? "The Paystack health check timed out." : "The Paystack health check could not reach the provider.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { accountLabel, mode: paystackMode(secret) },
    };
  }
}

export async function checkArkeselHealth(): Promise<IntegrationHealthCheck> {
  const started = Date.now();
  const provider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const key = process.env.ARKESEL_API_KEY?.trim();
  const sender = process.env.ARKESEL_SENDER_ID?.trim();

  if (provider !== "arkesel" || !key || !sender) {
    return {
      key: "arkesel",
      label: "Arkesel SMS",
      state: "unconfigured",
      configured: false,
      reachable: null,
      detail: provider === "arkesel"
        ? "Arkesel is selected but its API key or sender ID is missing."
        : `SMS is currently using ${provider} mode instead of Arkesel.`,
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider, senderConfigured: Boolean(sender) },
    };
  }

  try {
    const { response, payload } = await providerJson("https://sms.arkesel.com/api/v2/clients/balance-details", {
      "api-key": key,
      "Content-Type": "application/json",
    });
    const success = response.ok && payload?.status === "success";
    if (!success) {
      return {
        key: "arkesel",
        label: "Arkesel SMS",
        state: "unreachable",
        configured: true,
        reachable: false,
        detail: safeMessage(payload?.message, `Arkesel rejected the balance check with HTTP ${response.status}.`),
        checkedAt: nowIso(),
        responseTimeMs: Date.now() - started,
        metadata: { provider, sender, httpStatus: response.status },
      };
    }

    const data = payload?.data && typeof payload.data === "object"
      ? payload.data as Record<string, unknown>
      : {};
    const numericSmsBalance = typeof data.sms_balance === "string" || typeof data.sms_balance === "number"
      ? Number(data.sms_balance)
      : null;
    const smsBalance = numericSmsBalance !== null && Number.isFinite(numericSmsBalance) ? numericSmsBalance : null;
    const state: IntegrationHealthState = smsBalance !== null && smsBalance <= 20 ? "attention" : "healthy";

    return {
      key: "arkesel",
      label: "Arkesel SMS",
      state,
      configured: true,
      reachable: true,
      detail: state === "attention"
        ? "Arkesel is reachable, but the remaining SMS balance is low."
        : "Arkesel accepted a read-only authenticated balance request.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider, sender, smsBalance, mainBalance: data.main_balance ?? null },
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      key: "arkesel",
      label: "Arkesel SMS",
      state: "unreachable",
      configured: true,
      reachable: false,
      detail: timedOut ? "The Arkesel health check timed out." : "The Arkesel health check could not reach the provider.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider, sender },
    };
  }
}

export async function checkWhatsAppHealth(): Promise<IntegrationHealthCheck> {
  const started = Date.now();
  const provider = (process.env.WHATSAPP_PROVIDER ?? "console").toLowerCase();
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const healthUrl = process.env.WHATSAPP_HEALTH_URL?.trim();

  if (provider === "console" || !token) {
    return {
      key: "whatsapp",
      label: "WhatsApp",
      state: "unconfigured",
      configured: false,
      reachable: null,
      detail: provider === "console"
        ? "WhatsApp remains in console mode and cannot deliver production messages."
        : "The WhatsApp provider token is missing.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider },
    };
  }

  if (!healthUrl) {
    return {
      key: "whatsapp",
      label: "WhatsApp",
      state: "attention",
      configured: true,
      reachable: null,
      detail: "WhatsApp credentials are present, but no separate read-only WHATSAPP_HEALTH_URL is configured.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider },
    };
  }

  try {
    const candidate = new URL(healthUrl);
    if (candidate.protocol !== "https:") throw new Error("INSECURE_HEALTH_URL");
    const response = await fetch(candidate, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs()),
    });
    return {
      key: "whatsapp",
      label: "WhatsApp",
      state: response.ok ? "healthy" : "unreachable",
      configured: true,
      reachable: response.ok,
      detail: response.ok
        ? "The configured WhatsApp read-only health endpoint responded successfully."
        : `The WhatsApp health endpoint responded with HTTP ${response.status}.`,
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider, httpStatus: response.status, healthHost: candidate.host },
    };
  } catch (error) {
    const insecure = error instanceof Error && error.message === "INSECURE_HEALTH_URL";
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      key: "whatsapp",
      label: "WhatsApp",
      state: insecure ? "attention" : "unreachable",
      configured: true,
      reachable: insecure ? null : false,
      detail: insecure
        ? "WHATSAPP_HEALTH_URL must use HTTPS."
        : timedOut
          ? "The WhatsApp health check timed out."
          : "The WhatsApp health endpoint could not be reached.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider },
    };
  }
}

function mediaConfig() {
  const provider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase();
  return {
    provider,
    endpoint: process.env.S3_ENDPOINT ?? process.env.R2_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION ?? process.env.R2_REGION ?? "auto",
    bucket: process.env.S3_BUCKET ?? process.env.R2_BUCKET,
    publicUrl: process.env.MEDIA_PUBLIC_URL,
  };
}

export async function checkMediaHealth(): Promise<IntegrationHealthCheck> {
  const started = Date.now();
  const config = mediaConfig();
  if (config.provider === "local") {
    const allowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_EPHEMERAL_MEDIA === "true";
    return {
      key: "media",
      label: "Durable media storage",
      state: allowed ? "attention" : "unconfigured",
      configured: allowed,
      reachable: null,
      detail: process.env.NODE_ENV === "production"
        ? "Media is using local Railway storage, which is ephemeral across redeployments."
        : "Media is using local development storage.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider: config.provider },
    };
  }

  const missing = [
    ["endpoint", config.endpoint],
    ["access key", config.accessKeyId],
    ["secret key", config.secretAccessKey],
    ["bucket", config.bucket],
    ["public URL", config.publicUrl],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (!(["s3", "r2"].includes(config.provider)) || missing.length) {
    return {
      key: "media",
      label: "Durable media storage",
      state: "unconfigured",
      configured: false,
      reachable: null,
      detail: missing.length
        ? `The ${config.provider.toUpperCase()} configuration is missing: ${missing.join(", ")}.`
        : `Unsupported media provider: ${config.provider}.`,
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider: config.provider },
    };
  }

  try {
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId!, secretAccessKey: config.secretAccessKey! },
      forcePathStyle: true,
      requestHandler: undefined,
    });
    await client.send(new HeadBucketCommand({ Bucket: config.bucket! }), {
      abortSignal: AbortSignal.timeout(timeoutMs()),
    });
    return {
      key: "media",
      label: "Durable media storage",
      state: "healthy",
      configured: true,
      reachable: true,
      detail: `${config.provider.toUpperCase()} accepted a read-only bucket request.`,
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider: config.provider, bucket: config.bucket, publicUrlConfigured: true },
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      key: "media",
      label: "Durable media storage",
      state: "unreachable",
      configured: true,
      reachable: false,
      detail: timedOut ? "The storage health check timed out." : "The configured storage bucket could not be reached or authorised.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider: config.provider, bucket: config.bucket },
    };
  }
}

export async function checkReservationJobHealth(): Promise<IntegrationHealthCheck> {
  const started = Date.now();
  const token = (process.env.JOBS_API_TOKEN ?? process.env.JOB_SECRET)?.trim();
  const expectedMinutesRaw = Number(process.env.RESERVATION_JOB_INTERVAL_MINUTES ?? 15);
  const expectedMinutes = Number.isFinite(expectedMinutesRaw)
    ? Math.max(5, Math.min(24 * 60, expectedMinutesRaw))
    : 15;
  const state = await getScheduledJobState(RESERVATION_RELEASE_JOB_KEY).catch(() => null);

  if (!token || token.length < 32) {
    return {
      key: "reservations",
      label: "Reservation release job",
      state: "unconfigured",
      configured: false,
      reachable: null,
      detail: "The scheduler bearer token is missing or shorter than 32 characters.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { expectedIntervalMinutes: expectedMinutes },
    };
  }

  if (!state?.lastSucceededAt) {
    return {
      key: "reservations",
      label: "Reservation release job",
      state: "attention",
      configured: true,
      reachable: null,
      detail: "The scheduler is authenticated, but no successful reservation-release heartbeat has been recorded yet.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { expectedIntervalMinutes: expectedMinutes, lastStartedAt: state?.lastStartedAt?.toISOString() ?? null },
    };
  }

  const ageMinutes = (Date.now() - state.lastSucceededAt.getTime()) / 60_000;
  const failedAfterSuccess = Boolean(state.lastFailedAt && state.lastFailedAt > state.lastSucceededAt);
  const stale = ageMinutes > expectedMinutes * 2 + 5;
  const stateValue: IntegrationHealthState = failedAfterSuccess || stale ? "attention" : "healthy";

  return {
    key: "reservations",
    label: "Reservation release job",
    state: stateValue,
    configured: true,
    reachable: true,
    detail: failedAfterSuccess
      ? "The most recent scheduler run failed after the last successful heartbeat."
      : stale
        ? "The scheduler heartbeat is older than the allowed interval."
        : "The reservation-release scheduler is reporting successful heartbeats.",
    checkedAt: nowIso(),
    responseTimeMs: Date.now() - started,
    metadata: {
      expectedIntervalMinutes: expectedMinutes,
      lastStartedAt: state.lastStartedAt?.toISOString() ?? null,
      lastSucceededAt: state.lastSucceededAt.toISOString(),
      lastFailedAt: state.lastFailedAt?.toISOString() ?? null,
      lastDurationMs: state.lastDurationMs,
      lastResult: state.lastResult,
      lastError: state.lastError,
    },
  };
}

export async function getProductionIntegrationHealth() {
  const checks = await Promise.all([
    checkDatabaseHealth(),
    checkPaystackHealth(),
    checkArkeselHealth(),
    checkWhatsAppHealth(),
    checkMediaHealth(),
    checkReservationJobHealth(),
  ]);
  const healthy = checks.filter((check) => check.state === "healthy").length;
  const attention = checks.filter((check) => check.state === "attention").length;
  const unconfigured = checks.filter((check) => check.state === "unconfigured").length;
  const unreachable = checks.filter((check) => check.state === "unreachable").length;
  return { checks, summary: { total: checks.length, healthy, attention, unconfigured, unreachable }, checkedAt: nowIso() };
}

export async function checkShopPaystackSubaccount(subaccountCode: string | null | undefined): Promise<ShopPaystackHealth> {
  const started = Date.now();
  const code = subaccountCode?.trim();
  const secret = paystackSecret();
  if (!code) {
    return {
      state: "unconfigured",
      detail: "This shop does not have a Paystack subaccount code.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: {},
    };
  }
  if (!secret) {
    return {
      state: "unconfigured",
      detail: "The administrator Paystack account is not configured.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { subaccountCode: code },
    };
  }

  try {
    const { response, payload } = await providerJson(`https://api.paystack.co/subaccount/${encodeURIComponent(code)}`, {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    });
    const data = payload?.data && typeof payload.data === "object"
      ? payload.data as Record<string, unknown>
      : null;
    if (!response.ok || payload?.status !== true || !data) {
      return {
        state: "unreachable",
        detail: safeMessage(payload?.message, `Paystack could not verify this shop subaccount (HTTP ${response.status}).`),
        checkedAt: nowIso(),
        responseTimeMs: Date.now() - started,
        metadata: { subaccountCode: code },
      };
    }

    const active = data.active === true || data.active === 1;
    const verified = data.is_verified === true;
    return {
      state: active && verified ? "healthy" : "attention",
      detail: !active
        ? "The Paystack subaccount exists but is inactive."
        : !verified
          ? "The Paystack subaccount exists but Paystack has not marked it verified."
          : "Paystack confirmed this shop-owned settlement subaccount.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: {
        subaccountCode: typeof data.subaccount_code === "string" ? data.subaccount_code : code,
        businessName: typeof data.business_name === "string" ? data.business_name : undefined,
        settlementBank: typeof data.settlement_bank === "string" ? data.settlement_bank : undefined,
        settlementAccountMasked: maskAccount(data.account_number),
        settlementAccountName: typeof data.account_name === "string" ? data.account_name : undefined,
        currency: typeof data.currency === "string" ? data.currency : undefined,
        percentageCharge: typeof data.percentage_charge === "number" ? data.percentage_charge : undefined,
        active,
        verified,
        domain: typeof data.domain === "string" ? data.domain : undefined,
      },
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      state: "unreachable",
      detail: timedOut ? "The shop subaccount check timed out." : "The shop subaccount could not be reached for verification.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { subaccountCode: code },
    };
  }
}
