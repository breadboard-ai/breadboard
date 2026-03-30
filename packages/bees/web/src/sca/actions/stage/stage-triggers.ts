/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { eventTrigger, type EventTrigger } from "../../coordination.js";
import type { AppController, AppServices } from "../../types.js";

type ActionBind = { controller: AppController; services: AppServices };

export function onIframeNavigate({ services }: ActionBind): EventTrigger {
  return eventTrigger(
    "Iframe Navigate",
    services.stateEventBus,
    "iframe.navigate"
  );
}
