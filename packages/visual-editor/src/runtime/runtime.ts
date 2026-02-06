/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeConfig } from "./types.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

import { Select } from "./select.js";
import { State } from "../ui/index.js";
import { Project } from "../ui/state/types.js";
import { EditableGraph, MainGraphIdentifier } from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { SCA } from "../sca/sca.js";

export class Runtime extends EventTarget {
  public readonly select: Select;
  readonly #sca: SCA;

  #currentMainGraphId: MainGraphIdentifier | null = null;

  @signal
  accessor project: Project | null = null;

  constructor(config: RuntimeConfig) {
    super();

    const sca = config.sca;
    if (!sca) throw new Error("Expected SCA");

    this.#sca = sca;
    this.select = new Select();
  }

  /**
   * Syncs project state from the SCA controller.
   * Called directly after load/close actions.
   */
  syncProjectState(): void {
    const tab = this.#sca.controller.editor.graph.asTab();
    if (!tab) {
      // When the tab is null and the main graph id is not null, we are in the
      // process of closing a tab. Reset the state.
      if (this.#currentMainGraphId) {
        this.#currentMainGraphId = null;
        this.project = null;
      }
      return;
    }
    const mainGraphId = tab.mainGraphId;
    if (mainGraphId === this.#currentMainGraphId) return;
    this.#currentMainGraphId = mainGraphId;
    const editor = this.#sca.controller.editor.graph.editor;
    this.project = this.#createProjectState(editor);
  }

  #createProjectState(editable: EditableGraph | null): State.Project | null {
    if (!editable) {
      console.warn(`No editable graph provided: cannot create project state`);
      return null;
    }

    return State.createProjectState(
      this.#sca.services.actionTracker,
      this.#sca.services.mcpClientManager,
      editable,
      this.#sca
    );
  }
}
