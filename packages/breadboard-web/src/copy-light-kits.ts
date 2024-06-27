/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const PUBLIC_DIR = join(ROOT_DIR, "public");

const resolvePath = (module: string, file: string) => {
  if ("resolve" in import.meta) {
    const resolved = import.meta.resolve(`${module}/${file}`);
    return fileURLToPath(resolved);
  } else {
    const require = createRequire(import.meta.url);
    const resolvedModule = require.resolve(module);
    // A hack: assumes that the resolvedModule is pointing at `dist/index.js`,
    // and walks from there to the root, where the `kit.json` file is located.
    // Definitely wrong in the long term.
    // TODO: Figure out a more elegant solution.
    return join(dirname(resolvedModule), "..", "..", file);
  }
};

const LIGHT_KITS = [
  { module: "@google-labs/agent-kit", file: "agent.kit.json" },
];

export const copyLightKits = async () => {
  for (const { module, file } of LIGHT_KITS) {
    const source = resolvePath(module, file);
    const destination = join(PUBLIC_DIR, file);
    await fs.copyFile(source, destination);
  }
};

await copyLightKits();
