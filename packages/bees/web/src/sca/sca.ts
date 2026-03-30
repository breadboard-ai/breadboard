/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Services from "./services/services.js";
import * as Controller from "./controller/controller.js";
import * as Actions from "./actions/actions.js";
import type { AppActions } from "./types.js";

export interface SCA {
  services: ReturnType<typeof Services.services>;
  controller: ReturnType<typeof Controller.appController>;
  actions: AppActions;
}

let instance: SCA;

export function sca() {
  if (!instance) {
    const controller = Controller.appController();
    const services = Services.services();
    const actions = Actions.actions(controller, services);

    instance = {
      services,
      controller,
      actions,
    };

    // Set up triggers for side effects once controller is ready.
    controller.isHydrated.then(() => {
      Actions.activateTriggers();
    });
  }

  return instance;
}
