import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port: string;
  pathname: string;
};

function normalizedOrigin(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).origin;
  } catch {
    return null;
  }
}

function trustedFormOrigins() {
  const origins = new Set<string>(["https://web-production-8ee56.up.railway.app"]);
  for (const value of [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ]) {
    const origin = normalizedOrigin(value);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

function durableMediaPatterns(): RemotePattern[] {
  const value = process.env.MEDIA_PUBLIC_URL?.trim();
  if (!value) return [];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return [];
    const basePath = url.pathname.replace(/\/$/, "");
    return [{
      protocol: url.protocol.slice(0, -1) as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: `${basePath || ""}/**`,
    }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: durableMediaPatterns(),
  },
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.paystack.co",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      `form-action 'self' ${trustedFormOrigins().join(" ")} https://checkout.paystack.com https://*.paystack.co`,
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), serial=(self)" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
