import { describe, expect, it } from "vitest";
import { formatArkeselRecipient, parseArkeselSendResponse } from "@/lib/arkesel";

describe("Arkesel recipient formatting", () => {
  it("converts local Ghana mobile numbers to international digits", () => {
    expect(formatArkeselRecipient("024 123 4567")).toBe("233241234567");
    expect(formatArkeselRecipient("+233 24 123 4567")).toBe("233241234567");
    expect(formatArkeselRecipient("00 233 24 123 4567")).toBe("233241234567");
  });

  it("does not invent a country code for an unknown international number", () => {
    expect(formatArkeselRecipient("+44 7700 900123")).toBe("447700900123");
  });
});

describe("Arkesel V2 response parsing", () => {
  it("extracts the provider UUID from the documented data array", () => {
    expect(parseArkeselSendResponse({
      status: "success",
      data: [{ recipient: "233241234567", id: "9b752841-7ee7-4d40-b4fe-768bfb1da4f0" }],
    })).toEqual({
      accepted: true,
      providerReference: "9b752841-7ee7-4d40-b4fe-768bfb1da4f0",
    });
  });

  it("rejects success payloads that contain only invalid numbers", () => {
    expect(parseArkeselSendResponse({
      status: "success",
      data: [{ "invalid numbers": ["22354674948"] }],
    })).toEqual({ accepted: false, providerReference: "ARKESEL-NO-MESSAGE-ID" });
  });

  it("rejects malformed or provider-error payloads", () => {
    expect(parseArkeselSendResponse(null)).toEqual({ accepted: false, providerReference: "ARKESEL-INVALID-RESPONSE" });
    expect(parseArkeselSendResponse({ status: "error", message: "Validation failed" })).toEqual({ accepted: false, providerReference: "ARKESEL-REJECTED" });
  });
});
