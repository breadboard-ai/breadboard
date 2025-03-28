/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, NodeValue } from "@breadboard-ai/types";
import { ConnectorConfiguration } from "./types";
import { err, Outcome } from "@google-labs/breadboard";

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
