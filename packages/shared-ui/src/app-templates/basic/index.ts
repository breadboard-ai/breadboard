/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LitElement,
  html,
  css,
  PropertyValues,
  nothing,
  HTMLTemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  AppTemplate,
  AppTemplateOptions,
  EdgeLogEntry,
  TopGraphRunResult,
} from "../../types/types";
import Mode from "../shared/styles/icons.js";
import Animations from "../shared/styles/animations.js";

import { classMap } from "lit/directives/class-map.js";
import {
  GraphDescriptor,
  InspectableRun,
  InspectableRunSecretEvent,
  isLLMContent,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import { styleMap } from "lit/directives/style-map.js";
import {
  AddAssetEvent,
  AddAssetRequestEvent,
  BoardDescriptionUpdateEvent,
  BoardTitleUpdateEvent,
  InputEnterEvent,
  RunEvent,
  SignInRequestedEvent,
  StopEvent,
  UtteranceEvent,
} from "../../events/events";
import { repeat } from "lit/directives/repeat.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { LLMContent, NodeValue, OutputValues } from "@breadboard-ai/types";
import { isLLMContentArrayBehavior, isLLMContentBehavior } from "../../utils";
import { extractError } from "../shared/utils/utils";
import { AssetShelf } from "../../elements/elements";
import { SigninState } from "../../utils/signin-adapter";

/** Included so the app can be standalone */
import "../../elements/input/add-asset/add-asset-button.js";
import "../../elements/input/add-asset/add-asset-modal.js";
import "../../elements/input/add-asset/asset-shelf.js";
import "../../elements/input/speech-to-text/speech-to-text.js";
import "../../elements/input/drawable/drawable.js";

import "../../elements/output/llm-output/llm-output-array.js";
import "../../elements/output/llm-output/export-toolbar.js";
import "../../elements/output/llm-output/llm-output.js";
import "../../elements/output/multi-output/multi-output.js";
import { map } from "lit/directives/map.js";
import { markdown } from "../../directives/markdown";
import { maybeConvertToYouTube } from "../../utils/substitute-input";

@customElement("app-basic")
export class Template extends LitElement implements AppTemplate {
  @property({ type: Object })
  accessor options: AppTemplateOptions = {
    title: "Untitled App",
    mode: "light",
    splashImage: false,
  };

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor appURL: string | null = null;

  @property()
  accessor eventPosition = 0;

  @property()
  accessor pendingSplashScreen = false;

  @property()
  accessor showGDrive = false;

  @property()
  accessor isInSelectionState = false;

  @property()
  accessor showingOlderResult = false;

  @property()
  accessor state: SigninState = "anonymous";

  @property({ reflect: true, type: Boolean })
  accessor hasRenderedSplash = false;

  @property({ reflect: true, type: Boolean })
  accessor showShareButton = true;

  @property()
  accessor readOnly = true;

  @state()
  accessor showAddAssetModal = false;
  #addAssetType: string | null = null;

  get additionalOptions() {
    return {
      font: {
        values: [
          { title: "Sans-serif", value: "sans-serif" } /* Default */,
          { title: "Serif", value: "serif" },
        ],
        title: "Font",
      },
      fontStyle: {
        values: [
          { title: "Normal", value: "normal" } /* Default */,
          { title: "Italic", value: "italic" },
        ],
        title: "Font Style",
      },
    };
  }

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      /** Fonts */

      @scope (.app-template) {
        :scope {
          --font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          --font-style: normal;

          /**
           * Added so that any fixed position overlays are relative to this
           * scope rather than any containing document.
           */
          transform: translateX(0);
        }
      }

      @scope (.app-template.font-serif) {
        :scope {
          --font-family: serif;
        }
      }

      @scope (.app-template.fontStyle-italic) {
        :scope {
          --font-style: italic;
        }
      }

      /** General styles */

      :host([hasrenderedsplash]) {
        @scope (.app-template) {
          & #content {
            & #splash {
              animation: none;
            }
          }
        }
      }

      @scope (.app-template) {
        :scope {
          background: var(--background-color);
          color: var(--text-color);
          display: flex;
          width: 100%;
          height: 100%;
          margin: 0;
        }

        & #content {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-height: 100svh;
          overflow-x: hidden;
          overflow-y: scroll;
          flex: 1;
          scrollbar-width: none;
          position: relative;

          &::before {
            content: "";
            width: 100svw;
          }

          &:has(.loading) {
            align-items: center;
            justify-content: center;
            background: var(--background-color);
          }

          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100svw;
            height: 100svh;

            & .loading-message {
              display: flex;
              align-items: center;
              height: var(--bb-grid-size-8);
              padding-left: var(--bb-grid-size-8);
              background: var(--bb-progress) 4px center / 20px 20px no-repeat;
            }
          }

          #preview-step-not-run {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex: 1;
            animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1);
            padding: 0 var(--bb-grid-size-8);
            font: 400 var(--font-style, normal) var(--bb-title-medium) /
              var(--bb-title-line-height-medium)
              var(--font-family, var(--bb-font-family));
            color: var(--text-color, var(--bb-neutral-900));

            & h1 {
              font: 500 var(--font-style, normal) var(--bb-title-large) /
                var(--bb-title-line-height-large)
                var(--font-family, var(--bb-font-family));
              color: var(--primary-color, var(--bb-neutral-900));
              margin: 0 0 var(--bb-grid-size) 0;
            }

            & p {
              color: var(--text-color, var(--bb-neutral-700));
              margin: 0 0 var(--bb-grid-size-2) 0;
            }
          }

          & #splash {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex: 1;
            animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1);

            &::before {
              content: "";
              width: 100%;
              flex: 1;
              background: var(--splash-image, url(/images/app/generic-flow.jpg))
                center center / cover no-repeat;
              mask-image: linear-gradient(
                to bottom,
                rgba(255, 0, 255, 1) 0%,
                rgba(255, 0, 255, 1) 70%,
                rgba(255, 0, 255, 0.75) 80%,
                rgba(255, 0, 255, 0.4) 90%,
                rgba(255, 0, 255, 0) 100%
              );
            }

            & h1 {
              background: var(--background-color, none);
              border-radius: var(--bb-grid-size-2);
              font: 500 var(--font-style) 32px / 42px var(--font-family);
              color: var(--primary-color, var(--bb-neutral-700));
              margin: 0 0 var(--bb-grid-size-3);
              flex: 0 0 auto;
              max-width: 80%;
              width: max-content;
              text-align: center;
            }

            & p {
              flex: 0 0 auto;
              font: 400 var(--font-style) var(--bb-body-large) /
                var(--bb-body-line-height-large) var(--font-family);
              color: var(--secondary-color, var(--bb-neutral-700));
              margin: 0 0 var(--bb-grid-size-3);

              max-width: 65%;
              width: max-content;
              text-align: center;
            }
          }

          & #controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 76px;
            border-bottom: 1px solid var(--secondary-color, var(--bb-neutral-0));
            padding: 0 var(--bb-grid-size-4);
            position: relative;

            #older-data {
              position: absolute;
              width: max-content;
              max-width: 70%;
              text-align: center;
              left: 50%;
              top: 50%;
              user-select: none;
              transform: translate(-50%, -50%);
              padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
              font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);
              background: var(--bb-ui-50);
              color: var(--bb-ui-800);
              border-radius: var(--bb-grid-size-2);
              opacity: 0;
              transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

              &.active {
                opacity: 1;
              }
            }

            #progress-container {
              flex: 1 1 auto;
              margin: 0 var(--bb-grid-size-2);
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            #progress {
              width: 100%;
              max-width: 320px;
              height: 4px;
              background: var(--secondary-color);
              border-radius: var(--bb-grid-size-16);
              position: relative;

              &::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: calc(var(--percentage) * 100%);
                max-width: 100%;
                height: 4px;
                background: var(--primary-color);
                border-radius: var(--bb-grid-size-16);
                transition: width 0.3s cubic-bezier(0, 0, 0.3, 1);
              }
            }

            button {
              width: 20px;
              height: 20px;
              background: transparent;
              border: none;
              font-size: 0;
              opacity: 0.6;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);

              &#back {
                background: var(--bb-icon-arrow-back) center center / 20px 20px
                  no-repeat;
              }

              &#share {
                display: none;
                background: var(--bb-icon-share) center center / 20px 20px
                  no-repeat;
              }

              &#restart {
                background: var(--bb-icon-replay) center center / 20px 20px
                  no-repeat;
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  opacity: 1;
                }
              }
            }

            div#share {
              width: 20px;
              height: 20px;
              background: transparent;
            }
          }

          & #activity {
            flex: 1;
            overflow: auto;

            display: flex;
            flex-direction: column;
            padding: var(--bb-grid-size-3);
            color: var(--text-color);

            &::before {
              flex: 1;
              content: "";
            }

            & bb-multi-output {
              --output-value-padding-x: var(--bb-grid-size-4);
              --output-value-padding-y: var(--bb-grid-size-4);
              --output-border-radius: var(--bb-grid-size-4);
              --output-font: 400 var(--font-style, normal)
                var(--bb-title-large) / var(--bb-title-line-height-large)
                var(--font-family, var(--bb-font-family));
              --output-string-width: 95%;
              --output-string-margin-bottom-y: var(--bb-grid-size-3);
              --output-margin-bottom: var(--bb-grid-size-4);
              --output-background-color: var(--bb-neutral-0);
              --multi-output-value-padding-x: 0;
              flex: 1 0 auto;

              animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) forwards;
            }

            & .error {
              flex: 1 0 auto;
              display: flex;
              flex-direction: column;
              width: 80%;
              margin: 0 auto;

              & summary {
                list-style: none;
                cursor: pointer;

                & h1 {
                  margin: 0 0 var(--bb-grid-size-2) 0;
                  font: 400 var(--bb-title-large) /
                    var(--bb-title-line-height-large) var(--bb-font-family);
                  color: var(--primary-color);
                }

                & p {
                  font: 400 var(--bb-label-medium) /
                    var(--bb-label-line-height-medium) var(--bb-font-family);
                  margin: 0;
                  color: oklch(
                    from var(--text-color) l c h / calc(alpha - 0.6)
                  );
                }
              }

              & p {
                margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
                font: 400 var(--bb-title-medium) /
                  var(--bb-title-line-height-medium) var(--bb-font-family);
                color: var(--secondary-color);
              }

              &::-webkit-details-marker {
                display: none;
              }
            }

            & .thought {
              font: 400 var(--font-style, normal) var(--bb-title-medium) /
                var(--bb-title-line-height-medium)
                var(--font-family, var(--bb-font-family));
              color: var(--text-color, var(--bb-neutral-900));
              margin: 0 var(--bb-grid-size-3)
                var(--output-string-margin-bottom-y, var(--bb-grid-size-2))
                var(--bb-grid-size-3);
              padding: 0 var(--bb-grid-size-3);
              opacity: 0;
              animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) 0.05s forwards;

              & p {
                margin: 0 0 var(--bb-grid-size-2) 0;
              }

              & h1 {
                font: 500 var(--font-style, normal) var(--bb-title-small) /
                  var(--bb-title-line-height-small)
                  var(--font-family, var(--bb-font-family));
                color: var(--primary-color, var(--bb-neutral-900));
                margin: 0 0 var(--bb-grid-size-2) 0;
              }

              &.generative h1 {
                padding-left: var(--bb-grid-size-7);
                background: var(--bb-icon-generative) 0 center / 20px 20px
                  no-repeat;
              }
            }

            & #status {
              position: absolute;
              display: flex;
              align-items: center;
              bottom: var(--bb-grid-size-6);
              width: calc(100% - var(--bb-grid-size-12));
              left: 50%;
              transform: translateX(-50%);
              background: var(--bb-progress) var(--primary-color) 16px center /
                20px 20px no-repeat;
              color: var(--primary-text-color);
              padding: var(--bb-grid-size-3) var(--bb-grid-size-4)
                var(--bb-grid-size-3) var(--bb-grid-size-12);
              border-radius: var(--bb-grid-size-3);
              z-index: 1;
              font: 400 var(--bb-title-medium) /
                var(--bb-title-line-height-medium) var(--bb-font-family);
              opacity: 0;
              animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) 0.6s forwards;

              &::after {
                content: "Working";
                flex: 0 0 auto;
                margin-left: var(--bb-grid-size-3);
                color: oklch(
                  from var(--primary-text-color) l c h / calc(alpha - 0.4)
                );
              }
            }
          }

          & #input {
            --user-input-padding-left: 0;

            display: flex;
            justify-content: center;
            position: relative;

            background: var(--background-color, var(--bb-neutral-0));

            & #sign-in,
            & #run {
              min-width: 76px;
              height: var(--bb-grid-size-10);
              background: var(--primary-color, var(--bb-ui-50))
                var(--bb-icon-generative) 12px center / 16px 16px no-repeat;
              color: var(--primary-text-color, var(--bb-ui-700));
              border-radius: 20px;
              border: 1px solid var(--primary-color, var(--bb-ui-100));
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-9);
              opacity: 0.85;

              --transition-properties: opacity;
              transition: var(--transition);

              &.running {
                background: var(--bb-ui-500) url(/images/progress-ui.svg) 8px
                  center / 16px 16px no-repeat;
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  opacity: 1;
                }
              }
            }

            & #sign-in {
              background-image: var(--bb-icon-login-inverted);
            }

            &.stopped {
              min-height: 100px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
            }

            &.finished {
              display: none;
            }

            &.paused,
            &.running {
              width: 100%;

              & #input-container {
                padding: var(--bb-grid-size-2) var(--bb-grid-size-3)
                  var(--bb-grid-size-4) var(--bb-grid-size-3);
                transition: transform 0.6s cubic-bezier(0, 0, 0.3, 1);
                transform: translateY(100%);
                background: var(--primary-color);
                color: var(--primary-text-color);
                width: 100%;
                display: flex;

                min-height: 100px;
                max-height: 385px;

                bb-add-asset-button {
                  margin-right: var(--bb-grid-size-2);
                }

                & .user-input {
                  display: flex;
                  flex-direction: column;
                  flex: 1;
                  overflow: auto;

                  & p {
                    display: flex;
                    align-items: flex-end;
                    font: 500 var(--bb-title-small) /
                      var(--bb-title-line-height-small) var(--bb-font-family);
                    margin: 0 0 var(--bb-grid-size-3) 0;
                    flex: 1;
                    opacity: 0.8;

                    &.api-message {
                      font: 400 var(--bb-body-x-small) /
                        var(--bb-body-line-height-x-small) var(--bb-font-family);
                    }
                  }

                  & textarea,
                  & input[type="password"] {
                    field-sizing: content;
                    resize: none;
                    background: transparent;
                    color: var(--primary-text-color);
                    font: 400 var(--bb-title-medium) /
                      var(--bb-title-line-height-medium) var(--bb-font-family);
                    border: none;
                    border-radius: var(--bb-grid-size-2);
                    outline: none;
                    width: 100%;
                    scrollbar-width: none;

                    &::placeholder {
                      color: oklch(
                        from var(--primary-text-color) l c h / calc(alpha - 0.3)
                      );
                    }
                  }
                }

                & .controls {
                  margin-left: var(--bb-grid-size-2);
                  display: flex;
                  align-items: flex-end;

                  & #continue {
                    margin-left: var(--bb-grid-size-2);
                    background: oklch(
                        from var(--primary-text-color) l c h /
                          calc(alpha - 0.75)
                      )
                      var(--bb-icon-send) center center / 20px 20px no-repeat;

                    width: 40px;
                    height: 40px;
                    font-size: 0;
                    border: none;
                    border-radius: 50%;

                    --transition-properties: opacity;
                    transition: var(--transition);

                    &[disabled] {
                      cursor: auto;
                      opacity: 0.5;
                    }

                    &:not([disabled]) {
                      cursor: pointer;
                      opacity: 0.5;

                      &:hover,
                      &:focus {
                        opacity: 1;
                      }
                    }
                  }
                }
              }

              &.active.paused #input-container {
                transform: translateY(0);
              }
            }
          }
        }
      }

      :host([showsharebutton]) {
        @scope (.app-template) {
          & #content {
            & #controls {
              & button#share {
                display: block;
                margin-left: var(--bb-grid-size-2);
              }
            }
          }
        }
      }
    `,
    Mode,
    Animations,
  ];

  #inputRef: Ref<HTMLDivElement> = createRef();
  #splashRef: Ref<HTMLDivElement> = createRef();
  #assetShelfRef: Ref<AssetShelf> = createRef();

  #renderControls(topGraphResult: TopGraphRunResult) {
    if (topGraphResult.currentNode?.descriptor.id) {
      this.#nodesLeftToVisit.delete(topGraphResult.currentNode?.descriptor.id);
    }

    const showShare = "share" in navigator;
    const percentage =
      this.#totalNodeCount > 0
        ? (this.#totalNodeCount - this.#nodesLeftToVisit.size) /
          this.#totalNodeCount
        : 1;
    return html`<div id="controls">
      <button
        id="back"
        @click=${() => {
          this.dispatchEvent(new StopEvent(true));
        }}
      >
        Back
      </button>
      <div id="progress-container">
        <div
          id="progress"
          style=${styleMap({ "--percentage": percentage.toFixed(2) })}
        ></div>
      </div>
      <button
        id="restart"
        @click=${() => {
          this.dispatchEvent(new StopEvent(true));
        }}
      ></button>
      ${showShare
        ? html`<button
            id="share"
            @click=${() => {
              navigator.share({
                url: this.appURL ?? window.location.href,
                title: this.options.title ?? "Untitled App",
              });
            }}
          >
            Share
          </button>`
        : nothing}
      <div
        id="older-data"
        class=${classMap({
          active: this.isInSelectionState && this.showingOlderResult,
        })}
      >
        Viewing data from an earlier step. Newer data is available.
      </div>
    </div>`;
  }

  #renderActivity(topGraphResult: TopGraphRunResult) {
    let activityContents:
      | HTMLTemplateResult
      | Array<HTMLTemplateResult | symbol>
      | symbol = nothing;

    const currentItem = topGraphResult.log.at(-1);
    if (currentItem?.type === "error") {
      activityContents = html`
        <details class="error">
          <summary>
            <h1>We are sorry, but there was a problem with this flow.</h1>
            <p>Tap for more details</p>
          </summary>
          <div>
            <p>${extractError(currentItem.error)}</p>
          </div>
        </details>
      `;
    } else if (
      currentItem?.type === "edge" &&
      topGraphResult.status === "paused"
    ) {
      // Attempt to find the most recent output. If there is one, show it
      // otherwise show any message that's coming from the edge.
      let lastOutput = null;
      for (let i = topGraphResult.log.length - 1; i >= 0; i--) {
        const result = topGraphResult.log[i];
        if (result.type === "edge" && result.descriptor?.type === "output") {
          lastOutput = result;
          break;
        }
      }

      // Render the output.
      if (lastOutput !== null) {
        activityContents = html`<bb-multi-output
          .outputs=${lastOutput.value ?? null}
        ></bb-multi-output>`;
      }
    } else if (topGraphResult.status === "running") {
      let status: HTMLTemplateResult | symbol = nothing;
      let bubbledValue: HTMLTemplateResult | symbol = nothing;

      if (topGraphResult.currentNode?.descriptor.metadata?.title) {
        status = html`<div id="status">
          ${topGraphResult.currentNode.descriptor.metadata.title}
        </div>`;
      }

      let idx = 0;
      let lastOutput: EdgeLogEntry | null = null;
      for (let i = topGraphResult.log.length - 1; i >= 0; i--) {
        const result = topGraphResult.log[i];
        if (result.type === "edge" && result.value && result.schema) {
          lastOutput = result;
          idx = i;
          break;
        }
      }

      if (lastOutput !== null && lastOutput.schema && lastOutput.value) {
        bubbledValue = html`${repeat(
          Object.entries(lastOutput.schema.properties ?? {}),
          () => idx,
          ([name, property]) => {
            if (!lastOutput.value) {
              return nothing;
            }

            if (property.type !== "string" && property.format !== "markdown") {
              return nothing;
            }

            const value = lastOutput.value[name];
            if (typeof value !== "string") {
              return nothing;
            }

            const classes: Record<string, boolean> = {};
            if (property.title) {
              classes[
                property.title.toLocaleLowerCase().replace(/\W/gim, "-")
              ] = true;
            }

            if (property.icon) {
              classes[property.icon.toLocaleLowerCase().replace(/\W/gim, "-")] =
                true;
            }

            return html`<div class=${classMap(classes)}>
              <h1>${property.title}</h1>
              ${markdown(value)}
            </div> `;
          }
        )}`;
      }

      activityContents = [bubbledValue, status];
    } else {
      // Find the last item.
      let lastOutput = null;
      for (let i = topGraphResult.log.length - 1; i >= 0; i--) {
        const result = topGraphResult.log[i];
        if (result.type === "edge" && result.value) {
          lastOutput = result;
          break;
        }
      }

      if (lastOutput !== null) {
        activityContents = html`<bb-multi-output
          .outputs=${lastOutput.value ?? null}
        ></bb-multi-output>`;
      }
    }

    return html`<div id="activity">${activityContents}</div>`;
  }

  #toLLMContentWithTextPart(text: string): NodeValue {
    return { role: "user", parts: [{ text }] };
  }

  #hasFocusableInput = false;
  #renderInput(topGraphResult: TopGraphRunResult) {
    const placeholder = html`<div class="user-input">
        <p>&nbsp;</p>
      </div>

      <div class="controls"></div>`;

    const continueRun = (id: string) => {
      if (!this.#inputRef.value) {
        return;
      }

      const inputs = this.#inputRef.value.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea");
      const assetShelf =
        this.#inputRef.value.querySelector<AssetShelf>("bb-asset-shelf");
      const inputValues: OutputValues = {};

      let canProceed = true;
      for (const input of inputs) {
        if (!input.checkValidity()) {
          input.reportValidity();
          canProceed = false;
        }

        let value: string | LLMContent = input.value;
        if (typeof value === "string") {
          value = maybeConvertToYouTube(input.value);
        }

        if (typeof value === "string") {
          if (input.dataset.type === "llm-content") {
            inputValues[input.name] = this.#toLLMContentWithTextPart(value);
          } else if (input.dataset.type === "llm-content-array") {
            inputValues[input.name] = [this.#toLLMContentWithTextPart(value)];
          } else {
            inputValues[input.name] = value;
          }

          value = "";
        } else {
          inputValues[input.name] = value as NodeValue;
        }

        if (assetShelf && assetShelf.value) {
          const inputValue = inputValues[input.name];
          if (isLLMContent(inputValue)) {
            const parts = inputValue.parts;
            for (const asset of assetShelf.value) {
              parts.push(...asset.parts);
            }
          }

          // Once we have the values, remove the items from the shelf.
          assetShelf.clear();
        }
      }

      if (!canProceed) {
        return;
      }

      this.dispatchEvent(
        new InputEnterEvent(id, inputValues, /* allowSavingIfSecret */ true)
      );
    };

    let inputContents: HTMLTemplateResult | symbol = nothing;
    let active = false;
    const currentItem = topGraphResult.log.at(-1);
    if (currentItem?.type === "edge") {
      const props = Object.entries(currentItem.schema?.properties ?? {});
      if (this.run && this.run.events.at(-1)?.type === "secret") {
        const secretEvent = this.run.events.at(-1) as InspectableRunSecretEvent;

        active = true;
        inputContents = html`
          <div class="user-input">
            <p class="api-message">
              When calling an API, the API provider's applicable privacy policy
              and terms apply
            </p>
            ${map(secretEvent.keys, (key) => {
              if (key.startsWith("connection:")) {
                return html`<bb-connection-input
                  id=${key}
                  .connectionId=${key.replace(/^connection:/, "")}
                ></bb-connection-input>`;
              } else {
                return html`<input
                  name=${key}
                  type="password"
                  autocomplete="off"
                  required
                  .placeholder=${`Enter ${key}`}
                />`;
              }
            })}
          </div>
          <div class="controls">
            <button
              id="continue"
              @click=${() => {
                continueRun(currentItem.id ?? "unknown");
              }}
            >
              Continue
            </button>
          </div>
        `;
      } else if (props.length > 0 && currentItem.descriptor?.type === "input") {
        active = true;
        const valueIsDefined = currentItem.value !== undefined;
        const valueHasKeys =
          typeof currentItem.value === "object" &&
          Object.keys(currentItem.value).length > 0;
        const valueIsNonEmptyArray =
          Array.isArray(currentItem.value) && currentItem.value.length > 0;
        const disabled =
          valueIsDefined && (valueHasKeys || valueIsNonEmptyArray);

        inputContents = html`
          <bb-add-asset-button
            .anchor=${"above"}
            .useGlobalPosition=${false}
            .showGDrive=${this.showGDrive}
            ?disabled=${disabled}
          ></bb-add-asset-button>

          ${repeat(props, ([name, schema]) => {
            const dataType = isLLMContentArrayBehavior(schema)
              ? "llm-content-array"
              : isLLMContentBehavior(schema)
                ? "llm-content"
                : "string";

            const propValue = currentItem.value?.[name];
            let inputValue = "";
            if (isLLMContent(propValue)) {
              for (const part of propValue.parts) {
                if (isTextCapabilityPart(part)) {
                  inputValue = part.text;
                }
              }
            }
            const hasAssetEntered =
              this.#assetShelfRef?.value == undefined ||
              this.#assetShelfRef?.value.value.length == 0;
            return html`<div class="user-input">
              <p>
                ${schema.description ? html`${schema.description}` : nothing}
              </p>

              <textarea
                placeholder=${hasAssetEntered
                  ? "Type or upload your response."
                  : "Press Submit to continue"}
                name=${name}
                type="text"
                data-type=${dataType}
                .value=${inputValue}
                ?disabled=${disabled}
              ></textarea>
              <bb-asset-shelf ${ref(this.#assetShelfRef)}></bb-asset-shelf>
            </div>`;
          })}

          <div class="controls">
            <bb-speech-to-text
              ?disabled=${disabled}
              @bbutterance=${(evt: UtteranceEvent) => {
                if (!this.#inputRef.value) {
                  return;
                }

                const inputField =
                  this.#inputRef.value.querySelector<HTMLTextAreaElement>(
                    "textarea"
                  );
                if (!inputField) {
                  return;
                }

                inputField.value = evt.parts
                  .map((part) => part.transcript)
                  .join("");
              }}
            ></bb-speech-to-text>
            <button
              id="continue"
              ?disabled=${disabled}
              title="Submit"
              @click=${() => {
                continueRun(currentItem.id ?? "unknown");
              }}
            >
              Continue
            </button>
          </div>
        `;
      } else {
        active = true;
        inputContents = placeholder;
      }
    } else {
      inputContents = placeholder;
    }

    let status: "stopped" | "paused" | "running" | "finished" =
      topGraphResult.status;

    if (topGraphResult.status === "stopped" && topGraphResult.log.length > 0) {
      status = "finished";
    }

    this.#hasFocusableInput = active;

    return html`<div
      @transitionend=${() => {
        if (!this.#inputRef.value || !active) {
          return;
        }

        const input =
          this.#inputRef.value.querySelector<HTMLInputElement>(
            "input,textarea"
          );
        input?.focus();
      }}
      @keydown=${(evt: KeyboardEvent) => {
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

        if (!(evt.key === "Enter" && isCtrlCommand)) {
          return;
        }

        continueRun("unknown");
      }}
      id="input"
      class=${classMap({ active, [status]: true })}
    >
      <div id="input-container" ${ref(this.#inputRef)}>${inputContents}</div>
    </div>`;
  }

  #totalNodeCount = 0;
  #nodesLeftToVisit = new Set<string>();
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("topGraphResult")) {
      if (
        this.graph &&
        this.topGraphResult &&
        (this.topGraphResult.log.length === 0 || this.#totalNodeCount === 0)
      ) {
        this.#nodesLeftToVisit = new Set(
          this.graph.nodes.map((node) => node.id)
        );

        this.#totalNodeCount = this.#nodesLeftToVisit.size;

        for (const item of this.topGraphResult.log) {
          if (item.type !== "node") {
            continue;
          }

          this.#nodesLeftToVisit.delete(item.descriptor.id);
        }
      }
    }
  }

  render() {
    const classes: Record<string, boolean> = {
      "app-template": true,
      [this.options.mode]: true,
    };

    if (!this.topGraphResult) {
      return nothing;
    }

    if (this.options.additionalOptions) {
      for (const [name, value] of Object.entries(
        this.options.additionalOptions
      )) {
        classes[`${name}-${value}`] = true;
      }
    }

    const styles: Record<string, string> = {};
    if (this.options.theme) {
      styles["--primary-color"] = this.options.theme.primaryColor;
      styles["--primary-text-color"] = this.options.theme.primaryTextColor;
      styles["--secondary-color"] = this.options.theme.secondaryColor;
      styles["--text-color"] = this.options.theme.textColor;
      styles["--background-color"] = this.options.theme.backgroundColor;
    }

    if (typeof this.options.splashImage === "string") {
      styles["--splash-image"] = this.options.splashImage;
    }

    if (
      typeof this.options.splashImage === "boolean" &&
      this.options.splashImage
    ) {
      if (!this.topGraphResult || this.topGraphResult.status === "stopped") {
        return html`<section
          class=${classMap(classes)}
          style=${styleMap(styles)}
        >
          <div id="content">
            <div class="loading"><p class="loading-message">Loading...</p></div>
          </div>
        </section>`;
      }
    }

    const splashScreen = html`
      <div
        id="splash"
        @animationend=${() => {
          this.hasRenderedSplash = true;
        }}
      >
        <h1
          ?contenteditable=${!this.readOnly}
          @blur=${(evt: Event) => {
            if (this.readOnly) {
              return;
            }

            if (
              !(evt.target instanceof HTMLElement) ||
              !evt.target.textContent
            ) {
              return;
            }
            const newTitle = evt.target.textContent.trim();
            if (newTitle === this.options.title) {
              return;
            }
            this.dispatchEvent(new BoardTitleUpdateEvent(newTitle));
          }}
        >
          ${this.options.title}
        </h1>
        <p
          ?contenteditable=${!this.readOnly}
          @blur=${(evt: Event) => {
            if (this.readOnly) {
              return;
            }

            if (this.readOnly) {
              return;
            }

            if (
              !(evt.target instanceof HTMLElement) ||
              !evt.target.textContent
            ) {
              return;
            }

            const newDescription = evt.target.textContent.trim();
            if (newDescription === this.options.description) {
              return;
            }

            this.dispatchEvent(new BoardDescriptionUpdateEvent(newDescription));
          }}
        >
          ${this.options.description
            ? html`${this.options.description}`
            : nothing}
        </p>
      </div>
      <div id="input" class="stopped">
        <div>
          ${this.state === "anonymous" || this.state === "valid"
            ? html`<button
                id="run"
                ?disabled=${this.#totalNodeCount === 0}
                @click=${() => {
                  this.dispatchEvent(new RunEvent());
                }}
              >
                Start
              </button>`
            : html`<button
                id="sign-in"
                ?disabled=${this.#totalNodeCount === 0}
                @click=${() => {
                  this.dispatchEvent(new SignInRequestedEvent());
                }}
              >
                Sign In
              </button>`}
        </div>
      </div>
    `;

    let addAssetModal: HTMLTemplateResult | symbol = nothing;
    if (this.showAddAssetModal) {
      addAssetModal = html`<bb-add-asset-modal
        .assetType=${this.#addAssetType}
        @bboverlaydismissed=${() => {
          this.showAddAssetModal = false;
        }}
        @bbaddasset=${(evt: AddAssetEvent) => {
          if (!this.#assetShelfRef.value) {
            return;
          }

          this.showAddAssetModal = false;
          this.#assetShelfRef.value.addAsset(evt.asset);
        }}
      ></bb-add-asset-modal>`;
    }

    let content: HTMLTemplateResult | symbol = html`${(styles[
      "--splash-image"
    ] &&
      this.topGraphResult.status === "stopped" &&
      this.topGraphResult.log.length === 0) ||
    this.#totalNodeCount === 0
      ? splashScreen
      : [
          this.#renderControls(this.topGraphResult),
          this.#renderActivity(this.topGraphResult),
          this.#renderInput(this.topGraphResult),
          addAssetModal,
        ]}`;

    if (this.isInSelectionState && this.topGraphResult.log.length === 0) {
      content = html`<div id="preview-step-not-run">
        <h1>No data available</h1>
        <p>This step has yet to run</p>
      </div>`;
    }

    return html`<section
      class=${classMap(classes)}
      style=${styleMap(styles)}
      @bbaddassetrequest=${(evt: AddAssetRequestEvent) => {
        this.showAddAssetModal = true;
        this.#addAssetType = evt.assetType;
      }}
    >
      <div id="content">${content}</div>
    </section>`;
  }
}
