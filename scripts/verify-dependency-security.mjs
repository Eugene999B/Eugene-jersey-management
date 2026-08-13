import { readFileSync } from "node:fs";
import process from "node:process";

const prismaReviewDeadline = new Date("2026-09-04T00:00:00.000Z");
const nanoidReviewDeadline = new Date("2026-08-16T00:00:00.000Z");
const fastUriAdvisorySource = 1130719;
const fastUriAdvisoryUrl = "https://github.com/advisories/GHSA-7p8r-x3mc-p8w7";
const nanoidAdvisorySource = 1139427;
const nanoidAdvisoryUrl = "https://github.com/advisories/GHSA-2v37-7h3g-55p8";
const nanoidAuditRange = "<3.3.18";
const auditPath = process.argv[2] ?? "npm-audit.json";

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

function advisoryBySource(entry, source) {
  return Array.isArray(entry?.via)
    ? entry.via.find((item) => item && typeof item === "object" && item.source === source)
    : null;
}

const audit = loadJson(auditPath);
const lock = loadJson("package-lock.json");
const vulnerabilities = audit?.vulnerabilities ?? {};
const blocking = Object.values(vulnerabilities).filter((entry) => entry?.severity === "high" || entry?.severity === "critical");

if (!blocking.length) {
  console.log("No high or critical npm advisories were reported.");
  process.exit(0);
}

const allowedNames = new Set(["fast-uri", "ajv", "nanoid"]);
const unexpected = blocking.filter((entry) => !allowedNames.has(entry.name));
if (unexpected.length) {
  fail(`unexpected high/critical advisories: ${unexpected.map((entry) => `${entry.name} (${entry.severity})`).join(", ")}`);
}

const fastUri = vulnerabilities["fast-uri"];
const ajv = vulnerabilities.ajv;
if (!fastUri || !ajv) {
  fail("the reviewed Prisma fast-uri/Ajv advisory chain is no longer reported as expected.");
}
if (Date.now() >= prismaReviewDeadline.getTime()) {
  fail(`the temporary Prisma streams-local exception expired on ${prismaReviewDeadline.toISOString().slice(0, 10)}. Re-check for a published fast-uri or Prisma fix.`);
}

const fastUriAdvisory = advisoryBySource(fastUri, fastUriAdvisorySource);
if (!fastUriAdvisory || fastUriAdvisory.url !== fastUriAdvisoryUrl || fastUriAdvisory.severity !== "high") {
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

const nanoid = vulnerabilities.nanoid;
if (nanoid) {
  if (Date.now() >= nanoidReviewDeadline.getTime()) {
    fail(`the temporary PostCSS Nano ID exception expired on ${nanoidReviewDeadline.toISOString().slice(0, 10)}. Re-check the npm 3.x release channel and PostCSS dependency chain.`);
  }
  const nanoidAdvisory = advisoryBySource(nanoid, nanoidAdvisorySource);
  if (!nanoidAdvisory || nanoidAdvisory.url !== nanoidAdvisoryUrl || nanoidAdvisory.severity !== "high" || nanoidAdvisory.range !== nanoidAuditRange) {
    fail("Nano ID advisory identity, severity or audit range changed.");
  }
  if (JSON.stringify(nanoid.nodes) !== JSON.stringify(["node_modules/postcss/node_modules/nanoid"])) {
    fail(`Nano ID now appears at an unreviewed installation path: ${JSON.stringify(nanoid.nodes)}`);
  }
  const installedNanoid = packages["node_modules/postcss/node_modules/nanoid"];
  if (installedNanoid?.version !== "3.3.16") {
    fail(`expected the reviewed nested Nano ID release 3.3.16, found ${installedNanoid?.version ?? "missing"}. Re-check whether a patched 3.x release is now installable.`);
  }

  let postcssInput;
  try {
    postcssInput = readFileSync("node_modules/postcss/lib/input.js", "utf8");
  } catch (error) {
    fail(`could not inspect the installed PostCSS Nano ID call path: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!postcssInput.includes("require('nanoid/non-secure')") || !postcssInput.includes("nanoid(6)")) {
    fail("PostCSS Nano ID usage changed from the reviewed fixed-size non-secure call path.");
  }
  if (postcssInput.includes("customAlphabet") || postcssInput.includes("customRandom") || postcssInput.includes("nanoid(0)")) {
    fail("PostCSS now exposes a Nano ID call shape covered by the zero-size custom-generator advisory.");
  }
}

const expectedBlockingCount = nanoid ? 3 : 2;
if (blocking.length !== expectedBlockingCount) {
  fail(`the reviewed high-severity set changed unexpectedly: ${blocking.map((entry) => entry.name).join(", ")}`);
}

console.warn([
  "TEMPORARY SECURITY EXCEPTIONS ACCEPTED",
  `- Prisma advisory: ${fastUriAdvisoryUrl}`,
  "- affected path: devOptional @prisma/streams-local -> Ajv -> fast-uri",
  "- installed fast-uri: 4.1.1 (fixed release not yet published)",
  `- Prisma mandatory review deadline: ${prismaReviewDeadline.toISOString().slice(0, 10)}`,
  ...(nanoid ? [
    `- Nano ID advisory: ${nanoidAdvisoryUrl}`,
    `- npm audit reviewed range: ${nanoidAuditRange}`,
    "- affected installation path: Next/PostCSS -> nested Nano ID 3.x only",
    "- installed nested Nano ID: 3.3.16; the npm 3.x channel has no newer installable release in this review",
    "- reviewed PostCSS usage: nanoid/non-secure with fixed size 6; no customAlphabet/customRandom zero-size path",
    `- Nano ID mandatory review deadline: ${nanoidReviewDeadline.toISOString().slice(0, 10)}`,
  ] : []),
  "- every other high/critical advisory remains blocking",
].join("\n"));
