/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle, ParticleTree } from "@breadboard-ai/particles";
import {
  AssetMetadata,
  AssetPath,
  GraphIdentifier,
  HarnessRunner,
  LLMContent,
  NodeIdentifier,
  OutputValues,
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
import { ConnectorInstance, ConnectorType } from "../connectors/types";
import { ToastType } from "../events/events";
import { SideBoardRuntime } from "../sideboards/types";
import { VisualEditorMode } from "../types/types";
import { HTMLTemplateResult } from "lit";

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
   * Provides a number between 0 and 1 indicating current progress of the run.
   * 0 - just started
   * 1 - completely done
   */
  progress: number;
  /**
   * Answers whether the project is runnable in its current state.
   */
  runnable: boolean;
  /**
   * Console (fka Activity View)
   */
  console: Map<string, ConsoleEntry>;
  // TODO: Move this under console. It should be similar to App: holds entries,
  // rather than being a map.
  /**
   * The state of the console. The values are:
   * - "start" -- at the start screen
   * - "entries" -- showing entries
   */
  consoleState: "start" | "entries";
  /**
   * Any errors that might have occurred during a run.
   */
  errors: Map<string, RunError>;
  /**
   * The status of the run
   */
  status: "running" | "paused" | "stopped";
  /**
   * The current (unifinished) entries in the console
   */
  current: Map<string, ConsoleEntry> | null;
  /**
   * The user input (if any) that the run is waiting on. If `null`,
   * the run is not currently waiting on user input.
   */
  input: UserInput | null;
  /**
   * Final output values. When the run is still ongoing, will be `null`.
   */
  finalOutput: OutputValues | null;
};

/**
 * Represents the App state during the run.
 * Designed so that the App View can be built from this state
 */
export type App = {
  /**
   * Current state of the app. Can be one of the following:
   * - "splash" -- the app is showing a splash screen
   * - "screen" -- the app is showing a screen
   */
  state: "splash" | "screen";
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
   * The title of the screen
   */
  title: string;
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
   * The outputs for this screen
   */
  outputs: Map<string, AppScreenOutput>;
  /**
   * The last output for the screen
   */
  last: AppScreenOutput | null;
};

/**
 * Represents an output on a screen. There may be more than one output,
 * like multiple bubbling outputs from the step, as well as the final output.
 */
