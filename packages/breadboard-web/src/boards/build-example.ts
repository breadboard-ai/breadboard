/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input } from "@breadboard-ai/build";
import { prompt } from "@google-labs/template-kit";
import { reverseString } from "../build-example-kit.js";

const word = input({ description: "The word to reverse" });
const reversed = reverseString({ forwards: word });
const result = prompt`The word "${word}" is "${reversed}" in reverse`;

export default board({
  title: "Example of @breadboard-ai/build",
  description: "A simple example of using the @breadboard-ai/build API",
  version: "1.0.0",
  inputs: { word },
  outputs: { result },
});
