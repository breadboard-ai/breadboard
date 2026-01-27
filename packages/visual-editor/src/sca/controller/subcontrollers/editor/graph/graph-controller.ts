/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditableGraph,
  GraphChangeEvent,
  GraphChangeRejectEvent,
  GraphDescriptor,
} from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { Tab } from "../../../../../runtime/types.js";

export class GraphController extends RootController {
  @field()
  private accessor _editor: EditableGraph | null = null;

  @field()
  private accessor _graph: GraphDescriptor | null = null;

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
  accessor lastEditError: string | null = null;

  /**
   * Here for migrations.
   * @deprecated
   */
  @field()
  accessor graphIsMine = false;

  /**
   * Here for migrations.
   * @deprecated
   */
  @field()
  accessor mainGraphId: ReturnType<typeof globalThis.crypto.randomUUID> | null =
    null;

  get editor() {
    return this._editor;
  }

  setEditor(editor: EditableGraph | null) {
    if (this._editor) {
      this._editor.removeEventListener("graphchange", this.#onGraphChangeBound);
      this._editor.removeEventListener(
        "graphchangereject",
        this.#onGraphChangeRejectBound
      );
    }

    this._editor = editor;
    this._graph = this._editor?.raw() ?? null;
    this.lastEditError = null;

    if (!this._editor) return;
    this._editor.addEventListener("graphchange", this.#onGraphChangeBound);
    this._editor.addEventListener(
      "graphchangereject",
      this.#onGraphChangeRejectBound
    );
  }

  #onGraphChangeBound = this.#onGraphChange.bind(this);
  #onGraphChange(evt: GraphChangeEvent) {
    this._graph = evt.graph;
    this.lastEditError = null;
    this.version++;
  }

  #onGraphChangeRejectBound = this.#onGraphChangeReject.bind(this);
  #onGraphChangeReject(evt: GraphChangeRejectEvent) {
    this._graph = evt.graph;
    if (evt.reason.type === "error") {
      this.lastEditError = evt.reason.error;
    }
  }

  /**
   * Here for migrations.
   *
   * @deprecated
   */
  asTab(): Tab | null {
    if (!this._graph || !this.id || !this.mainGraphId) return null;

    return {
      id: this.id,
      graph: this._graph,
      graphIsMine: this.graphIsMine,
      readOnly: !this.graphIsMine,
      boardServer: null,
      lastLoadedVersion: this.lastLoadedVersion,
      mainGraphId: this.mainGraphId,
      moduleId: null,
      name: this._graph.title ?? "Untitled app",
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
    this._editor = null;
    this._graph = null;
    this.url = null;
    this.version = 0;
    this.readOnly = false;
    this.graphIsMine = false;
    this.mainGraphId = null;
    this.lastLoadedVersion = 0;
  }
}
