/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * UI-layer types that depend on `lit` or `signal-utils`.
 *
 * Canonical definitions now live in `sca/types.ts`.
 * This file re-exports them for backward compatibility with UI consumers.
 */

// Re-exported from SCA (canonical location)
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
} from "../../sca/types.js";
