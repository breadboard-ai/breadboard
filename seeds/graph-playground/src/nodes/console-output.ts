/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { log } from "@clack/prompts";
import type { InputValues } from "../graph.js";

export default async (inputs?: InputValues) => {
  if (!inputs) return {};
  log.step(JSON.stringify(inputs["text"]));
  return {};
};
