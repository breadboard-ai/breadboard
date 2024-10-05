/**
 * @license
 * Copyright 2023 Google LLC
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
  title: "Hacker News Researcher",
  description: "Adds depth to Hacker News top stories",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="p-4 bg-gray-800 text-white">
          <h1>Story Teller</h1>
          <p>Writes children's stories based on a topic.</p>
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
