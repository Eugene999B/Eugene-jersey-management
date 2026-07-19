import { createHash, randomBytes } from "crypto";

export function createPlainToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
