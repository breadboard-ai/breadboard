/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { OpieController } from "./opie-controller.js";

export class DevToolsController extends RootController {
  @field({ persist: "session" })
  accessor isOpen = false;

  @field({ persist: "session" })
  accessor activeTab = "opie";

  public readonly opie: OpieController;

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
    this.opie = new OpieController(
      `${controllerId}_Opie`,
      `${persistenceId}_Opie`
    );
  }
}
