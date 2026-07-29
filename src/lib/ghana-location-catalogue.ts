import catalogueJson from "@/data/ghana-location-catalogue.generated.json";
import { canonicalGhanaRegion, normaliseLocationToken, type GhanaRegionName } from "@/lib/ghana-locations";

type CatalogueTown = {
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  population: number;
  featureCode: string;
};

type CatalogueDistrict = {
  code: string;
  name: string;
  capital: string;
  towns: CatalogueTown[];
};

type GhanaLocationCatalogue = {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  licence: string;
  regionCount: number;
  districtCount: number;
  townCount: number;
  regions: Record<GhanaRegionName, CatalogueDistrict[]>;
};

const catalogue = catalogueJson as GhanaLocationCatalogue;

const DISTRICT_NAME_CORRECTIONS: Record<string, string> = {
  "accra": "Accra Metropolitan",
  "ayawaso central muncipal": "Ayawaso Central Municipal",
  "cape coast": "Cape Coast Metropolitan",
  "ho": "Ho Municipal",
  "kumasi": "Kumasi Metropolitan",
  "secondi takoradi": "Sekondi-Takoradi Metropolitan",
  "tamale": "Tamale Metropolitan",
  "tema": "Tema Metropolitan",
};

function districtToken(value: string | null | undefined) {
  return normaliseLocationToken(value)
    .replace(/ metropolitan assembly$/, "")
    .replace(/ municipal assembly$/, "")
    .replace(/ district assembly$/, "")
    .replace(/ metropolitan$/, "")
    .replace(/ municipal$/, "")
    .replace(/ district$/, "")
    .replace(/ assembly$/, "")
    .replace(/ muncipal$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function correctedDistrictName(name: string) {
  return DISTRICT_NAME_CORRECTIONS[normaliseLocationToken(name)] ?? name;
}

function regionDistricts(region: GhanaRegionName) {
  return catalogue.regions[region] ?? [];
}

export const GHANA_LOCATION_CATALOGUE_META = Object.freeze({
  generatedAt: catalogue.generatedAt,
  source: catalogue.source,
  licence: catalogue.licence,
  regionCount: catalogue.regionCount,
  districtCount: catalogue.districtCount,
  townCount: catalogue.townCount,
});

export function bundledDistricts(regionValue: string | null | undefined) {
  const region = canonicalGhanaRegion(regionValue);
  if (!region) return [];

  const seen = new Set<string>();
  return regionDistricts(region)
    .map((district) => ({
      code: district.code,
      name: correctedDistrictName(district.name),
      capital: district.capital || null,
    }))
    .filter((district) => {
      const key = districtToken(district.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function bundledTowns(regionValue: string | null | undefined, districtValue: string | null | undefined) {
  const region = canonicalGhanaRegion(regionValue);
  const requestedDistrict = districtToken(districtValue);
  if (!region || !requestedDistrict) return [];

  const district = regionDistricts(region).find((candidate) => {
    return districtToken(candidate.name) === requestedDistrict || districtToken(correctedDistrictName(candidate.name)) === requestedDistrict;
  });
  if (!district) return [];

  const seen = new Set<string>();
  return district.towns
    .map((town) => ({
      code: town.code,
      name: town.name,
      gpsCoordinate: town.latitude !== null && town.longitude !== null ? `${town.latitude},${town.longitude}` : null,
      landmark: null,
    }))
    .filter((town) => {
      const key = normaliseLocationToken(town.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function hasBundledDistrict(regionValue: string | null | undefined, districtValue: string | null | undefined) {
  return bundledDistricts(regionValue).some((district) => districtToken(district.name) === districtToken(districtValue));
}
