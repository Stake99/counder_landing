import type { Metadata, Viewport } from "next";
import { Manrope, DM_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

/* Typefaces matched to counder.com (Manrope + DM Mono, self-hosted via next/font). */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://counder.com"),
  title: {
    default: "Counder — The Network for Collective Understanding",
    template: "%s — Counder",
  },
  description:
    "The Network for Collective Understanding. Connecting visionary investors, entrepreneurs, and global leaders across 27+ countries, converging once a year in Cape Town.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Counder — The Network for Collective Understanding",
    description:
      "500 perspectives from all over the world, in one place. Once a year. Cape Town.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
