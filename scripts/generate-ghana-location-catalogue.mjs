import fs from "node:fs";
import path from "node:path";

const [sourceArgument, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !outputArgument) {
  throw new Error("Usage: node scripts/generate-ghana-location-catalogue.mjs <GH.txt> <output.json>");
}

const sourcePath = path.resolve(sourceArgument);
const outputPath = path.resolve(outputArgument);

const REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const REGION_ALIASES = new Map([
  ["ahafo", "Ahafo"],
  ["ashanti", "Ashanti"],
  ["bono", "Bono"],
  ["bono east", "Bono East"],
  ["brong ahafo", "Bono"],
  ["central", "Central"],
  ["eastern", "Eastern"],
  ["greater accra", "Greater Accra"],
  ["north east", "North East"],
  ["northern", "Northern"],
  ["oti", "Oti"],
  ["savannah", "Savannah"],
  ["upper east", "Upper East"],
  ["upper west", "Upper West"],
  ["volta", "Volta"],
  ["western", "Western"],
  ["western north", "Western North"],
]);

const FEATURE_PRIORITY = {
  PPLC: 900,
  PPLA: 850,
  PPLA2: 800,
  PPLA3: 750,
  PPLA4: 700,
  PPLG: 650,
  PPL: 500,
  PPLL: 450,
  PPLX: 400,
  STLMT: 350,
};

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function token(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+region$/, "");
}

function canonicalRegion(value) {
  return REGION_ALIASES.get(token(value)) ?? null;
}

function parseRows() {
  const source = fs.readFileSync(sourcePath, "utf8");
  return source
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const columns = line.split("\t");
      return {
        geonameId: clean(columns[0]),
        name: clean(columns[1]),
        asciiName: clean(columns[2]),
        latitude: Number(columns[4]),
        longitude: Number(columns[5]),
        featureClass: clean(columns[6]),
        featureCode: clean(columns[7]),
        countryCode: clean(columns[8]),
        admin1Code: clean(columns[10]),
        admin2Code: clean(columns[11]),
        population: Number(columns[14] || 0),
      };
    })
    .filter((row) => row.countryCode === "GH" && row.name);
}

function localityRank(row) {
  return (FEATURE_PRIORITY[row.featureCode] ?? 300) + Math.min(250, Math.round(Math.log10(Math.max(1, row.population)) * 35));
}

const rows = parseRows();
const regionByAdmin1 = new Map();
for (const row of rows) {
  if (row.featureCode !== "ADM1" || !row.admin1Code) continue;
  const region = canonicalRegion(row.name);
  if (region) regionByAdmin1.set(row.admin1Code, region);
}

const districtsByKey = new Map();
for (const row of rows) {
  if (row.featureCode !== "ADM2" || !row.admin1Code || !row.admin2Code) continue;
  const region = regionByAdmin1.get(row.admin1Code);
  if (!region) continue;
  const key = `${row.admin1Code}:${row.admin2Code}`;
  districtsByKey.set(key, {
    code: `${row.admin1Code}.${row.admin2Code}`,
    name: row.name,
    region,
    towns: [],
  });
}

for (const row of rows) {
  if (row.featureClass !== "P" || !row.admin1Code || !row.admin2Code) continue;
  const district = districtsByKey.get(`${row.admin1Code}:${row.admin2Code}`);
  if (!district) continue;
  district.towns.push({
    code: row.geonameId,
    name: row.name,
    latitude: Number.isFinite(row.latitude) ? row.latitude : null,
    longitude: Number.isFinite(row.longitude) ? row.longitude : null,
    population: Number.isFinite(row.population) ? row.population : 0,
    featureCode: row.featureCode || "PPL",
    rank: localityRank(row),
  });
}

const catalogue = Object.fromEntries(REGIONS.map((region) => [region, []]));
let totalTownCount = 0;

for (const district of districtsByKey.values()) {
  const deduplicated = new Map();
  for (const town of district.towns) {
    const key = token(town.name);
    if (!key) continue;
    const current = deduplicated.get(key);
    if (!current || town.rank > current.rank || (town.rank === current.rank && town.population > current.population)) {
      deduplicated.set(key, town);
    }
  }

  let towns = [...deduplicated.values()]
    .sort((left, right) => right.rank - left.rank || right.population - left.population || left.name.localeCompare(right.name))
    .map(({ rank: _rank, ...town }) => town);

  if (!towns.length) {
    towns = [{ code: `${district.code}-capital`, name: district.name, latitude: null, longitude: null, population: 0, featureCode: "ADM2" }];
  }

  const capital = towns[0]?.name ?? district.name;
  totalTownCount += towns.length;
  catalogue[district.region].push({
    code: district.code,
    name: district.name,
    capital,
    towns,
  });
}

for (const region of REGIONS) {
  catalogue[region].sort((left, right) => left.name.localeCompare(right.name));
}

const districtCount = Object.values(catalogue).reduce((sum, districts) => sum + districts.length, 0);
const populatedRegions = Object.values(catalogue).filter((districts) => districts.length > 0).length;
if (populatedRegions !== 16) throw new Error(`Expected 16 populated regions, received ${populatedRegions}.`);
if (districtCount < 200) throw new Error(`Location source returned only ${districtCount} districts; refusing an incomplete catalogue.`);
if (totalTownCount < 500) throw new Error(`Location source returned only ${totalTownCount} towns; refusing an incomplete catalogue.`);

const output = {
  generatedAt: new Date().toISOString(),
  source: "GeoNames Ghana country dump",
  sourceUrl: "https://download.geonames.org/export/dump/GH.zip",
  licence: "CC BY 4.0",
  regionCount: 16,
  districtCount,
  townCount: totalTownCount,
  regions: catalogue,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Generated ${outputPath}: ${districtCount} districts and ${totalTownCount} towns across 16 regions.`);
