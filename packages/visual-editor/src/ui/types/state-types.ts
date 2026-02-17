/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * UI-layer types that depend on `lit` or `signal-utils`.
 * These are intentionally kept outside of SCA to avoid coupling SCA to
 * framework-specific dependencies.
 */

import {
  InspectableNodePorts,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";
import { HTMLTemplateResult } from "lit";
import { VisualEditorMode } from "./types.js";
import type { AsyncComputedStatus } from "signal-utils/async-computed";

export {
  type AsyncComputedResult,
  type Component,
  type FilterableMap,
  type IntegrationState,
  type SubscriptionStatus,
  type TitledItem,
  type Tool,
  type UI,
  type UILoadState,
  type UIOverlays,
};

/**
 * Represents the result of AsyncComputed signals helper.
 */
type AsyncComputedResult<T> = {
  value: T | undefined;
  status: AsyncComputedStatus;
};

type Tool = {
  url: string;
  title?: string;
  description?: string;
  icon?: string | HTMLTemplateResult;
  /**
   * The identifier of the tool. This is useful in cases when URL points at a
   * tool server, not the actual tool.
   */
  id?: string;
  order?: number;
  tags?: string[];
};

type Component = {
  id: NodeIdentifier;
  title: string;
  description?: string;
  ports?: InspectableNodePorts;
  metadata?: NodeMetadata;
};

type TitledItem = {
  title?: string;
};

type FilterableMap<T extends TitledItem> = {
  results: ReadonlyMap<string, T>;
  filter: string;
};

type UIOverlays =
  | "BoardEditModal"
  | "BetterOnDesktopModal"
  | "SnackbarDetailsModal"
  | "MissingShare"
  | "GlobalSettings"
  | "TOS"
  | "VideoModal"
  | "StatusUpdateModal"
  | "SignInModal"
  | "WarmWelcome"
  | "NoAccessModal";

type UILoadState = "Home" | "Loading" | "Loaded" | "Error";

type UI = {
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
  blockingAction: boolean;
  lastSnackbarDetailsInfo: HTMLTemplateResult | string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCredits: number;
};

type SubscriptionStatus =
  | "indeterminate"
  | "error"
  | "subscribed"
  | "not-subscribed";

type IntegrationState = {
  title: string;
  url: string;

  status: "loading" | "complete" | "error";

  tools: Map<string, Tool>;

  message: string | null;
};
