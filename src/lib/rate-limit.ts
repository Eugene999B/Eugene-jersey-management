import "server-only";

import { prisma } from "@/lib/db";

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many attempts. Please try again later.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + input.windowSeconds * 1000);
  const key = input.key.toLowerCase();

  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;
  const bucket = rows[0];
  if (bucket && bucket.count > input.limit) {
    const bucketReset = new Date(bucket.resetAt);
    throw new RateLimitError(Math.max(1, Math.ceil((bucketReset.getTime() - now.getTime()) / 1000)));
  }
}
