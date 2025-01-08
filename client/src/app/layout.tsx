import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NyanCatChat",
  description:
    "NyanCatChat, a secure (AES-256, E2E), private, and anonymous chat app.",
  keywords: [
    "chat",
    "secure",
    "private",
    "anonymous",
    "encryption",
    "e2e",
    "aes-256",
  ],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "NyanCatChat",
    description:
      "NyanCatChat, a secure (AES-256, E2E), private, and anonymous chat app.",
    url: "https://chat.nyancat.se",
    siteName: "NyanCatChat",
    images: [
      {
        url: "/favicon.ico",
      },
    ],
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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
