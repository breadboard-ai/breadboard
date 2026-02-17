/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * # The SCA Architecture
 *
 * This application is built on the **SCA** pattern (Services, Controllers, and
 * Actions).
 *
 * This architecture separates **Infrastructure** (Services), **State**
 * (Controllers), and **Business Logic** (Actions) into distinct, testable
 * layers. It is designed specifically for reactive, signal-based UI frameworks.
 *
 * ---
 *
 * ## 1. Services (The "Infrastructure")
 * **Role:** The heavy lifting and external communication.
 *
 * Services are the "capabilities" of the application. They provide access to
 * the file system, network, graph processing, authentication, and hardware.
 *
 * - **Characteristics:**
 * - Typically stateless (with respect to the UI).
 * - Injected once at application boot.
 * - Held in `app.services` but rarely accessed directly by the UI.
 * - **Examples:** `FileSystem`, `Autonamer`, `GoogleDriveClient`.
 *
 * ## 2. Controllers (The "State")
 * **Role:** The reactive source of truth.
 *
 * Controllers are the "brain" of the UI. They hold the application state
 * using Signals (via the `@field` decorator), allowing components to react
 * efficiently to changes without manual event listeners.
 *
 * - **Characteristics:**
 * - **Hierarchical:** Organized into a clear tree (e.g., `app.editor.main`,
 *   `app.global.flags`).
 * - **The "Mask" Pattern:** They often wrap complex/legacy objects (like
 *   `EditableGraph`) to expose a clean, signal-based API to the view layer.
 * - **Atomic:** They expose simple, atomic mutations (e.g., `setGraph`,
 *   `addNode`).
 *
 * Complex workflows belong in Actions.
 * - **Examples:** `EditorMainController`, `SelectionController`, `RunController`.
 *
 * ## 3. Actions (The "Logic")
 * **Role:** The orchestration and business workflows.
 *
 * Actions are standalone functions that "glue" Services and Controllers
 * together. They implement the "verbs" of the user interface.
 *
 * - **Characteristics:**
 * - **Functional:** They are functions, not classes.
 * - **Dependencies:** They take the `AppController` and Services as arguments.
 * - **Cross-Cutting:** They can touch multiple parts of the state tree (e.g.,
 * "Delete Selection" reads `editor.selection`, mutates `editor.main`, and
 * notifies `global.toasts`).
 * - **Examples:** `createAndAutonameNode`, `moveSelectionToNewGraph`,
 *   `prepareRun`.
 *
 * Note: Controllers have simple atomic mutations, Actions coordinate multi-step
 * changes using Services and Controllers. If the value is simply to be updated
 * do it in the Controller directly. Not every change needs to be an Action.
 *
 * ## 4. Triggers (The "Side Effects")
 *
 * Triggers are automatic reactions to state changes that invoke Actions.
 * They are declared alongside Actions using the `triggeredBy` property:
 *
 * ```typescript
 * export const save = asAction("Board.save", {
 *   mode: ActionMode.Awaits,
 *   triggeredBy: [() => onVersionChange(bind)],
 * }, async () => { ... });
 * ```
 *
 * Triggers are activated during bootstrap via `Actions.activateTriggers()`.
 *
 * ---
 *
 * ## The Data Flow Cycle
 *
 * 1. **Render:** The **View** (Lit Component) reads state from **Controllers** (Signals).
 * 2. **Interact:** The User triggers an event (click, drag).
 * 3. **Dispatch:** The View calls an **Action** (Command).
 * 4. **Execute:** The **Action** coordinates **Services** (to do work) and
 *   mutates **Controllers** (to update state).
 * 5. **React:** The **Controllers** update their Signals, causing the **View**
 *   to re-render.
 */

import * as Services from "./services/services.js";
import * as Controller from "./controller/controller.js";
import * as Actions from "./actions/actions.js";
import { type RuntimeFlags } from "@breadboard-ai/types";
import { RuntimeConfig } from "../utils/graph-types.js";

// Re-export NotebookLM API client types and enums for UI components
export {
  type Notebook,
  OriginProductType,
  ApplicationPlatform,
  DeviceType,
} from "./services/notebooklm-api-client.js";

export interface SCA {
  services: ReturnType<typeof Services.services>;
  controller: ReturnType<typeof Controller.appController>;
  actions: ReturnType<typeof Actions.actions>;
}

let instance: SCA;
export function sca(config: RuntimeConfig, flags: RuntimeFlags) {
  if (!instance) {
    const controller = Controller.appController(flags);
    const services = Services.services(
      config,
      controller.global.flags,
      () => controller.global.consent
    );

    const actions = Actions.actions(controller, services);

    instance = {
      services,
      controller,
      actions,
    };

    // Set up triggers for side effects once the controller is ready.
    controller.isHydrated.then(() => {
      // Activate action-based triggers
      Actions.activateTriggers();

      // One-time initialization actions (no triggers, called directly)
      actions.router.init();
      actions.screenSize.init();

      // Start polling for status updates
      services.statusUpdates.start(controller.global.statusUpdates);
    });
  }

  return instance;
}
