/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import importHandler from "./nodes/import.js";
import include from "./nodes/include.js";
import invoke from "./nodes/invoke.js";
import passthrough from "./nodes/passthrough.js";
import reflect from "./nodes/reflect.js";
import slot from "./nodes/slot.js";

const builder = new KitBuilder({
  title: "Core Kit",
  description: "A Breadboard kit that enables composition and reuse of boards",
  version: "0.0.1",
  url: "npm:@google-labs/core-kit",
});

export const Core = builder.build({
  import: importHandler,
  include,
  invoke,
  passthrough,
  reflect,
  slot,
});
