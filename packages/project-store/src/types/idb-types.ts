/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard";
import {
  EntityMetadata,
  Evaluation,
  ProjectStoreCapabilities,
  Run,
  Secrets,
  User,
} from "./types";
import type * as idb from "idb";

export interface IDBProjectStoreConfiguration {
  url: string;
  kits: string[];
  users: User[];
  secrets: Secrets;
  extensions: string[];
  capabilities: ProjectStoreCapabilities;
}

export interface IDBProjectStoreBoard {
  theme?: string;
  descriptor: GraphDescriptor;
  runs?: Array<Run>;
  evaluations?: Array<Evaluation>;
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
