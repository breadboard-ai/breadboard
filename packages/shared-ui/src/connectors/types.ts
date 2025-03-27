/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonSerializable } from "@breadboard-ai/types";
import { Schema } from "@google-labs/breadboard";

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

export type ConnectorEdit = {
  configuration?: JsonSerializable;
  values: JsonSerializable;
};
