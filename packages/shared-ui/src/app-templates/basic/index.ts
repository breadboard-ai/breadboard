/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { AppTemplate, AppTemplateOptions } from "../../types/types";
import Mode from "../shared/styles/icons.js";
import Animations from "../shared/styles/animations.js";

import { classMap } from "lit/directives/class-map.js";
import {
  asBase64,
  BoardServer,
  GraphDescriptor,
  isLLMContentArray,
  ok,
  transformDataParts,
} from "@google-labs/breadboard";
import { styleMap } from "lit/directives/style-map.js";
import {
  AddAssetRequestEvent,
  BoardDescriptionUpdateEvent,
  BoardTitleUpdateEvent,
  ResizeEvent,
  RunEvent,
  SignInRequestedEvent,
  ToastEvent,
  ToastType,
} from "../../events/events";
import { SigninState } from "../../utils/signin-adapter";

import "./particles/card.js";
import "./particles/image.js";
import "./particles/list.js";
import "./particles/segment.js";

/** Included so the app can be standalone */
import "../../elements/input/webcam/webcam-video.js";
import "../../elements/input/add-asset/add-asset-button.js";
import "../../elements/input/add-asset/add-asset-modal.js";
import "../../elements/input/add-asset/asset-shelf.js";
import "../../elements/input/speech-to-text/speech-to-text.js";
import "../../elements/input/drawable/drawable.js";
import "../../elements/input/floating-input/floating-input.js";

import "../../elements/output/header/header.js";
import "../../elements/output/llm-output/llm-output-array.js";
import "../../elements/output/llm-output/export-toolbar.js";
import "../../elements/output/llm-output/llm-output.js";
import "../../elements/output/multi-output/multi-output.js";
import { createThemeStyles } from "@breadboard-ai/theme";
import { icons } from "../../styles/icons";
import { ActionTracker } from "../../utils/action-tracker.js";
import { buttonStyles } from "../../styles/button.js";
import { consume, provide } from "@lit/context";
import { boardServerContext } from "../../contexts/board-server.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { NodeValue } from "@breadboard-ai/types";
import { projectRunContext } from "../../contexts/project-run.js";
import { ProjectRun } from "../../state/types.js";
import { SignalWatcher } from "@lit-labs/signals";
import { themeContext } from "../shared/contexts/theme.js";
import { UITheme } from "../shared/theme/theme.js";
import { theme as uiTheme } from "./theme/light.js";
import { appScreenToParticles } from "../shared/utils/app-screen-to-particles.js";
import { type } from "../../styles/host/type.js";

function keyFromGraphUrl(url: string) {
  return `cw-${url.replace(/\W/gi, "-")}`;
}

@customElement("app-basic")
export class Template extends SignalWatcher(LitElement) implements AppTemplate {
  @property({ type: Object })
  accessor options: AppTemplateOptions = {
    title: "Untitled App",
    mode: "light",
    splashImage: false,
  };

  @provide({ context: themeContext })
  accessor theme: UITheme = uiTheme;

  @consume({ context: projectRunContext, subscribe: true })
  accessor run: ProjectRun | null = null;

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor showGDrive = false;

  @property()
  accessor showDisclaimer = false;

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

