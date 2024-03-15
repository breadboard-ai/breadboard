/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from "@lit/task";
import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LoadArgs } from "../../types/types.js";
import {
  InspectableNode,
  InspectablePort,
  Kit,
  NodeConfiguration,
  Schema,
  inspect,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SchemaEditor } from "../schema-editor/schema-editor.js";
import { NodeUpdateEvent } from "../../events/events.js";
import { guard } from "lit/directives/guard.js";

@customElement("bb-node-info")
export class NodeInfo extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  editable = false;

  @state()
  private selectedNodeId: string | null = null;

  #formTask = new Task(this, {
    task: async ([loadInfo, nodeId]) => {
      if (typeof loadInfo !== "object" || typeof nodeId !== "string") {
        throw new Error("Unsupported information");
      }

      if (!loadInfo || !loadInfo.graphDescriptor) {
        throw new Error("Unable to load node");
      }

      const descriptor = loadInfo.graphDescriptor;
      const breadboardGraph = inspect(descriptor, { kits: this.kits });
      const node = breadboardGraph.nodeById(nodeId);

      if (!node) {
        throw new Error("Unable to load node");
      }

      const configuration = node.configuration();
      const { inputs } = await node.ports();
      const ports = structuredClone(inputs.ports).sort((portA, portB) =>
        portA.name === "schema" ? -1 : portA.name > portB.name ? 1 : -1
      );

      return { node, ports, configuration };
    },
    args: () => [this.loadInfo, this.selectedNodeId],
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
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2) 0 0;
    }

    #node-properties input[type="number"],
    #node-properties div[contenteditable] {
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
    }

    #node-properties div[contenteditable].mono {
      font-family: var(--bb-font-family-mono);
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

  async #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement) || !this.selectedNodeId) {
      return;
    }

    const toConvert = new Set<string>();
    const data = new FormData(evt.target);
    for (const field of evt.target.querySelectorAll("div[contenteditable]")) {
      if (
        !(
          field instanceof HTMLDivElement &&
          field.dataset.id &&
          field.textContent
        )
      ) {
        continue;
      }

      if (field.dataset.type && field.dataset.type === "object") {
        toConvert.add(field.dataset.id);
      }

      data.set(field.dataset.id, field.textContent);
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
        !schemaEditor.schema.properties ||
        Object.keys(schemaEditor.schema.properties).length === 0
      ) {
        continue;
      }

      data.set(schemaEditor.id, JSON.stringify(schemaEditor.schema));
    }

    const id = data.get("$id") as string;
    const nodeType = data.get("$type") as string;
    if (!(id && nodeType)) {
      console.warn("Unable to configure node - ID and type are missing");
      return;
    }

    if (!this.loadInfo || !this.loadInfo.graphDescriptor) {
      return;
    }

    const descriptor = this.loadInfo.graphDescriptor;
    const breadboardGraph = inspect(descriptor, { kits: this.kits });
    const node = breadboardGraph.nodeById(id);
    if (!node) {
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

      if (name === "schema" || toConvert.has(name)) {
        configuration[name] = JSON.parse(value);
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

    this.dispatchEvent(new NodeUpdateEvent(id, configuration));
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
    this.dispatchEvent(new NodeUpdateEvent(node.descriptor.id, configuration));
  }

  protected shouldUpdate(
    changedProperties:
      | PropertyValueMap<{ loadInfo: LoadArgs | null }>
      | Map<PropertyKey, unknown>
  ): boolean {
    const lastSchemaVersion = this.#lastSchemaVersion;
    const schemaVersion = this.#schemaVersion;

    this.#lastSchemaVersion = this.#schemaVersion;

    // Changes to the load info don't necessarily qualify for a re-render. In
    // particular we don't want to overwrite the existing form, so we check here
    // before we go ahead and render.
    if (changedProperties.has("loadInfo")) {
      // We have gone from no info to some - render.
      if (changedProperties.get("loadInfo") === null) {
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
    if (
      !this.loadInfo ||
      !this.loadInfo.graphDescriptor ||
      !this.selectedNodeId
    ) {
      return html`<div id="no-node-selected">No node selected</div>`;
    }

    return this.#formTask.render({
      pending: () => html`Loading...`,
      complete: ({
        node,
        ports,
        configuration,
      }: {
        node: InspectableNode;
        ports: InspectablePort[];
        configuration: NodeConfiguration;
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
                  const schema = port.schema || {};
                  const name = port.name;
                  const configurationValue = configuration[name];

                  let input;
                  const type = port.schema?.type || "string";
                  switch (type) {
                    case "object": {
                      const schema = configurationValue as Schema;

                      if (schema && schema.properties) {
                        input = html`<bb-schema-editor
                          .editable=${this.editable}
                          .schema=${schema}
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
                        // prettier-ignore
                        input = html`<div
                    class="mono"
                    contenteditable="plaintext-only"
                    data-id="${name}"
                    data-type="${type}"
                  >${JSON.stringify(configurationValue, null, 2)}</div>`;
                      }
                      break;
                    }

                    case "number": {
                      input = html`<div>
                        <input
                          type="number"
                          value="${configurationValue}"
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
                          value="true"
                          ?checked=${configurationValue === "true"}
                        />
                      </div>`;
                      break;
                    }

                    default: {
                      // prettier-ignore
                      input = html`<div
                        contenteditable="plaintext-only"
                        data-id="${name}"
                      >${configurationValue}</div>`;
                      break;
                    }
                  }

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
      error: () => html`Error loading node`,
    });
  }
}
