import type { Metadata, Viewport } from "next";
import {
  Barlow, Barlow_Condensed, JetBrains_Mono, Orbitron,
} from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "XOX",
  description: "An xox-style drum sequencer",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      style={{ colorScheme: 'dark' }}
    >
      <head>
        <meta
          name="theme-color"
          content="#141311"
        />
      </head>
      <body
        className={
          `${barlow.variable}`
          + ` ${barlowCondensed.variable}`
          + ` ${jetbrainsMono.variable}`
          + ` ${orbitron.variable}`
          + ' antialiased'
        }
      >
        {children}
      </body>
    </html>
  );
}
