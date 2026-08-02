import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ImageInputCompatibility } from "@/components/media/image-input-compatibility";
import { PLATFORM_DESCRIPTION, PLATFORM_LOGO_PATH, PLATFORM_MARK_PATH, PLATFORM_NAME } from "@/lib/brand";
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
  title: { default: PLATFORM_NAME, template: `%s | ${PLATFORM_NAME}` },
  description: PLATFORM_DESCRIPTION,
  applicationName: PLATFORM_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: PLATFORM_MARK_PATH,
  },
  openGraph: {
    type: "website",
    siteName: PLATFORM_NAME,
    title: PLATFORM_NAME,
    description: PLATFORM_DESCRIPTION,
    images: [{ url: PLATFORM_LOGO_PATH, width: 920, height: 220, alt: PLATFORM_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: PLATFORM_NAME,
    description: PLATFORM_DESCRIPTION,
    images: [PLATFORM_LOGO_PATH],
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f4f7fb] text-slate-950">
        <ImageInputCompatibility />
        {children}
      </body>
    </html>
  );
}
