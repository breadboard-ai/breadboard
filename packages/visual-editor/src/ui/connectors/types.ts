/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonSerializable, LLMContent, UUID } from "@breadboard-ai/types";
import { Outcome, Schema } from "@google-labs/breadboard";

export type ConfiguratorStage = "initialize" | "read" | "write";

export type ConnectorInitializerResult = {
  title: string;
  configuration: JsonSerializable;
};

export type ConnectorConfiguration = {
  url: string;
  configuration: JsonSerializable;
};

export type ConnectorView = {
  schema: Schema;
  values: JsonSerializable;
};

export type ConnectorInstance = {
  type: ConnectorType;
  id: UUID;
  configuration: Outcome<ConnectorConfiguration>;
  view: Outcome<ConnectorView>;
  preview: Outcome<LLMContent[]>;
  commitEdits(
    title: string | undefined,
    values: Record<string, JsonSerializable>
  ): Promise<Outcome<void>>;
};

export type ConnectorType = {
  /**
   * The URL pointing to the connector BGL file.
   */
  url: string;
  icon?: string;
  title: string;
  description?: string;
  singleton: boolean;
  load: boolean;
  save: boolean;
  tools: boolean;
  experimental: boolean;
};
