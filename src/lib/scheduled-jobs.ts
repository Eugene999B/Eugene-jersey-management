import { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

export const RESERVATION_RELEASE_JOB_KEY = "release-expired-reservations";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Scheduled job failed.";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

export async function runMonitoredJob<T>(jobKey: string, operation: () => Promise<T>) {
  const startedAt = new Date();
  const startedMs = startedAt.getTime();

  await platformDb.scheduledJobState.upsert({
    where: { jobKey },
    create: { jobKey, lastStartedAt: startedAt },
    update: { lastStartedAt: startedAt },
  });

  try {
    const result = await operation();
    const completedAt = new Date();
    await platformDb.scheduledJobState.update({
      where: { jobKey },
      data: {
        lastSucceededAt: completedAt,
        lastDurationMs: completedAt.getTime() - startedMs,
        lastResult: jsonValue(result),
        lastError: null,
      },
    });
    return result;
  } catch (error) {
    const failedAt = new Date();
    await platformDb.scheduledJobState.update({
      where: { jobKey },
      data: {
        lastFailedAt: failedAt,
        lastDurationMs: failedAt.getTime() - startedMs,
        lastError: safeError(error),
      },
    }).catch(() => undefined);
    throw error;
  }
}

export async function getScheduledJobState(jobKey: string) {
  return platformDb.scheduledJobState.findUnique({ where: { jobKey } });
}
