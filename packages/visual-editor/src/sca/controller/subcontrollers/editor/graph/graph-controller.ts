/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { Tab } from "../../../../../runtime/types.js";

export class GraphController extends RootController {
  @field()
  accessor graph: GraphDescriptor | null = null;

  @field()
  accessor id: ReturnType<typeof globalThis.crypto.randomUUID> | null = null;

  @field()
  accessor version = 0;

  @field()
  accessor lastLoadedVersion = 0;

  @field()
  accessor url: string | null = null;

  @field()
  accessor readOnly = false;

  @field()
  accessor graphIsMine = false;

  @field()
  accessor mainGraphId: ReturnType<typeof globalThis.crypto.randomUUID> | null =
    null;

  /**
   * Here for migrations.
   *
   * @deprecated
   */
  asTab(): Tab | null {
    if (!this.graph || !this.id || !this.mainGraphId) return null;

    return {
      id: this.id,
      graph: this.graph,
      graphIsMine: this.graphIsMine,
      readOnly: !this.graphIsMine,
      boardServer: null,
      lastLoadedVersion: 0,
      mainGraphId: this.mainGraphId,
      moduleId: null,
      name: this.graph.title ?? "Untitled app",
      subGraphId: null,
      type: 0,
      version: this.version,
    } satisfies Tab;
  }

  /**
   * Here for migrations.
   *
   * @deprecated
   */
  resetAll() {
    this.id = null;
    this.graph = null;
    this.url = null;
    this.version = 0;
    this.readOnly = false;
    this.graphIsMine = false;
    this.mainGraphId = null;
    this.lastLoadedVersion = 0;
  }
}
