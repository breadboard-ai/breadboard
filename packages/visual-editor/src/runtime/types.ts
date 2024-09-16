/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataStore,
  GraphDescriptor,
  GraphProvider,
  Kit,
  RunStore,
} from "@google-labs/breadboard";

export type TabId = `${string}-${string}-${string}-${string}-${string}`;
export type TabURL = string;
export type TabName = string;
export interface Tab {
  id: TabId;
  kits: Kit[];
  name: TabName;
  graph: GraphDescriptor;
  subGraphId: string | null;
  version: number;
  readOnly: boolean;
}

export interface VERuntimeConfig {
  providers: GraphProvider[];
  dataStore: DataStore;
  runStore: RunStore;
}
