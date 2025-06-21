/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle } from "@breadboard-ai/particles";
import {
  AssetMetadata,
  AssetPath,
  GraphIdentifier,
  LLMContent,
  NodeIdentifier,
  ParameterMetadata,
} from "@breadboard-ai/types";
import {
  EditSpec,
  EditTransform,
  FileSystem,
  NodeHandlerMetadata,
  Outcome,
  PortIdentifier,
  Schema,
} from "@google-labs/breadboard";
import { HarnessRunner } from "@google-labs/breadboard/harness";
import { ConnectorInstance, ConnectorType } from "../connectors/types";
import { SideBoardRuntime } from "../sideboards/types";

/**
 * Represents the Model+Controller for the individual run of the graph.
 * The name is so weird because there's already a `RunState` type in
 * `@google-labs/breadboard`.
 */
export type ProjectRun = {
  /**
   * Represents the App state during the run.
   */
  app: App;
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
   * The user input (if any) that the run is waiting on. If `null`,
   * the run is not currently waiting on user input.
   */
  input: UserInput | null;
};

/**
 * Represents the App state during the run.
 * Designed so that the App View can be built from this state
 */
export type App = {
  /**
   * A sequences of screens that is produced during the run.
   */
  screens: Map<string, AppScreen>;
  /**
   * The current screen.
   */
  current: AppScreen | null;
};

/**
 * Represents the state of a single App Screen
 */
export type AppScreen = {
  /**
   * When "interactive", indicates that this screen is still being created
   * or is asking user for input.
   * When "complete", indicates that this screen is finalized and is now
   * a historical artifact of the run.
   */
  status: "interactive" | "complete";
  /**
   * The "progress" screen only shows the output to the user, either final
   * or intermediate results.
   * The "input" screen shows the output to the user and requests input
   * from the user.
   * See https://github.com/breadboard-ai/breadboard/wiki/Screens for details.
   */
  type: "progress" | "input";
  /**
   * The output for this screen
   */
  output: Map<string, LLMContent /* Particle */>;
};

/**
 * Represents the Model+Controller for a single Console entry.
 * Currently, each entry represents the output of a step when it's run.
 */
export type ConsoleEntry = {
  title: string;
  icon?: string;
  tags?: string[];
  /**
   * A list of work items: things that a step is doing.
   */
  work: Map<string, WorkItem>;
  /**
   * The final output of the step.
   */
  output: Map<string, LLMContent /* Particle */>;

  /**
   * Starts out as `false` and is set to `true` when the entry is finalized.
   */
  completed: boolean;

  /**
   * A convenient pointer at the last work item.
   */
  current: WorkItem | null;
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
  product: Map<string, LLMContent | Particle>;
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
  tags?: string[];
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

  /**
   * Returns metadata for a given node. This function is sync, and it
   * will return the current result, not the latest -- which is fine in most
   * cases.
   */
  getMetadataForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<NodeHandlerMetadata>;

  persistDataParts(contents: LLMContent[]): Promise<LLMContent[]>;
  connectHarnessRunner(
    runner: HarnessRunner,
    fileSystem: FileSystem,
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
