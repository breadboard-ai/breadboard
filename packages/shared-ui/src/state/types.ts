/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  AssetPath,
  GraphIdentifier,
  JsonSerializable,
  LLMContent,
  NodeIdentifier,
  NodeValue,
  ParameterMetadata,
} from "@breadboard-ai/types";
import {
  EditSpec,
  EditTransform,
  Outcome,
  PortIdentifier,
} from "@google-labs/breadboard";
import { SideBoardRuntime } from "../sideboards/types";
import { ConnectorView } from "../connectors/types";

export type ChatStatus = "running" | "paused" | "stopped";

export type ChatUserTurnState = {
  role: "user";
  content: ChatContent[];
};

export type ChatTextContent = {
  title: string;
  format?: "text" | "markdown";
  text: string;
};

export type ChatLLMContent = {
  title: string;
  context: LLMContent[];
};

export type ChatObjectContent = {
  title: string;
  object: NodeValue;
};

export type ChatError = {
  title: string;
  error: string;
};

export type ChatContent =
  | ChatTextContent
  | ChatLLMContent
  | ChatObjectContent
  | ChatError;

/**
 * Represents the system entry in the chat conversation between the
 * user and the system (Breadboard).
 * Typically, the role = "model", but here, we're defining it more broadly
 * so we'll name it "system."
 */
export type ChatSystemTurnState = {
  role: "system";
  /**
   * The icon representing the participant.
   */
  icon?: string;
  /**
   * The friendly name of the participant.
   */
  name?: string;
  /**
   * The content of the turn. May contain multiple messages.
   */
  content: ChatContent[];
};

export type ChatConversationState = ChatUserTurnState | ChatSystemTurnState;

export type ChatState = {
  conversation: ChatConversationState[];
  status: ChatStatus;
  statusDetail: string;
};

export type OrganizerStage = "free" | "busy";

/**
 * Represents the Model+Controller for the Asset Organizer.
 */
export type Organizer = {
  /**
   * Current status of the organizer
   */
  stage: OrganizerStage;

  /**
   * Current graph's assets.
   */
  graphAssets: Map<AssetPath, GraphAsset>;

  graphUrl: URL | null;

  // This double-plumbing is inelegant -- it just calls the
  // method by the same name in Project.
  // TODO: Make this more elegant.
  connectorInstanceExists(url: string): boolean;

  addGraphAsset(asset: GraphAsset): Promise<Outcome<void>>;
  removeGraphAsset(path: AssetPath): Promise<Outcome<void>>;
  changeGraphAssetMetadata(
    path: AssetPath,
    metadata: AssetMetadata
  ): Promise<Outcome<void>>;

  /**
   * Current graph's parameters.
   */
  parameters: Map<string, ParameterMetadata>;
  changeParameterMetadata(
    id: string,
    metadata: ParameterMetadata
  ): Promise<Outcome<void>>;

  /**
   * Available connectors
   */
  connectors: Map<string, Connector>;

  /**
   * Starts creating a new Connector instance
   *
   * @param url -- URL of the connector.
   */
  initializeConnectorInstance(url: string | null): Promise<Outcome<void>>;
  commitConnectorInstanceEdits(
    path: AssetPath,
    values: Record<string, JsonSerializable>
  ): Promise<Outcome<void>>;
  /**
   * Cancels all pending work.
   */
  cancel(): Promise<void>;

  /**
   * Gets the connector view: the values and the schema to use to render these
   * values.
   */
  getConnectorView(path: AssetPath): Promise<Outcome<ConnectorView>>;
};

export type GraphAsset = {
  metadata?: AssetMetadata;
  data: LLMContent[];
  path: AssetPath;
  connector?: Connector;
};

export type GeneratedAssetIdentifier = string;

export type GeneratedAsset = {
  data: LLMContent[];
  metadata?: AssetMetadata;
};

export type Tool = {
  url: string;
  title?: string;
  description?: string;
  icon?: string;
  connectorInstance?: string;
  order?: number;
};

export type Component = {
  id: NodeIdentifier;
  title: string;
  description?: string;
};

export type Connector = {
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

export type Components = Map<NodeIdentifier, Component>;

/**
 * Represents the Model+Controller for the "@" Menu.
 */
export type FastAccess = {
  graphAssets: Map<AssetPath, GraphAsset>;
  tools: Map<string, Tool>;
  myTools: Map<string, Tool>;
  components: Map<GraphIdentifier, Components>;
  parameters: Map<string, ParameterMetadata>;
};

/**
 * Represents the Model+Controller for the entire Project.
 * Contains all the state for the project.
 */
export type Project = {
  graphAssets: Map<AssetPath, GraphAsset>;
  parameters: Map<string, ParameterMetadata>;
  connectors: Map<string, Connector>;
  organizer: Organizer;
  fastAccess: FastAccess;
};

export type ProjectInternal = Project & {
  graphUrl: URL | null;
  runtime(): SideBoardRuntime;
  apply(transform: EditTransform): Promise<Outcome<void>>;
  edit(spec: EditSpec[], label: string): Promise<Outcome<void>>;
  persistBlobs(contents: LLMContent[]): Promise<LLMContent[]>;
  findOutputPortId(
    graphId: GraphIdentifier,
    id: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }>;
  connectorInstanceExists(url: string): boolean;
};
