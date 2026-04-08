/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RootController } from "./root-controller.js";
import { field } from "../decorators/field.js";

export { AgentTreeController };

/**
 * Tracks agent tree navigation state.
 *
 * The tree itself is derived from the flat ticket list in
 * `GlobalController` — see the `deriveAgentTree` utility for the
 * pure derivation logic, used by the tree action and tests.
 */
class AgentTreeController extends RootController {
  constructor() {
    super("agentTree", "agentTree");
  }

  /** The ticket ID of the currently selected agent in the tree. */
  @field() accessor selectedAgentId: string | null = null;
}
