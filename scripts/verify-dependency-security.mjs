import { readFileSync } from "node:fs";
import process from "node:process";

const auditPath = process.argv[2] ?? "npm-audit.json";
const reviewDeadline = new Date("2026-09-04T00:00:00.000Z");
const allowedAdvisorySource = 1130719;
const allowedAdvisoryUrl = "https://github.com/advisories/GHSA-7p8r-x3mc-p8w7";

function fail(message) {
  console.error(`Dependency security verification failed: ${message}`);
  process.exit(1);
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const audit = loadJson(auditPath);
const lock = loadJson("package-lock.json");
const vulnerabilities = audit?.vulnerabilities ?? {};
const blocking = Object.values(vulnerabilities).filter((entry) => entry?.severity === "high" || entry?.severity === "critical");

if (!blocking.length) {
  console.log("No high or critical npm advisories were reported.");
  process.exit(0);
}

if (Date.now() >= reviewDeadline.getTime()) {
  fail(`the temporary Prisma streams-local exception expired on ${reviewDeadline.toISOString().slice(0, 10)}. Re-check for a published fast-uri or Prisma fix.`);
}

const allowedNames = new Set(["fast-uri", "ajv"]);
const unexpected = blocking.filter((entry) => !allowedNames.has(entry.name));
if (unexpected.length) {
  fail(`unexpected high/critical advisories: ${unexpected.map((entry) => `${entry.name} (${entry.severity})`).join(", ")}`);
}

const fastUri = vulnerabilities["fast-uri"];
const ajv = vulnerabilities.ajv;
if (!fastUri || !ajv || blocking.length !== 2) {
  fail("the reported high-severity set no longer matches the reviewed fast-uri/Ajv chain.");
}

const advisory = Array.isArray(fastUri.via)
  ? fastUri.via.find((entry) => entry && typeof entry === "object" && entry.source === allowedAdvisorySource)
  : null;
if (!advisory || advisory.url !== allowedAdvisoryUrl || advisory.severity !== "high") {
  fail("fast-uri advisory identity or severity changed.");
}

if (JSON.stringify(fastUri.nodes) !== JSON.stringify(["node_modules/fast-uri"])) {
  fail(`fast-uri now appears at an unreviewed installation path: ${JSON.stringify(fastUri.nodes)}`);
}
if (JSON.stringify(ajv.nodes) !== JSON.stringify(["node_modules/@prisma/streams-local/node_modules/ajv"])) {
  fail(`Ajv now appears at an unreviewed installation path: ${JSON.stringify(ajv.nodes)}`);
}
if (JSON.stringify(ajv.via) !== JSON.stringify(["fast-uri"])) {
  fail(`Ajv is no longer inherited only through fast-uri: ${JSON.stringify(ajv.via)}`);
}

const packages = lock?.packages ?? {};
const streamsLocal = packages["node_modules/@prisma/streams-local"];
const nestedAjv = packages["node_modules/@prisma/streams-local/node_modules/ajv"];
const installedFastUri = packages["node_modules/fast-uri"];
if (!streamsLocal?.devOptional || !nestedAjv?.devOptional) {
  fail("the reviewed Prisma streams-local/Ajv path is no longer marked devOptional in the committed lockfile.");
}
if (installedFastUri?.version !== "4.1.1") {
  fail(`expected the newest published reviewed fast-uri release 4.1.1, found ${installedFastUri?.version ?? "missing"}.`);
}

console.warn([
  "TEMPORARY SECURITY EXCEPTION ACCEPTED",
  `- advisory: ${allowedAdvisoryUrl}`,
  "- affected path: devOptional @prisma/streams-local -> Ajv -> fast-uri",
  "- installed fast-uri: 4.1.1 (newer fixed release is not yet published)",
  `- mandatory review deadline: ${reviewDeadline.toISOString().slice(0, 10)}`,
  "- every other high/critical advisory remains blocking",
].join("\n"));
