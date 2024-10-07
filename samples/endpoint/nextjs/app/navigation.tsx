/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoryList } from "./utils/local-store";

const globalNavigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/new", label: "Tell a New Story", highlight: true },
];

export default function Navigation() {
  const pathname = usePathname();
  const stories = getStoryList();

  return (
    <nav>
      <ol className="flex pt-2 gap-5">
        {globalNavigation.map(({ href, label, highlight }, i) => {
          if (href === "/new" && stories.length === 0) {
            return null;
          }
          return (
            <li key={i}>
              <Link
                className={`block py-2 px-4 border-2 rounded-full ${highlight ? "bg-fuchsia-100  hover:bg-fuchsia-200" : " hover:bg-slate-100"} ${pathname === href ? "border-gray-300 pointer-events-none" : "border-transparent"}`}
                href={href}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
