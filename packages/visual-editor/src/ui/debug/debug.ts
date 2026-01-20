/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Pane } from "tweakpane";
import { AppController } from "../../controller/controller.js";

/**
 * Global state for the debug interface lifecycle.
 */
const container = document.createElement("div");
container.id = "debug-controls";

let pane: Pane | undefined;
let active = false;

export async function addDebugPanel(_controller: AppController) {
  if (active) return;
  active = true;

  const { Pane } = await import("tweakpane");
  document.body.appendChild(container);

  pane = new Pane({ title: "Debug Console", container });
  pane.addFolder({ title: "Global", expanded: false });
}

export function removeDebugPanel() {
  container.remove();
  if (!pane) return;

  pane.dispose();
  pane = undefined;
  active = false;
}
