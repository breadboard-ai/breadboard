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
  InspectableGraph,
  InspectableNode,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { CommentNode, NodeMetadata } from "@breadboard-ai/types";
import { classMap } from "lit/directives/class-map.js";

const STORAGE_PREFIX = "bb-node-meta-details";

type NodeMetaDetailsInfo = {
  type: "node";
  node: InspectableNode;
  metadata: NodeMetadata;
  nodeTypeTitle: string;
  nodeTypeURL: string | null;
  kitNodeHelp: NodeHandlerMetadata["help"] | null;
  kitNodeDescription: NodeHandlerMetadata["description"] | null;
};

type CommentMetaDetailsInfo = {
  type: "comment";
  node: CommentNode;
  metadata: NodeMetadata | null;
};

@customElement("bb-node-meta-details")
export class NodeMetaDetails extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  selectedNodeIds: string[] = [];

  @property()
  subGraphId: string | null = null;

  @property()
  readOnly = false;

  @state()
  expanded = true;

  #ignoreNextUpdate = false;
  #titleRef: Ref<HTMLSpanElement> = createRef();
  #formRef: Ref<HTMLFormElement> = createRef();
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

      if (subGraphId && typeof subGraphId === "string") {
        const subgraphs = graph.graphs();
        if (subgraphs && subgraphs[subGraphId]) {
          graph = subgraphs[subGraphId];
        } else {
          console.warn(`Unable to locate subgraph by name: ${this.subGraphId}`);
        }
      }

      let type: "node" | "comment" = "node";
      let node: InspectableNode | CommentNode | undefined =
        graph.nodeById(nodeId);
      let metadata: NodeMetadata | null = null;

      // Node is an InspectableNode.
      if (node) {
        const nodeType = (node as InspectableNode).type();
        const typeMetadata = await nodeType.metadata();
        const kitNodeDescription = typeMetadata.description || null;
        const kitNodeHelp = typeMetadata.help || null;
        const nodeTypeTitle = typeMetadata.title || nodeType.type();
        const nodeTypeURL = typeMetadata.url || null;

        metadata = node.metadata();

        return {
          type,
          node,
          metadata,
          kitNodeDescription,
          kitNodeHelp,
          nodeTypeTitle,
          nodeTypeURL,
        } as NodeMetaDetailsInfo;
      } else {
        // Node is a CommentNode.
        node = graph
          .metadata()
          ?.comments?.find((comment) => comment.id === nodeId);

        if (!node) {
          throw new Error("Unable to load node");
        }

        metadata = node.metadata || null;
        type = "comment";
        return { type, node, metadata } as CommentMetaDetailsInfo;
      }
    },
    onError: () => {
      // Ignore errors here because the node configuration will emit an event
      // when it can't load the details.
    },
    args: () => [this.graph, this.subGraphId, this.selectedNodeIds],
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

    #overview.no-border {
      border-bottom: none;
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

    #overview .help {
      padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-7);
      background: var(--bb-neutral-100) var(--bb-icon-help) 4px center / 20px
        20px no-repeat;
      display: inline-flex;
      border-radius: 50px;
      height: 24px;
      align-items: center;
      text-decoration: none;
      color: var(--bb-neutral-800);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    #overview .help:hover,
    #overview .help:focus {
      background-color: var(--bb-neutral-300);
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

    this.expanded = isExpanded ? isExpanded === "true" : this.expanded;
  }

  protected shouldUpdate(): boolean {
    if (this.#ignoreNextUpdate) {
      this.#ignoreNextUpdate = false;
      return false;
    }

    return true;
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

    if (this.readOnly) {
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

    if (!this.selectedNodeIds.length) {
      console.warn("No $id provided for node - unable to update metadata");
      return;
    }

    this.#ignoreNextUpdate = true;
    this.dispatchEvent(
      new NodeMetadataUpdateEvent(this.selectedNodeIds[0], this.subGraphId, {
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
    if (!this.graph || !this.selectedNodeIds.length) {
      return html`<div id="no-node-selected">No component selected</div>`;
    }

    return this.#formTask.render({
      pending: () => html`Loading...`,
      complete: (data: NodeMetaDetailsInfo | CommentMetaDetailsInfo | null) => {
        if (!data) {
          return nothing;
        }

        return data.type === "node"
          ? html`
              <div id="overview">
                <h1 ${ref(this.#titleRef)}>
                  ${data.metadata.title ?? data.node.descriptor.id}
                  (${data.nodeTypeTitle})
                </h1>
                <p>${data.kitNodeDescription ?? html`No description`}</p>
                ${data.kitNodeHelp
                  ? html`<p>
                      <a class="help" href="${data.kitNodeHelp.url}"
                        >${data.kitNodeHelp.description ?? "Read more"}</a
                      >
                    </p>`
                  : nothing}
              </div>
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
                  Component details
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
                <input
                  type="hidden"
                  name="id"
                  .value=${data.node.descriptor.id}
                />
                <input type="hidden" name="type" .value=${data.nodeTypeTitle} />
                <label>Title</label>
                <input
                  name="title"
                  type="text"
                  placeholder="Enter the title for this node"
                  .value=${data.metadata.title || ""}
                  ?disabled=${this.readOnly}
                />

                <label>Log Level</label>
                <select
                  type="text"
                  id="log-level"
                  name="log-level"
                  ?disabled=${this.readOnly}
                >
                  <option
                    value="debug"
                    ?selected=${data.metadata.logLevel === "debug"}
                  >
                    Debug
                  </option>
                  <option
                    value="info"
                    ?selected=${data.metadata.logLevel === "info"}
                  >
                    Information
                  </option>
                </select>

                <label>Description</label>
                <textarea
                  name="description"
                  placeholder="Enter the description for this node"
                  .value=${data.metadata.description || ""}
                  ?disabled=${this.readOnly}
                ></textarea>

                ${data.nodeTypeURL
                  ? html` <label for="url">URL</label>
                      <input
                        disabled
                        name="url"
                        type="text"
                        .value=${data.nodeTypeURL || ""}
                      />`
                  : nothing}
              </form>
            `
          : html`<div id="overview" class="no-border">
              <h1>Comment</h1>
              <p>Enter your comment below</p>
            </div>`;
      },
    });
  }
}
