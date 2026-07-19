import { redirect } from "next/navigation";
import { clearBuyerSessionCookie } from "@/lib/buyer-session";

export async function GET() {
  await clearBuyerSessionCookie();
  redirect("/shops");
}
