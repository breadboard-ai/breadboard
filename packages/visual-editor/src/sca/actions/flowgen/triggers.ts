/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Flowgen actions.
 */

import { stateEventTrigger, type EventTrigger } from "../../coordination.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

type ActionBind = { controller: AppController; services: AppServices };

// =============================================================================
// State Event Triggers
// =============================================================================

/** Fires when flow generation is requested. */
export function onFlowgenGenerate(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return stateEventTrigger(
    "Flowgen Generate",
    services.stateEventBus,
    "flowgen.generate"
  );
}
