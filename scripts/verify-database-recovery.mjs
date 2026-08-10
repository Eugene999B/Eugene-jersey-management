import "dotenv/config";

import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

function normalized(value) {
  return value?.trim().toLowerCase() ?? "";
}

function assertDisposableDatabase(url) {
  const railwayEnvironment = normalized(process.env.RAILWAY_ENVIRONMENT_NAME);
  const explicitTier = normalized(process.env.ESM_DEPLOYMENT_TIER);
  if (process.env.NODE_ENV === "production" || railwayEnvironment === "production" || explicitTier === "production") {
    throw new Error("Database recovery rehearsal is forbidden against production.");
  }
  if (process.env.CI !== "true" && process.env.RECOVERY_REHEARSAL !== "true") {
    throw new Error("Database recovery rehearsal requires CI=true or RECOVERY_REHEARSAL=true.");
  }
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname)) {
    throw new Error(`Database recovery rehearsal accepts only a loopback PostgreSQL host, received ${url.hostname}.`);
  }
}

function postgresUrl(raw, databaseName) {
  const url = new URL(raw);
  url.searchParams.delete("schema");
  if (databaseName) url.pathname = `/${databaseName}`;
  return url;
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function runPostgresTool(backupDir, args) {
  const result = spawnSync(
    "docker",
    ["run", "--rm", "--network", "host", "-v", `${backupDir}:/backup`, "postgres:16-alpine", ...args],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`PostgreSQL recovery tool failed with exit code ${result.status ?? "unknown"}.`);
}

async function tableCounts(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const counts = {};
    for (const { tablename } of tables.rows) {
      const result = await client.query(`SELECT COUNT(*)::BIGINT AS count FROM ${quoteIdentifier(tablename)}`);
      counts[tablename] = Number(result.rows[0]?.count ?? 0);
    }
    return counts;
  } finally {
    await client.end();
  }
}

async function migrationHistory(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        migration_name,
        checksum,
        finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS rolled_back
      FROM "_prisma_migrations"
      ORDER BY started_at, migration_name
    `);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) throw new Error("DATABASE_URL is required for database recovery rehearsal.");
  const sourceUrl = postgresUrl(rawUrl);
  assertDisposableDatabase(sourceUrl);

  const databaseName = `esm_recovery_${process.pid}_${Date.now()}`.slice(0, 60).toLowerCase();
  const recoveryUrl = postgresUrl(rawUrl, databaseName);
  const backupDir = mkdtempSync(join(tmpdir(), "esm-release-recovery-"));
  const backupPath = join(backupDir, "release.dump");
  const admin = new Client({ connectionString: sourceUrl.toString() });
  let recoveryCreated = false;

  try {
    const sourceCounts = await tableCounts(sourceUrl.toString());
    const sourceMigrations = await migrationHistory(sourceUrl.toString());

    runPostgresTool(backupDir, [
      "pg_dump",
      "--dbname",
      sourceUrl.toString(),
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file=/backup/release.dump",
    ]);
    if (statSync(backupPath).size < 1) throw new Error("PostgreSQL backup rehearsal produced an empty archive.");

    await admin.connect();
    await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    recoveryCreated = true;

    runPostgresTool(backupDir, [
      "pg_restore",
      "--dbname",
      recoveryUrl.toString(),
      "--no-owner",
      "--no-acl",
      "/backup/release.dump",
    ]);

    const recoveredCounts = await tableCounts(recoveryUrl.toString());
    const recoveredMigrations = await migrationHistory(recoveryUrl.toString());
    if (JSON.stringify(recoveredCounts) !== JSON.stringify(sourceCounts)) {
      throw new Error(`Recovered table counts do not match source counts. source=${JSON.stringify(sourceCounts)} recovered=${JSON.stringify(recoveredCounts)}`);
    }
    if (JSON.stringify(recoveredMigrations) !== JSON.stringify(sourceMigrations)) {
      throw new Error("Recovered Prisma migration history does not match the source database.");
    }

    console.log(`Database recovery rehearsal passed for ${Object.keys(sourceCounts).length} public table(s) and ${sourceMigrations.length} Prisma migration record(s).`);
  } finally {
    if (recoveryCreated) {
      if (!admin._connected) await admin.connect();
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
    rmSync(backupDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
