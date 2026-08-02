"use client";

import { useEffect, useState } from "react";
import { GHANA_REGIONS } from "@/lib/ghana-locations";

type LocationSuggestion = {
  code: string;
  name: string;
  capital?: string | null;
  gpsCoordinate?: string | null;
  landmark?: string | null;
};

type SuggestionPayload = {
  items?: LocationSuggestion[];
  notice?: string;
  error?: string;
};

type Props = {
  required?: boolean;
  compact?: boolean;
  defaults?: {
    region?: string | null;
    district?: string | null;
    city?: string | null;
    suburb?: string | null;
    digitalAddress?: string | null;
    address?: string | null;
    landmark?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
};

async function loadSuggestions(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, cache: "no-store" });
  const payload = await response.json().catch(() => null) as SuggestionPayload | null;
  if (!response.ok) {
    throw new Error(payload?.error || payload?.notice || "The built-in Ghana location list could not be loaded. Refresh this page and try again.");
  }
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    notice: typeof payload?.notice === "string" ? payload.notice : "",
  };
}

function containsValue(items: LocationSuggestion[], value: string) {
  return items.some((item) => item.name === value);
}

export function GhanaLocationFields({ required = false, compact = false, defaults = {} }: Props) {
  const [region, setRegion] = useState(defaults.region ?? "");
  const [district, setDistrict] = useState(defaults.district ?? "");
  const [town, setTown] = useState(defaults.city ?? "");
  const [districts, setDistricts] = useState<LocationSuggestion[]>([]);
  const [communities, setCommunities] = useState<LocationSuggestion[]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [districtError, setDistrictError] = useState("");
  const [communityError, setCommunityError] = useState("");
  const [notice, setNotice] = useState("");
  const [districtReload, setDistrictReload] = useState(0);
  const [communityReload, setCommunityReload] = useState(0);

  useEffect(() => {
    if (!region) {
      setDistricts([]);
      setDistrictError("");
      return;
    }

    const controller = new AbortController();
    setDistrictLoading(true);
    setDistrictError("");
    loadSuggestions(`/api/ghana-locations?level=districts&region=${encodeURIComponent(region)}&retry=${districtReload}`, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setDistricts(result.items);
        setNotice(result.notice);
        if (!result.items.length) setDistrictError("No districts were found in the built-in Ghana location list. Refresh the page and retry.");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setDistricts([]);
        setDistrictError(error instanceof Error ? error.message : "Districts could not be loaded from the built-in Ghana location list.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDistrictLoading(false);
      });
    return () => controller.abort();
  }, [region, districtReload]);

  useEffect(() => {
    if (!region || !district) {
      setCommunities([]);
      setCommunityError("");
      return;
    }

    const controller = new AbortController();
    setCommunityLoading(true);
    setCommunityError("");
    loadSuggestions(`/api/ghana-locations?level=communities&region=${encodeURIComponent(region)}&district=${encodeURIComponent(district)}&retry=${communityReload}`, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCommunities(result.items);
        setNotice(result.notice);
        if (!result.items.length) setCommunityError("No towns or communities were found in the built-in Ghana location list. Refresh the page and retry.");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCommunities([]);
        setCommunityError(error instanceof Error ? error.message : "Towns and communities could not be loaded from the built-in Ghana location list.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCommunityLoading(false);
      });
    return () => controller.abort();
  }, [region, district, communityReload]);

  const spacing = compact ? "gap-3" : "gap-5";
  const labelClass = compact
    ? "mb-1 block text-xs font-bold text-slate-600"
    : "mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500";

  return (
    <div className={`grid ${spacing} md:grid-cols-2`}>
      <input type="hidden" name="country" value="Ghana" />
      <label className="block">
        <span className={labelClass}>Region{required ? " *" : ""}</span>
        <select
          className="field"
          name="region"
          required={required}
          value={region}
          onChange={(event) => {
            setRegion(event.target.value);
            setDistrict("");
            setTown("");
            setDistricts([]);
            setCommunities([]);
            setDistrictError("");
            setCommunityError("");
          }}
        >
          <option value="">Choose a region</option>
          {GHANA_REGIONS.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>District / Municipal / Metropolitan{required ? " *" : ""}</span>
        <select
          className="field"
          name="district"
          required={required}
          value={district}
          disabled={!region || districtLoading}
          onChange={(event) => {
            setDistrict(event.target.value);
            setTown("");
            setCommunities([]);
            setCommunityError("");
          }}
          autoComplete="address-level2"
        >
          <option value="">
            {!region ? "Choose a region first" : districtLoading ? "Loading all districts..." : districtError ? "Districts unavailable — retry below" : "Choose a district"}
          </option>
          {district && !containsValue(districts, district) ? <option value={district}>{district} — saved location</option> : null}
          {districts.map((item) => <option key={item.code || item.name} value={item.name}>{item.name}{item.capital ? ` — capital: ${item.capital}` : ""}</option>)}
        </select>
        {districtError ? <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-700"><span>{districtError}</span><button type="button" className="rounded-lg border border-red-200 bg-white px-2 py-1 font-semibold" onClick={() => setDistrictReload((value) => value + 1)}>Retry districts</button></span> : <span className="mt-1 block text-xs text-slate-500">Select from the district, municipal and metropolitan list bundled with ESM for the chosen region.</span>}
      </label>

      <label className="block">
        <span className={labelClass}>Town, city or community{required ? " *" : ""}</span>
        <select
          className="field"
          name="city"
          required={required}
          value={town}
          disabled={!district || communityLoading}
          onChange={(event) => setTown(event.target.value)}
          autoComplete="address-level3"
        >
          <option value="">
            {!district ? "Choose a district first" : communityLoading ? "Loading all towns and communities..." : communityError ? "Towns unavailable — retry below" : "Choose a town, city or community"}
          </option>
          {town && !containsValue(communities, town) ? <option value={town}>{town} — saved location</option> : null}
          {communities.map((item) => <option key={item.code || item.name} value={item.name}>{item.name}</option>)}
        </select>
        {communityError ? <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-700"><span>{communityError}</span><button type="button" className="rounded-lg border border-red-200 bg-white px-2 py-1 font-semibold" onClick={() => setCommunityReload((value) => value + 1)}>Retry towns</button></span> : <span className="mt-1 block text-xs text-slate-500">Select the town or community under the chosen district. Type only the smaller area details below.</span>}
      </label>

      <label className="block">
        <span className={labelClass}>Suburb, area or sub-town</span>
        <input className="field" name="suburb" maxLength={160} defaultValue={defaults.suburb ?? ""} placeholder="For example: Ayeduase, Community 18, Abeka" autoComplete="address-level4" />
      </label>

      <label className="block">
        <span className={labelClass}>GhanaPost GPS digital address</span>
        <input className="field uppercase" name="digitalAddress" maxLength={40} defaultValue={defaults.digitalAddress ?? ""} placeholder="For example: AK-123-4567" autoCapitalize="characters" />
      </label>

      <label className="block">
        <span className={labelClass}>Street, building or shop number</span>
        <input className="field" name="address" maxLength={500} defaultValue={defaults.address ?? ""} placeholder="Street name, building, shop number or market" autoComplete="street-address" />
      </label>

      <label className="block md:col-span-2">
        <span className={labelClass}>Nearby landmark and directions</span>
        <textarea className="field min-h-24 resize-y" name="landmark" maxLength={700} defaultValue={defaults.landmark ?? ""} placeholder="For example: opposite the police barrier, second floor above the pharmacy" />
      </label>

      <details className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Optional map coordinates</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={labelClass}>Latitude</span><input className="field" name="latitude" type="number" step="any" min="-90" max="90" defaultValue={defaults.latitude ?? ""} placeholder="5.6037" /></label>
          <label className="block"><span className={labelClass}>Longitude</span><input className="field" name="longitude" type="number" step="any" min="-180" max="180" defaultValue={defaults.longitude ?? ""} placeholder="-0.1870" /></label>
        </div>
      </details>

      {notice ? <p className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" aria-live="polite">{notice}</p> : null}
    </div>
  );
}
