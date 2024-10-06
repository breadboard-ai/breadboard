/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from "next";
import { Amatic_SC } from "next/font/google";

import "./globals.css";
import Navigation from "./navigation";

// If loading a variable font, you don't need to specify the font weight
const amatic = Amatic_SC({ weight: "700", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Story Teller",
  description: "Writes children's stories based on a topic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const title = metadata.title as string;
  return (
    <html lang="en" className="flex justify-center">
      <body
        className={`${amatic.className} text-3xl antialiased max-w-screen-md w-screen`}
      >
        <header className="p-4 border-b-2">
          <section className="p-3">
            <h1 className="text-6xl">{title}</h1>
            <p className="text-slate-400 ">{metadata.description}</p>
          </section>
          <Navigation></Navigation>
        </header>
        {children}
      </body>
    </html>
  );
}
