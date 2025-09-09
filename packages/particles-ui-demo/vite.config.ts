/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { UserConfig } from "vite";

export default async () => {
  config();

  const entry: Record<string, string> = {
    demo: "./demo.html",
    alt: "./resolver.html",
  };
  return {
    build: {
      lib: {
        entry,
        name: "Particles UI Demo",
        formats: ["es"],
      },
      target: "esnext",
    },
    define: {},
    resolve: {
      dedupe: ["lit"],
    },
  } satisfies UserConfig;
};
