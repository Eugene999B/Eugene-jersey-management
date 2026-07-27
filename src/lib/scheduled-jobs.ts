import { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

export const RESERVATION_RELEASE_JOB_KEY = "release-expired-reservations";

const JOB_ENTITY_TYPE = "ScheduledJob";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Scheduled job failed.";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function action(jobKey: string, status: "started" | "succeeded" | "failed") {
  return `jobs.${jobKey}.${status}`;
}

function metadataRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

export async function runMonitoredJob<T>(jobKey: string, operation: () => Promise<T>) {
  const startedAt = new Date();
  const startedMs = startedAt.getTime();

  await platformDb.auditLog.create({
    data: {
      action: action(jobKey, "started"),
      entityType: JOB_ENTITY_TYPE,
      entityId: jobKey,
      metadata: { startedAt: startedAt.toISOString() },
    },
  });

  try {
    const result = await operation();
    const completedAt = new Date();
    await platformDb.auditLog.create({
      data: {
        action: action(jobKey, "succeeded"),
        entityType: JOB_ENTITY_TYPE,
        entityId: jobKey,
        metadata: {
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedMs,
          result: jsonValue(result),
        },
      },
    });
    return result;
  } catch (error) {
    const failedAt = new Date();
    await platformDb.auditLog.create({
      data: {
        action: action(jobKey, "failed"),
        entityType: JOB_ENTITY_TYPE,
        entityId: jobKey,
        metadata: {
          startedAt: startedAt.toISOString(),
          failedAt: failedAt.toISOString(),
          durationMs: failedAt.getTime() - startedMs,
          error: safeError(error),
        },
      },
    }).catch(() => undefined);
    throw error;
  }
}

export async function getScheduledJobState(jobKey: string) {
  const logs = await platformDb.auditLog.findMany({
    where: {
      shopId: null,
      userId: null,
      entityType: JOB_ENTITY_TYPE,
      entityId: jobKey,
      action: { in: [action(jobKey, "started"), action(jobKey, "succeeded"), action(jobKey, "failed")] },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const started = logs.find((log) => log.action === action(jobKey, "started"));
  const succeeded = logs.find((log) => log.action === action(jobKey, "succeeded"));
  const failed = logs.find((log) => log.action === action(jobKey, "failed"));
  const successMetadata = metadataRecord(succeeded?.metadata);
  const failureMetadata = metadataRecord(failed?.metadata);

  return {
    lastStartedAt: started?.createdAt ?? null,
    lastSucceededAt: succeeded?.createdAt ?? null,
    lastFailedAt: failed?.createdAt ?? null,
    lastDurationMs: typeof successMetadata.durationMs === "number"
      ? successMetadata.durationMs
      : typeof failureMetadata.durationMs === "number"
        ? failureMetadata.durationMs
        : null,
    lastResult: successMetadata.result ?? null,
    lastError: typeof failureMetadata.error === "string" ? failureMetadata.error : null,
  };
}
