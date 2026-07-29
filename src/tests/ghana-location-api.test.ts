import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/ghana-locations/route";

type LocationPayload = {
  source?: string;
  generatedAt?: string;
  offlineReady?: boolean;
  items?: Array<{ code: string; name: string }>;
};

describe("offline Ghana location API", () => {
  it("returns bundled districts and towns without an external provider", async () => {
    const districtResponse = await GET(new Request("http://localhost/api/ghana-locations?level=districts&region=Greater%20Accra"));
    expect(districtResponse.status).toBe(200);
    const districtPayload = await districtResponse.json() as LocationPayload;
    expect(districtPayload.offlineReady).toBe(true);
    expect(districtPayload.source).toBe("GeoNames Ghana country dump");
    expect(districtPayload.generatedAt).toBeTruthy();
    expect(districtPayload.items?.some((item) => item.name === "Accra Metropolitan")).toBe(true);

    const townResponse = await GET(new Request("http://localhost/api/ghana-locations?level=communities&region=Greater%20Accra&district=Accra%20Metropolitan"));
    expect(townResponse.status).toBe(200);
    const townPayload = await townResponse.json() as LocationPayload;
    expect(townPayload.offlineReady).toBe(true);
    expect(townPayload.items?.length).toBeGreaterThan(0);
  });

  it("rejects a district that does not belong to the selected region", async () => {
    const response = await GET(new Request("http://localhost/api/ghana-locations?level=communities&region=Ashanti&district=Accra%20Metropolitan"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Choose a district from the selected region's list." });
  });
});
