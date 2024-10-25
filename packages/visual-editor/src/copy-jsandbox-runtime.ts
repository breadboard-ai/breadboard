/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile } from "fs/promises";
import { dirname, join } from "path";

// TODO: Actually make this a real dependency.
const jsandboxDir = dirname(
  join(
    import.meta.dirname,
    "..",
    "..",
    "jsandbox",
    "target",
    "wasm-bindgen",
    "."
  )
);

await Promise.all(
  ["jsandbox_bg.js", "jsandbox_bg.wasm"].map((filename) => {
    copyFile(
      decodeURI(join(jsandboxDir, filename)),
      decodeURI(join(import.meta.dirname, "..", "public", filename))
    );
  })
);
