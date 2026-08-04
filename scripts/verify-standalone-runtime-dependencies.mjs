import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const standaloneRoot = ".next/standalone";
const forbiddenRuntimePackages = new Set([
  "@prisma/streams-local",
  "fast-uri",
  "hono",
  "postcss",
]);

function fail(message) {
  console.error(`Standalone runtime dependency verification failed: ${message}`);
  process.exit(1);
}

if (!existsSync(standaloneRoot)) {
  fail(`${standaloneRoot} does not exist. Run the production build first.`);
}

const found = [];
const stack = [standaloneRoot];
while (stack.length) {
  const directory = stack.pop();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      stack.push(path);
      continue;
    }
    if (!entry.isFile() || entry.name !== "package.json") continue;
    try {
      const manifest = JSON.parse(readFileSync(path, "utf8"));
      if (forbiddenRuntimePackages.has(manifest.name)) found.push({ name: manifest.name, path });
    } catch {
      // A malformed package manifest will be surfaced by the application build/runtime itself.
    }
  }
}

if (found.length) {
  fail(`build-only or currently vulnerable packages were copied into the deployable server: ${found.map((entry) => `${entry.name} at ${entry.path}`).join(", ")}`);
}

console.log(`Standalone runtime is clear of: ${[...forbiddenRuntimePackages].join(", ")}.`);
