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
  InspectableNode,
  InspectablePort,
  Kit,
  NodeConfiguration,
  inspect,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SchemaEditor } from "./schema-editor.js";
import { NodeUpdateEvent } from "../../events/events.js";
import { guard } from "lit/directives/guard.js";
import {
  assertIsLLMContent,
  resolveArrayType,
  resolveBehaviorType,
} from "../../utils/schema.js";
import { ArrayEditor } from "./array-editor.js";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

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
      const { inputs } = await node.ports();
      const ports = structuredClone(inputs.ports).sort((portA, portB) =>
        portA.name === "schema" ? -1 : portA.name > portB.name ? 1 : -1
      );

      return { node, ports, configuration, metadata };
    },
    args: () => [this.graph, this.subGraphId, this.selectedNodeId],
  });

  #formRef: Ref<HTMLFormElement> = createRef();
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

    :host > h1 {
      position: sticky;
      top: 0;
      font-size: var(--bb-font-medium);
      font-weight: normal;
      margin: 0 0 var(--bb-grid-size) 0;
      padding: var(--padding-x) var(--padding-x) var(--padding-y)
        var(--padding-x);
      background: white;
      z-index: 2;
      display: grid;
      grid-template-columns: auto auto;
    }

    :host > h1::after {
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

    #node-properties {
      width: 100%;
    }

    #node-properties form {
      font-size: var(--bb-text-small);
      overflow: auto;
      margin: 0;
      width: 100%;
      padding: var(--padding-y) var(--padding-x);
    }

    #node-properties #fields {
      overflow: auto;
      scrollbar-gutter: stable;
      width: 100%;
    }

    #node-properties label {
      grid-column: 1/3;
      font-family: var(--bb-font-family);
      font-size: var(--bb-text-small);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2)
        var(--bb-grid-size) 0;
      display: block;
    }

    #node-properties input[type="number"],
    #node-properties textarea {
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
    }

    #node-properties textarea {
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-x-small);
      line-height: var(--bb-body-line-height-x-small);
      resize: none;
      display: block;
      box-sizing: border-box;
      width: 100%;
      field-sizing: content;
      max-height: 300px;
    }

    #node-properties .configuration-item {
      margin-bottom: calc(var(--bb-grid-size) * 2);
      width: 100%;
    }

    #node-properties .configuration-item > label {
      font-weight: bold;
    }

    #node-properties .configuration-item > div {
      margin-top: calc(var(--bb-grid-size) * 2);
    }

    #node-properties #reset-to-defaults,
    #node-properties input[type="submit"] {
      background: rgb(209, 203, 255);
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      border: none;
      padding: 0 var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
    }

    #node-properties #reset-to-defaults {
      background: #eee;
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    #node-properties .cancel {
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

  #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement) || !this.selectedNodeId) {
      return;
    }

    const toConvert = new Map<string, BehaviorSchema>();
    const data = new FormData(evt.target);
    for (const field of evt.target.querySelectorAll("textarea")) {
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

    for (const schemaEditor of evt.target.querySelectorAll(
      "bb-schema-editor"
    )) {
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

    for (const arrayEditor of evt.target.querySelectorAll("bb-array-editor")) {
      if (!(arrayEditor instanceof ArrayEditor && arrayEditor.id)) {
        continue;
      }

      toConvert.set(arrayEditor.id, "json-schema");
      data.set(arrayEditor.id, arrayEditor.value);
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
        try {
          if (value === "") {
            continue;
          }

          // Always attempt a JSON parse of the value.
          const objectValue = JSON.parse(value);
          if (toConvert.get(name) === "llm-content") {
            assertIsLLMContent(objectValue);
          }

          // Set nulls & undefineds for deletion.
          if (objectValue === null || objectValue === undefined) {
            data.delete(name);
            continue;
          }

          configuration[name] = objectValue;
        } catch (err) {
          continue;
        }
        continue;
      }

      configuration[name] = value;
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
        <h1>
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
        </h1>

        <div id="node-properties">
          <form
            ${ref(this.#formRef)}
            @submit=${this.#onFormSubmit}
            @input=${() => {
              if (!this.#formRef.value) {
                return;
              }

              this.#formRef.value.dispatchEvent(new SubmitEvent("submit"));
            }}
          >
            <div id="fields">
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
                  switch (type) {
                    case "object": {
                      // Only show the schema editor for inputs & outputs
                      if (port.schema.behavior?.includes("ports-spec")) {
                        input = html`<bb-schema-editor
                          .editable=${this.editable}
                          .schema=${value}
                          .schemaVersion=${this.#schemaVersion}
                          @breadboardschemachange=${() => {
                            if (!this.#formRef.value) {
                              return;
                            }

                            this.#schemaVersion++;
                            this.#formRef.value.dispatchEvent(
                              new SubmitEvent("submit")
                            );
                          }}
                          id="${name}"
                          name="${name}"
                        ></bb-schema-editor>`;
                      } else {
                        input = html`<textarea
                          id="${name}"
                          name="${name}"
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
                          .value=${value ? JSON.stringify(value, null, 2) : ""}
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
                      input = html`<textarea
                        id="${name}"
                        name="${name}"
                        data-type="${type}"
                        .value=${value || ""}
                      ></textarea>`;
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
                    ${input}
                  </div>`;
                });
              })}
            </div>
          </form>
        </div>
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
