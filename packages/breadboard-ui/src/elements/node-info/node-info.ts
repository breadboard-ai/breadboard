/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from "@lit/task";
import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BehaviorSchema,
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
  NodeMetadataUpdateEvent,
  NodeUpdateEvent,
} from "../../events/events.js";
import { guard } from "lit/directives/guard.js";
import {
  assertIsLLMContent,
  resolveArrayType,
  resolveBehaviorType,
} from "../../utils/schema.js";
import { ArrayEditor } from "./array-editor.js";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";
import { BoardSelector } from "./board-selector.js";
import { isBoard } from "../../utils/board.js";
import { CodeEditor } from "../input/code-editor/code-editor.js";
import { EditorMode, filterConfigByMode } from "../../utils/mode.js";

@customElement("bb-node-info")
export class NodeInfo extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property()
  editable = false;

  @property()
  selectedNodeId: string | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  #formTask = new Task(this, {
    task: async ([graph, subGraphId, nodeId]) => {
      if (typeof graph !== "object" || typeof nodeId !== "string") {
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

      const node = breadboardGraph.nodeById(nodeId);

      if (!node) {
        throw new Error("Unable to load node");
      }

      const metadata = node.metadata();
      const configuration = node.configuration();
      const { inputs } = filterConfigByMode(
        await node.ports(),
        EditorMode.HARD
      );
      const ports = structuredClone(inputs.ports).sort((portA, portB) =>
        portA.name === "schema" ? -1 : portA.name > portB.name ? 1 : -1
      );

      return { node, ports, configuration, metadata };
    },
    args: () => [this.graph, this.subGraphId, this.selectedNodeId],
  });

  #metadataFormRef: Ref<HTMLFormElement> = createRef();
  #configurationFormRef: Ref<HTMLFormElement> = createRef();
  #schemaVersion = 0;
  #lastSchemaVersion = 0;
  #forceRender = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scrollbar-gutter: stable;

      --padding-x: calc(var(--bb-grid-size) * 4);
      --padding-y: calc(var(--bb-grid-size) * 2);
    }

    :host > details > summary {
      position: relative;
      user-select: none;
      font-size: var(--bb-font-medium);
      font-weight: normal;
      margin: 0 0 var(--bb-grid-size) 0;
      padding: var(--padding-x) var(--padding-x) var(--padding-y)
        var(--padding-x);
      background: white;
      z-index: 2;
      display: grid;
      grid-template-columns: auto 1fr auto;
      cursor: pointer;
    }

    :host > details > summary::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: red;
      margin-right: calc(var(--bb-grid-size) * 2);
      background: var(--bb-icon-expand) center center no-repeat;
    }

    :host > details[open] > summary::before {
      background: var(--bb-icon-collapse) center center no-repeat;
    }

    :host > details > summary::after {
      content: "";
      width: calc(100% - var(--padding-x) * 2);
      height: 1px;
      position: absolute;
      bottom: var(--bb-grid-size);
      left: var(--padding-x);
      background: #f6f6f6;
    }

    #reset-to-defaults {
      justify-self: end;
      width: 24px;
      height: 24px;
      opacity: 0.5;
      background: var(--bb-icon-reset) center center no-repeat;
      font-size: 0;
      border: none;
      cursor: pointer;
      margin-top: -2px;
    }

    #reset-to-defaults:hover {
      opacity: 1;
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

    .node-properties form {
      font-size: var(--bb-text-small);
      overflow: auto;
      margin: 0;
      width: 100%;
      padding: var(--padding-y) var(--padding-x);
    }

    .node-properties .fields {
      overflow: auto;
      scrollbar-gutter: stable;
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
  `;

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

  #onMetadataFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement) || !this.selectedNodeId) {
      return;
    }

    const getAsStringOrUndefined = (
      formData: FormData,
      key: string
    ): string | undefined => {
      if (!formData.has(key)) {
        return undefined;
      }

      const value = formData.get(key) as string;
      if (value === "") {
        return undefined;
      }

      return value;
    };

    const data = new FormData(evt.target);
    const id = getAsStringOrUndefined(data, "$id");
    const title = getAsStringOrUndefined(data, "metadata-title");
    const description = getAsStringOrUndefined(data, "metadata-description");
    const logLevel = getAsStringOrUndefined(data, "metadata-log-level") as
      | "debug"
      | "info";

    if (!id) {
      console.warn("No $id provided for node - unable to update metadata");
      return;
    }

    const metadataEvt = new NodeMetadataUpdateEvent(id, this.subGraphId, {
      title,
      description,
      logLevel,
    });
    this.dispatchEvent(metadataEvt);
  }

  #onConfigurationFormSubmit(form: HTMLFormElement) {
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
            if (behavior === "llm-content") {
              assertIsLLMContent(objectValue);
            }

            // Set nulls & undefineds for deletion.
            if (objectValue === null || objectValue === undefined) {
              delete configuration[name];
              continue;
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

    this.dispatchEvent(new NodeUpdateEvent(id, this.subGraphId, configuration));
  }

  async #setDefaultConfiguration(node: InspectableNode) {
    const configuration: NodeConfiguration = {} satisfies NodeConfiguration;
    const { inputs } = await node.ports();
    for (const port of inputs.ports) {
      if (!port.schema?.default && !port.schema?.examples) {
        continue;
      }

      configuration[port.name] = port.schema?.examples ?? port.schema?.default;
    }

    // Because we're going to change the configuration without typing anything,
    // we can do a rendering update safely.
    this.#forceRender = true;
    this.dispatchEvent(
      new NodeUpdateEvent(node.descriptor.id, this.subGraphId, configuration)
    );
  }

  protected shouldUpdate(
    changedProperties:
      | PropertyValueMap<{ graph: GraphDescriptor | null }>
      | Map<PropertyKey, unknown>
  ): boolean {
    const lastSchemaVersion = this.#lastSchemaVersion;
    const schemaVersion = this.#schemaVersion;

    this.#lastSchemaVersion = this.#schemaVersion;

    // Changes to the load info don't necessarily qualify for a re-render. In
    // particular we don't want to overwrite the existing form, so we check here
    // before we go ahead and render.
    if (changedProperties.has("graph")) {
      // We have gone from no info to some - render.
      if (changedProperties.get("graph") === null) {
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

  render() {
    if (!this.graph || !this.selectedNodeId) {
      return html`<div id="no-node-selected">No node selected</div>`;
    }

    return this.#formTask.render({
      pending: () => html`Loading...`,
      complete: ({
        node,
        ports,
        configuration,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        metadata,
      }: {
        node: InspectableNode;
        ports: InspectablePort[];
        configuration: NodeConfiguration;
        metadata: NodeMetadata;
      }) => html`
        <details>
          <summary>Metadata</summary>
          <div class="node-properties">
            <form
              ${ref(this.#metadataFormRef)}
              @submit=${this.#onMetadataFormSubmit}
              @input=${() => {
                if (!this.#metadataFormRef.value) {
                  return;
                }

                this.#metadataFormRef.value.dispatchEvent(
                  new SubmitEvent("submit")
                );
              }}
            >
              <input
                id="$id"
                name="$id"
                type="hidden"
                value="${node.descriptor.id}"
              />
              <div class="fields">
                <div class="configuration-item">
                  <label for="metadata-title">Title</label>
                  <input
                    type="text"
                    id="metdata-title"
                    name="metadata-title"
                    .value=${metadata.title || ""}
                  />
                </div>

                <div class="configuration-item">
                  <label for="metadata-description">Description</label>
                  <textarea
                    type="text"
                    id="metdata-description"
                    name="metadata-description"
                    .value=${metadata.description || ""}
                  ></textarea>
                </div>

                <div class="configuration-item">
                  <label for="metadata-log-level">Log Level</label>
                  <select
                    type="text"
                    id="metdata-log-level"
                    name="metadata-log-level"
                  >
                    <option
                      value="debug"
                      ?selected=${metadata.logLevel === "debug"}
                    >
                      Debug
                    </option>
                    <option
                      value="info"
                      ?selected=${metadata.logLevel === "info"}
                    >
                      Information
                    </option>
                  </select>
                </div>
              </div>
            </form>
          </div>
        </details>

        <details open>
          <summary>
            Configuration (${node.title()})
            <button
              ?disabled=${!this.editable}
              @click=${() => this.#setDefaultConfiguration(node)}
              type="button"
              title="Reset to defaults"
              id="reset-to-defaults"
            >
              Reset
            </button>
          </summary>

          <div class="node-properties">
            <form
              ${ref(this.#configurationFormRef)}
              @submit=${(evt: Event) => evt.preventDefault()}
              @input=${() => {
                if (!this.#configurationFormRef.value) {
                  return;
                }

                this.#onConfigurationFormSubmit(
                  this.#configurationFormRef.value
                );
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
                ${ports.map((port) => {
                  if (!configuration || port.star) return;
                  return guard([port.name], () => {
                    const name = port.name;
                    const value = port.value;

                    let input;
                    const type = port.schema.type;
                    const behavior = port.schema.behavior;
                    const defaultValue = port.schema.default;
                    const description = port.schema.description
                      ? html`<p class="port-description">
                          ${port.schema.description}
                        </p>`
                      : nothing;
                    switch (type) {
                      case "object": {
                        // Only show the schema editor for inputs & outputs
                        if (port.schema.behavior?.includes("ports-spec")) {
                          input = html`<bb-schema-editor
                            .editable=${this.editable}
                            .schema=${value}
                            .schemaVersion=${this.#schemaVersion}
                            @breadboardschemachange=${() => {
                              if (!this.#configurationFormRef.value) {
                                return;
                              }

                              this.#schemaVersion++;
                              this.#onConfigurationFormSubmit(
                                this.#configurationFormRef.value
                              );
                            }}
                            id="${name}"
                            name="${name}"
                          ></bb-schema-editor>`;
                        } else if (isBoard(port, value)) {
                          const selectorValue = value
                            ? typeof value === "string"
                              ? value
                              : value.path
                            : "";
                          input = html`<bb-board-selector
                            .graph=${this.graph}
                            .subGraphIds=${this.graph && this.graph.graphs
                              ? Object.keys(this.graph.graphs)
                              : []}
                            .providers=${this.providers}
                            .providerOps=${this.providerOps}
                            .value=${selectorValue || ""}
                            @input=${(evt: Event) => {
                              evt.preventDefault();
                              if (!this.#configurationFormRef.value) {
                                return;
                              }

                              this.#onConfigurationFormSubmit(
                                this.#configurationFormRef.value
                              );
                            }}
                            id="${name}"
                            name="${name}"
                          ></bb-board-selector>`;
                        } else {
                          input = html`<textarea
                            id="${name}"
                            name="${name}"
                            placeholder="${defaultValue}"
                            data-type="${type}"
                            data-behavior=${behavior ? behavior : nothing}
                            @input=${(evt: Event) => {
                              const field = evt.target;
                              if (!(field instanceof HTMLTextAreaElement)) {
                                return;
                              }

                              field.setCustomValidity("");
                            }}
                            @blur=${(evt: Event) => {
                              const field = evt.target;
                              if (!(field instanceof HTMLTextAreaElement)) {
                                return;
                              }

                              field.setCustomValidity("");
                              if (field.value === "") {
                                return;
                              }

                              try {
                                JSON.parse(field.value);
                                if (field.dataset.behavior === "llm-content") {
                                  assertIsLLMContent(field.value);
                                }
                              } catch (err) {
                                if (err instanceof SyntaxError) {
                                  field.setCustomValidity("Invalid JSON");
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
                        input = html`<bb-array-editor
                          id="${name}"
                          name="${name}"
                          .items=${JSON.parse(
                            (renderableValue as string) || "null"
                          )}
                          .type=${resolveArrayType(port.schema)}
                          .behavior=${resolveBehaviorType(
                            port.schema.items
                              ? Array.isArray(port.schema.items)
                                ? port.schema.items[0]
                                : port.schema.items
                              : port.schema
                          )}
                          .subGraphIds=${this.graph && this.graph.graphs
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
                        if (port.schema.behavior?.includes("code")) {
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

                    const schema = port.schema;

                    return html`<div class="configuration-item">
                      <label title="${schema.description}" for="${name}"
                        >${name}
                        (${Array.isArray(schema.type)
                          ? schema.type.join(", ")
                          : schema.type || "No type"}):
                      </label>
                      ${description} ${input}
                    </div>`;
                  });
                })}
              </div>
            </form>
          </div>
        </details>
      `,
      error: (err) => {
        console.warn(err);
        return html`<div class="node-load-error">
          Error loading node: (${(err as Error).toString()})
        </div>`;
      },
    });
  }
}
