/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { AppController, AppEnvironment } from "../types.js";
import { GlobalController } from "./subcontrollers/global/global.js";
import { RouterController } from "./subcontrollers/router/router-controller.js";
import { RootController } from "./subcontrollers/root-controller.js";
import { ThemeController } from "./subcontrollers/global/theme-controller.js";
import { AgentController } from "./subcontrollers/agent/agent-controller.js";

/**
 * The root application controller for Folio.
 */
class Controller extends RootController implements AppController {
  global: GlobalController;
  router: RouterController;
  theme: ThemeController;
  agent: AgentController;

  constructor(_env: AppEnvironment) {
    super("App", "AppController");
    this.global = new GlobalController();
    this.router = new RouterController();
    this.theme = new ThemeController();
    this.agent = new AgentController();
  }
}

let controller: Controller;
export const appController = (env?: AppEnvironment): Controller => {
  if (!controller) {
    if (!env)
      throw new Error(
        "App Controller must be instantiated with an Environment"
      );
    controller = new Controller(env);
  }

  return controller;
};
