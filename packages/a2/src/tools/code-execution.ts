/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@breadboard-ai/types";
import { err } from "../a2/utils";

export { invoke as default, describe };

async function invoke() {
  return err(`Do not invoke this tool directly.`);
}

async function describe() {
  return {
    title: "Code Execution",
    description: "Generates and runs Python code",
    inputSchema: {} satisfies Schema,
    outputSchema: {} satisfies Schema,
    metadata: {
      icon: "code",
      tags: ["quick-access", "tool", "component", "experimental"],
      order: 5,
    },
  };
}
