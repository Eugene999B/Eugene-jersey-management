import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eugene Jersey Management",
    short_name: "EJM",
    description: "Professional jersey production, sports retail, POS, stock and multi-shop operations.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#0b1f3a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/ejm-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
