/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileSystemEntry, RuntimeFlags } from "@breadboard-ai/types";

export { envFromFlags };

function envFromFlags(flags: RuntimeFlags): FileSystemEntry[] {
  return [
    {
      path: "/env/flags",
      data: [{ parts: [{ json: flags }] }],
    },
  ];
}
