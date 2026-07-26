import type { NextRequest } from "next/server";

function normalizedOrigin(value: string | undefined | null) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).origin;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function publicRequestOrigin(request: NextRequest) {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstForwardedValue(request.headers.get("host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  if (host) {
    const protocol = forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : new URL(request.url).protocol.replace(":", "");
    return `${protocol}://${host}`;
  }
  return new URL(request.url).origin;
}

export function trustedApplicationOrigins(request: NextRequest) {
  const origins = new Set<string>([
    new URL(request.url).origin,
    publicRequestOrigin(request),
  ]);

  for (const value of [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ]) {
    const origin = normalizedOrigin(value);
    if (origin) origins.add(origin);
  }

  return origins;
}

export function isTrustedApplicationOrigin(request: NextRequest) {
  const header = request.headers.get("origin");
  if (!header) return true;
  const origin = normalizedOrigin(header);
  return Boolean(origin && trustedApplicationOrigins(request).has(origin));
}
