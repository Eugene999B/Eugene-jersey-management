export function persistentSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    path: "/",
    priority: "high" as const,
  };
}
