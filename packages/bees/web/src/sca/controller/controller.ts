/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatController } from "./subcontrollers/chat.js";
import { StageController } from "./subcontrollers/stage.js";
import { GlobalController } from "./subcontrollers/global.js";
import { AppController } from "../types.js";

export class BeesController implements AppController {
  readonly chat = new ChatController();
  readonly stage = new StageController();
  readonly global = new GlobalController();

  isHydrated: Promise<number[]> = Promise.resolve([]);
}

let instance: BeesController | null = null;

export const appController = (): BeesController => {
  if (instance) return instance;
  instance = new BeesController();
  return instance;
};
