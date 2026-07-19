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

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return;
  }

  if (bucket.count >= input.limit) {
    throw new RateLimitError(Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)));
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}
