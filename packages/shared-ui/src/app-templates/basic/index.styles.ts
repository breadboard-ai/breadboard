/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";
import Mode from "../shared/styles/icons.js";
import Animations from "../shared/styles/animations.js";
import { icons } from "../../styles/icons";
import { buttonStyles } from "../../styles/button.js";
import { type } from "../../styles/host/type.js";

export const styles: CSSResultGroup = [
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

    .app-template {
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

    .app-template {
      background: var(--s-90, var(--background-color));
      color: var(--p-25, var(--text-color));
      display: grid;
      grid-template-rows: minmax(0, 1fr) max-content;
      width: 100%;
      height: 100%;
      margin: 0;

      & #disclaimer {
        position: absolute;
        left: 50%;
        bottom: 0px;
        width: 100%;
        margin: 0;
        font: 500 14px / 1.3 var(--bb-font-family);
        color: var(--n-50, var(--bb-neutral-800));
        text-align: center;
        padding: var(--bb-grid-size) var(--bb-grid-size) var(--bb-grid-size-2)
          var(--bb-grid-size);
        background: var(--s-90, var(--neutral-50, transparent));
        max-width: 80%;
        translate: -50% 0;
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
          width: 100cqw;
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
          width: 100cqw;
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
          overflow: scroll;
          scrollbar-width: none;

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
            flex: 1;
            max-height: calc(45cqh - 54px);
          }

          &.default {
            flex: 1;
            padding-top: 10%;

            &::before {
              flex: 1;
              max-width: 220px;
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

          & particle-ui-list,
          & bb-multi-output {
            --output-value-padding-x: var(--bb-grid-size-4);
            --output-value-padding-y: var(--bb-grid-size-4);
            --output-border-radius: var(--bb-grid-size-4);
            --output-font: 400 var(--font-style, normal) var(--bb-title-large) /
              var(--bb-title-line-height-large)
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

          & .html-view {
            width: 100%;
            height: 100cqh;
          }

          & .empty-state {
            flex: 1;
            color: var(--n-50);
            text-align: center;
          }

          & .error {
            flex: 1 0 auto;
            display: flex;
            flex-direction: column;
            width: 80%;
            margin: 0 auto;
            max-width: 270px;
            text-align: center;
            color: var(--n-0);

            & summary {
              list-style: none;
              cursor: pointer;

              & h1 {
                margin: 0 0 var(--bb-grid-size-2) 0;
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
            font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
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
      .app-template {
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
      padding: var(--bb-grid-size-4);
      display: flex;

      & #save-results-button,
      #export-output-button {
        display: flex;
        align-items: center;
        background: none;
        border: none;
        padding: 0 var(--bb-grid-size-4) 0 0;
        border-color: var(--bb-neutral-400);
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        opacity: 0.7;
        color: var(--n-0);

        &: [disabled] {
          opacity: 0.5;
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
    }
  `,
  Mode,
  Animations,
];
