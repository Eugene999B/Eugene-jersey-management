"use client";

import { useEffect, useId, useState } from "react";
import { GHANA_REGIONS } from "@/lib/ghana-locations";

type Suggestion = { code: string; name: string };

type Props = {
  region?: string;
  district?: string;
  city?: string;
  suburb?: string;
};

async function suggestions(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const payload = await response.json() as { items?: Suggestion[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export function MarketplaceLocationFilters({ region: initialRegion = "", district: initialDistrict = "", city: initialCity = "", suburb = "" }: Props) {
  const districtListId = useId();
  const townListId = useId();
  const [region, setRegion] = useState(initialRegion);
  const [district, setDistrict] = useState(initialDistrict);
  const [city, setCity] = useState(initialCity);
  const [districts, setDistricts] = useState<Suggestion[]>([]);
  const [towns, setTowns] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!region) {
      setDistricts([]);
      return;
    }
    const controller = new AbortController();
    suggestions(`/api/ghana-locations?level=districts&region=${encodeURIComponent(region)}`, controller.signal)
      .then(setDistricts)
      .catch(() => undefined);
    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    if (!region || !district) {
      setTowns([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      suggestions(`/api/ghana-locations?level=communities&region=${encodeURIComponent(region)}&district=${encodeURIComponent(district)}`, controller.signal)
        .then(setTowns)
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [region, district]);

  return (
    <>
      <select className="field" name="region" value={region} onChange={(event) => {
        setRegion(event.target.value);
        setDistrict("");
        setCity("");
      }} aria-label="Marketplace region">
        <option value="">All regions</option>
        {GHANA_REGIONS.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
      </select>
      <div>
        <input className="field" name="district" list={districtListId} value={district} onChange={(event) => {
          setDistrict(event.target.value);
          setCity("");
        }} placeholder={region ? "District or municipality" : "Choose region first"} disabled={!region} aria-label="Marketplace district" />
        <datalist id={districtListId}>{districts.map((item) => <option key={item.code || item.name} value={item.name} />)}</datalist>
      </div>
      <div>
        <input className="field" name="city" list={townListId} value={city} onChange={(event) => setCity(event.target.value)} placeholder={district ? "Town, city or community" : "Choose district first"} disabled={!district} aria-label="Marketplace town or city" />
        <datalist id={townListId}>{towns.map((item) => <option key={item.code || item.name} value={item.name} />)}</datalist>
      </div>
      <input className="field" name="suburb" defaultValue={suburb} placeholder="Suburb, area or sub-town" aria-label="Marketplace suburb or area" />
    </>
  );
}
