import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { platformDb } from "@/lib/platform-db";

export const MACHINE_JOB_STATUSES = ["PREPARED", "SENDING", "SENT", "FAILED", "CANCELLED"] as const;
export type MachineJobStatus = (typeof MACHINE_JOB_STATUSES)[number];

export type MachineProductionJobView = {
  id: string;
  shopId: string;
  designJobId: string;
  designTitle: string;
  machineProfileId: string;
  machineName: string;
  manufacturer: string | null;
  model: string | null;
  createdById: string;
  createdByName: string;
  jobName: string;
  material: string;
  materialWidthMm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  mirror: boolean;
  origin: string;
  copies: number;
  outputFormat: string;
  payloadHash: string;
  pathCount: number;
  byteLength: number;
  status: MachineJobStatus;
  attemptCount: number;
  lastError: string | null;
  deviceSnapshot: Record<string, unknown>;
  checklist: Record<string, unknown>;
  warnings: string[];
  claimedAt: Date | null;
  sentAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MachineProductionJobRow = Omit<MachineProductionJobView, "deviceSnapshot" | "checklist" | "warnings"> & {
  deviceSnapshot: Prisma.JsonValue;
  checklist: Prisma.JsonValue;
  warnings: Prisma.JsonValue;
};

type ClaimedJobRow = MachineProductionJobRow & {
  payload: string;
  baudRate: number;
  usbVendorId: number | null;
  usbProductId: number | null;
  connectionMode: string;
};

function record(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function view(row: MachineProductionJobRow): MachineProductionJobView {
  return {
    ...row,
    deviceSnapshot: record(row.deviceSnapshot),
    checklist: record(row.checklist),
    warnings: stringArray(row.warnings),
  };
}

const selection = Prisma.sql`
  SELECT
    jobs."id",
    jobs."shopId",
    jobs."designJobId",
    designs."title" AS "designTitle",
    jobs."machineProfileId",
    profiles."name" AS "machineName",
    profiles."manufacturer",
    profiles."model",
    jobs."createdById",
    users."name" AS "createdByName",
    jobs."jobName",
    jobs."material",
    jobs."materialWidthMm",
    jobs."sheetWidthMm",
    jobs."sheetHeightMm",
    jobs."mirror",
    jobs."origin",
    jobs."copies",
    jobs."outputFormat",
    jobs."payloadHash",
    jobs."pathCount",
    jobs."byteLength",
    jobs."status",
    jobs."attemptCount",
    jobs."lastError",
    jobs."deviceSnapshot",
    jobs."checklist",
    jobs."warnings",
    jobs."claimedAt",
    jobs."sentAt",
    jobs."cancelledAt",
    jobs."createdAt",
    jobs."updatedAt"
  FROM "MachineProductionJob" jobs
  INNER JOIN "DesignJob" designs
    ON designs."id" = jobs."designJobId" AND designs."shopId" = jobs."shopId"
  INNER JOIN "ShopMachineProfile" profiles
    ON profiles."id" = jobs."machineProfileId" AND profiles."shopId" = jobs."shopId"
  INNER JOIN "User" users
    ON users."id" = jobs."createdById" AND users."shopId" = jobs."shopId"
`;

export async function listMachineProductionJobs(shopId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const rows = await platformDb.$queryRaw<MachineProductionJobRow[]>(Prisma.sql`
    ${selection}
    WHERE jobs."shopId" = ${shopId}
    ORDER BY jobs."createdAt" DESC
    LIMIT ${safeLimit}
  `);
  return rows.map(view);
}

export async function createMachineProductionJob(input: {
  shopId: string;
  designJobId: string;
  machineProfileId: string;
  createdById: string;
  jobName: string;
  material: string;
  materialWidthMm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  mirror: boolean;
  origin: string;
  payload: string;
  payloadHash: string;
  pathCount: number;
  checklist: Record<string, unknown>;
  warnings: string[];
  allowDuplicate?: boolean;
}) {
  if (!input.allowDuplicate) {
    const duplicate = await platformDb.$queryRaw<Array<{ id: string; sentAt: Date }>>`
      SELECT "id", "sentAt"
      FROM "MachineProductionJob"
      WHERE "shopId" = ${input.shopId}
        AND "machineProfileId" = ${input.machineProfileId}
        AND "payloadHash" = ${input.payloadHash}
        AND "status" = 'SENT'
        AND "sentAt" >= NOW() - INTERVAL '15 minutes'
      ORDER BY "sentAt" DESC
      LIMIT 1
    `;
    if (duplicate[0]) throw new Error(`MACHINE_JOB_DUPLICATE:${duplicate[0].id}`);
  }

  const id = nanoid();
  const byteLength = new TextEncoder().encode(input.payload).byteLength;
  const inserted = await platformDb.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "MachineProductionJob" (
      "id", "shopId", "designJobId", "machineProfileId", "createdById", "jobName",
      "material", "materialWidthMm", "sheetWidthMm", "sheetHeightMm", "mirror", "origin",
      "copies", "outputFormat", "payload", "payloadHash", "pathCount", "byteLength",
      "status", "checklist", "warnings", "createdAt", "updatedAt"
    )
    SELECT
      ${id}, designs."shopId", designs."id", profiles."id", users."id", ${input.jobName},
      ${input.material}, ${input.materialWidthMm}, ${input.sheetWidthMm}, ${input.sheetHeightMm},
      ${input.mirror}, ${input.origin}, 1, 'HPGL', ${input.payload}, ${input.payloadHash},
      ${input.pathCount}, ${byteLength}, 'PREPARED', ${JSON.stringify(input.checklist)}::jsonb,
      ${JSON.stringify(input.warnings)}::jsonb, NOW(), NOW()
    FROM "DesignJob" designs
    INNER JOIN "ShopMachineProfile" profiles
      ON profiles."id" = ${input.machineProfileId}
      AND profiles."shopId" = designs."shopId"
      AND profiles."isActive" = TRUE
      AND profiles."outputFormat" = 'HPGL'
      AND profiles."connectionMode" = 'WEB_SERIAL'
    INNER JOIN "User" users
      ON users."id" = ${input.createdById}
      AND users."shopId" = designs."shopId"
      AND users."isActive" = TRUE
    WHERE designs."id" = ${input.designJobId}
      AND designs."shopId" = ${input.shopId}
    RETURNING "id"
  `;
  if (!inserted[0]) throw new Error("MACHINE_JOB_SOURCE_INVALID");

  const rows = await platformDb.$queryRaw<MachineProductionJobRow[]>(Prisma.sql`
    ${selection}
    WHERE jobs."shopId" = ${input.shopId} AND jobs."id" = ${id}
    LIMIT 1
  `);
  if (!rows[0]) throw new Error("MACHINE_JOB_NOT_FOUND");
  return view(rows[0]);
}

export async function claimMachineProductionJob(input: {
  shopId: string;
  jobId: string;
  actorId: string;
}) {
  return platformDb.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<ClaimedJobRow[]>`
      UPDATE "MachineProductionJob" jobs
      SET
        "status" = 'SENDING',
        "attemptCount" = jobs."attemptCount" + 1,
        "claimedAt" = NOW(),
        "lastError" = NULL,
        "updatedAt" = NOW()
      FROM "DesignJob" designs, "ShopMachineProfile" profiles, "User" users
      WHERE jobs."id" = ${input.jobId}
        AND jobs."shopId" = ${input.shopId}
        AND jobs."status" IN ('PREPARED', 'FAILED')
        AND designs."id" = jobs."designJobId"
        AND designs."shopId" = jobs."shopId"
        AND profiles."id" = jobs."machineProfileId"
        AND profiles."shopId" = jobs."shopId"
        AND profiles."isActive" = TRUE
        AND profiles."outputFormat" = 'HPGL'
        AND profiles."connectionMode" = 'WEB_SERIAL'
        AND users."id" = ${input.actorId}
        AND users."shopId" = jobs."shopId"
        AND users."isActive" = TRUE
      RETURNING
        jobs."id",
        jobs."shopId",
        jobs."designJobId",
        designs."title" AS "designTitle",
        jobs."machineProfileId",
        profiles."name" AS "machineName",
        profiles."manufacturer",
        profiles."model",
        jobs."createdById",
        users."name" AS "createdByName",
        jobs."jobName",
        jobs."material",
        jobs."materialWidthMm",
        jobs."sheetWidthMm",
        jobs."sheetHeightMm",
        jobs."mirror",
        jobs."origin",
        jobs."copies",
        jobs."outputFormat",
        jobs."payloadHash",
        jobs."pathCount",
        jobs."byteLength",
        jobs."status",
        jobs."attemptCount",
        jobs."lastError",
        jobs."deviceSnapshot",
        jobs."checklist",
        jobs."warnings",
        jobs."claimedAt",
        jobs."sentAt",
        jobs."cancelledAt",
        jobs."createdAt",
        jobs."updatedAt",
        jobs."payload",
        profiles."baudRate",
        profiles."usbVendorId",
        profiles."usbProductId",
        profiles."connectionMode"
    `;
    const job = rows[0];
    if (!job) {
      const current = await transaction.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM "MachineProductionJob"
        WHERE "id" = ${input.jobId} AND "shopId" = ${input.shopId}
        LIMIT 1
      `;
      if (!current[0]) throw new Error("MACHINE_JOB_NOT_FOUND");
      throw new Error(`MACHINE_JOB_NOT_SENDABLE:${current[0].status}`);
    }

    await transaction.$executeRaw`
      INSERT INTO "MachineProductionAttempt" (
        "id", "shopId", "jobId", "actorId", "attemptNumber", "status", "byteLength", "startedAt"
      ) VALUES (
        ${nanoid()}, ${input.shopId}, ${input.jobId}, ${input.actorId}, ${job.attemptCount}, 'STARTED', ${job.byteLength}, NOW()
      )
    `;

    return {
      ...view(job),
      payload: job.payload,
      baudRate: job.baudRate,
      usbVendorId: job.usbVendorId,
      usbProductId: job.usbProductId,
      connectionMode: job.connectionMode,
    };
  });
}

