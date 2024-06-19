/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from "@lit/task";
import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  BehaviorSchema,
  CommentNode,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  InspectableNode,
  InspectablePort,
  Kit,
  NodeConfiguration,
  inspect,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SchemaEditor } from "./schema-editor.js";
import {
  CommentUpdateEvent,
  GraphNodeDeselectedAllEvent,
  NodeUpdateEvent,
} from "../../events/events.js";
import { guard } from "lit/directives/guard.js";
import {
  assertIsLLMContent,
  resolveArrayType,
  resolveBehaviorType,
} from "../../utils/schema.js";
import { ArrayEditor } from "./array-editor.js";
import { BoardSelector } from "./board-selector.js";
import { isBoard } from "../../utils/board.js";
import { CodeEditor } from "../input/code-editor/code-editor.js";
import { LLMInput } from "../input/llm-input/llm-input.js";
import { EditorMode, filterConfigByMode } from "../../utils/mode.js";
import { classMap } from "lit/directives/class-map.js";
import { dataStoreContext } from "../../contexts/data-store.js";
import { provide } from "@lit/context";

function isLLMContent(port: InspectablePort) {
  return port.schema.behavior?.includes("llm-content") || false;
}

type NodeConfigurationInfoDetails = {
  type: "node";
  node: InspectableNode;
  ports: InspectablePort[];
  configuration: NodeConfiguration;
};

type CommentCodeConfigurationInfoDetails = {
  type: "comment";
  node: CommentNode;
};

const STORAGE_PREFIX = "bb-node-configuration";

