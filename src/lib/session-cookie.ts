export function persistentSessionCookieOptions(
  maxAge: number,
  secure = process.env.NODE_ENV === "production",
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    path: "/",
    priority: "high" as const,
  };
}
