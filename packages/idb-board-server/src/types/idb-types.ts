/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServerCapabilities,
  EntityMetadata,
  Evaluation,
  GraphDescriptor,
  Run,
  Secrets,
  User,
} from "@google-labs/breadboard";
import type * as idb from "idb";

export interface IDBProjectStoreConfiguration {
  url: string;
  kits: string[];
  users: User[];
  secrets: Secrets;
  extensions: string[];
  capabilities: BoardServerCapabilities;
}

export interface IDBProjectStoreBoard {
  theme?: string;
  descriptor: GraphDescriptor;
  runs?: Run[];
  evaluations?: Evaluation[];
  url: string;
  metadata: EntityMetadata;
}

export interface IDBProjectStoreProject {
  board: IDBProjectStoreBoard;
  url: string;
  metadata: EntityMetadata;
}

export interface LocalStoreData extends idb.DBSchema {
  configuration: {
    key: "url";
    value: IDBProjectStoreConfiguration;
  };
  projects: {
    key: "url";
    value: IDBProjectStoreProject;
  };
}
