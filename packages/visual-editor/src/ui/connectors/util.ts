/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, NodeValue, Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { ConnectorConfiguration } from "./types.js";

export { configFromData };

type ConfigLLMContentArray = {
  parts: {
    json: ConnectorConfiguration;
  }[];
}[];

function configFromData(
  data: LLMContent[] | NodeValue
): Outcome<ConnectorConfiguration> {
  const config = (data as ConfigLLMContentArray).at(-1)?.parts.at(0)
    ?.json as ConnectorConfiguration;
  if (!config) return err(`Unable to find configuration`);
  return config;
}