export type AppScreenOutput = {
  /**
   * The Schema of the output values.
   */
  schema: Schema | undefined;
  /**
   * The output values.
   */
  output: OutputValues;
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
   * How long this item has been running so far (in milliseconds)
   */
  elapsed: number;
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

export type ErrorReason =
  | "child"
  | "celebrity"
  | "unsafe"
  | "dangerous"
  | "hate"
  | "other"
  | "face"
  | "pii"
  | "prohibited"
  | "sexual"
  | "toxic"
  | "violence"
  | "vulgar";

export type ErrorMetadata = {
  /**
   * Origin of the error:
   * - client -- occured on the client (the step itself)
   * - server -- comes from the server
   * - system -- happened within the system (client, but outside of the step)
   * - unknown -- origin of the error is unknown.
   */
  origin?: "client" | "server" | "system" | "unknown";
  /**
   * Kind of the error
   * - capacity -- triggered by capacity issues (eg. quota exceeded)
   * - safety -- triggered by a safety checker
   * - recitation -- triggered by recitation checker.
   * - config -- triggered by invalid configuration (can be fixed by user)
   * - bug -- triggered by a bug in code somewhere.
   * - unknown -- (default) unknown kind of error
   */
  kind?: "capacity" | "safety" | "recitation" | "config" | "bug" | "unknown";
  /**
   * If relevant, the name of the model, that produced the error
   */
  model?: string;
  /**
   * When kind is "safety", the reasons for triggering. There may be more than
   * one.
   * - "child" -- detects child content where it isn't allowed due to the API
   * request settings or allowlisting.
   * - "celebrity" -- detects a photorealistic representation of a celebrity in
   *       the request.
   * - "unsafe" -- detects video content that's a safety violation.
   * - "dangerous" -- detects content that's potentially dangerous in nature.
   * - "hate" -- detects hate-related topics or content.
   * - "other" -- detects other miscellaneous safety issues with the request
   * - "face" -- detects a person or face when it isn't allowed due to the
   *      request safety settings.
   * - "pii" -- detects Personally Identifiable Information (PII) in the text,
   *      such as the mentioning a credit card number, home addresses, or other
   *      such information.
   * - "prohibited" -- detects the request of prohibited content in the request.
   * - "sexual" -- detects content that's sexual in nature.
   * - "toxic" -- detects toxic topics or content in the text.
   * - "volence" -- detects violence-related content from the image or text.
   * - "vulgar" -- detects vulgar topics or content from the text.
   */
  reasons?: ErrorReason[];
};

/**
 * Represents an error that occurred during a run.
 */
export type RunError = {
  message: string;
  /**
   * Details of the error (if any) in markdown.
   */
  details?: string;
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

export type UIOverlays =
  | "BoardEditModal"
  | "BoardServerAddOverlay"
  | "SnackbarDetailsModal"
  | "MissingShare"
  | "RuntimeFlags"
  | "TOS"
  | "VideoModal"
  | "StatusUpdateModal";

export type UILoadState = "Home" | "Loading" | "Loaded" | "Error";

export type UI = {
  mode: VisualEditorMode;
  boardServer: string;
  boardLocation: string;
  editorSection: "console" | "preview";

  /**
   * Indicates whether or not the UI can currently run a flow or not.
   * This is useful in situations where we're doing some work on the
   * board and want to prevent the user from triggering the start
   * of the flow.
   */
  canRunMain: boolean;
  loadState: UILoadState;
  projectFilter: string | null;
  show: Set<UIOverlays>;
  showStatusUpdateChip: boolean | null;
  toasts: Map<
    string,
    {
      message: string;
      type: ToastType;
      persistent: boolean;
    }
  >;
  blockingAction: boolean;
  lastSnackbarDetailsInfo: HTMLTemplateResult | string | null;
};

export type McpServerDetails = {
  /**
   * Name of the server. Part of the technical details, though when title is
   * not be specified, can be used instead of title
   */
  name: string;
  /**
   * Version of the server.
   */
  version: string;
  /**
   * URL of the server.
   */
  url: string;
};

export type McpServerIdentifier = string;

export type McpServer = {
  /**
   * Title of the MCP server. Assigned by the author or extracted from the
   * MCP server info.
   */
  readonly title: string;
  /**
   * Description of the server.
   */
  readonly description?: string;
  /**
   * Server details.
   */
  readonly details: McpServerDetails;
  /**
   * Whether or not the server is currently registered in this project.
   */
  readonly registered: boolean;
  /**
   * Whether or not the server is removable. We will have some servers that are
   * built-in, so they aren't removable.
   */
  readonly removable: boolean;
};

/**
 * Represents the Model+Controller for of the project's MCP
 * configuration.
 */
export type Mcp = {
  /**
   * List of currently all known MCP servers.
   */
  servers: ReadonlyMap<McpServerIdentifier, McpServer>;

  /**
   * Register the server specified by id. This adds it to the assets in the BGL.
   */
  register(id: McpServerIdentifier): Promise<Outcome<void>>;

  /**
   * Unregister the server specified by id. This removes it from the assets
   * in the BGL.
   */
  unregister(id: McpServerIdentifier): Promise<Outcome<void>>;

  /**
   * Add as a new MCP server by URL.
   *
   * @param url - URL of the server
   * @param title - title of the server, optional
   */
  add(url: string, title: string | undefined): Promise<Outcome<McpServer>>;

  /**
   * Remove the MCP server specified by id. This removes it both from the assets
   * in the BGL and removes it entirely from. Will fail if the server is not
   * removable.
   */
  remove(id: McpServerIdentifier): Promise<Outcome<void>>;

  /**
   *
   * @param id - id of the server
   * @param title - new title of the server
   */
  rename(id: string, title: string): Promise<Outcome<void>>;
};

/**
 * Represents the Model+Controller for the entire Project.
 * Contains all the state for the project.
 */
export type Project = {
  run: ProjectRun;
  graphAssets: Map<AssetPath, GraphAsset>;
  parameters: Map<string, ParameterMetadata>;
  connectors: ConnectorState;
  mcp: Mcp;
  organizer: Organizer;
  fastAccess: FastAccess;
  renderer: RendererState;

  /**
   * Resets the current run.
   */
  resetRun(): void;

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

export type EphemeralParticleTree = {
  tree: ParticleTree;
  done: boolean;
};
