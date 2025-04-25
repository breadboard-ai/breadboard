/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetMetadata,
  AssetPath,
  GraphIdentifier,
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
import { ConnectorInstance, ConnectorType } from "../connectors/types";

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
   * Current graph's assets.
   */
  graphAssets: Map<AssetPath, GraphAsset>;

  graphUrl: URL | null;

  addGraphAsset(asset: GraphAssetDescriptor): Promise<Outcome<void>>;
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
  connectors: ConnectorState;
};

export type GraphAssetDescriptor = {
  metadata?: AssetMetadata;
  data: LLMContent[];
  path: AssetPath;
};

export type GraphAsset = GraphAssetDescriptor & {
  update(title: string, data?: LLMContent[]): Promise<Outcome<void>>;
  connector?: ConnectorInstance;
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
 * Represents the Model+Controller for the Renderer (the visual editor)
 */
export type RendererState = {
  graphAssets: Map<AssetPath, GraphAsset>;
};

export type ConnectorState = {
  types: Map<string, ConnectorType>;

  // This double-plumbing is inelegant -- it just calls the
  // method by the same name in Project.
  // TODO: Make this more elegant.
  instanceExists(url: string): boolean;

  /**
   * Starts creating a new Connector instance
   *
   * @param url -- URL of the connector.
   */
  initializeInstance(url: string | null): Promise<Outcome<void>>;

  /**
   * Cancel any pending work.
   */
  cancel(): Promise<void>;
};

/**
 * Represents the Model+Controller for the entire Project.
 * Contains all the state for the project.
 */
export type Project = {
  graphAssets: Map<AssetPath, GraphAsset>;
  parameters: Map<string, ParameterMetadata>;
  connectors: ConnectorState;
  organizer: Organizer;
  fastAccess: FastAccess;
  renderer: RendererState;
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
  addConnectorInstance(url: string): void;
};
