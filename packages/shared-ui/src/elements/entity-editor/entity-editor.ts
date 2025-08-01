/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
  isTextCapabilityPart,
  MainGraphIdentifier,
  MutableGraphStore,
  ok,
  Schema,
  SchemaEnumValue,
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
import {
  EnumValue,
  WorkspaceSelectionStateWithChangeId,
} from "../../types/types";
import {
  AssetPath,
  GraphDescriptor,
  GraphIdentifier,
  InputValues,
  JsonSerializable,
  LLMContent,
  NodeIdentifier,
  NodeValue,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { classMap } from "lit/directives/class-map.js";
import { until } from "lit/directives/until.js";
import { isConfigurableBehavior, isLLMContentBehavior } from "../../utils";
import {
  FastAccessMenu,
  ItemSelect,
  LLMPartInput,
  TextEditor,
} from "../elements";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { isCtrlCommand } from "../../utils/is-ctrl-command";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { Project } from "../../state";
import {
  FastAccessSelectEvent,
  IterateOnPromptEvent,
  StateEvent,
  ToastEvent,
  ToastType,
} from "../../events/events";
import {
  isControllerBehavior,
  isLLMContentArrayBehavior,
} from "../../utils/behaviors";

import * as StringsHelper from "../../strings/helper.js";
import { FlowGenConstraint } from "../../flow-gen/flow-generator";
import { ConnectorView } from "../../connectors/types";
import { SignalWatcher } from "@lit-labs/signals";
import { icons } from "../../styles/icons";
import { consume } from "@lit/context";
import { embedderContext } from "../../contexts/embedder";
import { EmbedState, embedState } from "@breadboard-ai/embed";
import { getBoardUrlFromCurrentWindow } from "../../utils/board-id.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { iconSubstitute } from "../../utils/icon-substitute";

const Strings = StringsHelper.forSection("Editor");

// A type that is like a port (and fits InspectablePort), but could also be
// used to describe parameters for connectors.
type PortLike = {
  start?: boolean;
  title: string;
  name: string;
  schema: Schema;
  value: NodeValue;
};

const INVALID_ITEM = html`<div id="invalid-item">
  Unable to render selected item
</div>`;

@customElement("bb-entity-editor")
export class EntityEditor extends SignalWatcher(LitElement) {
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

  @property({ reflect: true, type: Boolean })
  accessor autoFocus = false;

  @consume({ context: embedderContext })
  accessor embedState: EmbedState = embedState();

  @state()
  accessor values: InputValues | undefined;

  static styles = [
    icons,
    colorsLight,
    type,
    css`
      :host {
        display: block;
        background: var(--n-100);
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
        flex: 0 0 auto;

        & span {
          flex: 1 0 auto;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: calc(100% - var(--bb-grid-size-7));

          &.g-icon {
            width: 20px;
            height: 20px;
            flex: 0 0 auto;
          }
        }

        & input {
          flex: 1 1 auto;
          background: transparent;
          padding: var(--bb-grid-size) var(--bb-grid-size);
          border: 1px solid transparent;
          border-radius: var(--bb-grid-size);
          max-width: 100%;
          min-width: 20%;
          outline: none;

          &:hover,
          &:focus {
            border: 1px solid var(--outer-border);
          }
        }
      }

      #iterate-on-prompt {
        height: var(--bb-grid-size-7);
        white-space: nowrap;
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-16);
        background: var(--bb-neutral-0);
        color: #004a77;
        font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        display: flex;
        align-items: center;
        border-radius: 100px;
        border: none;
        transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);
        cursor: pointer;
        background: var(--bb-grid-size-3) center / 18px 18px no-repeat #c2e7ff;
        &:hover,
        &:focus {
          background-color: #96d6ff;
        }
        &:disabled {
          background-color: #efefef;
          color: #1010104d;
          cursor: default;
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
          --outer-border: var(--n-80);
          background: var(--n-90);
        }

        &.module {
          & h1 {
            --outer-border: oklch(from var(--ui-generate) calc(l - 0.2) c h);
            background: var(--ui-generate);
          }
        }

        &.generative {
          & h1 {
            --outer-border: oklch(from var(--ui-generate) calc(l - 0.2) c h);
            background: var(--ui-generate);
          }
        }

        &.ask-user {
          & h1 {
            --outer-border: oklch(from var(--ui-get-input) calc(l - 0.2) c h);
            background: var(--ui-get-input);
          }
        }

        &.output {
          & h1 {
            --outer-border: oklch(from var(--ui-display) calc(l - 0.2) c h);
            background: var(--ui-display);
          }
        }
      }

      .asset {
        & h1 {
          --outer-border: oklch(from var(--ui-asset) calc(l - 0.2) c h);
          background: var(--ui-asset);
        }

        bb-llm-output {
          margin: var(--bb-grid-size-3) var(--bb-grid-size-6);
        }
      }

      #content {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: auto;
        padding: var(--bb-grid-size-3) 0 0 0;

        > details {
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--bb-neutral-300);
          color: var(--bb-neutral-900);
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          padding: var(--bb-grid-size-3) var(--bb-grid-size-6)
            var(--bb-grid-size-3) var(--bb-grid-size-6);

          & summary {
            display: flex;
            align-items: center;
            list-style: none;
            cursor: pointer;
            user-select: none;
            height: var(--bb-grid-size-5);

            & .g-icon {
              margin-right: var(--bb-grid-size-2);

              &::before {
                content: "keyboard_arrow_down";
              }
            }
          }

          & summary::-webkit-details-marker {
            display: none;
          }

          &[open] {
            summary {
              margin-bottom: var(--bb-grid-size-3);

              & .g-icon {
                &::before {
                  content: "keyboard_arrow_up";
                }
              }
            }
          }

          label {
            display: block;
            margin-bottom: var(--bb-grid-size);
          }

          bb-text-editor {
            width: 100%;
            height: 100%;
            --text-editor-padding-top: var(--bb-grid-size-2);
            --text-editor-padding-right: var(--bb-grid-size-3);
            --text-editor-padding-bottom: var(--bb-grid-size-2);
            --text-editor-padding-left: var(--bb-grid-size-3);
            border-radius: var(--bb-grid-size-2);
            border: 1px solid var(--bb-neutral-300);
          }

          & .port {
            margin-bottom: var(--bb-grid-size-2);
          }
        }

        div {
          display: flex;
          align-items: center;
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);

          &.port {
            position: relative;

            &.read-only::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 10;
            }

            &.boolean {
              & label {
                display: flex;
                align-items: center;
                padding-left: 0;

                & .g-icon {
                  margin-right: var(--bb-grid-size-2);

                  &::before {
                    content: "check_box_outline_blank";
                  }
                }

                &:has(+ input:checked) .g-icon::before {
                  content: "check_box";
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
              &:not(.slim) {
                margin-right: var(--bb-grid-size-2);

                &.icon::before {
                  margin-right: var(--bb-grid-size-2);
                }
              }
              display: inline-flex;
              align-items: center;

              &.icon {
                &::before {
                  content: "";
                  width: 20px;
                  height: 20px;
                  background: red;
                }

                &.search::before {
                  background: var(--bb-icon-search) center center / 20px 20px
                    no-repeat;
                }

                &.map-search::before {
                  background: var(--bb-icon-map-search) center center / 20px
                    20px no-repeat;
                }

                &.globe-book::before {
                  background: var(--bb-icon-globe-book) center center / 20px
                    20px no-repeat;
                }

                &.language::before {
                  background: var(--bb-icon-language) center center / 20px 20px
                    no-repeat;
                }

                &.sunny::before {
                  background: var(--bb-icon-sunny) center center / 20px 20px
                    no-repeat;
                }

                &.generative::before {
                  background: var(--bb-add-icon-generative) center center / 20px
                    20px no-repeat;
                }

                &.generative-image::before {
                  background: var(--bb-add-icon-generative-image) center
                    center / 20px 20px no-repeat;
                }

                &.generative-image-edit::before {
                  background: var(--bb-add-icon-generative-image-edit-auto)
                    center center / 20px 20px no-repeat;
                }

                &.generative-text::before {
                  background: var(--bb-add-icon-generative-text-analysis) center
                    center / 20px 20px no-repeat;
                }

                &.generative-audio::before {
                  background: var(--bb-add-icon-generative-audio) center
                    center / 20px 20px no-repeat;
                }

                &.generative-video::before {
                  background: var(--bb-add-icon-generative-videocam-auto) center
                    center / 20px 20px no-repeat;
                }

                &.generative-code::before {
                  background: var(--bb-add-icon-generative-code) center center /
                    20px 20px no-repeat;
                }

                &.generative-search::before {
                  background: var(--bb-add-icon-generative-search) center
                    center / 20px 20px no-repeat;
                }

                &.combine-outputs::before {
                  background: var(--bb-icon-table-rows) center center / 20px
                    20px no-repeat;
                }

                &.output::before {
                  background: var(--bb-icon-responsive-layout) center center /
                    20px 20px no-repeat;
                }

                &.ask-user::before {
                  background: var(--bb-icon-chat-mirror) center center / 20px
                    20px no-repeat;
                }

                &.input::before {
                  background: var(--bb-icon-input) center center / 20px 20px
                    no-repeat;
                }

                &.output::before {
                  background: var(--bb-icon-output) center center / 20px 20px
                    no-repeat;
                }

                &.smart-toy::before {
                  background: var(--bb-icon-smart-toy) center center / 20px 20px
                    no-repeat;
                }

                &.laps::before {
                  background: var(--bb-icon-laps) center center / 20px 20px
                    no-repeat;
                }

                &.merge-type::before {
                  background: var(--bb-icon-merge-type) center center / 20px
                    20px no-repeat;
                }

                &.code-blocks::before {
                  background: var(--bb-icon-code-blocks) center center / 20px
                    20px no-repeat;
                }

                &.human::before {
                  background: var(--bb-icon-human) center center / 20px 20px
                    no-repeat;
                }
              }
            }

            input,
            select,
            textarea {
              font: 400 var(--bb-label-medium) /
                var(--bb-label-line-height-medium) var(--bb-font-family);
              height: var(--bb-grid-size-5);
              border: none;
              margin: 0;
              padding: 0 var(--bb-grid-size-2);
            }

            .item-select-container {
              flex: 1 1 auto;
              overflow: hidden;
              margin-right: var(--bb-grid-size-2);

              bb-item-select {
                --selected-item-height: var(--bb-grid-size-9);
              }
            }
          }

          &.object:has(details) {
            padding-right: 0;
          }

          &:has(bb-text-editor) {
            min-height: var(--bb-grid-size-5);
            align-items: flex-start;
            flex-direction: column;

            /** Pass through the readonly-status to the text-editor */
            &.read-only::before {
              display: none;
            }

            &:not(.stretch) details {
              bb-text-editor {
                padding-top: var(--bb-grid-size-2);
                padding-bottom: var(--bb-grid-size-2);
                height: calc(200px - var(--bb-grid-size) * 2);
                --text-editor-padding-top: 0;
                --text-editor-padding-bottom: 0;
                --text-editor-padding-left: 0;
              }
            }

            &:not(:last-of-type) {
              padding-bottom: var(--bb-grid-size-3);
            }
          }

          & bb-llm-output {
            margin: var(--bb-grid-size-3) var(--bb-grid-size-6);
            --output-lite-border-color: transparent;
            --output-border-radius: var(--bb-grid-size);
          }

          & bb-llm-part-input {
            &.fill {
              width: 100%;
              height: 100%;
              overflow: auto;
            }
          }
        }

        > div {
          &.port {
            container-type: inline-size;
          }

          &.stretch:has(+ .port:not(.stretch)) {
            margin-bottom: var(--bb-grid-size-3);
            border-bottom: 1px solid var(--bb-neutral-300);
          }

          &:not(.stretch):not(.info):has(+ .stretch) {
            margin-bottom: var(--bb-grid-size-3);
            padding-bottom: var(--bb-grid-size-3);
            border-bottom: 1px solid var(--bb-neutral-300);
          }

          &:not(.stretch):not(.info):has(+ :not(.stretch)) {
            margin-bottom: var(--bb-grid-size-2);
          }

          &.info {
            height: var(--bb-grid-size-14);
            background: var(--n-95);
            border-top: 1px solid var(--n-90);
            border-bottom: 1px solid var(--n-90);
            display: flex;
            align-items: center;
            padding: 0 var(--bb-grid-size-6);
            margin-bottom: var(--bb-grid-size-3);

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
            }
          }

          &.stretch {
            overflow-y: auto;
            overflow-x: hidden;
            flex: 1 1 auto;

            &:not(:last-of-type) {
              padding-bottom: var(--bb-grid-size-3);
            }
          }

          &:not(.stretch) {
            padding: 0 var(--bb-grid-size-6);
            flex: 0 0 auto;

            &:last-of-type {
              padding-bottom: var(--bb-grid-size-3);
            }
          }

          & bb-text-editor {
            width: 100%;
            height: 100%;
            --text-editor-height: 100%;
            --text-editor-padding-top: 0;
            --text-editor-padding-right: var(--bb-grid-size-6);
            --text-editor-padding-bottom: 0;
            --text-editor-padding-left: var(--bb-grid-size-6);
          }

          &:has(bb-text-editor) {
            &:not(:last-of-type) {
              border-bottom: 1px solid var(--bb-neutral-300);
            }
          }

          #controls-container {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            flex: 0 0 auto;

            & #controls {
              display: flex;
              align-items: center;
              gap: 2px;

              height: var(--bb-grid-size-9);
              background: var(--n-98);
              border-radius: var(--bb-grid-size-16);
              padding: 2px;

              bb-flowgen-in-step-button {
                z-index: 1;
              }

              #tools {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 38px;
                height: 34px;
                border: none;
                background: var(--n-98);
                transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
                border-radius: var(--bb-grid-size-5) var(--bb-grid-size-16)
                  var(--bb-grid-size-16) var(--bb-grid-size-5);
                padding: 0 6px 0 0;

                &:not([disabled]) {
                  cursor: pointer;

                  &:hover,
                  &:focus {
                    background: var(--n-95);
                  }
                }
              }
            }
          }
        }
      }

      bb-fast-access-menu {
        display: none;
        position: absolute;
        z-index: 10;

        &.active {
          display: block;
          left: var(--fast-access-x, 10);
          top: var(--fast-access-y, 10);
        }
      }

      #proxy {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 0;
        background: red;
      }
    `,
  ];

  #lastUpdateTimes: Map<"nodes" | "assets", number> = new Map();
  #connectorPorts: Map<AssetPath, PortLike[]> = new Map();
  #editorRef: Ref<TextEditor> = createRef();
  #edited = false;
  #formRef: Ref<HTMLFormElement> = createRef();
  #proxyRef: Ref<HTMLDivElement> = createRef();
  #fastAccessRef: Ref<FastAccessMenu> = createRef();
  #isUsingFastAccess = false;
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #advancedOpen = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("pointerdown", this.#onPointerDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("pointerdown", this.#onPointerDownBound);
  }

  #onPointerDown() {
    this.#hideFastAccess();
  }

  #reactiveChange(port: PortLike) {
    const reactive = port.schema.behavior?.includes("reactive");
    if (!reactive)
      return () => {
        this.#edited = true;
      };

    return (evt: Event) => {
      const { target } = evt;
      if (target instanceof HTMLSelectElement || target instanceof ItemSelect) {
        this.#edited = true;
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

  async #submit(currentValues: InputValues | undefined) {
    if (!this.#formRef.value) {
      return;
    }

    const form = this.#formRef.value;
    const data = new FormData(this.#formRef.value);
    const graphId = data.get("graph-id") as string | null;
    const nodeId = data.get("node-id") as string | null;
    if (nodeId !== null && graphId !== null) {
      await this.#emitUpdatedNodeConfiguration(
        currentValues,
        form,
        graphId,
        nodeId
      );
      return;
    }
    const assetPath = data.get("asset-path") as string | null;
    if (assetPath !== null) {
      // When "asset-path" is submitted, we know that this is a an asset.

      // 1) Get the right asset
      const asset = this.projectState?.graphAssets.get(assetPath);
      if (!asset) {
        console.warn(`Unable to commit edits to asset "${assetPath}`);
        return;
      }

      // 2) get title
      const title = form.querySelector<HTMLInputElement>("#node-title")?.value;
      if (!title) {
        console.warn(
          `Unable to find title for in step editor, likely a form integrity problem`
        );
        return;
      }

      // 3) update connector configuration
      const connector = asset.connector;
      if (connector) {
        const ports = this.#connectorPorts.get(assetPath) || [];
        const { values } = this.#takePortValues(form, ports);
        const commiting = await connector.commitEdits(
          title,
          values as Record<string, JsonSerializable>
        );
        if (!ok(commiting)) {
          this.dispatchEvent(new ToastEvent(commiting.$error, ToastType.ERROR));
        }
      } else {
        const dataPart =
          form.querySelector<LLMPartInput>("#asset-value")?.dataPart;

        let data: LLMContent[] | undefined = undefined;
        if (dataPart) {
          data = [{ role: "user", parts: [dataPart] }];
        }

        const updating = await asset.update(title, data);
        if (!ok(updating)) {
          this.dispatchEvent(new ToastEvent(updating.$error, ToastType.ERROR));
        }
      }
    }
  }

  async #emitUpdatedNodeConfiguration(
    currentValues: InputValues | undefined,
    form: HTMLFormElement,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
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

    const metadata = { ...node.metadata() };
    const title = form.querySelector<HTMLInputElement>("#node-title");
    if (title) {
      metadata.title = title.value;
    }

    // Because the rest of the function is async and the values of the form
    // element may change as the selection changes, let's copy the form values,
    // so that we have a stable set of values to work with.
    const formValues = this.#copyFormValues(form);

    const ports = (await node.ports(currentValues)).inputs.ports.filter(
      (port) => {
        if (port.star || port.name === "") return false;
        if (!isConfigurableBehavior(port.schema)) return false;
        return true;
      }
    );

    const { values, ins } = this.#takePortValues(formValues, ports);
    const configuration = { ...node.configuration(), ...values };

    this.dispatchEvent(
      new StateEvent({
        eventType: "node.change",
        id: nodeId,
        subGraphId: graphId !== MAIN_BOARD_ID ? graphId : null,
        configurationPart: configuration,
        metadata,
        ins,
      })
    );
  }

  #copyFormValues(form: HTMLFormElement): InputValues {
    const result: InputValues = {};
    for (const input of form.querySelectorAll<HTMLInputElement>("[name]")) {
      const name = input.getAttribute("name");
      if (!name) {
        continue;
      }
      const value = input.type === "checkbox" ? input.checked : input.value;
      result[name] = value;
    }
    return result;
  }

  #takePortValues(
    formValues: InputValues,
    ports: PortLike[]
  ): { values: Record<string, NodeValue>; ins: TemplatePart[] } {
    const values: Record<string, NodeValue> = {};

    const ins: TemplatePart[] = [];
    const transform = (part: TemplatePart) => {
      if (part.type === "in") {
        ins.push(part);
        // Always optimistically mark part as valid.
        delete part.invalid;
      }
      return part;
    };

    for (const port of ports) {
      const formValue = formValues[port.name];
      switch (port.schema.type) {
        case "array":
        case "object": {
          if (isLLMContentBehavior(port.schema)) {
            const value = { text: (formValue as string) ?? "" };
            this.#updateComponentParamsInText(value, transform);
            values[port.name] = { role: "user", parts: [value] };
          } else if (isLLMContentArrayBehavior(port.schema)) {
            const value = { text: (formValue as string) ?? "" };
            this.#updateComponentParamsInText(value, transform);
            values[port.name] = [{ role: "user", parts: [value] }];
          } else {
            values[port.name] = formValue;
          }
          break;
        }

        case "boolean": {
          values[port.name] = formValue ?? false;
          break;
        }

        case "string": {
          values[port.name] = formValue ?? undefined;
          break;
        }
      }
    }
    return { values, ins };
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
        return nothing;
      }

      const metadata = node.type().currentMetadata();
      const classes: Record<string, boolean> = { node: true };

      if (metadata.icon) {
        classes[metadata.icon] = true;
      }

      if (node.type().type().startsWith("#module")) {
        classes["module"] = true;
      }

      const inputPorts = ports.inputs.ports
        .filter((port) => {
          if (port.star || port.name === "") return false;
          if (!isConfigurableBehavior(port.schema)) return false;
          return true;
        })
        .sort((a, b) => {
          if (isControllerBehavior(a.schema)) return -1;
          if (isControllerBehavior(b.schema)) return 1;
          if (shouldBeAtTop(a.schema)) return -1;
          if (shouldBeAtTop(b.schema)) return 1;

          return a.name.localeCompare(b.name);

          function shouldBeAtTop(schema: Schema) {
            return (
              isLLMContentBehavior(schema) &&
              !schema.behavior?.includes("hint-advanced")
            );
          }
        });

      return html`<div class=${classMap(classes)}>
        <h1 id="title">
          ${metadata.icon
            ? html`<span class="g-icon filled round"
                >${iconSubstitute(metadata.icon)}</span
              >`
            : nothing}
          <input
            autocomplete="off"
            id="node-title"
            name="node-title"
            class="sans-flex round w-500 md-title-medium"
            .value=${node.title()}
            ?disabled=${this.readOnly}
            @keydown=${(evt: KeyboardEvent) => {
              if (evt.key !== "Enter") {
                return;
              }

              evt.preventDefault();
              evt.stopPropagation();
              this.#submit(this.values);
            }}
          />
          ${this.embedState?.showIterateOnPrompt
            ? this.#renderIterateOnPromptButton(nodeId, node.title(), node)
            : nothing}
        </h1>
        <div id="type"></div>
        <div id="content">
          ${this.#renderPorts(graphId, nodeId, inputPorts, node.title())}
        </div>
        <input type="hidden" name="graph-id" .value=${graphId} />
        <input type="hidden" name="node-id" .value=${nodeId} />
      </div>`;
    });

    return html`${until(value, html`<div id="generic-status">Loading...</div>`)}`;
  }

  #renderIterateOnPromptButton(
    nodeId: NodeIdentifier,
    nodeTitle: string,
    node: InspectableNode
  ) {
    // Note that the board URL here may not be a HTTP/HTTPS URL - it could
    // be a Drive URL of the form drive:/12345.
    const boardUrl = this.graph?.raw().url ?? getBoardUrlFromCurrentWindow();
    if (!boardUrl || !isGenerativeNode(node)) {
      return nothing;
    }
    // If tools are contained in prompt, iterate-on-prompt will be disabled.
    const promptcontainsToolsOrAssets = containsToolsOrAssets(
      node.currentPorts()
    );
    return html` <button
      id="iterate-on-prompt"
      .disabled=${promptcontainsToolsOrAssets}
      @click=${async () => {
        // Submit the changes to ensure the prompt is updated before it's sent.
        await this.#submit(this.values);
        const ports = await node.ports();
        const promptTemplate = extractLlmTextPart(ports);
        const modelId = extractModelId(ports);
        if (!promptTemplate) {
          return;
        }
        this.dispatchEvent(
          new IterateOnPromptEvent(
            nodeTitle,
            promptTemplate,
            boardUrl!,
            nodeId,
            modelId
          )
        );
      }}
    >
      Iterate on prompt
    </button>`;
  }

  #renderTextEditorPort(
    port: PortLike,
    value: LLMContent | undefined,
    graphId: GraphIdentifier,
    fastAccess: boolean,
    isReferenced: boolean
  ) {
    const portValue = getLLMContentPortValue(value, port.schema);
    const textPart = portValue.parts.find((part) => isTextCapabilityPart(part));
    if (!textPart) {
      return html`Invalid value`;
    }

    // Note that projectState and subGraphId must be set before value since
    // value depends on the projectState & subGraphId to expand on chiclet
    // metadata.
    return html`<bb-text-editor
      ${isReferenced ? ref(this.#editorRef) : nothing}
      .projectState=${this.projectState}
      .subGraphId=${graphId !== MAIN_BOARD_ID ? graphId : null}
      .value=${textPart.text}
      .supportsFastAccess=${fastAccess}
      .readOnly=${this.readOnly}
      id=${port.name}
      name=${port.name}
      @keydown=${(evt: KeyboardEvent) => {
        if (!isCtrlCommand(evt) || evt.key !== "Enter") {
          return;
        }

        this.#submit(this.values);
      }}
    ></bb-text-editor>`;
  }

  #renderPorts(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    inputPorts: PortLike[],
    title: string
  ) {
    const hasTextEditor =
      inputPorts.findIndex((port) => isLLMContentBehavior(port.schema)) !== -1;

    const portRender = (port: PortLike) => {
      const classes: Record<string, boolean> = { port: true };
      let value:
        | HTMLTemplateResult
        | symbol
        | Array<HTMLTemplateResult | symbol> = html`No value`;
      switch (port.schema.type) {
        case "object": {
          if (isLLMContentBehavior(port.schema)) {
            const advanced = port.schema.behavior?.includes("hint-advanced");

            classes.object = true;
            classes.stretch = !advanced;
            const isReferenced = !advanced;

            value = [
              advanced
                ? html`<label for=${port.name}>${port.title}</label>`
                : nothing,
              this.#renderTextEditorPort(
                port,
                isLLMContent(port.value) ? port.value : undefined,
                graphId,
                !advanced,
                isReferenced
              ),
            ];
          } else {
            value = html`<bb-delegating-input
              id=${port.name}
              name=${port.name}
              .metadata=${{
                docName: title,
              }}
              .schema=${port.schema}
              .value=${port.value}
              @input=${() => {
                this.#edited = true;
              }}
            ></bb-delegating-input>`;
          }
          break;
        }

        case "array": {
          if (isLLMContentArrayBehavior(port.schema)) {
            classes.stretch = true;
            classes.object = true;
            classes.array = true;
            value = this.#renderTextEditorPort(
              port,
              isLLMContentArray(port.value)
                ? (port.value.at(-1) as LLMContent)
                : undefined,
              graphId,
              true,
              true
            );
          }
          break;
        }

        case "boolean": {
          const checked = !!port.value;
          classes.boolean = true;
          classes.checked = checked;
          if (port.schema.icon) {
            classes[port.schema.icon] = true;
          }

          value = html` <label
              for=${port.name}
              class=${classMap({
                slim: isControllerBehavior(port.schema),
              })}
              ><span class="g-icon"></span>${!isControllerBehavior(port.schema)
                ? port.title
                : ""}</label
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
            const currentValue = enumValue(
              port.schema.enum.find(
                (value) => enumValue(value).id == port.value
              ) ?? port.schema.enum[0]
            );

            const classes: Record<string, boolean> = {};
            if (currentValue.icon) {
              classes.slim = isControllerBehavior(port.schema);
            }

            value = html`${!isControllerBehavior(port.schema)
                ? html`<label for=${port.name} class=${classMap(classes)}
                    >${port.title}</label
                  >`
                : ""}
              <div class="item-select-container">
                <bb-item-select
                  @change=${this.#reactiveChange(port)}
                  name=${port.name}
                  id=${port.name}
                  .alignment=${isControllerBehavior(port.schema)
                    ? "bottom"
                    : "top"}
                  .values=${port.schema.enum.map((option) => {
                    return enumValue(option);
                  })}
                  .value=${port.value}
                ></bb-item-select>
              </div>`;
            break;
          }

          value = html`<label
            class=${classMap({ slim: isControllerBehavior(port.schema) })}
            >${!isControllerBehavior(port.schema) ? html`${port.title}: ` : ""}
            <input type="text" name=${port.name} .value=${port.value ?? ""}
          /></label>`;
          break;
        }

        default: {
          value = nothing;
        }
      }

      let controls: HTMLTemplateResult | symbol = nothing;
      if (isControllerBehavior(port.schema)) {
        controls = html`<div id="controls-container">
          <div id="controls">
            ${this.graph
              ? html`<bb-flowgen-in-step-button
                  monochrome
                  popoverPosition="below"
                  .label=${Strings.from("COMMAND_DESCRIBE_EDIT_STEP")}
                  .currentGraph=${this.graph.raw() satisfies GraphDescriptor}
                  .constraint=${{
                    kind: "EDIT_STEP_CONFIG",
                    stepId: nodeId,
                  } satisfies FlowGenConstraint}
                  @bbgraphreplace=${() => {
                    // Ignore all edits to this point so that we don't issue
                    // a submit and stomp the new values.
                    this.#edited = false;
                  }}
                ></bb-flowgen-in-step-button>`
              : nothing}
            ${hasTextEditor
              ? html`<button
                  id="tools"
                  @pointerdown=${() => {
                    if (!this.#editorRef.value) {
                      return;
                    }

                    this.#editorRef.value.storeLastRange();
                  }}
                  @click=${(evt: PointerEvent) => {
                    const bounds = new DOMRect(evt.clientX, evt.clientY, 0, 0);
                    this.#showFastAccess(bounds);
                  }}
                >
                  <span class="g-icon round">home_repair_service</span>
                </button>`
              : nothing}
          </div>
        </div>`;
      }

      classes["read-only"] = this.readOnly;
      const extendedInfo = port.schema.enum?.find((item) => {
        if (typeof item === "string") {
          return false;
        }

        return item.id === port.value && item.info !== undefined;
      });

      const extendedInfoOutput =
        extendedInfo && typeof extendedInfo !== "string"
          ? html`<div class="info">
              <span class="g-icon round filled">warning</span
              >${extendedInfo.info}
            </div>`
          : nothing;

      return [
        html`<div class=${classMap(classes)}>${value} ${controls}</div>`,
        extendedInfoOutput,
      ];
    };

    const basicPorts: PortLike[] = [];
    const advancedPorts: PortLike[] = [];
    for (const port of inputPorts) {
      const advanced = port.schema.behavior?.includes("hint-advanced");
      if (advanced) {
        advancedPorts.push(port);
        continue;
      }

      basicPorts.push(port);
    }

    return [
      ...basicPorts.map(portRender),
      advancedPorts.length > 0
        ? html`<details
            id="advanced-settings"
            ?open=${this.#advancedOpen}
            @toggle=${(evt: Event) => {
              if (!(evt.target instanceof HTMLDetailsElement)) {
                return;
              }

              this.#advancedOpen = evt.target.open;
            }}
          >
            <summary><span class="g-icon"></span>Advanced settings</summary>
            ${[...advancedPorts.map(portRender)]}
          </details>`
        : nothing,
    ];
  }

  #showFastAccess(bounds: DOMRect | undefined) {
    if (!bounds || this.#isUsingFastAccess) {
      return;
    }

    if (!this.#fastAccessRef.value || !this.#proxyRef.value) {
      return;
    }

    const containerBounds = this.getBoundingClientRect();
    const proxyBounds = this.#proxyRef.value.getBoundingClientRect();
    let top = Math.round(bounds.top - proxyBounds.top);
    let left = Math.round(bounds.left - proxyBounds.left);

    // If the fast access menu is about to go off the right, bring it back.
    if (left + 280 > proxyBounds.width) {
      left = proxyBounds.width - 280;
    }

    // Similarly, if it's going to go off the bottom bring it back.
    if (top + 312 > containerBounds.height) {
      top = containerBounds.height - 312;
    }

    if (bounds.top === 0 || bounds.left === 0) {
      top = 0;
      left = 0;
    }

    this.style.setProperty("--fast-access-x", `${left}px`);
    this.style.setProperty("--fast-access-y", `${top}px`);
    this.#fastAccessRef.value.classList.add("active");

    requestAnimationFrame(() => {
      if (!this.#fastAccessRef.value) {
        return;
      }

      this.#fastAccessRef.value.focusFilter();
    });
    this.#isUsingFastAccess = true;
  }

  #hideFastAccess() {
    this.#isUsingFastAccess = false;
    if (!this.#fastAccessRef.value) {
      return;
    }

    this.#fastAccessRef.value.classList.remove("active");
  }

  #renderAsset(assetPath: AssetPath) {
    const asset = this.graph?.assets().get(assetPath);
    if (!asset) {
      return INVALID_ITEM;
    }

    if (!this.graph) {
      return INVALID_ITEM;
    }

    let value;
    if (asset.type === "connector") {
      const view =
        this.projectState?.graphAssets.get(assetPath)?.connector?.view;
      if (!view || !ok(view)) return nothing;
      const ports = portsFromView(view);
      this.#connectorPorts.set(assetPath, ports);
      value = this.#renderPorts("", "", ports, asset.title);
    } else {
      const graphUrl = new URL(this.graph.raw().url ?? window.location.href);
      const itemData = asset?.data.at(-1) ?? null;
      const dataPart = itemData?.parts[0] ?? null;
      const isDrawable = isStoredData(dataPart) && asset.subType === "drawable";
      const skipOutput = isTextCapabilityPart(dataPart) || isDrawable;

      const partEditor = html`<bb-llm-part-input
        class=${classMap({ fill: skipOutput })}
        id="asset-value"
        @submit=${(evt: SubmitEvent) => {
          evt.preventDefault();
          evt.stopImmediatePropagation();

          this.#submit(this.values);
        }}
        @input=${() => {
          this.#edited = true;
        }}
        .graphUrl=${graphUrl}
        .subType=${asset.subType}
        .projectState=${this.projectState}
        .dataPart=${dataPart}
      ></bb-llm-part-input>`;

      let input: HTMLTemplateResult | symbol = nothing;
      if (skipOutput) {
        input = html`<div class="stretch object">${partEditor}</div>`;
      } else {
        input = partEditor;
      }

      let output: HTMLTemplateResult | symbol = nothing;
      if (!skipOutput) {
        output = html` <bb-llm-output
          .value=${itemData}
          .clamped=${false}
          .lite=${true}
          .showModeToggle=${false}
          .showEntrySelector=${false}
          .showExportControls=${false}
          .graphUrl=${graphUrl}
        ></bb-llm-output>`;
      }

      value = [input, output];
    }

    let icon: string | undefined | null = "text_fields";
    if (asset.type) {
      icon = iconSubstitute(asset.type);
    }
    if (asset.subType) {
      icon = iconSubstitute(asset.subType);
    }

    return html`<div class=${classMap({ asset: true })}>
      <h1 id="title">
        ${icon
          ? html`<span class="g-icon filled round">${icon}</span>`
          : nothing}
        <input
          autocomplete="off"
          id="node-title"
          name="node-title"
          class="sans-flex w-500 round md-title-medium"
          .value=${asset.title}
        />
      </h1>
      <div id="content">${value}</div>
      <input type="hidden" name="asset-path" .value=${assetPath} />
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
    // Auto-save both when a different step is selected
    // and when the reactive change is triggered.
    if (
      (changedProperties.has("graphTopologyUpdateId") ||
        changedProperties.has("selectionState") ||
        changedProperties.has("values")) &&
      this.#edited
    ) {
      this.triggerSubmit();
    }
  }

  triggerSubmit() {
    if (!this.#edited) {
      return;
    }

    // Autosave.
    this.#edited = false;
    this.#submit(this.values);

    // Reset the node value so that we don't receive incorrect port data.
    this.values = undefined;
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

    return [
      this.#renderSelectedItem(),
      html`<bb-fast-access-menu
          ${ref(this.#fastAccessRef)}
          .showTools=${true}
          .showAssets=${false}
          .showComponents=${false}
          .showParameters=${false}
          @pointerdown=${(evt: PointerEvent) => {
            evt.stopImmediatePropagation();
          }}
          @bbfastaccessdismissed=${() => {
            this.#hideFastAccess();
          }}
          @bbfastaccessselect=${(evt: FastAccessSelectEvent) => {
            this.#hideFastAccess();
            if (!this.#editorRef.value) {
              return;
            }

            this.#editorRef.value.restoreLastRange(false /* offsetLastChar */);
            this.#editorRef.value.addItem(
              evt.path,
              evt.title,
              evt.accessType,
              evt.mimeType,
              evt.instance
            );
          }}
          .graphId=${null}
          .nodeId=${null}
          .state=${this.projectState?.fastAccess}
        ></bb-fast-access-menu>
        <div ${ref(this.#proxyRef)} id="proxy"></div>`,
    ];
  }
}

function enumValue(value: SchemaEnumValue): EnumValue {
  if (typeof value === "string") {
    return { title: value, id: value };
  }
  const enumVal: EnumValue = {
    title: value.title || value.description || value.id,
    id: value.id,
  };
  if (value.icon) {
    enumVal.icon = value.icon;
  }

  if (value.description) {
    enumVal.description = value.description;
  }

  if (value.info) {
    enumVal.info = value.info;
  }

  if (value.hidden) {
    enumVal.hidden = value.hidden;
  }

  return enumVal;
}

function portsFromView(view: ConnectorView): PortLike[] {
  const { schema, values } = view;
  return Object.entries(schema.properties || {}).map(([name, schema]) => {
    return {
      name,
      title: schema.title || name,
      schema,
      value: (values as Record<string, NodeValue>)[name],
    } satisfies PortLike;
  });
}

function getLLMContentPortValue(
  value: LLMContent | undefined,
  schema: Schema
): LLMContent {
  if (!value) {
    const defaultValue = schema.default;
    if (defaultValue) {
      try {
        return JSON.parse(defaultValue);
      } catch {
        // eat the error, just fall through
      }
    }
  } else {
    return value;
  }
  return {
    role: "user",
    parts: [{ text: "" }],
  };
}

// Extract LLM text part if available; null otherwise.
function extractLlmTextPart(ports: InspectableNodePorts): string | null {
  const inputPorts = ports.inputs.ports;
  const port = inputPorts.find(
    (port) =>
      isLLMContentBehavior(port.schema) &&
      !port.schema.behavior?.includes("hint-advanced")
  );
  if (!port || !isLLMContent(port.value)) {
    return null;
  }
  const portValue = getLLMContentPortValue(port.value, port.schema);
  const textPart = portValue.parts.find((part) => isTextCapabilityPart(part));
  if (!textPart) {
    return null;
  }
  return textPart.text;
}

// Extract selected model ID (e.g., 'text', 'text-2.0-flash') from node.
// Returns null if not present.
function extractModelId(ports: InspectableNodePorts): string | null {
  const inputPorts = ports.inputs.ports;
  const port = inputPorts.find(
    (port) => port.schema.type === "string" && port.schema.enum
  );
  if (!port) {
    return null;
  }
  const currentValue = enumValue(
    port.schema!.enum!.find((value) => enumValue(value).id == port.value) ??
      port.schema!.enum![0]
  );
  return currentValue?.id ?? null;
}

function isGenerativeNode(node: InspectableNode): boolean {
  return node.descriptor.type === "embed://a2/generate.bgl.json#module:main";
}

// Returns true if LLM text part of node contains tools/assets or is absent.
function containsToolsOrAssets(ports: InspectableNodePorts): boolean {
  const textPart = extractLlmTextPart(ports);
  if (!textPart) {
    return false;
  }
  const template = new Template(textPart!);
  const tools = template.placeholders.filter((placeholder) =>
    ["tool", "asset"].includes(placeholder.type)
  );
  return tools.length > 0;
}
