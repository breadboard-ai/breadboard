/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner } from "@breadboard-ai/types";
import { Outcome } from "@breadboard-ai/types";
import { signal } from "signal-utils";

import { ReactiveProjectRun } from "./project-run.js";

import { Project, ProjectRun } from "./types.js";
import { SCA } from "../../sca/sca.js";

export { createProjectState, ReactiveProject };

function createProjectState(sca: SCA): Project {
  return new ReactiveProject(sca);
}

class ReactiveProject implements Project {
  readonly #sca: SCA;

  @signal
  accessor run: ProjectRun;

  constructor(sca: SCA) {
    this.#sca = sca;
    const editable = this.#sca.controller.editor.graph.editor;
    if (!editable) {
      throw new Error("No editor available");
    }

    this.run = ReactiveProjectRun.createInert(editable.inspect(""));
  }

  resetRun(): void {
    const editable = this.#sca.controller.editor.graph.editor;
    if (!editable) {
      throw new Error("No editor available");
    }
    this.run = ReactiveProjectRun.createInert(editable.inspect(""));
  }

  connectHarnessRunner(
    runner: HarnessRunner,
    signal?: AbortSignal
  ): Outcome<void> {
    const editable = this.#sca.controller.editor.graph.editor;
    if (!editable) {
      throw new Error("No editor available");
    }
    // Intentionally reset this property with a new instance.
    this.run = ReactiveProjectRun.create(
      this.#sca,
      this.#sca.services.actionTracker,
      editable.inspect(""),
      runner,
      editable,
      signal
    );
  }
}
