/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeConfig } from "./types.js";
import { State } from "../ui/index.js";
import { Project } from "../ui/state/types.js";
import { MainGraphIdentifier } from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { SCA } from "../sca/sca.js";

export class Runtime extends EventTarget {
  readonly #sca: SCA;

  #currentMainGraphId: MainGraphIdentifier | null = null;

  @signal
  accessor project: Project | null = null;

  constructor(config: RuntimeConfig) {
    super();

    if (!config.sca) throw new Error("Expected SCA");
    this.#sca = config.sca;
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
    this.project = this.#createProjectState();
  }

  #createProjectState(): State.Project | null {
    if (!this.#sca.controller.editor.graph.editor) {
      console.warn(`No editable graph provided: cannot create project state`);
      return null;
    }

    return State.createProjectState(this.#sca);
  }
}
