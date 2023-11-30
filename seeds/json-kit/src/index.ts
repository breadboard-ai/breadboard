/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import validateJson from "./nodes/validate-json.js";
import schemish from "./nodes/schemish.js";

const JSONKit = new KitBuilder({
  title: "JSON Kit",
  description:
    "A Breadboard Kit containing nodes that facilitate wrangling JSON objects",
  version: "0.0.1",
  url: "npm:@google-labs/json-kit",
}).build({
  validateJson,
  schemish,
});

export default JSONKit;

export type JSONKit = InstanceType<typeof JSONKit>;
