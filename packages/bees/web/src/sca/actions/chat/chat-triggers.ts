/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import type { AppController, AppServices } from "../../types.js";

type ActionBind = { controller: AppController; services: AppServices };

export function onTicketsUpdate({ controller }: ActionBind): SignalTrigger {
  return signalTrigger("Tickets Update", () => {
    return controller.global.tickets.length > 0
      ? controller.global.tickets
      : null;
  });
}
