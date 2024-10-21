/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  BoardServer,
  CommentNode,
  GraphDescriptor,
  GraphLoader,
  inspect,
  InspectableNode,
  InspectablePort,
  Kit,
  NodeConfiguration,
  Schema,
} from "@google-labs/breadboard";
import { Task } from "@lit/task";
import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { EditorMode, filterConfigByMode } from "../../utils/mode";
import {
  CommentUpdateEvent,
  GraphNodeDeselectedAllEvent,
} from "../../events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { UserInput } from "../elements";
import { behaviorsMatch, itemsMatch } from "../../utils";

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
const EXPANDED_KEY = `${STORAGE_PREFIX}-expanded`;

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
  editorMode = EditorMode.ADVANCED;

  @property()
  selectedNodeIds: string[] = [];

  @property()
  subGraphId: string | null = null;

  @property()
  boardServers: BoardServer[] = [];

  @property()
  showTypes = false;

  @state()
  isStale = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    h1 {
      position: sticky;
      top: 0;
      background: #fff;
      z-index: 2;
      margin: 0;
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

    .details {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      display: none;
    }

    .details.visible {
      display: block;
    }

    #multiple-nodes-selected,
    #loading {
      color: var(--bb-neutral-700);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
    }

    .comment {
      padding: var(--bb-grid-size-4);
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
      width: 100%;
      display: block;
      margin-top: var(--bb-grid-size);
    }

    #stale-data {
      display: inline-block;
      height: 24px;
      font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border-radius: var(--bb-grid-size-3);
      background: var(--bb-boards-100);
      color: var(--bb-boards-900);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      margin-left: var(--bb-grid-size-2);
    }

    #stale-data.visible {
      opacity: 1;
      pointer-events: auto;
    }
  `;

  #expanded = true;
  #userInputRef: Ref<UserInput> = createRef();
  #commentConfigurationFormRef: Ref<HTMLFormElement> = createRef();
  #staleDataWarningRef: Ref<HTMLDivElement> = createRef();
  #lastGraph: GraphDescriptor | null = null;
  #manualUpdateRequested = false;

  #loadTask: Task<
    (string | GraphDescriptor | string[] | null)[],
    NodeConfigurationInfoDetails | CommentCodeConfigurationInfoDetails | null
  > | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    const isExpanded = globalThis.sessionStorage.getItem(EXPANDED_KEY);

    if (isExpanded !== null) {
      this.#expanded = isExpanded === "true";
    }
  }

  ensureRenderOnNextUpdate() {
    this.#manualUpdateRequested = true;
  }

  protected shouldUpdate(
    changedProperties: PropertyValueMap<{
      graph: GraphDescriptor | null;
      selectedNodeIds: string[];
    }>
  ): boolean {
    if (this.#manualUpdateRequested) {
      this.#manualUpdateRequested = false;
      return true;
    }

    // Here we may be notified of a change to the graph or selected nodes. This
    // is not automatically a reason to re-render. In fact, it's problematic if
    // we re-render too eagerly as input focus will be lost. As such we check
    // to see if the url of the graph has changed, which nodes are selected, or
    // if the number of ports on the selected node has changed. Any of these are
    // sufficient conditions for a re-render.
    if (
      changedProperties.has("graph") ||
      changedProperties.has("selectedNodeIds")
    ) {
      let graphIsTheSame = true;
      let selectedNodeIdsAreTheSame = true;

      if (changedProperties.has("graph")) {
        graphIsTheSame =
          this.graph !== null && this.graph.url === this.#lastGraph?.url;
      }

      if (changedProperties.has("selectedNodeIds")) {
        const oldSelectedIds = changedProperties.get("selectedNodeIds") ?? [];
        selectedNodeIdsAreTheSame =
          this.selectedNodeIds.length === 1 &&
          this.selectedNodeIds[0] === oldSelectedIds[0];
      }

      if (graphIsTheSame && selectedNodeIdsAreTheSame) {
        // Check the ports before declaring there are no changes.
        if (this.graph && this.#lastGraph) {
          const lastSelectedNode = inspect(this.#lastGraph, {
            kits: this.kits,
            loader: this.loader || undefined,
          }).nodeById(this.selectedNodeIds[0]);

          const newSelectedNode = inspect(this.graph, {
            kits: this.kits,
            loader: this.loader || undefined,
          }).nodeById(this.selectedNodeIds[0]);

          if (lastSelectedNode && newSelectedNode) {
            Promise.all([
              lastSelectedNode.ports(),
              newSelectedNode.ports(),
            ]).then(([lastNodePorts, newNodePorts]) => {
              const portCountDiffers =
                lastNodePorts.inputs.ports.length !==
                  newNodePorts.inputs.ports.length ||
                lastNodePorts.outputs.ports.length !==
                  newNodePorts.outputs.ports.length;

              const lastPortSpecs = lastNodePorts.inputs.ports.filter((port) =>
                port.schema.behavior?.includes("ports-spec")
              );
              const newPortSpecs = newNodePorts.inputs.ports.filter((port) =>
                port.schema.behavior?.includes("ports-spec")
              );

              let portSpecsDiffer = false;
              for (const lastPortSpec of lastPortSpecs) {
                const newPortSpec = newPortSpecs.find(
                  (port) => port.name === lastPortSpec.name
                );

                if (!newPortSpec) {
                  continue;
                }

                const lastPortSpecValue = lastPortSpec.value;
                const newPortSpecValue = newPortSpec.value;

                if (
                  !lastPortSpecValue ||
                  !newPortSpecValue ||
                  typeof lastPortSpecValue !== "object" ||
                  typeof newPortSpecValue !== "object" ||
                  !("properties" in lastPortSpecValue) ||
                  !("properties" in newPortSpecValue)
                ) {
                  break;
                }

                const lastProperties = lastPortSpecValue.properties as Record<
                  string,
                  Schema
                >;
                const newProperties = newPortSpecValue.properties as Record<
                  string,
                  Schema
                >;
                for (const [property, schema] of Object.entries(
                  lastProperties
                )) {
                  const newSchema = newProperties[property];
                  if (!newSchema) {
                    portSpecsDiffer = true;
                    break;
                  }

                  if (schema.type !== newSchema.type) {
                    portSpecsDiffer = true;
                    break;
                  } else {
                    if (
                      schema.type === "object" &&
                      newSchema.type === "object"
                    ) {
                      if (!behaviorsMatch(schema, newSchema)) {
                        portSpecsDiffer = true;
                        break;
                      }
                    } else if (
                      schema.type === "array" &&
                      newSchema.type === "array"
                    ) {
                      if (!itemsMatch(schema, newSchema)) {
                        portSpecsDiffer = true;
                        break;
                      }
                    }
                  }
                }
              }

              const isStale = portCountDiffers || portSpecsDiffer;

              // Here we don't to force a re-render because that will be
              // lose focus on inputs. Instead we do a "softer" update and
              // warn them that the component's data is considered stale.
              if (this.#staleDataWarningRef.value) {
                this.#staleDataWarningRef.value.classList.toggle(
                  "visible",
                  isStale
                );
              }

              // TODO: Update the port status nodes when inputs change.
            });
          }
        }

        return false;
      }
    }

    return true;
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          graph: GraphDescriptor | null;
          selectedNodeIds: string[];
        }>
      | Map<PropertyKey, unknown>
  ): void {
    this.#lastGraph = structuredClone(this.graph);

    if (
      !changedProperties.has("graph") &&
      !changedProperties.has("selectedNodeIds")
    ) {
      return;
    }

    if (!this.graph || !this.selectedNodeIds) {
      this.#loadTask = null;
      return;
    }

    this.destroyEditors();
    this.#loadTask = new Task(this, {
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
            console.warn(
              `Unable to locate subgraph by name: ${this.subGraphId}`
            );
          }
        }

        let node: InspectableNode | CommentNode | undefined =
          breadboardGraph.nodeById(nodeId);
        if (node) {
          const configuration = node.configuration();
          const nodePorts = await node.ports();

          const { inputs } = filterConfigByMode(nodePorts, this.editorMode);
          const ports = [...inputs.ports].sort((portA, portB) => {
            const isSchema =
              portA.name === "schema" ||
              portA.schema.behavior?.includes("ports-spec");
            return isSchema ? -1 : portA.name > portB.name ? 1 : -1;
          });

          // For some reason, the task does not re-render the component when
          // it completes for discrete nodes (like fetch or runJavascript).
          // TODO: Figure out why this is necessary.
          this.requestUpdate();

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

          return {
            type: "comment",
            node,
          } as CommentCodeConfigurationInfoDetails;
        }
      },
      onError: () => {
        this.dispatchEvent(new GraphNodeDeselectedAllEvent());
      },
      args: () => [this.graph, this.subGraphId, this.selectedNodeIds],
    });
  }

  destroyEditors() {
    // Here we must unhook the editor *before* it is removed from the DOM,
    // otherwise CodeMirror will hold onto focus if it has it.
    if (!this.#userInputRef.value) {
      return;
    }

    this.#userInputRef.value.destroyEditors();
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

  #onCommentConfigurationFormSubmit(form: HTMLFormElement) {
    const data = new FormData(form);
    const id = data.get("$id") as string;
    const text = data.get("text") as string;

    if (id === null || text === null) {
      return;
    }

    this.dispatchEvent(new CommentUpdateEvent(id, text, this.subGraphId));
  }

  render() {
    if (!this.graph || !this.selectedNodeIds.length || !this.#loadTask) {
      return html`<div id="no-node-selected">No node selected</div>`;
    }

    return this.#loadTask.render({
      pending: () => html`<div id="loading">Loading...</div>`,
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
          return nothing;
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
