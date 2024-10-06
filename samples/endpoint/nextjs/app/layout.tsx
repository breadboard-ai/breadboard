/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Link from "next/link";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Story Teller",
  description: "Writes children's stories based on a topic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const title = metadata.title as string;
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="p-4 bg-gray-800 text-white">
          <h1>{title}</h1>
          <p>{metadata.description}</p>
          <ol>
            <li>
              <a href="/">Home</a>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
          </ol>
        </header>
        {children}
      </body>
    </html>
  );
}
