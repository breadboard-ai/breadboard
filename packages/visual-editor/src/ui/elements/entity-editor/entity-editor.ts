/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  AssetPath,
  GraphDescriptor,
  GraphIdentifier,
  InputValues,
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  LLMContent,
  NodeConfiguration,
  NodeIdentifier,
  NodeMetadata,
  NodeValue,
  Outcome,
  Schema,
  SchemaEnumValue,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import {
  isStoredData,
  ok,
  Template,
  TemplatePart,
  TemplatePartTransformCallback,
} from "@breadboard-ai/utils";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { notebookLmIcon } from "../../styles/svg-icons.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { MAIN_BOARD_ID } from "../../../sca/constants.js";
import {
  FastAccessSelectEvent,
  IterateOnPromptEvent,
  StateEvent,
  ToastEvent,
} from "../../events/events.js";
import { ToastType } from "../../../sca/types.js";

import { EnumValue } from "../../types/types.js";
import {
  isConfigurableBehavior,
  isControllerBehavior,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../../utils/schema/behaviors.js";
import { isCtrlCommand } from "../../input/is-ctrl-command.js";
import {
  FastAccessMenu,
  ItemSelect,
  LLMPartInput,
  TextEditor,
} from "../elements.js";

import type { EmbedState } from "@breadboard-ai/types/embedder.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import {
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
} from "../../../data/common.js";

