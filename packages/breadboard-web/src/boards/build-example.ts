/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";
import { prompt } from "@google-labs/template-kit";
import { reverseString } from "../build-example-kit.js";

const word = input({ description: "The word to reverse" });
const reversed = reverseString({ forwards: word });
const capitalizer = code(
  { str: word },
  { capitalized: "string" },
  ({ str }) => ({ capitalized: str.toUpperCase() })
);
const result = prompt`The word "${word}" is "${reversed}" in reverse
and "${capitalizer.outputs.capitalized}" when capitalized.`;

export default board({
  title: "Example of @breadboard-ai/build",
  description: "A simple example of using the @breadboard-ai/build API",
  version: "1.1.0",
  inputs: { word },
  outputs: { result },
});
