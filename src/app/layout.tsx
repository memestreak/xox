import type { Metadata, Viewport } from "next";
import {
  Geist, Geist_Mono, Orbitron,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
          content="#0a0a0a"
        />
      </head>
      <body
        className={
          `${geistSans.variable}`
          + ` ${geistMono.variable}`
          + ` ${orbitron.variable}`
          + ' antialiased'
        }
      >
        {children}
      </body>
    </html>
  );
}
