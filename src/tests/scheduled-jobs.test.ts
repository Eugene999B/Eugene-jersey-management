import { afterEach, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/platform-db";
import { getScheduledJobState, runMonitoredJob } from "@/lib/scheduled-jobs";

vi.mock("@/lib/platform-db", () => ({
  platformDb: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockedDb = vi.mocked(platformDb, true);

afterEach(() => {
  vi.clearAllMocks();
});

describe("scheduled job monitoring", () => {
  it("records started and successful audit heartbeats", async () => {
    mockedDb.auditLog.create.mockResolvedValue({} as never);

    const result = await runMonitoredJob("example-job", async () => ({ processed: 3 }));

    expect(result).toEqual({ processed: 3 });
    expect(mockedDb.auditLog.create).toHaveBeenCalledTimes(2);
    expect(mockedDb.auditLog.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ action: "jobs.example-job.started", entityType: "ScheduledJob" }),
    }));
    expect(mockedDb.auditLog.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ action: "jobs.example-job.succeeded", entityType: "ScheduledJob" }),
    }));
  });

  it("records failures without swallowing the original error", async () => {
    mockedDb.auditLog.create.mockResolvedValue({} as never);
    const failure = new Error("provider failed\nwith details");

    await expect(runMonitoredJob("example-job", async () => {
      throw failure;
    })).rejects.toBe(failure);

    expect(mockedDb.auditLog.create).toHaveBeenCalledTimes(2);
    expect(mockedDb.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "jobs.example-job.failed",
        metadata: expect.objectContaining({ error: "provider failed with details" }),
      }),
    }));
  });

  it("returns the latest successful and failed heartbeat summary", async () => {
    mockedDb.auditLog.findMany.mockResolvedValue([
      {
        action: "jobs.example-job.failed",
        createdAt: new Date("2026-07-27T12:10:00.000Z"),
        metadata: { durationMs: 50, error: "Failure" },
      },
      {
        action: "jobs.example-job.succeeded",
        createdAt: new Date("2026-07-27T12:00:00.000Z"),
        metadata: { durationMs: 40, result: { processed: 2 } },
      },
      {
        action: "jobs.example-job.started",
        createdAt: new Date("2026-07-27T11:59:59.000Z"),
        metadata: {},
      },
    ] as never);

    const state = await getScheduledJobState("example-job");

    expect(state.lastSucceededAt?.toISOString()).toBe("2026-07-27T12:00:00.000Z");
    expect(state.lastFailedAt?.toISOString()).toBe("2026-07-27T12:10:00.000Z");
    expect(state.lastDurationMs).toBe(40);
    expect(state.lastResult).toEqual({ processed: 2 });
    expect(state.lastError).toBe("Failure");
  });
});
