/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Signal } from "@lit-labs/signals";
import { type BaseBladeParams } from "tweakpane";
import {
  AssetMetadata,
  AssetPath,
  ConsentRequest,
  ConsentUIType,
  DataPart,
  GraphIdentifier,
  InputValues,
  LLMContent,
  NodeIdentifier,
  NodeRunState,
} from "@breadboard-ai/types";
import { GlobalConfig } from "../ui/contexts/global-config.js";
import {
  GuestConfiguration,
  OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";

import type { InPort } from "../ui/transforms/autowire-in-ports.js";
import type { Tool, Component } from "../ui/types/state-types.js";

// ── Types migrated from ui/state/types.ts ──────────────────────────────────

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
  /**
   * The tags used for this step
   */
  tags?: string[];
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
   */
  reasons?: ErrorReason[];
};

export type GraphAssetDescriptor = {
  metadata?: AssetMetadata;
  data: LLMContent[];
  path: AssetPath;
};

/**
 * Graph asset data type.
 * Note: Asset updates are handled by the Asset.updateAsset action.
 */
export type GraphAsset = GraphAssetDescriptor;

export type GeneratedAssetIdentifier = string;

export type GeneratedAsset = {
  data: LLMContent[];
  metadata?: AssetMetadata;
};

export type Components = Map<NodeIdentifier, Component>;

export type FlowGenGenerationStatus = "generating" | "initial" | "error";

export type LiteModeType = "loading" | "home" | "editor" | "error" | "invalid";

export type LiteModeIntentExample = {
  intent: string;
};

export type EdgeRunState = {
  status: "initial" | "consumed" | "stored";
};

export type RendererRunState = {
  nodes: Map<NodeIdentifier, NodeRunState>;
  edges: Map<string, EdgeRunState>;
};

export type ThemePromptArgs = {
  random: boolean;
  title: string;
  description?: string;
  userInstruction?: string;
};

export interface ServicesConfig {
  globalConfig: GlobalConfig;
  guestConfig: GuestConfiguration;
  shellHost: OpalShellHostProtocol;
  env?: FileSystemEntry[];
  appName: string;
  appSubName: string;
}

export type pending = symbol;

export type AssetIdentifier = string;
export type EdgeIdentifier =
  `${NodeIdentifier}:${string}->${NodeIdentifier}:${string}`;
export type AssetEdgeIdentifier = `${AssetIdentifier}->${NodeIdentifier}`;

export interface DebugController {
  enabled: boolean;
}
export interface DebuggableAppController {
  global: {
    debug: DebugController;
  };
}

export type PrimitiveType =
  | string
  | number
  | boolean
  | null
  | symbol
  | { [key: string]: PrimitiveType }
  | object
  | Map<string, PrimitiveValue>
  | Set<PrimitiveType>
  | PrimitiveType[];

export type PrimitiveValue = PrimitiveType | pending;

export interface Storage {
  get<T extends PrimitiveType>(name: string): Promise<T | null>;
  set<T extends PrimitiveType>(name: string, value: T): Promise<void>;
  clear(): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface HydratedController {
  isHydrated: Promise<number>;
  isSettled: Promise<void[]>;
  registerSignalHydration(signal: Signal.State<unknown>): void;
}

export interface DebugContext {
  foo: number;
}

export interface DebugContainerOpts {
  path: string;
}

export interface DebugBinding<T = any> {
  get: () => T;
  set: (value: T) => void;
}

export interface DebugEntry {
  config: BaseBladeParams;
  binding: DebugBinding;
}

export interface DebugLog {
  type: "error" | "info" | "warning" | "verbose" | "group";
  title?: string;
  args: string[];
}

export interface DebugFormatter {
  error(...args: unknown[]): DebugLog;
  info(...args: unknown[]): DebugLog;
  warning(...args: unknown[]): DebugLog;
  verbose(...args: unknown[]): DebugLog;
  group(...args: unknown[]): DebugLog;
}

export interface DebugParams<Value> {
  ui?: BaseBladeParams;
  log?:
    | boolean
    | {
        label?: string;
        format(v: Value, host: DebugFormatter): DebugLog;
      };
}

export interface PendingConsent {
  request: ConsentRequest;
  askUsingUiType?: ConsentUIType;
}

/**
 * Represents a pending edit to a node's configuration.
 * Values should already be transformed to the proper configuration format.
 */
export interface PendingEdit {
  graphId: GraphIdentifier;
  nodeId: NodeIdentifier;
  values: InputValues;
  /** Incoming port connections (from chiclets) to autowire */
  ins?: InPort[];
  /** Graph version when edit was captured - used to detect stale edits */
  graphVersion: number;
}

/**
 * Represents a pending edit to an asset.
 * Used by the step autosave trigger to save asset changes on selection change.
 * Asset updates are handled by the Asset.updateAsset action.
 */
export interface PendingAssetEdit {
  assetPath: string;
  title: string;
  dataPart: DataPart | null | undefined;
  /** Graph version when edit was captured - used to detect stale edits */
  graphVersion: number;
}

/**
 * Tagged union of all items that can appear in the Fast Access menu.
 * Built by `GraphController.getFastAccessItems()` for a flat, indexed list
 * that eliminates the brittle offset arithmetic previously in the UI.
 */
export type FastAccessItem =
  | { kind: "asset"; asset: GraphAsset }
  | { kind: "tool"; tool: Tool }
  | { kind: "component"; component: Component }
  | { kind: "route"; route: Component };

/**
 * The display context for the Fast Access menu.
 *
 * - `"tools"` — Tools picker (entity-editor `@` input). Shows tools + agent-mode only.
 * - `"browse"` — Full `@` menu (text-editor). Shows assets, tools, components, agent-mode.
 * - `"route"` — Chiclet re-targeting. Shows routes only.
 */
export type FastAccessMode = "tools" | "browse" | "route";

/**
 * Extended item type that includes integration tools (managed by legacy
 * Integrations until that migration is complete).
 */
export type DisplayItem =
  | FastAccessItem
  | { kind: "integration-tool"; url: string; tool: Tool };
