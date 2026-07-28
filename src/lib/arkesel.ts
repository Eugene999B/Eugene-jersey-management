export type ArkeselSendResult = {
  accepted: boolean;
  providerReference: string;
};

export function formatArkeselRecipient(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = `233${digits.slice(1)}`;
  return digits;
}

export function parseArkeselSendResponse(payload: unknown): ArkeselSendResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { accepted: false, providerReference: "ARKESEL-INVALID-RESPONSE" };
  }

  const record = payload as Record<string, unknown>;
  if (record.status !== "success" || !Array.isArray(record.data)) {
    return { accepted: false, providerReference: "ARKESEL-REJECTED" };
  }

  for (const entry of record.data) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const id = (entry as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) {
      return { accepted: true, providerReference: id.trim() };
    }
  }

  return { accepted: false, providerReference: "ARKESEL-NO-MESSAGE-ID" };
}
