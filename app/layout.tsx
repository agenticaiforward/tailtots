import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif for the marketing landing — outcome-first headlines.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "TailTots | Parent-Guided Real-World Development For Kids",
  description:
    "Character isn't taught. It's practiced. TailTots turns real pet care and everyday moments into character and life skills for kids 4–12 — parent-guided, no strangers, no open chat, ~10 minutes a day.",
  metadataBase: new URL("https://tailtots.com"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "TailTots — Character isn't taught. It's practiced.",
    description:
      "Real pets. Real responsibility. Real growth. Parent-guided missions that build character and life skills in ~10 minutes a day. No strangers, no open chat — safety by design.",
    url: "https://tailtots.com",
    siteName: "TailTots",
    type: "website",
    images: [{ url: "/hero-kids-pets.png", alt: "Kids caring for their pets with TailTots" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TailTots — Character isn't taught. It's practiced.",
    description:
      "Parent-guided missions with real pets build character and life skills. Ages 4–12, ~10 minutes a day, safety by design.",
    images: ["/hero-kids-pets.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TailTots",
  },
};

export const viewport: Viewport = {
  themeColor: "#165a4b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
