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
  GraphIdentifier,
  NodeConfiguration,
  NodeIdentifier,
  OutputValues,
} from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import { Tab } from "../../../../../runtime/types.js";
import { Tool } from "../../../../../ui/state/types.js";
import { A2_TOOLS } from "../../../../../a2/a2-registry.js";

/**
 * Context for tracking node configuration changes.
 * Used by the autoname trigger to react to config updates.
 */
export interface ConfigChangeContext {
  nodeId: NodeIdentifier;
  graphId: GraphIdentifier;
  configuration: NodeConfiguration;
  titleUserModified: boolean;
}

export class GraphController extends RootController {
  /**
   * Static registry of A2 tools. These are environment-independent
   * and don't change based on graph content.
   */
  readonly tools: ReadonlyMap<string, Tool> = new Map(A2_TOOLS);

  @field({ deep: false })
  private accessor _editor: EditableGraph | null = null;

  /**
   * We set this to shallow because we update it via the Editor API, and that
   * wholesale changes the graph. Also parts of the graph might be
   * structureClone'd and so we don't want those to break.
   */
  @field({ deep: false })
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
   * Tracks the current save status of the board.
   * Updated by the saveStatusChange trigger when the board server reports changes.
   */
  @field()
  accessor saveStatus: "saved" | "saving" | "unsaved" | "error" = "saved";

  /**
   * Tracks the most recent node configuration change.
   * Set by the changeNodeConfiguration action, consumed by the autoname trigger.
   */
  @field({ deep: true })
  accessor lastNodeConfigChange: ConfigChangeContext | null = null;

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

  /**
   * Pre-loaded final output values for displaying results.
   * Not reactive since this is set once at load time.
   */
  finalOutputValues: OutputValues | undefined = undefined;

  /**
   * The title of the graph. Updated reactively when the graph changes.
   */
  @field()
  private accessor _title: string | null = null;

  get title(): string | null {
    return this._title;
  }

  /**
   * The current graph descriptor.
   */
  get graph() {
    return this._graph;
  }

  /**
   * Whether the graph is empty (has no nodes).
   */
  get empty() {
    return (this._graph?.nodes?.length ?? 0) === 0;
  }

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
    this._title = this._graph?.title ?? null;
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
    this._title = evt.graph?.title ?? null;
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
      finalOutputValues: this.finalOutputValues,
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
    this._title = null;
    this.url = null;
    this.version = 0;
    this.readOnly = false;
    this.graphIsMine = false;
    this.mainGraphId = null;
    this.lastLoadedVersion = 0;
    this.lastNodeConfigChange = null;
    this.finalOutputValues = undefined;
  }
}
