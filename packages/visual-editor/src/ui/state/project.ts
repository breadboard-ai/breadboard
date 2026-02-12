/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner } from "@breadboard-ai/types";
import { Outcome } from "@breadboard-ai/types";
import { signal } from "signal-utils";

import { ReactiveProjectRun } from "./project-run.js";

import {
  Integrations,
  Project,
  ProjectRun,
  ProjectValues,
  FastAccess,
} from "./types.js";
import { IntegrationsImpl } from "./integrations.js";
import { McpClientManager } from "../../mcp/index.js";
import { ReactiveFastAccess } from "./fast-access.js";
import { FilteredIntegrationsImpl } from "./filtered-integrations.js";
import { SCA } from "../../sca/sca.js";

export { createProjectState, ReactiveProject };

function createProjectState(
  mcpClientManager: McpClientManager,
  sca: SCA
): Project {
  return new ReactiveProject(mcpClientManager, sca);
}

class ReactiveProject implements Project, ProjectValues {
  readonly #sca: SCA;

  @signal
  accessor run: ProjectRun;

  readonly integrations: Integrations;
  readonly fastAccess: FastAccess;

  constructor(clientManager: McpClientManager, sca: SCA) {
    this.#sca = sca;
    const editable = this.#sca.controller.editor.graph.editor;
    if (!editable) {
      throw new Error("No editor available");
    }
    this.integrations = new IntegrationsImpl(clientManager, editable);
    this.fastAccess = new ReactiveFastAccess(
      new FilteredIntegrationsImpl(this.integrations.registered),
      this.#sca
    );

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
