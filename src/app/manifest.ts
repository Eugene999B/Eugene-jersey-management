import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eugene Jersey Management",
    short_name: "EJM",
    description: "Jersey production, sports retail, POS, stock and shop operations.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#0f766e",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/ejm-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
