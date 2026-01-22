/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../../controller/controller.js";
import { type AppServices } from "../../services/services.js";
import { makeAction } from "../binder.js";

export const bind = makeAction();

export async function load() {
  const { controller, services } = bind;
  console.log(controller, services);
}

export async function edit(_app: AppController, _services: AppServices) {
  // TODO
}
