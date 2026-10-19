import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SystemStatusProvider } from "@/contexts/SystemStatusProvider";
import HubIdentify from "@/components/HubIdentify";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KPN Talent Acquisition System",
  description: "Comprehensive talent acquisition and recruitment management system",
  manifest: "/faveicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/faveicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/faveicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/faveicon/favicon.ico",
    apple: "/faveicon/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "KPN Talent Acquisition",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_HUB_SDK_URL && (
          <script
            src={process.env.NEXT_PUBLIC_HUB_SDK_URL}
            data-app-key={process.env.NEXT_PUBLIC_HUB_SDK_KEY}
            data-release={process.env.NEXT_PUBLIC_GIT_SHA || undefined}
            data-bug-button="false"
            defer
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SystemStatusProvider>
          <AuthProvider>
            <HubIdentify />
            {children}
          </AuthProvider>
        </SystemStatusProvider>
      </body>
    </html>
  );
}
