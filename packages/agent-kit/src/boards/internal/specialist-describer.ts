/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, object, starInputs } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";
import { describeSpecialist } from "../../future/templating.js";

const inputs = starInputs({ type: object({}, "unknown") });

const describe = code(
  {
    $metadata: {
      title: "Describe",
      description: "Describes the Specialist",
    },
    "*": inputs,
  },
  { inputSchema: object({}, "unknown"), outputSchema: object({}, "unknown") },
  describeSpecialist
);

export default board({
  title: "Specialist Describer",
  description: "A custom describer for the Specialist component",
  version: "0.1.0",
  inputs: { "*": inputs },
  outputs: {
    inputSchema: describe.outputs.inputSchema,
    outputSchema: describe.outputs.outputSchema,
  },
});
