import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  console.warn("Standalone build directory was not found. Skipping standalone asset copy.");
  process.exit(0);
}

async function copyIfExists(source, destination) {
  if (!existsSync(source)) {
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

await copyIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));
await copyIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
