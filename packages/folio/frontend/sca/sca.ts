/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Services from "./services/services.js";
import * as Controller from "./controller/controller.js";
import * as Actions from "./actions/actions.js";
import {
  createEnvironment,
  type AppEnvironment,
} from "./environment/environment.js";

export type { AppEnvironment } from "./environment/environment.js";
export { type EnvironmentFlags } from "./environment/environment-flags.js";

export interface SCA {
  env: AppEnvironment;
  services: ReturnType<typeof Services.services>;
  controller: ReturnType<typeof Controller.appController>;
  actions: ReturnType<typeof Actions.actions>;
}

let instance: SCA;
export function sca(flags: Record<string, boolean> = {}) {
  if (!instance) {
    const env = createEnvironment(flags);
    const controller = Controller.appController(env);
    const services = Services.services(env);
    const actions = Actions.actions(controller, services, env);

    instance = {
      env,
      services,
      controller,
      actions,
    };

    // Set up triggers for side effects once both environment and
    // controller are ready.
    Promise.all([env.isHydrated, controller.isHydrated]).then(() => {
      // Activate action-based triggers
      Actions.activateTriggers();

      // One-time initialization actions
      actions.router.init();
    });
  }

  return instance;
}
