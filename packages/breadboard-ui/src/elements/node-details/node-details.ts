/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { NodeMetadataUpdateEvent } from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { Task } from "@lit/task";
import {
  GraphDescriptor,
  GraphLoader,
  InspectableNode,
  Kit,
  inspect,
} from "@google-labs/breadboard";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";
import { classMap } from "lit/directives/class-map.js";

const STORAGE_PREFIX = "bb-node-details";

@customElement("bb-node-details")
export class NodeDetails extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property()
  selectedNodeId: string | null = null;

  @property()
  subGraphId: string | null = null;

  @state()
  expanded = false;

  @property()
  showNodeTypeDescriptions = true;

  #titleRef: Ref<HTMLSpanElement> = createRef();
  #formRef: Ref<HTMLFormElement> = createRef();
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

      let kitNodeDescription: string | null = null;
      for (const kit of breadboardGraph.kits()) {
        for (const nodeType of kit.nodeTypes) {
          if (nodeType.type() === node.descriptor.type) {
            kitNodeDescription = nodeType.metadata().description || null;
            break;
          }
        }
      }

      const metadata = node.metadata();
      return { node, metadata, kitNodeDescription };
    },
    onError: (err) => {
      console.warn(err);
    },
    args: () => [this.graph, this.subGraphId, this.selectedNodeId],
  });

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      border-bottom: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
    }

    :host > h1 {
      position: sticky;
      margin: 0 0 var(--bb-grid-size) 0;
      top: 0;
      z-index: 2;
    }

    #overview {
      border-bottom: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
    }

    #overview h1 {
      width: 100%;
      display: flex;
      align-items: center;
      border: none;
      background: #fff;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: 0;
      text-align: left;
      position: sticky;
      margin: 0 0 var(--bb-grid-size) 0;
      top: 0;
      z-index: 2;
    }

    #overview p {
      color: var(--bb-neutral-700);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding: 0;
      margin: 0 0 var(--bb-grid-size-2) 0;
    }

    #unfold {
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

    #unfold::after {
      content: "";
      width: 20px;
      height: 20px;
      background: #fff var(--bb-icon-unfold-more) center center / 20px 20px
        no-repeat;
      justify-self: end;
    }

    #unfold.visible::after {
      background: #fff var(--bb-icon-unfold-less) center center / 20px 20px
        no-repeat;
    }

    form {
      display: none;
      grid-template-rows: 16px 28px;
      row-gap: 4px;
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
    }

    form.visible {
      display: grid;
    }

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    const isExpanded = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-expanded`
    );

    this.expanded = isExpanded === "true";
  }

  #emitUpdatedInfo() {
    const form = this.#formRef.value;
    if (!form) {
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
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

    const data = new FormData(form);
    const title = getAsStringOrUndefined(data, "title");
    const description = getAsStringOrUndefined(data, "description");
    const id = getAsStringOrUndefined(data, "id");
    const type = getAsStringOrUndefined(data, "type");
    const logLevel = getAsStringOrUndefined(data, "log-level") as
      | "debug"
      | "info";

    if (!this.selectedNodeId) {
      console.warn("No $id provided for node - unable to update metadata");
      return;
    }

    this.dispatchEvent(
      new NodeMetadataUpdateEvent(this.selectedNodeId, this.subGraphId, {
        title,
        description,
        logLevel,
      })
    );

    if (!this.#titleRef.value) {
      return;
    }

    this.#titleRef.value.textContent = `${title ?? id} (${type ?? "Unknown type"})`;
  }

  render() {
    if (!this.graph || !this.selectedNodeId) {
      return html`<div id="no-node-selected">No node selected</div>`;
    }

    return this.#formTask.render({
      pending: () => html`Loading...`,
      complete: ({
        node,
        metadata,
        kitNodeDescription,
      }: {
        node: InspectableNode;
        metadata: NodeMetadata;
        kitNodeDescription: string | null;
      }) => html`
        ${this.showNodeTypeDescriptions
          ? html`
              <div id="overview">
                <h1 ${ref(this.#titleRef)}>
                  ${metadata.title ?? node.descriptor.id}
                  (${node.descriptor.type})
                </h1>
                <p>${kitNodeDescription ?? html`No description`}</p>
              </div>
            `
          : nothing}
        <h1>
          <button
            id="unfold"
            class=${classMap({ visible: this.expanded })}
            @click=${() => {
              this.expanded = !this.expanded;

              globalThis.sessionStorage.setItem(
                `${STORAGE_PREFIX}-expanded`,
                this.expanded.toString()
              );
            }}
          >
            Node details
          </button>
        </h1>
        <form
          ${ref(this.#formRef)}
          class=${classMap({ visible: this.expanded })}
          @input=${(evt: Event) => {
            evt.preventDefault();
            evt.stopImmediatePropagation();

            this.#emitUpdatedInfo();
          }}
          @keydown=${(evt: KeyboardEvent) => {
            if (evt.key !== "Enter") {
              return;
            }

            this.#emitUpdatedInfo();
          }}
          @submit=${(evt: Event) => {
            evt.preventDefault();
          }}
        >
          <input type="hidden" name="id" .value=${node.descriptor.id} />
          <input type="hidden" name="type" .value=${node.descriptor.type} />
          <label>Title</label>
          <input
            name="title"
            type="text"
            placeholder="Enter the title for this node"
            .value=${metadata.title || ""}
          />

          <label>Log Level</label>
          <select type="text" id="log-level" name="log-level">
            <option value="debug" ?selected=${metadata.logLevel === "debug"}>
              Debug
            </option>
            <option value="info" ?selected=${metadata.logLevel === "info"}>
              Information
            </option>
          </select>

          <label>Description</label>
          <textarea
            name="description"
            placeholder="Enter the description for this node"
            .value=${metadata.description || ""}
          ></textarea>
        </form>
      `,
    });
  }
}