  @consume({ context: boardServerContext, subscribe: true })
  accessor boardServer: BoardServer | undefined;

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
    buttonStyles,
    type,
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
          --font-family: var(
            --bb-font-family,
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif
          );
          --font-family-flex: var(
            --bb-font-family-flex,
            "Helvetica Neue",
            Helvetica,
            Arial,
            sans-serif
          );
          --font-family-mono: var(
            --bb-font-family-mono,
            "Courier New",
            Courier,
            monospace
          );
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
          display: grid;
          grid-template-rows: minmax(0, 1fr) max-content;
          width: 100%;
          height: 100%;
          margin: 0;
        }

        & #disclaimer {
          position: absolute;
          left: 0;
          bottom: 0px;
          width: 100%;
          margin: 0;
          font: 500 10px / 1 var(--bb-font-family);
          color: var(--n-50, var(--bb-neutral-800));
          text-align: center;
          padding: var(--bb-grid-size) var(--bb-grid-size) var(--bb-grid-size-2)
            var(--bb-grid-size);
          background: var(--s-90, var(--neutral-50, transparent));
        }

        & #content-warning {
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
            flex: 1;
            flex-direction: column;
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
              margin-top: 20%;

              &::before {
                max-width: 320px;
                background-clip: initial;
                background-size: contain;
              }
            }

            & h1 {
              background: var(--background-color, none);
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

            &::after {
              content: "";
              display: block;
              height: var(--input-clearance);
              width: 100%;
              flex: 0 0 auto;
            }

            & ui-basic-list,
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
              margin: 0 auto;
              width: 100%;
              max-width: 840px;
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
                  color: var(--e-30);
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

          & bb-floating-input {
            position: absolute;
            left: 50%;
            bottom: var(--bb-grid-size-6);
            translate: -50% 0;
            --container-margin: 0 var(--bb-grid-size-6);
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
                align-items: flex-end;

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
                    --background-color: var(--p-80);
                    --text-color: var(--p-15);
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
                max-height: 100cqh;
                aspect-ratio: initial;
              }

              &.default {
                margin-top: 0;

                &::before {
                  max-width: initial;
                  background-size: initial;
                }
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

      #save-results-button-container {
        display: flex;
        #save-results-button {
          flex: 1;
          margin: var(--bb-grid-size-4);
          border-color: var(--bb-neutral-400);
        }
      }
    `,
    Mode,
    Animations,
  ];

  #renderControls() {
    return html`<bb-app-header
      .progress=${this.run?.progress}
      .replayActive=${true}
      .menuActive=${true}
      .appTitle=${this.graph?.title}
    ></bb-app-header>`;
  }

  #renderActivity() {
    if (!this.run) return nothing;

    let activityContents:
      | HTMLTemplateResult
      | Array<HTMLTemplateResult | symbol>
      | symbol = nothing;
    let status: HTMLTemplateResult | symbol = nothing;

    const errors = this.run.errors;
    if (errors.size > 0) {
      activityContents = html`
        ${Array.from(errors.values()).map((error) => {
          return html`<details class="error">
            <summary>
              <h1>We are sorry, but there was a problem with this flow.</h1>
              <p>Tap for more details</p>
            </summary>
            <div>
              <p>${error.message}</p>
            </div>
          </details>`;
        })};
      `;
    } else {
      const current = this.run.app.current;
      if (!current) return nothing;

      if (this.run.status === "running") {
        status = html`<div id="status">
          <span class="g-icon"></span>
          ${this.run.app.current?.title}
        </div>`;
      }

      if (current.last) {
        if (new URLSearchParams(location.search).get("particles")) {
          const list = appScreenToParticles(current.last);
          activityContents = html` <ui-basic-list
            class=${classMap(this.theme.components.list)}
            .list=${list}
            .orientation=${list?.presentation.orientation}
          ></ui-basic-list>`;
        } else {
          activityContents = html`<bb-multi-output
            .showAsStatus=${current.type === "input"}
            .outputs=${current.last.output}
          ></bb-multi-output>`;
        }
      }
    }

    return html`<div id="activity">${[activityContents, status]}</div>`;
  }

  #renderSaveResultsButton() {
    if (!this.run?.finalOutput) {
      return nothing;
    }
    // TODO(aomarks) Add share button.
    return html`
      <div id="save-results-button-container">
        <button
          id="save-results-button"
          class="bb-button-outlined"
          @click=${this.#onClickSaveResults}
        >
          <span class="g-icon filled">file_save</span>
          Save results
        </button>
      </div>
    `;
  }

  async #onClickSaveResults() {
    if (!this.run) {
      console.error(`No project run`);
      return;
    }
    // Clone because we are going to inline content below.
    const finalOutputValues = structuredClone(this.run.finalOutput);
    if (!finalOutputValues) {
      return;
    }
    const graphUrl = this.graph?.url;
    if (!graphUrl) {
      console.error(`No graph url`);
      return;
    }
    const boardServer = this.boardServer;
    if (!boardServer) {
      console.error(`No board server`);
      return;
    }
    if (!(boardServer instanceof GoogleDriveBoardServer)) {
      console.error(`Board server was not Google Drive`);
      return;
    }

    // Inline all content.
    await Promise.all(
      Object.entries(finalOutputValues).map(async ([key, value]) => {
        if (!isLLMContentArray(value)) {
          return;
        }

        // Transform any inline data parts.
        const inlined = await transformDataParts(
          new URL(graphUrl),
          value,
          "inline",
          boardServer.dataPartTransformer(new URL(graphUrl))
        );
        if (!ok(inlined)) {
          console.error(`Error inlining results content for ${key}`, inlined);
          return;
        }

        // Also check for blobs inside of HTML, and inline those too.
        for (const content of inlined) {
          for (const part of content.parts) {
            if (
              "inlineData" in part &&
              part.inlineData.mimeType === "text/html" &&
              part.inlineData.data
            ) {
              const html = part.inlineData.data;
              part.inlineData.data = await inlineHtmlBlobUrls(html);
            }
          }
        }

        finalOutputValues[key] = inlined as NodeValue;
      })
    );

    this.dispatchEvent(
      new ToastEvent(`Saving results to your Google Drive`, ToastType.PENDING)
    );
    let resultsFileId: string;
    try {
      const result = await boardServer.ops.writeRunResults({
        graphUrl,
        finalOutputValues,
      });
      resultsFileId = result.id;
    } catch (error) {
      console.log(error);
      this.dispatchEvent(
        new ToastEvent(
          `Error saving results to your Google Drive`,
          ToastType.ERROR
        )
      );
      return;
    }

    this.dispatchEvent(
      new ToastEvent(
        `Publishing results from your Google Drive`,
        ToastType.PENDING
      )
    );
    try {
      await boardServer.ops.publishFile(resultsFileId);
    } catch (error) {
      console.log(error);
      this.dispatchEvent(
        new ToastEvent(
          `Error publishing results from your Google Drive`,
          ToastType.ERROR
        )
      );
      return;
    }

    const shareUrl = new URL(
      `/app/${encodeURIComponent(graphUrl)}`,
      document.location.origin
    );
    shareUrl.searchParams.set("results", resultsFileId);
    navigator.clipboard.writeText(shareUrl.href);
    this.dispatchEvent(
      new ToastEvent(`Share link copied`, ToastType.INFORMATION)
    );
  }

  #renderInput() {
    const input = this.run?.input;
    if (!input) {
      this.style.setProperty("--input-clearance", `0px`);

      return nothing;
    }

    const PADDING = 24;
    return html`<bb-floating-input
      .schema=${input.schema}
      .showDisclaimer=${this.showDisclaimer}
      @bbresize=${(evt: ResizeEvent) => {
        this.style.setProperty(
          "--input-clearance",
          `${evt.contentRect.height + PADDING}px`
        );
      }}
    ></bb-floating-input>`;
  }

  render() {
    const classes: Record<string, boolean> = {
      "app-template": true,
      [this.options.mode]: true,
    };

    if (!this.run) {
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
    if (typeof this.options.splashImage === "string") {
      styles["--splash-image"] = this.options.splashImage;
    }

    if (
      typeof this.options.splashImage === "boolean" &&
      this.options.splashImage
    ) {
      if (!this.run || this.run.status === "stopped") {
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
            class="w-500 round sans-flex md-display-small"
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
            class="w-500 round sans-flex md-title-medium"
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
                    ?disabled=${!this.run.runnable}
                    @click=${() => {
                      ActionTracker.runApp(this.graph?.url, "app_preview");
                      this.dispatchEvent(new RunEvent());
                    }}
                  >
                    <span class="g-icon"></span>Start
                  </button>`
                : html`<button
                    id="sign-in"
                    ?disabled=${!this.run.runnable}
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

    let content: NonNullable<unknown>;
    if (this.run.app.state === "splash") {
      content = splashScreen;
    } else {
      content = [
        this.#renderControls(),
        this.#renderActivity(),
        this.#renderSaveResultsButton(),
        this.#renderInput(),
        this.showDisclaimer
          ? html`<p id="disclaimer">${Strings.from("LABEL_DISCLAIMER")}</p>`
          : nothing,
      ];
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
      <div id="content">${content}</div>
      ${this.showContentWarning
        ? html`<div id="content-warning">
            <div class="message">
              This content was created by another person. It may be inaccurate
              or unsafe.
              <a href="https://support.google.com/legal/answer/3110420?hl=en"
                >Report unsafe content</a
              >
              &middot; <a href="/policy">Privacy & Terms</a>
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
    </section>`;
  }
}

async function inlineHtmlBlobUrls(html: string): Promise<string> {
  const blobUrls = findBlobUrlsInHtml(html);
  if (blobUrls.length === 0) {
    return html;
  }

  const replacements = (
    await Promise.all(
      blobUrls.map(async ({ start, end, blobId }) => {
        // Let's not trust the raw URL. We instead extract the blob ID from the
        // URL if it looks like a blob URL, and then construct a new safe blob
        // URL from scratch. This way there is no way for generated HTML to
        // trigger an unsafe fetch.
        const safeUrl = new URL(
          `/board/blobs/${encodeURIComponent(blobId)}`,
          document.location.origin
        );
        const response = await fetch(safeUrl);
        if (!response.ok) {
          console.error(
            `${response.status} error fetching blob`,
            safeUrl,
            await response.text()
          );
          return null;
        }
        const blob = await response.blob();
        const base64 = await asBase64(blob);
        const dataUrl = `data:${blob.type};base64,${base64}`;
        return { start, end, replacement: dataUrl };
      })
    )
  ).filter((replacement) => replacement != null);

  // Apply replacements reverse so that indices remain correct.
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    html = html.slice(0, start) + replacement + html.slice(end);
  }
  return html;
}

function findBlobUrlsInHtml(
  str: string
): Array<{ start: number; end: number; blobId: string }> {
  const results = [];
  const matches = str.matchAll(/https?:\/\/[^/]+\/board\/blobs\/([a-z0-9-]+)/g);
  for (const match of matches) {
    results.push({
      start: match.index,
      end: match.index + match[0].length,
      blobId: match[1],
    });
  }
  return results;
}
