import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eugene Jersey Management",
    short_name: "EJM",
    description: "Professional multi-shop commerce, jersey production, POS, stock and customer operations.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#07111f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/ejm-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