@customElement("bb-node-configuration")
export class NodeConfigurationInfo extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property()
  editable = false;

  @property()
  selectedNodeIds: string[] = [];

  @property()
  subGraphId: string | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  @state()
  schemaExpanded = true;

  @state()
  inputsExpanded = true;

  @provide({ context: dataStoreContext })
  dataStore = { instance: null };

  #ignoreNextUpdate = false;

  #formTask = new Task(this, {
    task: async ([graph, subGraphId, nodeIds]) => {
      if (!Array.isArray(nodeIds) || nodeIds.length !== 1) {
        return null;
      }

      const nodeId = nodeIds[0];
      if (
        typeof graph !== "object" ||
        Array.isArray(graph) ||
        typeof nodeId !== "string"
      ) {
        throw new Error("Unsupported information");
      }

      if (!graph) {
        throw new Error("Unable to load node");
      }

      const descriptor = graph;
      let breadboardGraph = inspect(descriptor, {
        kits: this.kits,
        loader: this.loader || undefined,
      });

      if (subGraphId && typeof subGraphId === "string") {
        const subgraphs = breadboardGraph.graphs();
        if (subgraphs[subGraphId]) {
          breadboardGraph = subgraphs[subGraphId];
        } else {
          console.warn(`Unable to locate subgraph by name: ${this.subGraphId}`);
        }
      }

      let node: InspectableNode | CommentNode | undefined =
        breadboardGraph.nodeById(nodeId);
      if (node) {
        const configuration = node.configuration();
        const { inputs } = filterConfigByMode(
          await node.ports(),
          EditorMode.ADVANCED
        );
        const ports = [...inputs.ports].sort((portA, portB) =>
          portA.name === "schema" ? -1 : portA.name > portB.name ? 1 : -1
        );

        return {
          type: "node",
          node,
          ports,
          configuration,
        } as NodeConfigurationInfoDetails;
      } else {
        node = breadboardGraph
          .metadata()
          ?.comments?.find((comment) => comment.id === nodeId);

        if (!node) {
          throw new Error("Unable to load node");
        }

        return { type: "comment", node } as CommentCodeConfigurationInfoDetails;
      }
    },
    onError: () => {
      this.dispatchEvent(new GraphNodeDeselectedAllEvent());
    },
    args: () => [this.graph, this.subGraphId, this.selectedNodeIds],
  });

  #nodeConfigurationFormRef: Ref<HTMLFormElement> = createRef();
  #commentConfigurationFormRef: Ref<HTMLFormElement> = createRef();
  #schemaVersion = 0;
  #lastSchemaVersion = 0;
  #forceRender = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    .unfold {
      cursor: pointer;
      width: 100%;
      display: grid;
      grid-template-columns: auto min-content;
      align-items: center;
      border: none;
      background: #fff;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      text-align: left;
    }

    .unfold::after {
      content: "";
      width: 20px;
      height: 20px;
      background: #fff var(--bb-icon-unfold-more) center center / 20px 20px
        no-repeat;
      justify-self: end;
    }

    .unfold.visible::after {
      background: #fff var(--bb-icon-unfold-less) center center / 20px 20px
        no-repeat;
    }

    #no-node-selected {
      padding: var(--padding-y) var(--padding-x);
    }

    .node-load-error {
      padding: var(--padding-y) var(--padding-x);
      font-size: var(--bb-body-small);
    }

    .node-properties {
      width: 100%;
      margin-bottom: calc(var(--bb-grid-size) * 8);
    }

    .node-properties form h1 {
      position: sticky;
      top: 0;
      background: #fff;
      z-index: 2;
      margin: 0;
    }

    .node-properties .fields {
      overflow: auto;
      width: 100%;
    }

    .node-properties label {
      grid-column: 1/3;
      font-family: var(--bb-font-family);
      font-size: var(--bb-text-small);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2)
        var(--bb-grid-size) 0;
      display: block;
    }

    .node-properties input[type="text"],
    .node-properties input[type="number"],
    .node-properties textarea,
    .node-properties select {
      display: block;
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
    }

    .node-properties input[type="text"] {
      width: 100%;
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-small);
      line-height: var(--bb-body-line-height-small);
    }

    .node-properties textarea {
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-small);
      line-height: var(--bb-body-line-height-small);
      resize: none;
      display: block;
      box-sizing: border-box;
      width: 100%;
      field-sizing: content;
      max-height: 300px;
    }

    .node-properties .configuration-item {
      margin-bottom: calc(var(--bb-grid-size) * 2);
      width: 100%;
    }

    .node-properties .configuration-item > label {
      font-weight: bold;
      display: flex;
      align-items: center;
    }

    .node-properties .configuration-item > label::before {
      content: "";
      width: var(--bb-grid-size-2);
      height: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-500);
      background: #fff;
      margin-right: var(--bb-grid-size-2);
      border-radius: 50%;
      box-sizing: border-box;
    }

    .node-properties .configuration-item.connected > label::before {
      background: var(--bb-inputs-300);
    }

    .node-properties .configuration-item.connected.configured > label::before {
      background: var(--bb-boards-500);
    }

    .node-properties .configuration-item > div {
      margin-top: calc(var(--bb-grid-size) * 2);
    }

    .node-properties #reset-to-defaults,
    .node-properties input[type="submit"] {
      background: rgb(209, 203, 255);
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      border: none;
      padding: 0 var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
    }

    .node-properties #reset-to-defaults {
      background: #eee;
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    .node-properties .cancel {
      width: 24px;
      height: 24px;
      font-size: 0;
      border: none;
      background: no-repeat center center var(--bb-icon-close);
    }

    #form-controls {
      display: grid;
      column-gap: calc(var(--bb-grid-size) * 2);
    }

    .port-description {
      font-size: var(--bb-label-small);
      line-height: 1.5;
      margin: 0 0 var(--bb-grid-size) 0;
    }

    .schema,
    .inputs {
      display: none;
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
    }

    .schema.visible,
    .inputs.visible {
      display: block;
    }

    .divider {
      border-bottom: 1px solid var(--bb-neutral-300);
    }

    #multiple-nodes-selected {
      color: var(--bb-neutral-700);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
    }

    .comment {
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
    }

    .comment textarea {
      padding: var(--bb-grid-size);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    const isSchemaExpanded = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-schema-expanded`
    );
    const isInputExpanded = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-input-expanded`
    );

    if (isSchemaExpanded !== null) {
      this.schemaExpanded = isSchemaExpanded === "true";
    }

    if (isInputExpanded !== null) {
      this.inputsExpanded = isInputExpanded === "true";
    }
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          graph: GraphDescriptor | null;
          subGraphId: number;
          selectedNodeIds: string[];
        }>
      | Map<PropertyKey, unknown>
  ): void {
    if (
      changedProperties.has("graph") ||
      changedProperties.has("subGraphId") ||
      changedProperties.has("selectedNodeIds")
    ) {
      if (!this.#nodeConfigurationFormRef.value) {
        return;
      }

      // Here we must unhook the editor *before* it is removed from the DOM,
      // otherwise CodeMirror will hold onto focus if it has it.
      const editors =
        this.#nodeConfigurationFormRef.value.querySelectorAll<CodeEditor>(
          "bb-code-editor"
        );
      for (const editor of editors) {
        editor.unhookSafely();
      }
    }
  }

  #assertIsValidBehavior(
    behavior: string | undefined
  ): behavior is BehaviorSchema {
    switch (behavior) {
      case "board":
      case "bubble":
      case "error":
      case "image":
      case "stream":
      case "json-schema":
      case "llm-content":
      case "ports-spec":
      case "transient":
        return true;

      default:
        return false;
    }
  }

  #onCommentConfigurationFormSubmit(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = data.get("$id") as string;
    const text = data.get("text") as string;

    if (id === null || text === null) {
      return;
    }

    this.#ignoreNextUpdate = true;
    this.dispatchEvent(new CommentUpdateEvent(id, text, this.subGraphId));
  }

  #onNodeConfigurationFormSubmit(form: HTMLFormElement) {
    const toConvert = new Map<string, BehaviorSchema>();
    const data = new FormData(form);
    for (const field of form.querySelectorAll("textarea")) {
      if (field.dataset.type && field.dataset.type === "object") {
        toConvert.set(
          field.id,
          this.#assertIsValidBehavior(field.dataset.behavior)
            ? field.dataset.behavior
            : "json-schema"
        );
      }

      data.set(field.id, field.value);
    }

    for (const schemaEditor of form.querySelectorAll("bb-schema-editor")) {
      if (!(schemaEditor instanceof SchemaEditor && schemaEditor.id)) {
        continue;
      }

      if (!schemaEditor.applyPendingChanges()) {
        return;
      }

      if (
        !schemaEditor.schema?.properties ||
        Object.keys(schemaEditor.schema?.properties).length === 0
      ) {
        continue;
      }

      toConvert.set(schemaEditor.id, "ports-spec");
      data.set(schemaEditor.id, JSON.stringify(schemaEditor.schema));
    }

    for (const arrayEditor of form.querySelectorAll("bb-array-editor")) {
      if (!(arrayEditor instanceof ArrayEditor && arrayEditor.id)) {
        continue;
      }

      toConvert.set(arrayEditor.id, "json-schema");
      data.set(arrayEditor.id, arrayEditor.value);
    }

    for (const boardSelector of form.querySelectorAll<BoardSelector>(
      "bb-board-selector"
    )) {
      if (!boardSelector.id) {
        continue;
      }

      data.set(boardSelector.id, boardSelector.value || "");
      toConvert.set(boardSelector.id, "board");
    }

    for (const codeEditor of form.querySelectorAll<CodeEditor>(
      "bb-code-editor"
    )) {
      if (!codeEditor.id) {
        continue;
      }

      data.set(codeEditor.id, codeEditor.value || "");
    }

    for (const llmInput of form.querySelectorAll<LLMInput>("bb-llm-input")) {
      if (!llmInput.id) {
        continue;
      }

      data.set(llmInput.id, JSON.stringify(llmInput.value));
      toConvert.set(llmInput.id, "llm-content");
    }

    const id = data.get("$id") as string;
    const nodeType = data.get("$type") as string;
    if (!(id && nodeType)) {
      console.warn("Unable to configure node - ID and type are missing");
      return;
    }

    if (!this.graph) {
      return;
    }

    const descriptor = this.graph;
    let breadboardGraph = inspect(descriptor, {
      kits: this.kits,
      loader: this.loader || undefined,
    });

    if (this.subGraphId) {
      const subgraphs = breadboardGraph.graphs();
      if (subgraphs[this.subGraphId]) {
        breadboardGraph = subgraphs[this.subGraphId];
      } else {
        console.warn(`Unable to locate subgraph by name: ${this.subGraphId}`);
        return;
      }
    }

    const node = breadboardGraph.nodeById(id);
    if (!node) {
      console.log("Unable to find node");
      return;
    }

    const configuration: NodeConfiguration = structuredClone(
      node.configuration()
    );

    // Copy data into the configuration.
    for (const [name, value] of data) {
      if (typeof value !== "string") {
        continue;
      }

      if (name === "$id" || name === "$type") {
        continue;
      }

      if (toConvert.has(name)) {
        if (value === "") {
          continue;
        }
        const behavior = toConvert.get(name);
        if (behavior === "board") {
          const capability = { kind: "board", path: value };
          configuration[name] = capability;
          continue;
        } else {
          try {
            // Always attempt a JSON parse of the value.
            const objectValue = JSON.parse(value);
            // Set nulls & undefineds for deletion.
            if (objectValue === null || objectValue === undefined) {
              delete configuration[name];
              continue;
            }

            if (behavior === "llm-content") {
              assertIsLLMContent(objectValue);
            }

            configuration[name] = objectValue;
          } catch (err) {
            continue;
          }
        }
        continue;
      }

      configuration[name] = value;
      if (value === "") {
        delete configuration[name];
      }
    }

    // Check for any removed items.
    for (const [name, value] of Object.entries(configuration)) {
      if (data.get(name)) {
        continue;
      }

      // Override boolean values rather than deleting them.
      if (value === "true") {
        configuration[name] = "false";
        continue;
      }

      delete configuration[name];
    }

    this.#ignoreNextUpdate = true;
    this.dispatchEvent(new NodeUpdateEvent(id, this.subGraphId, configuration));
  }

  protected shouldUpdate(
    changedProperties:
      | PropertyValueMap<{ graph: GraphDescriptor | null }>
      | Map<PropertyKey, unknown>
  ): boolean {
    if (this.#ignoreNextUpdate) {
      this.#ignoreNextUpdate = false;
      return false;
    }

    const lastSchemaVersion = this.#lastSchemaVersion;
    const schemaVersion = this.#schemaVersion;

    this.#lastSchemaVersion = this.#schemaVersion;

    // Changes to the load info don't necessarily qualify for a re-render. In
    // particular we don't want to overwrite the existing form, so we check here
    // before we go ahead and render.
    if (changedProperties.has("graph")) {
      // We have gone from no info to some - render.
      if (changedProperties.get("graph") !== this.graph) {
        return true;
      }

      // The schema version has changed - render.
      if (schemaVersion !== lastSchemaVersion) {
        return true;
      }

      // We know for sure that we want to re-render the form.
      if (this.#forceRender) {
        return true;
      }

      // All other cases of load info changing - don't render.
      return false;
    }

    return true;
  }

  protected updated(): void {
    this.#forceRender = false;
  }

  #saveCurrentNodeState(evt: Event) {
    if (!this.#nodeConfigurationFormRef.value) {
      return;
    }

    evt.stopImmediatePropagation();
    this.#onNodeConfigurationFormSubmit(this.#nodeConfigurationFormRef.value);
  }

  #saveCurrentCommentState(evt: Event) {
    if (!this.#commentConfigurationFormRef.value) {
      return;
    }

    evt.stopImmediatePropagation();
    this.#onCommentConfigurationFormSubmit(
      this.#commentConfigurationFormRef.value
    );
  }

  render() {
    if (!this.graph || !this.selectedNodeIds.length) {
      return html`<div id="no-node-selected">No node selected</div>`;
    }

    return this.#formTask.render({
      pending: () => html`Loading...`,
      complete: (
        data:
          | NodeConfigurationInfoDetails
          | CommentCodeConfigurationInfoDetails
          | null
      ) => {
        if (!data) {
          return html`<div id="multiple-nodes-selected">
            Multiple nodes selected
          </div>`;
        }

        if (data.type === "node") {
          const { node, ports, configuration } = data;

          const portSpec = ports.filter(
            (port) =>
              port.type.hasBehavior("ports-spec") && port.edges.length === 0
          );
          const inputs = ports.filter((port) => {
            if (port.star) {
              return false;
            }

            if (
              port.type.hasBehavior("ports-spec") &&
              port.edges.length === 0
            ) {
              return false;
            }

            return true;
          });

          return html`
            <div class="node-properties">
              <form
                ${ref(this.#nodeConfigurationFormRef)}
                @submit=${(evt: Event) => evt.preventDefault()}
                @paste=${this.#saveCurrentNodeState}
                @input=${this.#saveCurrentNodeState}
                @bbcodechange=${(evt: Event) => {
                  this.#saveCurrentNodeState(evt);
                }}
              >
                <div class="fields">
                  <input
                    id="$id"
                    name="$id"
                    type="hidden"
                    value="${node.descriptor.id}"
                  />
                  <input
                    id="$type"
                    name="$type"
                    type="hidden"
                    value="${node.descriptor.type}"
                  />

                  <!-- Schema (if applicable) -->
                  ${portSpec.length
                    ? html`<h1>
                          <button
                            class=${classMap({
                              unfold: true,
                              visible: this.schemaExpanded,
                            })}
                            @click=${() => {
                              this.schemaExpanded = !this.schemaExpanded;

                              globalThis.sessionStorage.setItem(
                                `${STORAGE_PREFIX}-schema-expanded`,
                                this.schemaExpanded.toString()
                              );
                            }}
                          >
                            Schema
                          </button>
                        </h1>
                        <div
                          class=${classMap({
                            schema: true,
                            visible: this.schemaExpanded,
                          })}
                        >
                          ${portSpec.map((port) => {
                            return html`<bb-schema-editor
                              .nodeId=${node.descriptor.id}
                              .editable=${this.editable}
                              .schema=${port.value}
                              .schemaVersion=${this.#schemaVersion}
                              @bbschemachange=${() => {
                                if (!this.#nodeConfigurationFormRef.value) {
                                  return;
                                }

                                this.#schemaVersion++;
                                this.#onNodeConfigurationFormSubmit(
                                  this.#nodeConfigurationFormRef.value
                                );
                              }}
                              id="${port.name}"
                              name="${port.name}"
                            ></bb-schema-editor>`;
                          })}
                        </div>`
                    : nothing}

                  <!-- Horizontal divider -->
                  ${portSpec.length && inputs.length
                    ? html`<div class="divider"></div>`
                    : nothing}

                  <!-- Inputs (if applicable) -->
                  ${inputs.length
                    ? html`<h1>
                          <button
                            class=${classMap({
                              unfold: true,
                              visible: this.inputsExpanded,
                            })}
                            @click=${() => {
                              this.inputsExpanded = !this.inputsExpanded;

                              globalThis.sessionStorage.setItem(
                                `${STORAGE_PREFIX}-input-expanded`,
                                this.inputsExpanded.toString()
                              );
                            }}
                          >
                            Input
                          </button>
                        </h1>

                        <div
                          class=${classMap({
                            inputs: true,
                            visible: this.inputsExpanded,
                          })}
                        >
                          ${inputs.map((port) => {
                            if (!configuration || port.star) return nothing;
                            return guard([this.graph, port.name], () => {
                              const name = port.name;
                              const value = port.value;
                              const title = port.schema.title ?? port.name;

                              let input;
                              const type = port.schema.type;
                              const behavior = port.schema.behavior;
                              const defaultValue = port.schema.default;

                              // LLM Inputs show their own description, so don't include it
                              // here.
                              const description =
                                port.schema.description && !isLLMContent(port)
                                  ? html`<p class="port-description">
                                      ${port.schema.description}
                                    </p>`
                                  : nothing;
                              if (port.edges.length === 0) {
                                switch (type) {
                                  case "object": {
                                    // Only show the schema editor for inputs & outputs
                                    if (port.type.hasBehavior("ports-spec")) {
                                      input = html``;
                                    } else if (isBoard(port, value)) {
                                      const selectorValue = value
                                        ? typeof value === "string"
                                          ? value
                                          : value.path
                                        : "";
                                      input = html`<bb-board-selector
                                        .graph=${this.graph}
                                        .subGraphIds=${this.graph &&
                                        this.graph.graphs
                                          ? Object.keys(this.graph.graphs)
                                          : []}
                                        .providers=${this.providers}
                                        .providerOps=${this.providerOps}
                                        .value=${selectorValue || ""}
                                        @input=${(evt: Event) => {
                                          evt.preventDefault();
                                          if (
                                            !this.#nodeConfigurationFormRef
                                              .value
                                          ) {
                                            return;
                                          }

                                          this.#onNodeConfigurationFormSubmit(
                                            this.#nodeConfigurationFormRef.value
                                          );
                                        }}
                                        id="${name}"
                                        name="${name}"
                                      ></bb-board-selector>`;
                                    } else if (isLLMContent(port)) {
                                      input = html`<bb-llm-input
                                        id="${name}"
                                        name="${name}"
                                        .schema=${port.schema}
                                        .value=${value}
                                        .description=${port.schema
                                          ?.description || null}
                                      ></bb-llm-input>`;
                                    } else {
                                      input = html`<textarea
                                        id="${name}"
                                        name="${name}"
                                        placeholder="${defaultValue}"
                                        data-type="${type}"
                                        data-behavior=${behavior
                                          ? behavior
                                          : nothing}
                                        @input=${(evt: Event) => {
                                          const field = evt.target;
                                          if (
                                            !(
                                              field instanceof
                                              HTMLTextAreaElement
                                            )
                                          ) {
                                            return;
                                          }

                                          field.setCustomValidity("");
                                        }}
                                        @blur=${(evt: Event) => {
                                          const field = evt.target;
                                          if (
                                            !(
                                              field instanceof
                                              HTMLTextAreaElement
                                            )
                                          ) {
                                            return;
                                          }

                                          field.setCustomValidity("");
                                          if (field.value === "") {
                                            return;
                                          }

                                          try {
                                            JSON.parse(field.value);
                                            if (
                                              field.dataset.behavior ===
                                              "llm-content"
                                            ) {
                                              assertIsLLMContent(field.value);
                                            }
                                          } catch (err) {
                                            if (err instanceof SyntaxError) {
                                              field.setCustomValidity(
                                                "Invalid JSON"
                                              );
                                            } else {
                                              const llmError = err as Error;
                                              field.setCustomValidity(
                                                `Invalid LLM Content: ${llmError.message}`
                                              );
                                            }
                                          }

                                          field.reportValidity();
                                        }}
                                        .value=${value
                                          ? JSON.stringify(value, null, 2)
                                          : ""}
                                      ></textarea>`;
                                    }
                                    break;
                                  }

                                  case "array": {
                                    let renderableValue = value;
                                    if (typeof value !== "string") {
                                      renderableValue = JSON.stringify(value);
                                    }

                                    let items: Array<
                                      string | number | object
                                    > | null = null;
                                    try {
                                      items = JSON.parse(
                                        renderableValue as string
                                      );
                                    } catch (err) {
                                      items = null;
                                    }

                                    input = html`<bb-array-editor
                                      id="${name}"
                                      name="${name}"
                                      .items=${items}
                                      .type=${resolveArrayType(port.schema)}
                                      .behavior=${resolveBehaviorType(
                                        port.schema.items
                                          ? Array.isArray(port.schema.items)
                                            ? port.schema.items[0]
                                            : port.schema.items
                                          : port.schema
                                      )}
                                      .subGraphIds=${this.graph &&
                                      this.graph.graphs
                                        ? Object.keys(this.graph.graphs)
                                        : []}
                                      .providers=${this.providers}
                                      .providerOps=${this.providerOps}
                                    ></bb-array-editor>`;
                                    break;
                                  }

                                  case "number": {
                                    input = html`<div>
                                      <input
                                        type="number"
                                        value="${value}"
                                        name="${name}"
                                        id=${name}
                                      />
                                    </div>`;
                                    break;
                                  }

                                  case "boolean": {
                                    input = html`<div>
                                      <input
                                        type="checkbox"
                                        name="${name}"
                                        id=${name}
                                        .checked=${value}
                                      />
                                    </div>`;
                                    break;
                                  }

                                  default: {
                                    if (
                                      port.schema.behavior?.includes("code")
                                    ) {
                                      input = html` <div>
                                        <bb-code-editor
                                          id="${name}"
                                          name="${name}"
                                          .value=${value ?? defaultValue ?? ""}
                                        ></bb-code-editor>
                                      </div>`;
                                      break;
                                    }

                                    input = html` <div>
                                      <textarea
                                        id="${name}"
                                        name="${name}"
                                        data-type="${type}"
                                        .value=${value ?? defaultValue ?? ""}
                                      ></textarea>
                                    </div>`;

                                    break;
                                  }
                                }
                              } else {
                                input = nothing;
                              }

                              return html`<div
                                class=${classMap({
                                  "configuration-item": true,
                                  configured:
                                    port.configured && port.edges.length === 0,
                                  [port.status]: true,
                                })}
                              >
                                <label
                                  title="${port.schema.description}"
                                  for="${name}"
                                  >${title}
                                </label>
                                ${description} ${input}
                              </div>`;
                            });
                          })}
                        </div>`
                    : nothing}
                </div>
              </form>
            </div>
          `;
        } else if (data.type === "comment") {
          return html`<div class="node-properties">
            <form
              ${ref(this.#commentConfigurationFormRef)}
              @submit=${(evt: Event) => evt.preventDefault()}
              @paste=${this.#saveCurrentCommentState}
              @input=${this.#saveCurrentCommentState}
            >
              <div class="comment">
                <input
                  id="$id"
                  name="$id"
                  type="hidden"
                  value="${data.node.id}"
                />
                <div>
                  <label title="Comment" for="text">Details </label>
                  <textarea
                    id="text"
                    name="text"
                    .value=${data.node.text || ""}
                  ></textarea>
                </div>
              </div>
            </form>
          </div>`;
        }
      },
      error: () => {
        this.dispatchEvent(new GraphNodeDeselectedAllEvent());
      },
    });
  }
}
