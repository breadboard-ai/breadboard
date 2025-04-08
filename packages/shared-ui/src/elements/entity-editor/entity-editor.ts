/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  InspectableGraph,
  InspectablePort,
  isTextCapabilityPart,
  MainGraphIdentifier,
  MutableGraphStore,
  Template,
  TemplatePart,
  TemplatePartTransformCallback,
} from "@google-labs/breadboard";
import {
  LitElement,
  html,
  css,
  HTMLTemplateResult,
  nothing,
  PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { WorkspaceSelectionStateWithChangeId } from "../../types/types";
import {
  AssetPath,
  GraphIdentifier,
  InputValues,
  LLMContent,
  NodeIdentifier,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";
import { isConfigurableBehavior, isLLMContentBehavior } from "../../utils";
import { map } from "lit/directives/map.js";
import { TextEditor } from "../elements";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { isCtrlCommand } from "../../utils/is-ctrl-command";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { Project } from "../../state";
import { NodePartialUpdateEvent } from "../../events/events";

const INVALID_ITEM = html`<div id="invalid-item">
  Unable to render selected item
</div>`;

@customElement("bb-entity-editor")
export class EntityEditor extends LitElement {
  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor graphTopologyUpdateId = 0;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property()
  accessor graphStoreUpdateId = 0;

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor projectState: Project | null = null;

  @property({ reflect: true, type: Boolean })
  accessor readOnly = false;

  @property()
  accessor autoFocus = false;

  @state()
  accessor values: InputValues | undefined;

  static styles = css`
    :host {
      display: block;
    }

    #invalid-item,
    #generic-status {
      padding: var(--bb-grid-size-2);
      text-align: center;
      font: 500 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    h1 {
      display: flex;
      align-items: center;
      margin: 0;
      height: var(--bb-grid-size-12);
      padding: 0 var(--bb-grid-size-6);
      border-bottom: 1px solid var(--bb-neutral-300);
      font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);

      & span {
        flex: 1 0 auto;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: calc(100% - var(--bb-grid-size-7));
      }

      & input {
        flex: 1 0 auto;
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        background: transparent;
        padding: var(--bb-grid-size) var(--bb-grid-size);
        border: 1px solid transparent;
        border-radius: var(--bb-grid-size);
        field-sizing: content;
        max-width: 100%;
        min-width: 20%;

        &:hover,
        &:focus {
          border: 1px solid var(--outer-border);
        }
      }

      &::before {
        content: "";
        width: 20px;
        height: 20px;
        flex: 0 0 auto;
        margin-right: var(--bb-grid-size);
      }
    }

    form {
      height: 100%;

      > * {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
    }

    .node {
      & h1 {
        --outer-border: var(--bb-ui-300);
        background: var(--bb-ui-100);
      }

      &.module {
        & h1 {
          --outer-border: var(--bb-neutral-200);
          background: var(--bb-neutral-50);
        }
      }

      &.generative,
      &.generative-image,
      &.generative-image-edit,
      &.generative-text,
      &.generative-audio,
      &.generative-video,
      &.generative-code,
      &.generative-search {
        & h1 {
          --outer-border: var(--bb-generative-200);
          background: var(--bb-generative-50);
        }
      }

      &.input,
      &.output,
      &.core,
      &.combine-outputs {
        & h1 {
          --outer-border: var(--bb-input-200);
          background: var(--bb-input-50);
        }
      }

      &.search h1::before {
        background: var(--bb-icon-search) center center / 20px 20px no-repeat;
      }

      &.map-search h1::before {
        background: var(--bb-icon-map-search) center center / 20px 20px
          no-repeat;
      }

      &.globe-book h1::before {
        background: var(--bb-icon-globe-book) center center / 20px 20px
          no-repeat;
      }

      &.language h1::before {
        background: var(--bb-icon-language) center center / 20px 20px no-repeat;
      }

      &.sunny h1::before {
        background: var(--bb-icon-sunny) center center / 20px 20px no-repeat;
      }

      &.generative h1::before {
        background: var(--bb-add-icon-generative) center center / 20px 20px
          no-repeat;
      }

      &.generative-image h1::before {
        background: var(--bb-add-icon-generative-image) center center / 20px
          20px no-repeat;
      }

      &.generative-image-edit h1::before {
        background: var(--bb-add-icon-generative-image-edit-auto) center
          center / 20px 20px no-repeat;
      }

      &.generative-text h1::before {
        background: var(--bb-add-icon-generative-text-analysis) center center /
          20px 20px no-repeat;
      }

      &.generative-audio h1::before {
        background: var(--bb-add-icon-generative-audio) center center / 20px
          20px no-repeat;
      }

      &.generative-video h1::before {
        background: var(--bb-add-icon-generative-videocam-auto) center center /
          20px 20px no-repeat;
      }

      &.generative-code h1::before {
        background: var(--bb-add-icon-generative-code) center center / 20px 20px
          no-repeat;
      }

      &.generative-search h1::before {
        background: var(--bb-add-icon-generative-search) center center / 20px
          20px no-repeat;
      }

      &.combine-outputs h1::before {
        background: var(--bb-icon-table-rows) center center / 20px 20px
          no-repeat;
      }

      &.input h1::before {
        background: var(--bb-icon-input) center center / 20px 20px no-repeat;
      }

      &.output h1::before {
        background: var(--bb-icon-output) center center / 20px 20px no-repeat;
      }

      &.smart-toy h1::before {
        background: var(--bb-icon-smart-toy) center center / 20px 20px no-repeat;
      }

      &.laps h1::before {
        background: var(--bb-icon-laps) center center / 20px 20px no-repeat;
      }
    }

    .asset {
      & h1 {
        background: var(--bb-inputs-50);

        &::before {
          background: var(--bb-icon-alternate-email) center center / 20px 20px
            no-repeat;
        }
      }
    }

    #content {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: auto;

      > div {
        margin-bottom: var(--bb-grid-size);
        height: var(--bb-grid-size-5);
        display: flex;
        align-items: center;
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);

        &.stretch {
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1 1 auto;
          border-bottom: 1px solid var(--bb-neutral-300);
          margin-bottom: var(--bb-grid-size-3);
        }

        &:not(.stretch) {
          padding: 0 var(--bb-grid-size-6);

          &:last-of-type {
            padding-bottom: var(--bb-grid-size-3);
          }
        }

        &.boolean {
          & label {
            display: flex;
            align-items: center;
            padding-left: 0;

            &::before {
              content: "";
              display: block;
              width: 16px;
              height: 16px;
              border-radius: var(--bb-grid-size);
              border: 1px solid var(--bb-neutral-600);
              flex: 0 0 auto;
              margin-right: var(--bb-grid-size-2);
            }

            &:has(+ input:checked)::before {
              background: var(--bb-icon-check) center center / 20px 20px
                no-repeat;
            }

            &:focus {
              outline: none;

              &::before {
                border: 1px solid var(--bb-ui-700);
                outline: 1px solid var(--bb-ui-700);
              }
            }
          }

          & input {
            display: none;
          }
        }

        label {
          margin-right: var(--bb-grid-size-2);
        }

        input,
        select,
        textarea {
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          height: var(--bb-grid-size-5);
          border: none;
          margin: 0;
          padding: 0 var(--bb-grid-size-2);
        }
      }

      & bb-text-editor {
        width: 100%;
        height: 100%;
        --text-editor-height: 100%;
        --text-editor-padding-top: var(--bb-grid-size-4);
        --text-editor-padding-right: var(--bb-grid-size-6);
        --text-editor-padding-bottom: var(--bb-grid-size-4);
        --text-editor-padding-left: var(--bb-grid-size-6);
      }

      & bb-llm-output {
        margin: var(--bb-grid-size-3) var(--bb-grid-size-6);
        --output-lite-border-color: transparent;
        --output-border-radius: var(--bb-grid-size);
      }
    }

    #controls {
      height: var(--bb-grid-size-10);
      display: flex;
      align-items: center;
      border-top: 1px solid var(--bb-neutral-300);
      padding: 0 var(--bb-grid-size-4);

      & button {
        background: var(--bb-ui-500);
        color: var(--bb-neutral-0);
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        border: none;
        border-radius: var(--bb-grid-size-16);
        height: var(--bb-grid-size-6);
        padding: 0 var(--bb-grid-size-3);
        transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: var(--bb-ui-600);
          }
        }
      }
    }
  `;

  #lastUpdateTimes: Map<"nodes" | "assets", number> = new Map();
  #editorRef: Ref<TextEditor> = createRef();
  #edited = false;
  #formRef: Ref<HTMLFormElement> = createRef();

  #reactiveChange(port: InspectablePort) {
    const reactive = port.schema.behavior?.includes("reactive");
    if (!reactive) return () => {};

    return (evt: Event) => {
      const { target } = evt;
      if (target instanceof HTMLSelectElement) {
        const { value } = target;
        this.values = {
          ...this.values,
          [port.name]: value,
        };
      }
    };
  }

  #calculateSelectionSize() {
    if (!this.selectionState) {
      return 0;
    }

    return [...this.selectionState.selectionState.graphs].reduce(
      (prev, [, graph]) => {
        return (
          prev +
          graph.assets.size +
          graph.comments.size +
          graph.nodes.size +
          graph.references.size
        );
      },
      0
    );
  }

  /**
   * If necessary, updates the text parts that contain parameterized references
   * to components.
   * @param part
   */
  #updateComponentParamsInText(
    part: TextCapabilityPart,
    callback: TemplatePartTransformCallback
  ) {
    part.text = new Template(part.text).transform(callback);
  }

  #emitUpdatedNodeConfiguration() {
    if (!this.#formRef.value) {
      return;
    }

    const ins: TemplatePart[] = [];
    const transform = (part: TemplatePart) => {
      if (part.type === "in") {
        ins.push(part);
        // Always optimistically mark part as valid.
        delete part.invalid;
      }
      return part;
    };

    const data = new FormData(this.#formRef.value);
    const graphId = data.get("graph-id") as string | null;
    const nodeId = data.get("node-id") as string | null;
    if (nodeId === null || graphId === null) {
      return;
    }

    let targetGraph = this.graph;
    if (!targetGraph) {
      return;
    }

    if (graphId !== MAIN_BOARD_ID) {
      targetGraph = this.graph!.graphs()?.[graphId] ?? null;
    }

    if (!targetGraph) {
      return;
    }

    const node = targetGraph.nodeById(nodeId);
    if (!node) {
      return;
    }

    const ports = node.currentPorts().inputs.ports.filter((port) => {
      if (port.star || port.name === "") return false;
      if (!isConfigurableBehavior(port.schema)) return false;
      return true;
    });

    const configuration = { ...node.configuration() };
    const metadata = { ...node.metadata() };
    const title =
      this.#formRef.value.querySelector<HTMLInputElement>("#node-title");
    if (title) {
      metadata.title = title.value;
    }

    for (const port of ports) {
      const portEl = this.#formRef.value.querySelector<HTMLInputElement>(
        `[name="${port.name}"]`
      );
      switch (port.schema.type) {
        case "object": {
          const value = { text: portEl?.value ?? "" };
          this.#updateComponentParamsInText(value, transform);
          configuration[port.name] = { role: "user", parts: [value] };
          break;
        }

        case "boolean": {
          configuration[port.name] = portEl?.checked ?? false;
          break;
        }

        case "string": {
          configuration[port.name] = portEl?.value ?? undefined;
          break;
        }
      }
    }

    this.dispatchEvent(
      new NodePartialUpdateEvent(
        nodeId,
        graphId !== MAIN_BOARD_ID ? graphId : null,
        configuration,
        metadata,
        false,
        ins
      )
    );
  }

  #renderNode(graphId: GraphIdentifier, nodeId: NodeIdentifier) {
    let targetGraph = this.graph;
    if (!targetGraph) {
      return INVALID_ITEM;
    }

    if (graphId !== MAIN_BOARD_ID) {
      targetGraph = this.graph!.graphs()?.[graphId] ?? null;
    }

    if (!targetGraph) {
      return INVALID_ITEM;
    }

    const node = targetGraph.nodeById(nodeId);
    if (!node) {
      return INVALID_ITEM;
    }

    this.#lastUpdateTimes.set("nodes", globalThis.performance.now());
    const lastUpdateTime = this.#lastUpdateTimes.get("nodes") ?? 0;

    const value = node.ports(this.values).then((ports) => {
      // Ensure the most recent values before proceeding.
      if (lastUpdateTime !== this.#lastUpdateTimes.get("nodes")) {
        return;
      }

      const metadata = node.type().currentMetadata();
      const classes: Record<string, boolean> = { node: true };

      if (metadata.icon) {
        classes[metadata.icon] = true;
      }

      if (node.type().type().startsWith("#module")) {
        classes["module"] = true;
      }

      // By convention we assume there will be a single llm-content port
      // and multiple other configurable ports. Therefore we order & filter
      // ports on that basis.
      const inputPorts = ports.inputs.ports
        .filter((port) => {
          if (port.star || port.name === "") return false;
          if (!isConfigurableBehavior(port.schema)) return false;
          return true;
        })
        .sort((portA, portB) => {
          if (
            isLLMContentBehavior(portA.schema) &&
            !isLLMContentBehavior(portB.schema)
          ) {
            return -1;
          }

          if (
            !isLLMContentBehavior(portA.schema) &&
            isLLMContentBehavior(portB.schema)
          ) {
            return 1;
          }

          return 0;
        });

      return html`<div class=${classMap(classes)}>
        <h1 id="title">
          <input id="node-title" name="node-title" .value=${node.title()} />
        </h1>
        <div id="type"></div>
        <div id="content">
          ${inputPorts.map((port) => {
            const classes: Record<string, boolean> = {};
            if (isLLMContentBehavior(port.schema)) {
              classes["stretch"] = true;
            }

            let value: HTMLTemplateResult | symbol = html`No value`;
            switch (port.schema.type) {
              case "object": {
                const portValue = (port.value ?? {
                  role: "user",
                  parts: [{ text: "" }],
                }) as LLMContent;
                const textPart = portValue.parts.find((part) =>
                  isTextCapabilityPart(part)
                );
                if (!textPart) {
                  value = html`Invalid value`;
                  break;
                }

                classes.object = true;
                value = html`<bb-text-editor
                  ${ref(this.#editorRef)}
                  .value=${textPart.text}
                  .projectState=${this.projectState}
                  .subGraphId=${graphId !== MAIN_BOARD_ID ? graphId : null}
                  id=${port.name}
                  name=${port.name}
                  @keydown=${(evt: KeyboardEvent) => {
                    if (!isCtrlCommand(evt) || evt.key !== "Enter") {
                      return;
                    }

                    this.#emitUpdatedNodeConfiguration();
                  }}
                ></bb-text-editor>`;
                break;
              }

              case "boolean": {
                const checked = !!port.value;
                classes.boolean = true;
                classes.checked = checked;
                if (port.schema.icon) {
                  classes[port.schema.icon] = true;
                }

                value = html`<label for=${port.name}>${port.title}</label
                  ><input
                    type="checkbox"
                    ?checked=${port.value === true}
                    id=${port.name}
                    name=${port.name}
                  />`;
                break;
              }

              case "string": {
                classes.string = true;
                if (port.schema.icon) {
                  classes[port.schema.icon] = true;
                }

                if (port.schema.enum) {
                  value = html`<label for=${port.name}>${port.title}</label
                    ><select
                      @change=${this.#reactiveChange(port)}
                      name=${port.name}
                      id=${port.name}
                    >
                      ${map(port.schema.enum, (option) => {
                        return html`<option
                          value=${option}
                          ?selected=${port.value === option ||
                          (!port.value && option === port.schema.default)}
                        >
                          ${option}
                        </option>`;
                      })}
                    </select>`;
                  break;
                }

                value = html`<label
                  >${port.title}: ${port.value ?? "Value not set"}</label
                >`;
                break;
              }

              default: {
                value = nothing;
              }
            }

            return html`<div class=${classMap(classes)}>${value}</div>`;
          })}
        </div>
        <div id="controls">
          <button
            @click=${() => {
              this.#emitUpdatedNodeConfiguration();
            }}
          >
            Update
          </button>
        </div>
        <input type="hidden" name="graph-id" .value=${graphId} />
        <input type="hidden" name="node-id" .value=${nodeId} />
      </div>`;
    });

    return html`${until(value, html`<div id="generic-status">Loading...</div>`)}`;
  }

  #renderAsset(assetPath: AssetPath) {
    const asset = this.graph?.assets().get(assetPath);
    if (!asset) {
      return INVALID_ITEM;
    }

    if (!this.graph) {
      return INVALID_ITEM;
    }

    const graphUrl = new URL(this.graph.raw().url ?? window.location.href);

    return html`<div class=${classMap({ asset: true })}>
      <h1 id="title"><span>${asset.title}</span></h1>
      <div id="content">
        <bb-llm-output
          .value=${asset?.data.at(-1) ?? null}
          .clamped=${false}
          .lite=${true}
          .showModeToggle=${false}
          .showEntrySelector=${false}
          .showExportControls=${false}
          .graphUrl=${graphUrl}
        ></bb-llm-output>
      </div>
    </div>`;
  }

  #renderSelectedItem() {
    if (!this.selectionState) {
      return;
    }

    const candidate = [...this.selectionState.selectionState.graphs].find(
      ([, graph]) =>
        graph.assets.size > 0 || graph.nodes.size > 0 || graph.comments.size > 0
    );
    let value: HTMLTemplateResult | symbol = nothing;
    if (!candidate) {
      value = html`<div id="generic-status">Unsupported item</div>`;
    } else {
      const [id, graph] = candidate;
      if (graph.assets.size) {
        value = this.#renderAsset([...graph.assets][0]);
      } else if (graph.nodes.size) {
        value = this.#renderNode(id, [...graph.nodes][0]);
      } else {
        value = html`<div id="generic-status">Unsupported Item</div>`;
      }
    }

    return html`<form
      ${ref(this.#formRef)}
      @submit=${(evt: SubmitEvent) => {
        evt.preventDefault();
      }}
      @input=${() => {
        this.#edited = true;
      }}
    >
      ${value}
    </form>`;
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("selectionState") && this.#edited) {
      // Eagerly process a change.
      this.#edited = false;
      this.#emitUpdatedNodeConfiguration();
    }

    if (changedProperties.has("autoFocus")) {
      this.autoFocus = false;
      this.focus();
    }
  }

  focus() {
    requestAnimationFrame(() => {
      if (!this.#editorRef.value) {
        return;
      }

      this.#editorRef.value.focus();
    });
  }

  protected firstUpdated(changedProperties: PropertyValues): void {
    if (!changedProperties.has("selectionState")) {
      return;
    }

    this.focus();
  }

  render() {
    const selectionCount = this.#calculateSelectionSize();
    if (selectionCount === 0) {
      return html`<div id="generic-status">Please select an item to edit</div>`;
    }

    if (selectionCount > 1) {
      return html`<div id="generic-status">Multiple items selected</div>`;
    }

    return this.#renderSelectedItem();
  }
}
