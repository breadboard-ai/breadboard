/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BeginRenderingMessage } from "./begin-rendering";
import type { Component, ComponentUpdateMessage } from "./component-update";
import type { DataModelUpdateMessage, DataObject } from "./data-update";
import { StreamHeaderMessage } from "./stream-header";

export interface GulfData {
  version: string;
  root: Component;
  data: DataObject;
}

export type UnifiedUpdate = Array<
  | StreamHeaderMessage
  | BeginRenderingMessage
  | ComponentUpdateMessage
  | DataModelUpdateMessage
>;
