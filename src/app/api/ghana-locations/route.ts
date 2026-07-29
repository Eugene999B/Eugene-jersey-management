import { NextResponse } from "next/server";
import { z } from "zod";
import { GHANA_REGIONS, canonicalGhanaRegion, normaliseLocationToken } from "@/lib/ghana-locations";

const querySchema = z.object({
  level: z.enum(["regions", "districts", "communities"]),
  region: z.string().trim().max(120).optional(),
  district: z.string().trim().max(180).optional(),
});

type RegistryItem = {
  code?: unknown;
  name?: unknown;
  parent_code?: unknown;
  capital?: unknown;
  gpsCoordinate?: unknown;
  landmark_info?: unknown;
  status?: unknown;
};

type RegistryResponse = {
  data?: RegistryItem[];
};

const REGISTRY_ENDPOINTS = [
  "https://registry.mogcsp.gov.gh/api/locations",
  "https://registry.mogcsp.gov.gh/api/v2/locations",
] as const;

async function registryLocations(type: "R" | "D" | "C", parentCode?: string) {
  let lastError: unknown = null;

  for (const endpoint of REGISTRY_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("type", type);
      if (parentCode) url.searchParams.set("parent_code", parentCode);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Eugene-Jersey-Management/1.0",
        },
        next: { revalidate: 24 * 60 * 60 },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error(`Ghana location registry returned ${response.status}.`);

      const payload = await response.json() as RegistryResponse;
      if (!Array.isArray(payload.data)) throw new Error("Ghana location registry returned an invalid response.");
      return payload.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Ghana location registry is unavailable.");
}

function text(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function publicItem(item: RegistryItem) {
  return {
    code: text(item.code),
    name: text(item.name),
    parentCode: text(item.parent_code),
    capital: text(item.capital) || null,
    gpsCoordinate: text(item.gpsCoordinate) || null,
    landmark: text(item.landmark_info) || null,
  };
}

async function officialRegionCode(regionName: string) {
  const regions = await registryLocations("R");
  const token = normaliseLocationToken(regionName).replace(/ region$/, "");
  const match = regions.find((item) => normaliseLocationToken(text(item.name)).replace(/ region$/, "") === token);
  return match ? text(match.code) : "";
}

async function officialDistrict(regionName: string, districtName: string) {
  const regionCode = await officialRegionCode(regionName);
  if (!regionCode) return null;
  const districts = await registryLocations("D", regionCode);
  const token = normaliseLocationToken(districtName)
    .replace(/ metropolitan$/, "")
    .replace(/ municipal$/, "")
    .replace(/ district$/, "");
  const match = districts.find((item) => normaliseLocationToken(text(item.name))
    .replace(/ metropolitan$/, "")
    .replace(/ municipal$/, "")
    .replace(/ district$/, "") === token);
  return match ? publicItem(match) : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    level: searchParams.get("level"),
    region: searchParams.get("region") || undefined,
    district: searchParams.get("district") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid Ghana location request." }, { status: 400 });

  if (parsed.data.level === "regions") {
    return NextResponse.json({
      source: "EJM canonical regions",
      manualEntryAllowed: false,
      items: GHANA_REGIONS,
    });
  }

  const region = canonicalGhanaRegion(parsed.data.region);
  if (!region) return NextResponse.json({ error: "Choose one of Ghana's 16 regions." }, { status: 400 });

  try {
    if (parsed.data.level === "districts") {
      const regionCode = await officialRegionCode(region);
      if (!regionCode) throw new Error("Region code was not found in the registry.");
      const items = (await registryLocations("D", regionCode))
        .map(publicItem)
        .filter((item) => item.code && item.name)
        .sort((left, right) => left.name.localeCompare(right.name));
      return NextResponse.json({ source: "Ghana National Household Registry", manualEntryAllowed: false, items });
    }

    if (!parsed.data.district) {
      return NextResponse.json({ error: "Choose a district before loading towns and communities." }, { status: 400 });
    }
    const district = await officialDistrict(region, parsed.data.district);
    if (!district?.code) throw new Error("District code was not found in the registry.");
    const items = (await registryLocations("C", district.code))
      .filter((item) => !text(item.status) || text(item.status).toUpperCase() === "APPROVED")
      .map(publicItem)
      .filter((item) => item.code && item.name)
      .sort((left, right) => left.name.localeCompare(right.name));
    return NextResponse.json({ source: "Ghana National Household Registry", manualEntryAllowed: false, items });
  } catch {
    return NextResponse.json({
      source: "Ghana National Household Registry",
      manualEntryAllowed: false,
      items: [],
      retryable: true,
      notice: "The official Ghana district and town directory could not be reached. Please retry; district and town are selected from the directory rather than typed manually.",
    }, { status: 503 });
  }
}