export async function finishMachineProductionJob(input: {
  shopId: string;
  jobId: string;
  actorId: string;
  success: boolean;
  deviceInfo: Record<string, unknown>;
  error?: string | null;
}) {
  return platformDb.$transaction(async (transaction) => {
    const status = input.success ? "SENT" : "FAILED";
    const error = input.success ? null : (input.error?.trim().slice(0, 1_000) || "The cutter did not accept the serial job.");
    const rows = await transaction.$queryRaw<Array<{ attemptCount: number }>>`
      UPDATE "MachineProductionJob"
      SET
        "status" = ${status},
        "lastError" = ${error},
        "deviceSnapshot" = ${JSON.stringify(input.deviceInfo)}::jsonb,
        "sentAt" = CASE WHEN ${input.success} THEN NOW() ELSE "sentAt" END,
        "updatedAt" = NOW()
      WHERE "id" = ${input.jobId}
        AND "shopId" = ${input.shopId}
        AND "status" = 'SENDING'
        AND EXISTS (
          SELECT 1 FROM "User"
          WHERE "id" = ${input.actorId} AND "shopId" = ${input.shopId} AND "isActive" = TRUE
        )
      RETURNING "attemptCount"
    `;
    if (!rows[0]) throw new Error("MACHINE_JOB_NOT_SENDING");

    await transaction.$executeRaw`
      UPDATE "MachineProductionAttempt"
      SET
        "status" = ${status},
        "deviceInfo" = ${JSON.stringify(input.deviceInfo)}::jsonb,
        "error" = ${error},
        "finishedAt" = NOW()
      WHERE "jobId" = ${input.jobId}
        AND "shopId" = ${input.shopId}
        AND "attemptNumber" = ${rows[0].attemptCount}
        AND "actorId" = ${input.actorId}
        AND "status" = 'STARTED'
    `;

    const jobs = await platformDb.$queryRaw<MachineProductionJobRow[]>(Prisma.sql`
      ${selection}
      WHERE jobs."shopId" = ${input.shopId} AND jobs."id" = ${input.jobId}
      LIMIT 1
    `);
    if (!jobs[0]) throw new Error("MACHINE_JOB_NOT_FOUND");
    return view(jobs[0]);
  });
}

export async function cancelMachineProductionJob(input: {
  shopId: string;
  jobId: string;
  actorId: string;
}) {
  const rows = await platformDb.$queryRaw<Array<{ id: string }>>`
    UPDATE "MachineProductionJob"
    SET "status" = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${input.jobId}
      AND "shopId" = ${input.shopId}
      AND "status" IN ('PREPARED', 'FAILED')
      AND EXISTS (
        SELECT 1 FROM "User"
        WHERE "id" = ${input.actorId} AND "shopId" = ${input.shopId} AND "isActive" = TRUE
      )
    RETURNING "id"
  `;
  if (!rows[0]) throw new Error("MACHINE_JOB_NOT_CANCELLABLE");
  return rows[0].id;
}
