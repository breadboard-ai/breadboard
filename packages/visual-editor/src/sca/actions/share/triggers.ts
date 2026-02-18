/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Share actions.
 *
 * These are factory functions that create trigger definitions.
 * They take `bind` as a parameter to avoid circular dependencies.
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when the graph URL changes.
 */
export function onGraphUrl(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph URL", () => {
    const { controller } = bind;
    return controller.editor.graph.url;
  });
}
