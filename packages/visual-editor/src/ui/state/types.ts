/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Re-export shim: types now live in their canonical locations.
 * - Pure types → sca/types.ts
 * - Lit/signal-dependent types → ui/types/state-types.ts
 *
 * This file exists so that the barrel `ui/state/index.ts` continues to work
 * for existing consumers. New code should import from the canonical locations.
 */

// Pure types (SCA)
export type {
  StepListStateStatus,
  StepListState,
  StepListStepState,
  ErrorReason,
  ErrorMetadata,
  GraphAssetDescriptor,
  GraphAsset,
  GeneratedAssetIdentifier,
  GeneratedAsset,
  Components,
  FlowGenGenerationStatus,
  LiteModeType,
  LiteModeIntentExample,
  EdgeRunState,
  RendererRunState,
  ThemePromptArgs,
} from "../../sca/types.js";

// Lit/signal-dependent types
export type {
  AsyncComputedResult,
  Component,
  FilterableMap,
  IntegrationState,
  SubscriptionStatus,
  TitledItem,
  Tool,
  UI,
  UILoadState,
  UIOverlays,
} from "../types/state-types.js";