import { embedderContext } from "../../contexts/embedder.js";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { embedState } from "../../embed/embed.js";
import { FlowGenConstraint } from "../../flow-gen/flow-generator.js";
import * as StringsHelper from "../../strings/helper.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { getBoardUrlFromCurrentWindow } from "../../navigation/board-id.js";
import { iconSubstitute } from "../../utils/icon-substitute.js";

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
  get #graph(): InspectableGraph | null {
    return this.sca.controller.editor.graph.editor?.inspect("") ?? null;
  }

  get #readOnly(): boolean {
    return this.sca.controller.editor.graph.readOnly;
  }

  @property({ reflect: true, type: Boolean })
  accessor autoFocus = false;

  @consume({ context: embedderContext })
  accessor embedState: EmbedState = embedState();

  @consume({ context: scaContext })
  accessor sca!: SCA;

  @state()
  accessor values: InputValues | undefined;

  static styles = [
    icons,
    baseColors,
    type,
    css`
      :host {
        display: block;
        background: light-dark(var(--n-100), var(--n-15));
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
        border-bottom: 1px solid var(--light-dark-n-90);
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
          &:not(:focus) {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      #iterate-on-prompt {
        height: var(--bb-grid-size-7);
        white-space: nowrap;
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-16);
        background: var(--light-dark-n-100);
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
          --outer-border: var(--light-dark-n-80);
          background: var(--light-dark-n-90);
          color: var(--n-0);
        }

        & input {
          color: var(--n-0);
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

        &.responsive_layout,
        &.drive_presentation,
        &.web,
        &.docs,
        &.sheets {
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
          color: var(--n-0);
        }
        & input {
          color: var(--n-0);
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
          border-top: 1px solid var(--light-dark-n-90);
          color: var(--light-dark-n-10);
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

          bb-text-editor,
          bb-text-editor-remix {
            width: 100%;
            height: 100%;
            --text-editor-padding-top: var(--bb-grid-size-2);
            --text-editor-padding-right: var(--bb-grid-size-3);
            --text-editor-padding-bottom: var(--bb-grid-size-2);
            --text-editor-padding-left: var(--bb-grid-size-3);
            border-radius: var(--bb-grid-size-2);
            border: 1px solid light-dark(var(--n-90), var(--n-70));
          }

          & .port {
            margin-bottom: var(--bb-grid-size-2);
          }
        }

        .memory-sheet-container {
          display: block;
          padding: var(--bb-grid-size-4) 0;
        }

        .memory-sheet-link {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: var(--bb-grid-size-2);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
          border: 1px solid var(--n-90);
          border-radius: var(--bb-grid-size-6);
          color: var(--n-30);
          text-decoration: none;
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);

          &:hover {
            background: var(--n-95);
          }

          & .g-icon {
            font-size: 18px;
          }
        }

        div {
          display: flex;
          align-items: center;
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);

          &:has(.info) {
            display: grid;
            grid-template-columns: 1fr 36px;
          }

          &.info {
            height: var(--bb-grid-size-14);
            background: light-dark(var(--n-95), var(--n-10));
            border-top: 1px solid light-dark(var(--n-90), var(--n-10));
            display: flex;
            align-items: center;
            padding: 0 var(--bb-grid-size-6);
            margin-top: var(--bb-grid-size-3);
            margin-left: calc(-1 * var(--bb-grid-size-6));
            width: 100%;
            grid-column: 1/3;

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
            }
          }

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
                    border: 1px solid var(--light-dark-p-30);
                    outline: 1px solid var(--light-dark-p-30);
                  }
                }
              }

              & input {
                display: none;
              }
            }

            &.string:not(:has(.item-select-container)) {
              & label {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: var(--bb-grid-size);
                width: 100%;
              }

              & input {
                border: 1px solid var(--light-dark-n-80);
                width: 100%;
                box-sizing: border-box;
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
                max-width: 100%;
                --menu-width: 320px;
                --selected-item-height: var(--bb-grid-size-9);
                --selected-item-background-color: light-dark(
                  var(--n-98),
                  var(--n-30)
                );
                --selected-item-hover-color: light-dark(
                  var(--n-95),
                  var(--n-40)
                );
              }
            }
          }

          &.object:has(details) {
            padding-right: 0;
          }

          &:has(:is(bb-text-editor, bb-text-editor-remix)) {
            min-height: var(--bb-grid-size-5);
            align-items: flex-start;
            flex-direction: column;

            /** Pass through the readonly-status to the text-editor */
            &.read-only::before {
              display: none;
            }

            &:not(.stretch) details {
              bb-text-editor,
              bb-text-editor-remix {
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
          position: relative;

          &.port {
            container-type: inline-size;
          }

          &.stretch:has(+ .port:not(.stretch)) {
            margin-bottom: var(--bb-grid-size-3);
            border-bottom: 1px solid var(--light-dark-n-90);
          }

          &:not(.stretch):not(.info):has(+ .stretch) {
            margin-bottom: var(--bb-grid-size-14);
            padding-bottom: var(--bb-grid-size-3);
            border-bottom: 1px solid var(--light-dark-n-90);

            &:has(.info) {
              padding-bottom: 0;
            }

            &::after {
              content: "Prompt";
              font-family: var(--bb-font-family-flex);
              font-size: 12px;
              position: absolute;
              left: var(--bb-grid-size-6);
              bottom: calc(var(--bb-grid-size-9) * -1);
            }
          }

          &:not(.stretch):not(.info):has(+ :not(.stretch)) {
            margin-bottom: var(--bb-grid-size-2);
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

          & :is(bb-text-editor, bb-text-editor-remix) {
            width: 100%;
            height: 100%;
            --text-editor-height: 100%;
            --text-editor-padding-top: 0;
            --text-editor-padding-right: var(--bb-grid-size-6);
            --text-editor-padding-bottom: 0;
            --text-editor-padding-left: var(--bb-grid-size-6);
          }

          &:has(:is(bb-text-editor, bb-text-editor-remix)) {
            &:not(:last-of-type) {
              border-bottom: 1px solid var(--light-dark-n-90);
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

              width: var(--bb-grid-size-9);
              height: var(--bb-grid-size-9);
              border-radius: var(--bb-grid-size-16);

              #tools {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                border: none;
                background: light-dark(var(--n-98), var(--n-30));
                transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
                border-radius: 50%;
                padding: 0;

                &:not([disabled]) {
                  cursor: pointer;

                  &:hover,
                  &:focus {
                    background: var(--light-dark-n-95);
                  }
                }
              }
            }
          }

          bb-flowgen-in-step-button {
            z-index: 1;
            position: absolute;
            bottom: calc(var(--bb-grid-size-11) * -1);
            right: var(--bb-grid-size-6);
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
      let value = null;
      if (target instanceof HTMLSelectElement || target instanceof ItemSelect) {
        value = target.value;
      } else if (
        target instanceof HTMLInputElement &&
        target.type === "checkbox"
      ) {
        value = !port.value;
      }
      if (value !== null) {
        this.#edited = true;
        this.values = {
          ...this.values,
          [port.name]: value,
        };
        // Reactive changes need to be saved immediately so the graph editor
        // updates. Unlike regular edits (which wait for selection change),
        // reactive controls should propagate their changes right away.
        this.#save();
      }
    };
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
      // The direct apply above incremented the graph version, so any
      // pendingEdit captured earlier (via @input) is now stale.
      // Clear it to prevent a false "edits were discarded" warning.
      this.#edited = false;
      this.sca?.controller.editor.step.clearPendingEdit();
      return;
    }
    const assetPath = data.get("asset-path") as string | null;
    if (assetPath !== null) {
      // When "asset-path" is submitted, we know that this is a an asset.

      // 1) get title
      const title = form.querySelector<HTMLInputElement>("#node-title")?.value;
      if (!title) {
        console.warn(
          `Unable to find title for in step editor, likely a form integrity problem`
        );
        return;
      }

      // 2) update asset using Asset action
      const dataPart =
        form.querySelector<LLMPartInput>("#asset-value")?.dataPart;

      let assetData: LLMContent[] | undefined = undefined;
      if (dataPart) {
        assetData = [{ role: "user", parts: [dataPart] }];
      }

      const updating = await this.sca.actions.asset.update(
        assetPath,
        title,
        assetData
      );
      if (!ok(updating)) {
        this.dispatchEvent(new ToastEvent(updating.$error, ToastType.ERROR));
      }

      // The direct apply above incremented the graph version, so any
      // pendingAssetEdit captured earlier (via @input) is now stale.
      // Clear it to prevent a false "edits were discarded" warning.
      this.#edited = false;
      this.sca.controller.editor.step.clearPendingAssetEdit();
    }
  }

  /**
   * Prepares the node configuration by transforming form values.
   * Returns the configuration, metadata, and ins for either dispatch or pendingEdit.
   */
  async #prepareNodeConfiguration(
    currentValues: InputValues | undefined,
    form: HTMLFormElement,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ): Promise<{
    configuration: NodeConfiguration;
    metadata: NodeMetadata;
    ins: TemplatePart[];
    editGraphId: GraphIdentifier;
  } | null> {
    let targetGraph = this.#graph;
    if (!targetGraph) {
      return null;
    }

    // Note: graphId from form is MAIN_BOARD_ID for main board, but API expects ""
    const apiGraphId = graphId === MAIN_BOARD_ID ? "" : graphId;

    if (graphId !== MAIN_BOARD_ID) {
      targetGraph = this.#graph!.graphs()?.[graphId] ?? null;
    }

    if (!targetGraph) {
      return null;
    }

    const node = targetGraph.nodeById(nodeId);
    if (!node) {
      return null;
    }

    const metadata = { ...node.metadata() };
    const title = form.querySelector<HTMLInputElement>("#node-title");
    if (title) {
      metadata.title = title.value;
    }

    // Copy form values for stable async processing
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

    return { configuration, metadata, ins, editGraphId: apiGraphId };
  }

  async #emitUpdatedNodeConfiguration(
    currentValues: InputValues | undefined,
    form: HTMLFormElement,
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier
  ) {
    const prepared = await this.#prepareNodeConfiguration(
      currentValues,
      form,
      graphId,
      nodeId
    );

    if (!prepared) {
      return;
    }

    this.sca?.services.actionTracker?.editStep("manual");

    this.dispatchEvent(
      new StateEvent({
        eventType: "node.change",
        id: nodeId,
        subGraphId: graphId !== MAIN_BOARD_ID ? graphId : null,
        configurationPart: prepared.configuration,
        metadata: prepared.metadata,
        ins: prepared.ins,
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
    let targetGraph = this.#graph;
    if (!targetGraph) {
      return INVALID_ITEM;
    }

    if (graphId !== MAIN_BOARD_ID) {
      targetGraph = this.#graph!.graphs()?.[graphId] ?? null;
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

      const icon = node.currentDescribe().metadata?.icon;
      const classes: Record<string, boolean> = { node: true };

      if (icon) {
        classes[icon] = true;
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
          ${icon
            ? html`<span class="g-icon filled round"
                >${iconSubstitute(icon)}</span
              >`
            : nothing}
          <input
            autocomplete="off"
            id="node-title"
            name="node-title"
            class="sans-flex round w-500 md-title-medium"
            .value=${node.title()}
            ?disabled=${this.#readOnly}
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
          ${this.#renderPorts(graphId, nodeId, inputPorts, node)}
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
    const boardUrl = this.#graph?.raw().url ?? getBoardUrlFromCurrentWindow();
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
    isReferenced: boolean,
    agentMode: boolean
  ) {
    const portValue = getLLMContentPortValue(value, port.schema);
    const textPart = portValue.parts.find((part) => isTextCapabilityPart(part));
    if (!textPart) {
      return html`Invalid value`;
    }

    // Note that subGraphId must be set before value since
    // value depends on the subGraphId to expand on chiclet
    // metadata.
    const useRemix = this.sca?.env.flags.get("textEditorRemix");

    // We use a static template per variant so Lit can diff correctly.
    // Both components expose the same property/event surface.
    if (useRemix) {
      return html`<bb-text-editor-remix
        ${isReferenced ? ref(this.#editorRef) : nothing}
        .subGraphId=${graphId !== MAIN_BOARD_ID ? graphId : null}
        .value=${textPart.text}
        .supportsFastAccess=${fastAccess}
        .readOnly=${this.#readOnly}
        id=${port.name}
        name=${port.name}
        @keydown=${(evt: KeyboardEvent) => {
          if (!isCtrlCommand(evt) || evt.key !== "Enter") {
            return;
          }

          this.#save();
        }}
      ></bb-text-editor-remix>`;
    }

    return html`<bb-text-editor
      ${isReferenced ? ref(this.#editorRef) : nothing}
      .subGraphId=${graphId !== MAIN_BOARD_ID ? graphId : null}
      .value=${textPart.text}
      .supportsFastAccess=${fastAccess}
      .readOnly=${this.#readOnly}
      .isAgentMode=${agentMode}
      id=${port.name}
      name=${port.name}
      @keydown=${(evt: KeyboardEvent) => {
        if (!isCtrlCommand(evt) || evt.key !== "Enter") {
          return;
        }

        this.#save();
      }}
    ></bb-text-editor>`;
  }

  #renderPorts(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    inputPorts: PortLike[],
    node: InspectableNode
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
                isReferenced,
                isAgentMode(node, this.values)
              ),
            ];
          } else {
            console.warn("[entity editor] Can't render port", port);
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
              true,
              isAgentMode(node, this.values)
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
              @change=${this.#reactiveChange(port)}
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
            <input
              type="text"
              name=${port.name}
              .value=${port.value ?? ""}
              placeholder=${port.schema.description ?? ""}
          /></label>`;
          break;
        }

        default: {
          value = nothing;
        }
      }

      let controls: HTMLTemplateResult | symbol = nothing;
      if (isControllerBehavior(port.schema)) {
        const extendedInfo = port.schema.enum?.find((item) => {
          if (typeof item === "string") {
            return false;
          }

          return item.id === port.value && item.info !== undefined;
        });

        const extendedInfoOutput =
          extendedInfo && typeof extendedInfo !== "string"
            ? html`<div class="info">
                <span class="g-icon round">info</span>${extendedInfo.info}
              </div>`
            : nothing;

        controls = html`<div id="controls-container">
            <div id="controls">
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
                      const bounds = new DOMRect(
                        evt.clientX,
                        evt.clientY,
                        0,
                        0
                      );
                      this.#showFastAccess(bounds);
                    }}
                  >
                    <span class="g-icon round">home_repair_service</span>
                  </button>`
                : nothing}
            </div>
          </div>

          ${extendedInfoOutput}
          ${this.#graph
            ? html`<bb-flowgen-in-step-button
                monochrome
                popoverPosition="below"
                .label=${Strings.from("COMMAND_DESCRIBE_EDIT_STEP")}
                .currentGraph=${this.#graph.raw() satisfies GraphDescriptor}
                .constraint=${{
                  kind: "EDIT_STEP_CONFIG",
                  stepId: nodeId,
                } satisfies FlowGenConstraint}
                @bbgraphreplace=${() => {
                  this.sca?.services.actionTracker?.editStep("flowgen");
                  // Ignore all edits to this point so that we don't issue
                  // a submit and stomp the new values.
                  this.#edited = false;
                }}
              ></bb-flowgen-in-step-button>`
            : nothing}`;
      }

      classes["read-only"] = this.#readOnly;

      return [html`<div class=${classMap(classes)}>${value} ${controls}</div>`];
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
      advancedPorts.length > 0 ||
      this.sca?.controller.editor.step.memorySheetUrl
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
            ${this.sca?.controller.editor.step.memorySheetUrl
              ? html`<a
                  class="memory-sheet-link"
                  href=${this.sca.controller.editor.step.memorySheetUrl}
                  target="_blank"
                  rel="noopener"
                  >Open Memory Database
                  <span class="g-icon">open_in_new</span></a
                >`
              : nothing}
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
    this.sca.controller.editor.fastAccess.fastAccessMode = "tools";
    this.#isUsingFastAccess = true;
  }

  #hideFastAccess() {
    this.#isUsingFastAccess = false;
    this.sca.controller.editor.fastAccess.fastAccessMode = null;
    if (!this.#fastAccessRef.value) {
      return;
    }

    this.#fastAccessRef.value.classList.remove("active");
  }

  #renderAsset(assetPath: AssetPath) {
    const asset = this.#graph?.assets().get(assetPath);
    if (!asset) {
      return INVALID_ITEM;
    }

    if (!this.#graph) {
      return INVALID_ITEM;
    }

    const graphUrl = new URL(this.#graph.raw().url ?? window.location.href);
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

    const value = [input, output];

    let icon: string | HTMLTemplateResult | undefined | null = "text_fields";
    if (asset.type) {
      icon = iconSubstitute(asset.type);
    }
    if (asset.subType) {
      if (asset.subType === "notebooklm") {
        icon = notebookLmIcon;
      } else {
        icon = iconSubstitute(asset.subType);
      }
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
    const sel = this.sca.controller.editor.selection.selection;

    let value: HTMLTemplateResult | symbol = nothing;
    if (sel.assets.size > 0) {
      value = this.#renderAsset([...sel.assets][0]);
    } else if (sel.nodes.size > 0) {
      value = this.#renderNode(MAIN_BOARD_ID, [...sel.nodes][0]);
    } else {
      value = html`<div id="generic-status">Unsupported item</div>`;
    }

    return html`<form
      ${ref(this.#formRef)}
      @submit=${(evt: SubmitEvent) => {
        evt.preventDefault();
      }}
      @input=${() => {
        this.#edited = true;
        this.#setPendingEditFromForm();
      }}
      @change=${() => {
        this.#edited = true;
        this.#setPendingEditFromForm();
      }}
    >
      ${value}
    </form>`;
  }

  // NOTE: willUpdate no longer triggers autosave. Pending edits are set
  // directly in the @input handler on the form.

  /**
   * Sets a pending edit on the SCA controller from current form state.
   * The step autosave trigger will apply this when selection changes.
   * Handles both node edits (node-id/graph-id) and asset edits (asset-path).
   */
  async #setPendingEditFromForm(): Promise<void> {
    if (!this.#formRef.value || !this.sca) {
      return;
    }

    const form = this.#formRef.value;
    const data = new FormData(form);

    // Check if this is a node edit
    const formGraphId = data.get("graph-id") as string | null;
    const nodeId = data.get("node-id") as string | null;

    if (formGraphId !== null && nodeId !== null) {
      // Handle node edit
      const prepared = await this.#prepareNodeConfiguration(
        this.values,
        form,
        formGraphId,
        nodeId
      );

      if (!prepared) {
        return;
      }

      this.sca.controller.editor.step.setPendingEdit({
        graphId: prepared.editGraphId,
        nodeId,
        values: prepared.configuration,
        ins: prepared.ins,
        graphVersion: this.sca.controller.editor.graph.version,
      });
      return;
    }

    // Check if this is an asset edit
    const assetPath = data.get("asset-path") as string | null;
    if (assetPath !== null) {
      const asset = this.sca.controller.editor.graph.graphAssets.get(assetPath);
      if (!asset) {
        return;
      }

      const title = form.querySelector<HTMLInputElement>("#node-title")?.value;
      const dataPart =
        form.querySelector<LLMPartInput>("#asset-value")?.dataPart;

      if (!title) {
        return;
      }

      this.sca.controller.editor.step.setPendingAssetEdit({
        assetPath,
        title,
        dataPart,
        graphVersion: this.sca.controller.editor.graph.version,
      });
    }
  }

  /**
   * Implements the StepEditorSurface interface, so that this class could
   * be used in step editing.
   */
  async #save(): Promise<Outcome<void>> {
    if (!this.#edited) {
      return;
    }

    // Autosave.
    this.#edited = false;
    const submitting = this.#submit(this.values);

    // Clear pending edit since we're explicitly saving
    // This prevents the stale edit warning when clicking away
    this.sca?.controller.editor.step.clearPendingEdit();
    this.sca?.controller.editor.step.clearPendingAssetEdit();

    // Reset the node value so that we don't receive incorrect port data.
    this.values = undefined;

    return submitting;
  }

  focus() {
    requestAnimationFrame(() => {
      if (!this.#editorRef.value) {
        return;
      }

      this.#editorRef.value.focus();
    });
  }

  protected firstUpdated(): void {
    this.focus();
  }

  render() {
    // Read graph version to subscribe to graph changes via SignalWatcher.
    // This ensures we re-render when the graph is modified (e.g., wire drag).
    void this.sca.controller.editor.graph.version;
    // Subscribe to selection changes via SignalWatcher.
    void this.sca.controller.editor.selection.selectionId;
    // Subscribe to memory sheet URL changes (set asynchronously by action).
    void this.sca.controller.editor.step.memorySheetUrl;

    // Count only primary editable items (nodes, assets).
    // Edges and asset-edges are secondary and shouldn't inflate the count.
    const sel = this.sca.controller.editor.selection.selection;
    const selectionCount = sel.nodes.size + sel.assets.size;
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

            const part: TemplatePart = {
              path: evt.path,
              title: evt.title,
              type: evt.accessType,
              mimeType: evt.mimeType,
              instance: evt.instance,
            };

            this.#editorRef.value.addItem(part);
          }}
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

function isAgentMode(
  node: InspectableNode,
  pendingValues?: InputValues
): boolean {
  if (!isGenerativeNode(node)) return false;
  // Check pending values first (for reactive updates), then fall back to persisted configuration
  const mode =
    pendingValues?.["generation-mode"] ??
    node.configuration()?.["generation-mode"];
  // undefined means "agent" mode (it's the default)
  return mode === "agent" || mode === undefined;
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
