export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const startsWithPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return startsWithPlus ? `+${digits}` : digits;
}

export function phoneRateKey(value: string) {
  return normalizePhone(value).replace(/^\+/, "");
}
