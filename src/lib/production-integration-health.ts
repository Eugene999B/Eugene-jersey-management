import "server-only";

import {
  getProductionIntegrationHealth as getBaseProductionIntegrationHealth,
  type IntegrationHealthCheck,
  type IntegrationHealthState,
} from "@/lib/integration-health";
import {
  configuredSenderDomain,
  transactionalEmailConfig,
} from "@/lib/transactional-email";

export type ProductionIntegrationKey = IntegrationHealthCheck["key"] | "email";
export type ProductionIntegrationHealthCheck = Omit<IntegrationHealthCheck, "key"> & {
  key: ProductionIntegrationKey;
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

export async function checkTransactionalEmailHealth(): Promise<ProductionIntegrationHealthCheck> {
  const started = Date.now();
  const config = transactionalEmailConfig();
  const senderDomain = configuredSenderDomain();

  if (config.provider !== "resend" || !config.apiKey || !config.from || !senderDomain) {
    const missing = [
      config.provider === "resend" ? null : "EMAIL_PROVIDER=resend",
      config.apiKey ? null : "RESEND_API_KEY",
      config.from ? null : "EMAIL_FROM",
      senderDomain ? null : "valid sender domain",
    ].filter(Boolean).join(", ");
    return {
      key: "email",
      label: "Transactional email",
      state: "unconfigured",
      configured: false,
      reachable: null,
      detail: `Transactional email is not ready. Missing or invalid: ${missing}.`,
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider: config.provider, senderDomain: senderDomain ?? "Not configured" },
    };
  }

  try {
    const response = await fetch("https://api.resend.com/domains?limit=100", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        "User-Agent": "Eugene-Jersey-Management/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs()),
    });
    const payload = await response.json().catch(() => null) as {
      message?: string;
      data?: Array<{
        name?: string;
        status?: string;
        capabilities?: { sending?: string };
      }>;
    } | null;

    if (!response.ok || !Array.isArray(payload?.data)) {
      return {
        key: "email",
        label: "Transactional email",
        state: "unreachable",
        configured: true,
        reachable: false,
        detail: safeMessage(payload?.message, `Resend rejected the read-only domain check with HTTP ${response.status}.`),
        checkedAt: nowIso(),
        responseTimeMs: Date.now() - started,
        metadata: { provider: "resend", senderDomain, httpStatus: response.status },
      };
    }

    const domain = payload.data.find((item) => item.name?.toLowerCase() === senderDomain.toLowerCase());
    const domainStatus = domain?.status?.toLowerCase() ?? "not-found";
    const sendingCapability = domain?.capabilities?.sending?.toLowerCase() ?? "unknown";
    const ready = domainStatus === "verified" && sendingCapability === "enabled";
    const state: IntegrationHealthState = ready ? "healthy" : "attention";

    return {
      key: "email",
      label: "Transactional email",
      state,
      configured: true,
      reachable: true,
      detail: ready
        ? "Resend authenticated successfully and confirmed the configured sending domain is verified for sending."
        : domain
          ? `Resend authenticated successfully, but ${senderDomain} is ${domainStatus} with sending ${sendingCapability}.`
          : `Resend authenticated successfully, but ${senderDomain} was not found in the account domain list.`,
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: {
        provider: "resend",
        senderDomain,
        domainStatus,
        sendingCapability,
        domainFound: Boolean(domain),
      },
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      key: "email",
      label: "Transactional email",
      state: "unreachable",
      configured: true,
      reachable: false,
      detail: timedOut ? "The Resend health check timed out." : "The Resend health check could not reach the provider.",
      checkedAt: nowIso(),
      responseTimeMs: Date.now() - started,
      metadata: { provider: "resend", senderDomain },
    };
  }
}

export async function getProductionIntegrationHealth() {
  const [base, email] = await Promise.all([
    getBaseProductionIntegrationHealth(),
    checkTransactionalEmailHealth(),
  ]);
  const checks: ProductionIntegrationHealthCheck[] = [...base.checks, email];
  return {
    checks,
    summary: {
      total: checks.length,
      healthy: checks.filter((check) => check.state === "healthy").length,
      attention: checks.filter((check) => check.state === "attention").length,
      unconfigured: checks.filter((check) => check.state === "unconfigured").length,
      unreachable: checks.filter((check) => check.state === "unreachable").length,
    },
    checkedAt: new Date().toISOString(),
  };
}