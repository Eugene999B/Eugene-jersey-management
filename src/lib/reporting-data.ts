import "server-only";

import { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

export async function listOrderCompletionTimes(shopId: string, orderIds: readonly string[]) {
  if (!orderIds.length) return new Map<string, Date>();
  const uniqueIds = [...new Set(orderIds)];
  const rows = await platformDb.$queryRaw<Array<{ orderId: string; completedAt: Date }>>(Prisma.sql`
    SELECT events."orderId", MAX(events."createdAt") AS "completedAt"
    FROM "OrderWorkflowEvent" events
    INNER JOIN "Order" orders
      ON orders."id" = events."orderId" AND orders."shopId" = events."shopId"
    WHERE events."shopId" = ${shopId}
      AND events."orderId" IN (${Prisma.join(uniqueIds)})
      AND events."type" = 'STATUS_CHANGED'
      AND events."toStatus" = 'COMPLETED'
    GROUP BY events."orderId"
  `);
  return new Map(rows.map((row) => [row.orderId, row.completedAt]));
}

export type OrderTimingReportRow = {
  orderId: string;
  receiptNumber: string;
  assignedToId: string | null;
  assignedToName: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
};

export async function listCompletedOrderTimings(shopId: string, from: Date, to: Date) {
  return platformDb.$queryRaw<OrderTimingReportRow[]>`
    SELECT
      workflow."orderId",
      orders."receiptNumber",
      workflow."assignedToId",
      assignee."name" AS "assignedToName",
      workflow."dueAt",
      MAX(events."createdAt") AS "completedAt"
    FROM "OrderWorkflow" workflow
    INNER JOIN "Order" orders
      ON orders."id" = workflow."orderId" AND orders."shopId" = workflow."shopId"
    LEFT JOIN "User" assignee
      ON assignee."id" = workflow."assignedToId" AND assignee."shopId" = workflow."shopId"
    INNER JOIN "OrderWorkflowEvent" events
      ON events."orderId" = workflow."orderId"
      AND events."shopId" = workflow."shopId"
      AND events."type" = 'STATUS_CHANGED'
      AND events."toStatus" = 'COMPLETED'
    WHERE workflow."shopId" = ${shopId}
      AND events."createdAt" >= ${from}
      AND events."createdAt" <= ${to}
    GROUP BY workflow."orderId", orders."receiptNumber", workflow."assignedToId", assignee."name", workflow."dueAt"
    ORDER BY MAX(events."createdAt") DESC
  `;
}

export type PlatformDeviceBridgeReport = {
  activeWebSerialProfiles: number;
  sentJobs: number;
  failedJobs: number;
  sendingJobs: number;
  staleSendingJobs: number;
  preparedJobs: number;
  successRatePercent: number;
  shopsWithFailures: Array<{ shopId: string; shopName: string; failedJobs: number; lastFailureAt: Date | null }>;
};

export async function platformDeviceBridgeReport(from: Date, to: Date): Promise<PlatformDeviceBridgeReport> {
  const [profileRows, statusRows, failureRows] = await Promise.all([
    platformDb.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::BIGINT AS "count"
      FROM "ShopMachineProfile"
      WHERE "isActive" = TRUE AND "connectionMode" = 'WEB_SERIAL' AND "outputFormat" = 'HPGL'
    `,
    platformDb.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT "status"::TEXT AS "status", COUNT(*)::BIGINT AS "count"
      FROM "MachineProductionJob"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY "status"
    `,
    platformDb.$queryRaw<Array<{ shopId: string; shopName: string; failedJobs: bigint; lastFailureAt: Date | null }>>`
      SELECT jobs."shopId", shops."name" AS "shopName", COUNT(*)::BIGINT AS "failedJobs", MAX(jobs."updatedAt") AS "lastFailureAt"
      FROM "MachineProductionJob" jobs
      INNER JOIN "Shop" shops ON shops."id" = jobs."shopId"
      WHERE jobs."status" = 'FAILED' AND jobs."createdAt" >= ${from} AND jobs."createdAt" <= ${to}
      GROUP BY jobs."shopId", shops."name"
      ORDER BY COUNT(*) DESC, MAX(jobs."updatedAt") DESC
      LIMIT 20
    `,
  ]);
  const counts = new Map(statusRows.map((row) => [row.status, Number(row.count)]));
  const sentJobs = counts.get("SENT") ?? 0;
  const failedJobs = counts.get("FAILED") ?? 0;
  const sendingJobs = counts.get("SENDING") ?? 0;
  const staleRows = await platformDb.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::BIGINT AS "count"
    FROM "MachineProductionJob"
    WHERE "status" = 'SENDING' AND "updatedAt" < NOW() - INTERVAL '10 minutes'
  `;
  return {
    activeWebSerialProfiles: Number(profileRows[0]?.count ?? 0),
    sentJobs,
    failedJobs,
    sendingJobs,
    staleSendingJobs: Number(staleRows[0]?.count ?? 0),
    preparedJobs: counts.get("PREPARED") ?? 0,
    successRatePercent: sentJobs + failedJobs > 0 ? (sentJobs / (sentJobs + failedJobs)) * 100 : 0,
    shopsWithFailures: failureRows.map((row) => ({ ...row, failedJobs: Number(row.failedJobs) })),
  };
}
