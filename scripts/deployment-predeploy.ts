import "dotenv/config";

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export type DeploymentTier = "production" | "staging";
export type DeploymentEnvironment = Record<string, string | undefined>;

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function resolveDeploymentTier(env: DeploymentEnvironment = process.env): DeploymentTier {
  const explicit = normalized(env.ESM_DEPLOYMENT_TIER);
  if (explicit === "production" || explicit === "staging") return explicit;
  if (explicit) throw new Error("ESM_DEPLOYMENT_TIER must be production or staging when set.");

  const railwayEnvironment = normalized(env.RAILWAY_ENVIRONMENT_NAME);
  if (railwayEnvironment === "production") return "production";
  if (railwayEnvironment) return "staging";

  if (env.CI === "true" || env.RELEASE_PREDEPLOY_ALLOW_LOCAL === "true") return "staging";
  throw new Error("Release predeploy requires RAILWAY_ENVIRONMENT_NAME, ESM_DEPLOYMENT_TIER, or explicit local test permission.");
}

function executable(name: "npm" | "npx") {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command: "npm" | "npx", args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(executable(command), args, {
    stdio: "inherit",
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
}

export function deploymentPlan(tier: DeploymentTier) {
  return tier === "production"
    ? ["prisma-migrate-deploy", "production-activate", "production-purge-demo", "release-database-verify"] as const
    : ["prisma-migrate-deploy", "release-database-verify"] as const;
}

async function main() {
  const tier = resolveDeploymentTier();
  const environmentName = process.env.RAILWAY_ENVIRONMENT_NAME?.trim() || "non-Railway verification";
  console.log(`ESM release predeploy: tier=${tier}, environment=${environmentName}`);

  run("npx", ["prisma", "migrate", "deploy"]);

  if (tier === "production") {
    run("npm", ["run", "production:activate"]);
    run("npm", ["run", "production:purge-demo"]);
  } else {
    console.log("Staging predeploy: production administrator activation and permanent demo cleanup are intentionally skipped.");
  }

  run("npm", ["run", "release:verify-db"], {
    ...process.env,
    ESM_DEPLOYMENT_TIER: tier,
  });

  console.log(`ESM release predeploy complete for ${tier}.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath && import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
