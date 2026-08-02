import type { MetadataRoute } from "next";
import { PLATFORM_DESCRIPTION, PLATFORM_MARK_PATH, PLATFORM_NAME, PLATFORM_SHORT_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PLATFORM_NAME,
    short_name: PLATFORM_SHORT_NAME,
    description: PLATFORM_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#07111f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: PLATFORM_MARK_PATH, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
