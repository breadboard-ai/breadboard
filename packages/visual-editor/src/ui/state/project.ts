/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner } from "@breadboard-ai/types";
import { Outcome } from "@breadboard-ai/types";
import { signal } from "signal-utils";

import { ReactiveProjectRun } from "./project-run.js";
import { RendererStateImpl } from "./renderer.js";
import {
  Integrations,
  Project,
  ProjectRun,
  ProjectValues,
  RendererState,
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

  readonly renderer: RendererState;
  readonly integrations: Integrations;
  readonly fastAccess: FastAccess;

  /**
   * Derives editable from SCA controller.
   */
  get #editable() {
    return this.#sca.controller.editor.graph.editor!;
  }

  constructor(clientManager: McpClientManager, sca: SCA) {
    this.#sca = sca;
    const editable = this.#editable;
    this.integrations = new IntegrationsImpl(clientManager, editable);
    this.fastAccess = new ReactiveFastAccess(
      new FilteredIntegrationsImpl(this.integrations.registered),
      this.#sca
    );
    this.renderer = new RendererStateImpl(
      this.#sca.controller.editor.graph.graphAssets
    );

    this.run = ReactiveProjectRun.createInert(this.#editable.inspect(""));
  }

  resetRun(): void {
    this.run = ReactiveProjectRun.createInert(this.#editable.inspect(""));
  }

  connectHarnessRunner(
    runner: HarnessRunner,
    signal?: AbortSignal
  ): Outcome<void> {
    // Intentionally reset this property with a new instance.
    this.run = ReactiveProjectRun.create(
      this.#sca,
      this.#sca.services.actionTracker,
      this.#editable.inspect(""),
      runner,
      this.#editable,
      signal
    );
  }
}
