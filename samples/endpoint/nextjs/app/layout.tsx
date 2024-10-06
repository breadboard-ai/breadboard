/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from "next";
import { Amatic_SC } from "next/font/google";

import "./globals.css";
import Link from "next/link";

// If loading a variable font, you don't need to specify the font weight
const amatic = Amatic_SC({ weight: "700", subsets: ["latin"] });

const globalNavigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];

export const metadata: Metadata = {
  title: "The Story Teller",
  description: "Writes children's stories based on a topic.",
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
            <p>{metadata.description}</p>
          </section>
          <nav>
            <ol className="flex pt-2">
              {globalNavigation.map(({ href, label }, i) => (
                <li key={i}>
                  <Link
                    className="block py-2 px-4 hover:bg-slate-100 rounded-full"
                    href={href}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
