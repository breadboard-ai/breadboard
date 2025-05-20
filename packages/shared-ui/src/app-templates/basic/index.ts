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
import { SIGN_IN_CONNECTION_ID, SigninState } from "../../utils/signin-adapter";

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
import { createThemeStyles } from "@breadboard-ai/theme";
import { icons } from "../../styles/icons";

const SIGN_IN_SECRET_KEY = `connection:${SIGN_IN_CONNECTION_ID}`;

function keyFromGraphUrl(url: string) {
  return `cw-${url.replace(/\W/gi, "-")}`;
}

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

  @property()
  set showContentWarning(showContentWarning: boolean) {
    // Only accept an updated value if it's false or unset.
    if (!showContentWarning || this.#showContentWarning === undefined) {
      this.#showContentWarning = showContentWarning;
    }

    // If we have the graph's URL and we just got an updated value for the
    // content warning, we will handle it. If the value was set to false then
    // we store the fact that they've seen the warning and dismissed it.
    //
    // If it's set to true then we will take a look to the local storage and if
    // the flag has been set then we don't show the content warning.
    if (this.graph?.url) {
      const key = keyFromGraphUrl(this.graph.url);
      if (!showContentWarning) {
        globalThis.localStorage.setItem(key, "true");
      } else if (globalThis.localStorage.getItem(key) === "true") {
        this.#showContentWarning = false;
      }
    }
  }
  get showContentWarning() {
    if (this.graph?.url && typeof this.#showContentWarning === "undefined") {
      const key = keyFromGraphUrl(this.graph.url);
      if (globalThis.localStorage.getItem(key) === "true") {
        this.#showContentWarning = false;
      }
    }
    return this.#showContentWarning ?? true;
  }
  #showContentWarning: boolean | undefined = undefined;

  @state()
  accessor showAddAssetModal = false;
  #addAssetType: string | null = null;
  #allowedMimeTypes: string | null = null;

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
    icons,
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
          background: var(--s-90, var(--background-color));
          color: var(--p-25, var(--text-color));
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

          #content-warning {
            border-top: 1px solid var(--bb-neutral-0);
            display: flex;
            justify-content: space-between;
            background: var(--bb-neutral-100);
            padding: var(--bb-grid-size-6) var(--bb-grid-size-3);
            min-height: var(--bb-grid-size-11);
            color: var(--bb-neutral-900);
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);

            & .message {
              margin-right: var(--bb-grid-size-16);

              & a {
                font-weight: 500;
                color: var(--bb-ui-500);
                text-decoration: none;
              }
            }

            & .dismiss {
              color: var(--bb-ui-600);
              padding: 0;
              margin: 0;
              background: transparent;
              border: none;
              font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);

              &:not([disabled]) {
                cursor: pointer;

                &:focus,
                &:hover {
                  color: var(--bb-ui-600);
                }
              }
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
              color: var(--s-80, var(--bb-neutral-900));
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
            animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1);

            #splash-content-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 100%;
            }

            &::before {
              content: "";
              width: var(--splash-width, 100%);
              background: var(--splash-image, var(--bb-logo)) center center /
                var(--splash-fill, cover) no-repeat;
              padding: var(--bb-grid-size-3);
              background-clip: content-box;
              border-radius: var(--bb-grid-size-5);
              box-sizing: border-box;
              aspect-ratio: 17/20;
              max-height: 45cqh;
            }

            &.default {
              flex: 1;
              &::before {
                max-width: 320px;
                background-clip: initial;
              }
            }

            & h1 {
              background: var(--background-color, none);
              border-radius: var(--bb-grid-size-2);
              font: 400 var(--font-style) 36px / 40px var(--font-family);
              color: var(--p-25, var(--bb-neutral-700));
              margin: var(--bb-grid-size-10) 0 var(--bb-grid-size-4) 0;
              flex: 0 0 auto;
              max-width: 80%;
              width: max-content;
              text-align: center;
            }

            & p {
              flex: 0 0 auto;
              font: 400 var(--font-style) 16px / 20px var(--font-family);
              color: var(--p-25, var(--bb-neutral-700));
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
            border-bottom: 1px solid var(--s-70, var(--bb-neutral-0));
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
              background: var(--p-70);
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
                background: var(--p-40);
                border-radius: var(--bb-grid-size-16);
                transition: width 0.3s cubic-bezier(0, 0, 0.3, 1);
              }
            }

            button {
              width: 20px;
              height: 20px;
              background: transparent;
              border: none;
              font-size: 20px;
              opacity: 0.6;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
              padding: 0;
              color: var(--p-15, var(--bb-neutral-800));

              &#back {
                opacity: 0;
                pointer-events: none;
              }

              &#share {
                display: none;
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
            container-type: size;

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
                  color: var(--e-80);
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
                color: var(--s-80, var(--bb-neutral-900));
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
              background: var(--p-20);
              color: var(--p-100);
              padding: var(--bb-grid-size-3) var(--bb-grid-size-4)
                var(--bb-grid-size-3) var(--bb-grid-size-3);
              border-radius: var(--bb-grid-size-3);
              z-index: 1;
              font: 400 var(--bb-title-medium) /
                var(--bb-title-line-height-medium) var(--bb-font-family);
              opacity: 0;
              animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) 0.6s forwards;
              max-width: 640px;

              & .g-icon {
                margin: var(--bb-grid-size-2);
                animation: rotate 1s linear forwards infinite;

                &::before {
                  content: "progress_activity";
                }
              }

              &::after {
                content: "";
                flex: 0 0 auto;
                margin-left: var(--bb-grid-size-3);
                color: oklch(from var(--p-15) l c h / calc(alpha - 0.4));
              }
            }
          }

          & #input {
            --user-input-padding-left: 0;

            display: flex;
            justify-content: center;
            position: relative;
            background: transparent;

            & #sign-in,
            & #run {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 200px;
              height: var(--bb-grid-size-12);
              background: var(--p-15, var(--bb-ui-50));
              color: var(--p-100, var(--bb-ui-700));
              border-radius: var(--bb-grid-size-12);
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              padding: 0;
              opacity: 0.85;
              border: none;

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

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }
            }

            & #run .g-icon::before {
              content: "spark";
            }

            & #sign-in .g-icon::before {
              content: "login";
            }

            &.stopped {
              min-height: 100px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
              background: transparent;
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
                background: var(--s-95);
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

                  .no-text-input {
                    background: transparent;
                    color: var(--primary-text-color);
                    font: 400 var(--bb-title-medium) /
                      var(--bb-title-line-height-medium) var(--bb-font-family);
                    user-select: none;
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

                bb-add-asset-button {
                  --background-color: var(--p-80);
                  --text-color: var(--p-15);
                }

                & .controls {
                  margin-left: var(--bb-grid-size-2);
                  display: flex;
                  align-items: flex-end;

                  bb-speech-to-text {
                    --background: var(--p-80);
                    --bb-icon-color: var(--p-15);
                    --active-color: linear-gradient(var(--p-40), transparent);
                  }

                  & #continue {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: var(--bb-grid-size-2);
                    background: var(--p-80);
                    color: var(--p-15);
                    width: 40px;
                    height: 40px;
                    border: none;
                    border-radius: 50%;

                    --transition-properties: opacity;
                    transition: var(--transition);

                    &[disabled] {
                      cursor: auto;
                      opacity: 0.8;
                    }

                    &:not([disabled]) {
                      cursor: pointer;
                      opacity: 0.8;

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

        @container (min-width: 820px) {
          & #content {
            justify-content: center;

            & #controls {
              & #progress-container {
                & #progress {
                  max-width: 800px;
                }
              }
            }

            & #input.stopped {
              justify-content: flex-start;
              padding-left: 0;
            }

            & #splash {
              display: flex;
              flex-direction: row;
              flex: 1;

              #splash-content-container {
                height: 100%;
                flex: 1;

                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: flex-start;

                margin-left: var(--bb-grid-size-10);
              }

              &::before {
                height: 100%;
                flex: 1;
                max-height: calc(100cqh - var(--bb-grid-size-6));
                aspect-ratio: initial;
              }

              &.default::before {
                max-width: initial;
                background-size: initial;
              }

              & h1,
              & p {
                width: auto;
                text-align: left;
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

    const showShare = false && "share" in navigator;
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
        id="replay"
        @click=${() => {
          this.dispatchEvent(new StopEvent(true));
        }}
      >
        <span class="g-icon">replay</span>
      </button>
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
            <span class="g-icon">share</span>
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
          .showAsStatus=${true}
          .outputs=${lastOutput.value ?? null}
        ></bb-multi-output>`;
      }
    } else if (topGraphResult.status === "running") {
      let status: HTMLTemplateResult | symbol = nothing;
      let bubbledValue: HTMLTemplateResult | symbol = nothing;

      if (topGraphResult.currentNode?.descriptor.metadata?.title) {
        status = html`<div id="status">
          <span class="g-icon"></span>
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
            inputValues[input.name] =
              input.dataset.empty === "true"
                ? { parts: [] }
                : this.#toLLMContentWithTextPart(value);
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
                if (key === SIGN_IN_SECRET_KEY) {
                  // When the connection id is a sign in, we never bring up
                  // the input dialog -- it is presumed to exist.
                  // However, we still need to send an event so that AppView
                  // catches it and interprets it
                  this.dispatchEvent(
                    new InputEnterEvent(
                      SIGN_IN_SECRET_KEY,
                      { secret: "" },
                      /* allowSavingIfSecret */ true
                    )
                  );

                  return nothing;
                }
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
              <span class="g-icon">send_spark</span>
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

        // We have to inspect the properties to determine what is allowed here,
        // but it is theoretically possible for multiple properties to define
        // different allowed values. For now we just roll through and pick out
        // the first one and go with what it says.
        let allowAddAssets = false;

        // Setting this to null will allow all default types through.
        let allowedUploadMimeTypes: string | null = null;
        let textToSpeech = false;
        let textInput = false;

        const supportedActions = {
          upload: false,
          youtube: false,
          drawable: false,
          gdrive: false,
        };

        propSearch: for (const [, prop] of props) {
          if (!prop.format) {
            // Any.
            allowAddAssets = true;
            textToSpeech = true;
            textInput = true;
            supportedActions.upload = true;
            supportedActions.youtube = true;
            supportedActions.drawable = true;
            supportedActions.gdrive = true;
            continue;
          }

          switch (prop.format) {
            case "upload": {
              allowAddAssets = true;
              supportedActions.upload = true;
              break propSearch;
            }

            case "mic": {
              allowAddAssets = true;
              allowedUploadMimeTypes = "audio/*";
              supportedActions.upload = true;
              break propSearch;
            }

            case "videocam": {
              allowAddAssets = true;
              allowedUploadMimeTypes = "video/*";
              supportedActions.upload = true;
              supportedActions.youtube = true;
              break propSearch;
            }

            case "image": {
              allowAddAssets = true;
              allowedUploadMimeTypes = "image/*";
              supportedActions.upload = true;
              break propSearch;
            }

            case "edit_note": {
              allowAddAssets = true;
              allowedUploadMimeTypes = "text/*";
              supportedActions.upload = true;
              textToSpeech = true;
              textInput = true;
              break propSearch;
            }

            default: {
              // Any.
              allowAddAssets = true;
              textToSpeech = true;
              textInput = true;
              supportedActions.upload = true;
              supportedActions.youtube = true;
              supportedActions.drawable = true;
              supportedActions.gdrive = true;
              break propSearch;
            }
          }
        }

        inputContents = html`
          ${allowAddAssets
            ? html`<bb-add-asset-button
                .anchor=${"above"}
                .supportedActions=${supportedActions}
                .allowedUploadMimeTypes=${allowedUploadMimeTypes}
                .useGlobalPosition=${false}
                .showGDrive=${this.showGDrive}
                ?disabled=${disabled}
              ></bb-add-asset-button>`
            : nothing}
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

              ${textInput
                ? html`<textarea
                    placeholder=${hasAssetEntered
                      ? "Type or upload your response."
                      : "Press Submit to continue"}
                    name=${name}
                    type="text"
                    data-type=${dataType}
                    .value=${inputValue}
                    ?disabled=${disabled}
                  ></textarea>`
                : allowAddAssets
                  ? html`<div class="no-text-input">
                        ${hasAssetEntered
                          ? "Upload your response."
                          : "Press Submit to continue"}
                      </div>
                      <input
                        type="hidden"
                        data-type=${dataType}
                        data-empty="true"
                        name=${name}
                      />`
                  : nothing}
              <bb-asset-shelf
                @assetchanged=${() => {
                  this.requestUpdate();
                }}
                ${ref(this.#assetShelfRef)}
              ></bb-asset-shelf>
            </div>`;
          })}

          <div class="controls">
            ${textToSpeech
              ? html`<bb-speech-to-text
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
                ></bb-speech-to-text>`
              : nothing}
            <button
              id="continue"
              ?disabled=${disabled}
              title="Submit"
              @click=${() => {
                continueRun(currentItem.id ?? "unknown");
              }}
            >
              <span class="g-icon">send_spark</span>
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
        if (evt.key !== "Enter") {
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

    let styles: Record<string, string> = {};
    if (this.options.theme) {
      styles = createThemeStyles(this.options.theme);
    }

    if (typeof this.options.splashImage === "string") {
      // Special-case the default theme based on the mime types.
      // TODO: Replace this with a more robust check.
      if (this.options.isDefaultTheme) {
        styles["--splash-width"] = "50%";
        styles["--splash-fill"] = "contain";
        styles["--start-border"] = "var(--secondary-color)";
        styles["--default-progress"] = "url(/images/progress-inverted.svg)";
        styles["--start-icon"] = "var(--bb-icon-generative-inverted)";
        styles["--input-background"] =
          "oklch(from var(--s-80) calc(l + 0.2) c h)";
      }

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
        class=${classMap({ default: this.options.isDefaultTheme ?? false })}
        @animationend=${() => {
          this.hasRenderedSplash = true;
        }}
      >
        <section id="splash-content-container">
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

              this.dispatchEvent(
                new BoardDescriptionUpdateEvent(newDescription)
              );
            }}
          >
            ${this.options.description
              ? html`${this.options.description}`
              : nothing}
          </p>
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
                    <span class="g-icon"></span>Start
                  </button>`
                : html`<button
                    id="sign-in"
                    ?disabled=${this.#totalNodeCount === 0}
                    @click=${() => {
                      this.dispatchEvent(new SignInRequestedEvent());
                    }}
                  >
                    <span class="g-icon"></span>Sign In
                  </button>`}
            </div>
          </div>
        </section>
      </div>
    `;

    let addAssetModal: HTMLTemplateResult | symbol = nothing;
    if (this.showAddAssetModal) {
      addAssetModal = html`<bb-add-asset-modal
        .assetType=${this.#addAssetType}
        .allowedMimeTypes=${this.#allowedMimeTypes}
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
        this.#allowedMimeTypes = evt.allowedMimeTypes;
      }}
    >
      <div id="content">
        ${content}
        ${this.showContentWarning
          ? html`<div id="content-warning">
              <div class="message">
                This content was created by another person. It may be inaccurate
                or unsafe.
                <a href="https://support.google.com/legal/answer/3110420?hl=en"
                  >Report unsafe content</a
                >
              </div>
              <button
                class="dismiss"
                @click=${() => {
                  this.showContentWarning = false;
                }}
              >
                Dismiss
              </button>
            </div>`
          : nothing}
      </div>
    </section>`;
  }
}
