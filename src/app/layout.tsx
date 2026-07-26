import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

function metadataBase() {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: "Eugene Jersey Management", template: "%s | Eugene Jersey Management" },
  description: "Professional multi-shop commerce, jersey production, POS, customer, credit, stock and design operations.",
  applicationName: "Eugene Jersey Management",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/brand/ejm-mark.svg",
  },
  openGraph: {
    type: "website",
    siteName: "Eugene Jersey Management",
    title: "Eugene Jersey Management",
    description: "One secure operating system for sports retail, jersey production and multi-shop control.",
    images: [{ url: "/brand/ejm-logo.svg", width: 920, height: 220, alt: "Eugene Jersey Management" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eugene Jersey Management",
    description: "Professional sports retail, production and multi-shop operations.",
    images: ["/brand/ejm-logo.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f4f7fb] text-slate-950">{children}</body>
    </html>
  );
}
