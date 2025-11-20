/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParticleTree } from "@breadboard-ai/particles";
import {
  App,
  AssetMetadata,
  AssetPath,
  ConsoleEntry,
  GraphIdentifier,
  GraphTheme,
  HarnessRunner,
  InspectableNodePorts,
  LLMContent,
  McpServerDescriptor,
  McpServerIdentifier,
  NodeIdentifier,
  NodeMetadata,
  NodeRunState,
  OutputValues,
  ParameterMetadata,
  RunError,
  RuntimeFlags,
  ConsentRequestWithCallback,
  GraphDescriptor,
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
import { StateEvent, ToastType } from "../events/events";
import { AppTheme, VisualEditorMode } from "../types/types";
import { HTMLTemplateResult } from "lit";
import type { AsyncComputedStatus } from "signal-utils/async-computed";
import { FilteredMap } from "./utils/filtered-map";

/**
 * Represents the result of AsyncComputed signals helper.
 */
export type AsyncComputedResult<T> = {
  value: T | undefined;
  status: AsyncComputedStatus;
};

export type ProjectRunStatus = "running" | "paused" | "stopped";

/**
 * Represents the Model+Controller for the individual run of the graph.
 * The name is so weird because there's already a `RunState` type in
 * `@google-labs/breadboard`.
 */
export type ProjectRun = {
  /**
   * Represents the renderer (the graph) state during the run.
   */
  renderer: RendererRunState;
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
   * Overall error message that is conveyed to the user (appears in snackbar),
   * combining multiple errors, if necessary.
   */
  error: RunError | null;
  /**
   * The status of the run
   */
  status: ProjectRunStatus;
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
  /**
   * Handles user action. This is a receiver for user's events, such as
   * clicking on the "Run step" buttons, etc.
   */
  handleUserAction(
    payload: StateEvent<"node.action">["payload"]
  ): Promise<Outcome<void>>;

  /**
   * Call when the user chooses to dismiss errors shown (if any)
   */
  dismissError(): void;

  /**
   * Represents step list view (aka lite)
   */
  stepList: StepListState;
};

export type StepListStateStatus = "planning" | "running" | "ready";

export type StepListState = {
  /**
   * - "planning" - there's a planning operation (flowgen generate or edit)
   *   going on.
   * - "running" -- the flow is running
   * - "ready" -- interactive state
   */
  status: StepListStateStatus;
  /**
   * The intent behind the app. This value is taken from the BGL
   * "metadata.intent" property. If "null", no intent was specified.
   */
  intent: string | null;

  /**
   * True when the underlying graph is brand new and has no nodes.
   */
  empty: boolean;
  /**
   * The current graph
   */
  graph: GraphDescriptor | null;

  /**
   * The list of steps according to the current run plan
   */
  steps: Map<string, StepListStepState>;
};

export type StepListStepState = {
  /**
   * The icon, associated with the step.
   */
  icon?: string;
  /**
   * The title of the step
   */
  title: string;
  /**
   * Current status of the step.
   * - "loading" -- the step is loading (not sure if we need this)
   * - "working" -- the step is either in "working" or "waiting" state
   * - "ready" -- the step is in "ready" state
   * - "complete" -- (not sure if we need this)
   * - "pending" -- the step is in indeterminate state, because planner is
   *   running
   */
  status: "loading" | "working" | "ready" | "complete" | "pending";
  /**
   * The prompt from step's configuration
   */
  prompt: string;
  /**
   * The text label for the prompt;
   */
  label: string;
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
 * Represents user input request.
 */
export type UserInput = {
  /**
   * Node id of the current input request.
   */
  id: NodeIdentifier;
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
  /**
   * The identifier of the tool. This is useful in cases when URL points at a
   * tool server, not the actual tool.
   */
  id?: string;
  order?: number;
  tags?: string[];
};

export type Component = {
  id: NodeIdentifier;
  title: string;
  description?: string;
  ports?: InspectableNodePorts;
  metadata?: NodeMetadata;
};

export type Components = Map<NodeIdentifier, Component>;

/**
 * Represents the Model+Controller for the "@" Menu.
 */
export type FastAccess = {
  graphAssets: Map<AssetPath, GraphAsset>;
  tools: Map<string, Tool>;
  myTools: Map<string, Tool>;
  controlFlow: FilteredMap<Tool>;
  components: Map<GraphIdentifier, Components>;
  parameters: Map<string, ParameterMetadata>;
  integrations: FilteredIntegrations;
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
  | "BetterOnDesktopModal"
  | "SnackbarDetailsModal"
  | "MissingShare"
  | "GlobalSettings"
  | "TOS"
  | "VideoModal"
  | "StatusUpdateModal"
  | "SignInModal"
  | "WarmWelcome";

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
  /**
   * Consent requests that will be displayed as a modal popup
   */
  consentRequests: Array<ConsentRequestWithCallback>;
  blockingAction: boolean;
  lastSnackbarDetailsInfo: HTMLTemplateResult | string | null;
  flags: RuntimeFlags | null;
};

export type FlowGenGenerationStatus = "generating" | "initial" | "error";

/**
 * Represents the flow gen state
 */
export type LiteViewState = {
  status: FlowGenGenerationStatus;
  error?: string;
  intent: string;

  stepList: StepListState | undefined;

  setIntent(intent: string): void;
};

/**
 * Represents the context of the runtime. This is actually a very simplified
 * representation of the `Runtime` from visual editor.
 */
export type RuntimeContext = {
  currentProjectState(): Project | null;
};

export type IntegrationState = {
  title: string;
  url: string;

  status: "loading" | "complete" | "error";

  tools: Map<string, Tool>;

  message: string | null;
};

export type FilteredIntegrations = {
  filter: string;

  results: ReadonlyMap<McpServerIdentifier, IntegrationState>;
};

/**
 * Represents the Model+Controller for of the project's Integrations
 * configuration.
 */
export type Integrations = {
  /**
   * List of registered integrations. This list is controlled by
   * `register`/`unregister` methods.
   */
  registered: ReadonlyMap<McpServerIdentifier, IntegrationState>;
  /**
   * List of all known MCP servers. This list is controlled by `add`/`remove`
   * methods.
   */
  known: AsyncComputedResult<
    ReadonlyMap<McpServerIdentifier, McpServerDescriptor>
  >;

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
   * Add as a new MCP server by URL. This both adds it to the list of known
   * servers and registers it.
   *
   * @param url - URL of the server
   * @param title - title of the server, optional
   */
  add(
    url: string,
    title: string | undefined,
    authToken: string | undefined
  ): Promise<Outcome<void>>;

  /**
   * Remove the MCP server specified by id. This removes it both from the assets
   * in the BGL and removes it entirely from the list of known servers.
   * Will fail if the server is not removable.
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
  integrations: Integrations;
  organizer: Organizer;
  fastAccess: FastAccess;
  renderer: RendererState;
  stepEditor: StepEditor;
  readonly themes: ProjectThemeState;

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

  getPortsForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<InspectableNodePorts>;

  getTitleForNode(
    nodeId: NodeIdentifier,
    graphId: GraphIdentifier
  ): Outcome<string>;

  persistDataParts(contents: LLMContent[]): Promise<LLMContent[]>;
  connectHarnessRunner(
    runner: HarnessRunner,
    fileSystem: FileSystem,
    signal?: AbortSignal
  ): Outcome<void>;
};

export type ProjectInternal = Project & {
  graphUrl: URL | null;
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

export type EdgeRunState = {
  status: "initial" | "consumed" | "stored";
};

export type RendererRunState = {
  nodes: Map<NodeIdentifier, NodeRunState>;
  edges: Map<string, EdgeRunState>;
};

/**
 * Represents the Model + Controler for the Step Editor.
 */
export type StepEditor = {
  surface: StepEditorSurface | null;
};

/**
 * Represents the step editor surface, Usually, its the actual
 * `bb-entity-editor`, but can be anything, really.
 */
export type StepEditorSurface = {
  /**
   * Saves current state of the surface, if necessary.
   * Returns when save is completed.
   */
  save(): Promise<Outcome<void>>;
};

export type ThemeStatus = "generating" | "uploading" | "editing" | "idle";

export type ThemePromptArgs = {
  random: boolean;
  title: string;
  description?: string;
  userInstruction?: string;
};

/**
 * Represents the model-controller for the project's themes.
 */
export type ProjectThemeState = {
  /**
   * Reports the current status of the theming machinery. Aside from "idle",
   * all other statuses are blocking -- calls to mutating functions will fail
   * silently.
   *
   * Valid status values:
   * - "generating" -- an image is currently being generated for the theme
   * - "uploading" -- an image is currently being uploaded to Drive
   * - "editing" -- theme is currently being edited.
   * - "idle" -- the machinery is idle and ready for operation.
   */
  readonly status: ThemeStatus;
  /**
   * Adds provided theme to the list of available themes and sets it
   * as current.
   */
  addTheme(theme: AppTheme): Promise<Outcome<void>>;

  /**
   * Generates a new theme based on the intent and sets is a current
   */
  generateThemeFromIntent(intent: string): Promise<Outcome<GraphTheme>>;

  setTheme(theme: GraphTheme): Promise<Outcome<void>>;

  /**
   * Generates a new theme to the list of available themes and sets it
   * as current.
   */
  generateTheme(
    args: ThemePromptArgs,
    signal: AbortSignal
  ): Promise<Outcome<void>>;

  /**
   * Deletes a theme with a given ID
   */
  deleteTheme(id: string): Promise<Outcome<void>>;

  /**
   * Sets the current them to a given ID
   */
  setCurrent(id: string): Promise<Outcome<void>>;
};
