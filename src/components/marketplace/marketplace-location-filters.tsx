"use client";

import { useEffect, useState } from "react";
import { GHANA_REGIONS } from "@/lib/ghana-locations";

type Suggestion = { code: string; name: string };

type Props = {
  region?: string;
  district?: string;
  city?: string;
  suburb?: string;
};

async function suggestions(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { items?: Suggestion[]; notice?: string; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || payload?.notice || "The built-in Ghana location list could not be loaded.");
  return Array.isArray(payload?.items) ? payload.items : [];
}

function containsValue(items: Suggestion[], value: string) {
  return items.some((item) => item.name === value);
}

export function MarketplaceLocationFilters({ region: initialRegion = "", district: initialDistrict = "", city: initialCity = "", suburb = "" }: Props) {
  const [region, setRegion] = useState(initialRegion);
  const [district, setDistrict] = useState(initialDistrict);
  const [city, setCity] = useState(initialCity);
  const [districts, setDistricts] = useState<Suggestion[]>([]);
  const [towns, setTowns] = useState<Suggestion[]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [townLoading, setTownLoading] = useState(false);
  const [districtFailed, setDistrictFailed] = useState(false);
  const [townFailed, setTownFailed] = useState(false);

  useEffect(() => {
    if (!region) {
      setDistricts([]);
      setDistrictFailed(false);
      return;
    }
    const controller = new AbortController();
    setDistrictLoading(true);
    setDistrictFailed(false);
    suggestions(`/api/ghana-locations?level=districts&region=${encodeURIComponent(region)}`, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setDistricts(items);
        setDistrictFailed(items.length === 0);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDistricts([]);
          setDistrictFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDistrictLoading(false);
      });
    return () => controller.abort();
  }, [region]);

  useEffect(() => {
    if (!region || !district) {
      setTowns([]);
      setTownFailed(false);
      return;
    }
    const controller = new AbortController();
    setTownLoading(true);
    setTownFailed(false);
    suggestions(`/api/ghana-locations?level=communities&region=${encodeURIComponent(region)}&district=${encodeURIComponent(district)}`, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setTowns(items);
        setTownFailed(items.length === 0);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTowns([]);
          setTownFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTownLoading(false);
      });
    return () => controller.abort();
  }, [region, district]);

  return (
    <>
      <select className="field" name="region" value={region} onChange={(event) => {
        setRegion(event.target.value);
        setDistrict("");
        setCity("");
        setDistricts([]);
        setTowns([]);
      }} aria-label="Marketplace region">
        <option value="">All regions</option>
        {GHANA_REGIONS.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
      </select>

      <select className="field" name="district" value={district} onChange={(event) => {
        setDistrict(event.target.value);
        setCity("");
        setTowns([]);
      }} disabled={!region || districtLoading} aria-label="Marketplace district">
        <option value="">{!region ? "Choose region first" : districtLoading ? "Loading districts..." : districtFailed ? "Districts unavailable — refresh" : "All districts"}</option>
        {district && !containsValue(districts, district) ? <option value={district}>{district}</option> : null}
        {districts.map((item) => <option key={item.code || item.name} value={item.name}>{item.name}</option>)}
      </select>

      <select className="field" name="city" value={city} onChange={(event) => setCity(event.target.value)} disabled={!district || townLoading} aria-label="Marketplace town or city">
        <option value="">{!district ? "Choose district first" : townLoading ? "Loading towns..." : townFailed ? "Towns unavailable — refresh" : "All towns and communities"}</option>
        {city && !containsValue(towns, city) ? <option value={city}>{city}</option> : null}
        {towns.map((item) => <option key={item.code || item.name} value={item.name}>{item.name}</option>)}
      </select>

      <input className="field" name="suburb" defaultValue={suburb} placeholder="Suburb, area or sub-town" aria-label="Marketplace suburb or area" />
    </>
  );
}
