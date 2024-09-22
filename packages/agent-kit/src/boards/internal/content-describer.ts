/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, object, starInputs } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";
import { describeContent } from "../../future/templating.js";

// A board that acts as a custom describer for the
// Content component.

const inputs = starInputs({ type: object({}, "unknown") });

const describe = code(
  {
    $metadata: {
      title: "Describe",
      description: "Describes the content",
    },
    "*": inputs,
  },
  { inputSchema: object({}, "unknown"), outputSchema: object({}, "unknown") },
  describeContent
);

export default board({
  title: "Content Describer",
  description: "A custom describer for the Content component",
  version: "0.1.0",
  inputs: { "*": inputs },
  outputs: {
    inputSchema: describe.outputs.inputSchema,
    outputSchema: describe.outputs.outputSchema,
  },
});
