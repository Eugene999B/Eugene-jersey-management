export const GHANA_REGIONS = [
  { code: "GH-AF", name: "Ahafo", capital: "Goaso" },
  { code: "GH-AH", name: "Ashanti", capital: "Kumasi" },
  { code: "GH-BO", name: "Bono", capital: "Sunyani" },
  { code: "GH-BE", name: "Bono East", capital: "Techiman" },
  { code: "GH-CP", name: "Central", capital: "Cape Coast" },
  { code: "GH-EP", name: "Eastern", capital: "Koforidua" },
  { code: "GH-AA", name: "Greater Accra", capital: "Accra" },
  { code: "GH-NE", name: "North East", capital: "Nalerigu" },
  { code: "GH-NP", name: "Northern", capital: "Tamale" },
  { code: "GH-OT", name: "Oti", capital: "Dambai" },
  { code: "GH-SV", name: "Savannah", capital: "Damongo" },
  { code: "GH-UE", name: "Upper East", capital: "Bolgatanga" },
  { code: "GH-UW", name: "Upper West", capital: "Wa" },
  { code: "GH-TV", name: "Volta", capital: "Ho" },
  { code: "GH-WP", name: "Western", capital: "Sekondi-Takoradi" },
  { code: "GH-WN", name: "Western North", capital: "Sefwi Wiawso" },
] as const;

export type GhanaRegionName = (typeof GHANA_REGIONS)[number]["name"];

export type GhanaLocationValue = {
  country?: string | null;
  region?: string | null;
  district?: string | null;
  town?: string | null;
  area?: string | null;
  digitalAddress?: string | null;
  streetAddress?: string | null;
  landmark?: string | null;
};

export function normaliseLocationToken(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function canonicalGhanaRegion(value: string | null | undefined): GhanaRegionName | null {
  const token = normaliseLocationToken(value).replace(/ region$/, "");
  const match = GHANA_REGIONS.find((region) => normaliseLocationToken(region.name) === token);
  return match?.name ?? null;
}

export function isGhanaRegion(value: string | null | undefined): value is GhanaRegionName {
  return canonicalGhanaRegion(value) !== null;
}

export function cleanLocationText(value: string | null | undefined, maximum = 160) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maximum) : null;
}

export function buildLocationSearchText(value: GhanaLocationValue) {
  return [
    value.country || "Ghana",
    value.region,
    value.district,
    value.town,
    value.area,
    value.digitalAddress,
    value.streetAddress,
    value.landmark,
  ]
    .map(normaliseLocationToken)
    .filter(Boolean)
    .join(" ");
}

export function formatGhanaLocation(value: GhanaLocationValue) {
  const primary = [value.area, value.town].map((item) => cleanLocationText(item)).filter(Boolean).join(", ");
  const administrative = [value.district, value.region].map((item) => cleanLocationText(item)).filter(Boolean).join(" · ");
  return [primary, administrative].filter(Boolean).join(" — ") || "Ghana";
}
