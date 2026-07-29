import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GHANA_LOCATION_CATALOGUE_META,
  bundledDistricts,
  bundledTowns,
  hasBundledDistrict,
} from "@/lib/ghana-location-catalogue";
import { GHANA_REGIONS, canonicalGhanaRegion } from "@/lib/ghana-locations";

const querySchema = z.object({
  level: z.enum(["regions", "districts", "communities"]),
  region: z.string().trim().max(120).optional(),
  district: z.string().trim().max(180).optional(),
});

function catalogueResponse(items: readonly unknown[]) {
  return {
    source: GHANA_LOCATION_CATALOGUE_META.source,
    generatedAt: GHANA_LOCATION_CATALOGUE_META.generatedAt,
    licence: GHANA_LOCATION_CATALOGUE_META.licence,
    manualEntryAllowed: false,
    offlineReady: true,
    items,
  };
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
    return NextResponse.json(catalogueResponse(GHANA_REGIONS));
  }

  const region = canonicalGhanaRegion(parsed.data.region);
  if (!region) return NextResponse.json({ error: "Choose one of Ghana's 16 regions." }, { status: 400 });

  if (parsed.data.level === "districts") {
    const items = bundledDistricts(region);
    if (!items.length) {
      return NextResponse.json({ error: "No bundled districts were found for the selected region." }, { status: 500 });
    }
    return NextResponse.json(catalogueResponse(items));
  }

  if (!parsed.data.district) {
    return NextResponse.json({ error: "Choose a district before loading towns and communities." }, { status: 400 });
  }
  if (!hasBundledDistrict(region, parsed.data.district)) {
    return NextResponse.json({ error: "Choose a district from the selected region's list." }, { status: 400 });
  }

  const items = bundledTowns(region, parsed.data.district);
  if (!items.length) {
    return NextResponse.json({ error: "No bundled towns or communities were found for the selected district." }, { status: 500 });
  }
  return NextResponse.json(catalogueResponse(items));
}
