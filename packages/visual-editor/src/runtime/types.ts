/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataStore,
  GraphDescriptor,
  GraphProvider,
  Kit,
  RunStore,
} from "@google-labs/breadboard";

export type VETabId = `${string}-${string}-${string}-${string}-${string}`;
export type VETabURL = string;
export type VETabName = string;
export interface VETab {
  id: VETabId;
  kits: Kit[];
  name: VETabName;
  graph: GraphDescriptor;
  subGraphId: string | null;
  version: number;
}

export interface VERuntimeConfig {
  providers: GraphProvider[];
  dataStore: DataStore;
  runStore: RunStore;
}
