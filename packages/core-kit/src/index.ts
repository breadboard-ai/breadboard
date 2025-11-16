/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/legacy.js";

import invoke from "./nodes/invoke.js";

const metadata = {
  title: "Core Kit",
  description: "A Breadboard kit that enables composition and reuse of boards",
  version: "0.0.1",
  url: "npm:@google-labs/core-kit",
};

const builder = new KitBuilder(metadata);

const Core = builder.build({ invoke });

export default Core;
