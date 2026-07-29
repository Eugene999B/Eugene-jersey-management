"use client";

import { useEffect, useId, useState } from "react";
import { GHANA_REGIONS } from "@/lib/ghana-locations";

type LocationSuggestion = {
  code: string;
  name: string;
  capital?: string | null;
  gpsCoordinate?: string | null;
  landmark?: string | null;
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
  const response = await fetch(url, { signal });
  if (!response.ok) return { items: [] as LocationSuggestion[], notice: "" };
  const payload = await response.json() as { items?: LocationSuggestion[]; notice?: string };
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    notice: typeof payload.notice === "string" ? payload.notice : "",
  };
}

export function GhanaLocationFields({ required = false, compact = false, defaults = {} }: Props) {
  const districtListId = useId();
  const communityListId = useId();
  const [region, setRegion] = useState(defaults.region ?? "");
  const [district, setDistrict] = useState(defaults.district ?? "");
  const [town, setTown] = useState(defaults.city ?? "");
  const [districts, setDistricts] = useState<LocationSuggestion[]>([]);
  const [communities, setCommunities] = useState<LocationSuggestion[]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!region) {
      setDistricts([]);
      return;
    }
    const controller = new AbortController();
    setDistrictLoading(true);
    loadSuggestions(`/api/ghana-locations?level=districts&region=${encodeURIComponent(region)}`, controller.signal)
      .then((result) => {
        setDistricts(result.items);
        setNotice(result.notice);
      })
      .catch(() => undefined)
      .finally(() => setDistrictLoading(false));
    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    if (!region || !district) {
      setCommunities([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCommunityLoading(true);
      loadSuggestions(`/api/ghana-locations?level=communities&region=${encodeURIComponent(region)}&district=${encodeURIComponent(district)}`, controller.signal)
        .then((result) => {
          setCommunities(result.items);
          setNotice(result.notice);
        })
        .catch(() => undefined)
        .finally(() => setCommunityLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [region, district]);

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
            setCommunities([]);
          }}
        >
          <option value="">Choose a region</option>
          {GHANA_REGIONS.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>District / Municipal / Metropolitan{required ? " *" : ""}</span>
        <input
          className="field"
          name="district"
          list={districtListId}
          required={required}
          maxLength={180}
          value={district}
          disabled={!region}
          placeholder={!region ? "Choose a region first" : districtLoading ? "Loading districts..." : "Choose or type the district"}
          onChange={(event) => {
            setDistrict(event.target.value);
            setTown("");
          }}
          autoComplete="address-level2"
        />
        <datalist id={districtListId}>
          {districts.map((item) => <option key={item.code || item.name} value={item.name}>{item.capital ? `Capital: ${item.capital}` : ""}</option>)}
        </datalist>
        <span className="mt-1 block text-xs text-slate-500">Suggestions come from Ghana&apos;s official location directory. Manual entry remains available for spelling or boundary updates.</span>
      </label>

      <label className="block">
        <span className={labelClass}>Town, city or community{required ? " *" : ""}</span>
        <input
          className="field"
          name="city"
          list={communityListId}
          required={required}
          maxLength={160}
          value={town}
          disabled={!district}
          placeholder={!district ? "Choose a district first" : communityLoading ? "Loading communities..." : "Choose or type the town/community"}
          onChange={(event) => setTown(event.target.value)}
          autoComplete="address-level3"
        />
        <datalist id={communityListId}>
          {communities.map((item) => <option key={item.code || item.name} value={item.name}>{item.landmark ?? ""}</option>)}
        </datalist>
        <span className="mt-1 block text-xs text-slate-500">The list is searchable; type the correct community when it is not yet listed.</span>
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

      {notice ? <p className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{notice}</p> : null}
    </div>
  );
}
