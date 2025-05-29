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
  Schema,
} from "@google-labs/breadboard";
import { SideBoardRuntime } from "../sideboards/types";
import { ConnectorInstance, ConnectorType } from "../connectors/types";
import { HarnessRunner } from "@google-labs/breadboard/harness";

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

/**
 * Represents the Model+Controller for the individual run of the graph.
 * The name is so weird because there's already a `RunState` type in
 * `@google-labs/breadboard`.
 */
export type ProjectRun = {
  /**
   * Provides an estimate of entries that will be in console for this run.
   * The estimate is updated when the run goes over it.
   */
  estimatedEntryCount: number;
  /**
   * Console (fka Activity View)
   */
  console: Map<string, ConsoleEntry>;
  /**
   * Any errors that might have occurred during a run.
   */
  errors: Map<string, RunError>;
  /**
   * The status of the run
   */
  status: "running" | "paused" | "stopped";
  /**
   * The current entry.
   */
  current: ConsoleEntry | null;
  /**
   * The input (if any) that the user is waiting on. If `null`,
   * the user is not currently waiting on input.
   */
  input: UserInput | null;
};

/**
 * Represents the Model+Controller for a single Console entry.
 * Currently, each entry represents the output of a step when it's run.
 */
export type ConsoleEntry = {
  title: string;
  icon?: string;
  /**
   * A list of work items: things that a step is doing.
   */
  work: Map<string, WorkItem>;
  /**
   * The final output of the step.
   */
  output: Map<string, LLMContent /* Particle */>;

  completed: boolean;
};

/**
 * Represents the Model+Controller for a single work item within the
 * Console entry. Work items are a way for the steps to communicate what they
 * are doing.
 */
export type WorkItem = {
  title: string;
  icon?: string;
  /**
   * Start time for the work item.
   */
  start: number;
  /**
   * End time for the work time (null if still in progress)
   */
  end: number | null;
  /**
   * If true, this work item currently awaiting user input.
   */
  awaitingUserInput: boolean;
  /**
   * If true, indicates that this work item was shown to the user as part
   * of a chat interaction.
   */
  chat: boolean;
  /**
   * Schema representing the product, if available. This is useful when
   * the WorkItem represents an input.
   */
  schema?: Schema;
  /**
   * Similar to the `output` of the `ConsoleEntry`, represents the work product
   * of this item.
   */
  product: Map<string, LLMContent /* Particle */>;
};

/**
 * Represents an error that occurred during a run.
 */
export type RunError = {
  message: string;
};

/**
 * Represents user input request.
 */
export type UserInput = {
  /**
   * The schema of the current input request.
   */
  schema: Schema;
};

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
  run: ProjectRun | null;
  graphAssets: Map<AssetPath, GraphAsset>;
  parameters: Map<string, ParameterMetadata>;
  connectors: ConnectorState;
  organizer: Organizer;
  fastAccess: FastAccess;
  renderer: RendererState;

  persistDataParts(contents: LLMContent[]): Promise<LLMContent[]>;
  connectHarnessRunner(
    runner: HarnessRunner,
    signal?: AbortSignal
  ): Outcome<void>;
};

export type ProjectInternal = Project & {
  graphUrl: URL | null;
  runtime(): SideBoardRuntime;
  apply(transform: EditTransform): Promise<Outcome<void>>;
  edit(spec: EditSpec[], label: string): Promise<Outcome<void>>;
  findOutputPortId(
    graphId: GraphIdentifier,
    id: NodeIdentifier
  ): Outcome<{ id: PortIdentifier; title: string }>;
  connectorInstanceExists(url: string): boolean;
  addConnectorInstance(url: string): void;
};
