/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphProvider,
  Kit,
  NodeConfiguration,
  NodeIdentifier,
} from "@google-labs/breadboard";

export type Username = string;
export type UserApiKey = string;

export interface ProjectStoreCapabilities {
  connect: boolean;
  disconnect: boolean;
  refresh: boolean;
  watch: boolean;
  preview: boolean;
}

export interface ProjectStoreConfiguration {
  url: URL;
  projects: Promise<Array<Project>>;
  kits: Array<Kit>;
  users: Array<User>;
  secrets: Secrets;
  extensions: Array<ProjectStoreExtension>;
  capabilities: ProjectStoreCapabilities;
}

export interface ProjectStore
  extends GraphProvider,
    ProjectStoreConfiguration,
    EventTarget {
  getAccess(url: URL, user: User): Promise<Permission>;
}

export interface EntityMetadata {
  owner: Username;
  access: Map<Username, Permission>;
  title?: string;
  description?: string;
  icon?: string;
}

export interface Entity {
  url: URL;
  metadata: EntityMetadata;
}

export interface HostAPI {
  send(method: string, args: unknown[]): Promise<void>;
}

export interface ProjectStoreExtension extends Entity {
  node: {
    onEditStart(
      api: HostAPI,
      id: NodeIdentifier,
      type: string,
      configuration: NodeConfiguration
    ): Promise<void>;
  };
  graph: {
    onGraphStart(api: HostAPI): Promise<void>;
    onGraphStop(api: HostAPI): Promise<void>;
  };
}

export interface Project extends Entity {
  board: Board;
}

export interface User {
  username: Username;
  apiKey: UserApiKey;
  secrets: Secrets /* Used in preference to Board Server equivalents */;
}

export type Secrets = Map<string, string>;

export type Permission = {
  create: boolean;
  retrieve: boolean;
  update: boolean;
  delete: boolean;
};

export interface Board extends Entity {
  theme?: string;
  descriptor: GraphDescriptor;
  runs?: Array<Run>;
  evaluations?: Array<Evaluation>;
}

export interface Run {
  metadata: {
    dateTime: Date;
    title?: string;
  };
  descriptor: GraphDescriptor;
  status: string;
}

export interface Evaluation {
  runs: Array<Run>;
}
