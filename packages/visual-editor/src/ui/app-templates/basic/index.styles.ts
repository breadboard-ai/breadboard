/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";
import Mode from "../shared/styles/icons.js";
import Animations from "../shared/styles/animations.js";
import * as Styles from "../../styles/styles.js";
import { buttonStyles } from "../../styles/button.js";

export const styles: CSSResultGroup = [
  Styles.HostIcons.icons,
  Styles.HostType.type,
  buttonStyles,
  css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    @keyframes glide {
      from {
        background-position: bottom right;
      }

      to {
        background-position: top left;
      }
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
      --drive-min-width: 280px;

      /**
           * Added so that any fixed position overlays are relative to this
           * scope rather than any containing document.
           */
      transform: translateX(0);
    }

    /** General styles */

    :host([hasrenderedsplash]) {
      .app-template {
        & #content {
          & #splash {
            animation: none;
          }
        }
      }
    }

    :host([isrefreshingapptheme]) {
      .app-template #content #input #run .g-icon::before {
        content: "progress_activity";
        display: inline-block;
        animation: rotate 1s linear infinite;
      }
    }

    .app-template {
      --custom-color-text: light-dark(var(--p-25), var(--p-80));
      --custom-color-header: light-dark(var(--n-5), var(--n-95));
      --custom-color-button: light-dark(var(--n-100), var(--n-0));

      background: light-dark(var(--s-90), var(--p-30));
      color: light-dark(var(--p-25), var(--p-80));
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
        color: light-dark(var(--s-30), var(--p-80));
        text-align: center;
        padding: var(--bb-grid-size) var(--bb-grid-size) var(--bb-grid-size-2)
          var(--bb-grid-size);
        background: light-dark(var(--s-90), var(--p-30));
        max-width: 80%;
        translate: -50% 0;
      }

      & #content-warning {
        border-top: 1px solid var(--light-dark-n-100);
        display: flex;
        justify-content: space-between;
        background: var(--light-dark-n-98);
        padding: var(--bb-grid-size-6) var(--bb-grid-size-3);
        min-height: var(--bb-grid-size-11);
        color: var(--light-dark-n-10);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);

        & .message {
          margin-right: var(--bb-grid-size-16);

          & a {
            font-weight: 500;
            color: var(--light-dark-p-50);
            text-decoration: none;
          }
        }

        & .dismiss {
          color: var(--light-dark-p-40);
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
              color: var(--light-dark-p-40);
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
          color: var(--text-color, var(--light-dark-n-10));

          & h1 {
            font: 500 var(--font-style, normal) var(--bb-title-large) /
              var(--bb-title-line-height-large)
              var(--font-family, var(--bb-font-family));
            color: var(--light-dark-s-80, var(--light-dark-n-10));
            margin: 0 0 var(--bb-grid-size) 0;
          }

          & p {
            color: var(--text-color, var(--light-dark-n-40));
            margin: 0 0 var(--bb-grid-size-2) 0;
          }
        }

        & #splash {
          display: flex;
          flex: 1;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1);
          overflow: scroll;
          scrollbar-width: none;
          position: relative;

          #splash-content-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
          }

          &::before {
            --light: oklch(from var(--p-60) l c h / 20%);
            --dark: oklch(from var(--p-60) l c h / 60%);

            content: "";
            width: var(--splash-width, 100%);
            background: linear-gradient(
              123deg,
              var(--light) 0%,
              var(--dark) 25%,
              var(--light) 50%,
              var(--dark) 75%,
              var(--light) 100%
            );
            background-size: 200% 200%;
            padding: var(--bb-grid-size-3);
            border-radius: var(--bb-grid-size-5);
            box-sizing: border-box;
            background-clip: content-box;
            flex: 1;
            max-width: 600px;
            max-height: calc(55cqh - 54px);
            animation: glide 2150ms linear infinite;
          }

          &:not(.retrieving-splash) {
            &::before {
              animation: fadeIn 0.7s cubic-bezier(0.6, 0, 0.3, 1) 1 forwards;
              background: var(--splash-image, var(--bb-logo)) center center /
                var(--splash-fill, cover) no-repeat;
              background-clip: content-box;
            }

            &::after {
              display: none;
            }
          }

          &.default {
            flex: 1;

            &::before {
              flex: 1;
              max-width: 220px;
              background-clip: initial;
              background-size: contain;
            }
          }

          & h1 {
            background: var(--background-color, none);
            color: light-dark(var(--p-25), var(--p-80));
            margin: var(--bb-grid-size-10) 0 var(--bb-grid-size-4) 0;
            flex: 0 0 auto;
            max-width: 80%;
            width: max-content;
            text-align: center;
          }

          & p {
            flex: 0 0 auto;
            font: 400 var(--font-style) 16px / 20px var(--font-family);
            color: light-dark(var(--p-25), var(--p-80));
            margin: 0 0 var(--bb-grid-size-3);

            max-width: 65%;
            width: max-content;
            text-align: center;

            max-height: 5lh;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          & h1,
          & p {
            transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);

            &.invisible {
              opacity: 0;
            }
          }
        }

        & #controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 76px;
          border-bottom: 1px solid
            var(--light-dark-s-70, var(--light-dark-n-100));
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
            background: var(--light-dark-p-98);
            color: var(--light-dark-p-20);
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
            background: var(--light-dark-p-70);
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
              background: var(--light-dark-p-40);
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
            color: var(--light-dark-p-15, var(--light-dark-n-20));

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

        & #progress,
        & #activity {
          flex: 1;
          overflow: auto;
          container-type: size;
          flex-direction: column;
          padding: var(--bb-grid-size-3);
          display: flex;

          &:has(.thoughts) {
            align-items: center;
            justify-content: center;
          }

          &:not(:has(.thoughts)) {
            &::before {
              flex: 1;
              content: "";
            }
          }

          &::after {
            content: "";
            display: block;
            height: var(--input-clearance);
            width: 100%;
            flex: 0 0 auto;
          }

          & gulf-root,
          & particle-ui-list,
          & bb-multi-output,
          & #surfaces {
            --output-value-padding-x: var(--bb-grid-size-4);
            --output-value-padding-y: var(--bb-grid-size-4);
            --output-border-radius: var(--bb-grid-size-4);
            --output-font: 400 var(--font-style, normal) var(--bb-title-large) /
              var(--bb-title-line-height-large)
              var(--font-family, var(--bb-font-family));
            --output-string-width: 95%;
            --output-string-margin-bottom-y: var(--bb-grid-size-3);
            --output-margin-bottom: var(--bb-grid-size-4);
            --output-background-color: var(--light-dark-n-100);
            --multi-output-value-padding-x: 0;
            flex: 1 0 auto;
            margin: 0 auto;
            width: calc(100% - var(--bb-grid-size-12));
            max-width: 960px;
            box-sizing: border-box;
            animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) forwards;
          }

          & .thoughts {
            display: flex;
            flex-direction: column;
            align-items: center;

            & > * {
              margin-left: 0;
              margin-right: 0;
            }

            bb-shape-morph {
              width: 50cqw;
              height: 50cqw;
              max-width: 240px;
              max-height: 240px;
              aspect-ratio: 1;
              margin-bottom: var(--bb-grid-size-10);
            }

            & h1 {
              margin: 0 0 var(--bb-grid-size-4) 0;
            }

            & .thought-content {
              display: flex;
              flex-direction: column;
              align-items: center;
              min-height: 10svh;

              & ul {
                list-style: none;
                padding: 0;
                max-width: 80%;
                text-align: center;

                & li {
                  display: inline;

                  &::after {
                    content: ", ";
                  }

                  &:last-of-type::after {
                    content: "";
                  }
                }
              }

              & p {
                margin: 0 0 var(--bb-grid-size-2) 0;
              }
            }
          }

          & .empty-state {
            flex: 1;
            color: var(--light-dark-n-50);
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
            color: var(--light-dark-n-0);

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
            color: var(--text-color, var(--light-dark-n-10));
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
              color: var(--light-dark-s-80, var(--light-dark-n-10));
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
            background: var(--light-dark-p-20);
            color: var(--light-dark-p-100);
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
              color: oklch(
                from var(--light-dark-p-15) l c h / calc(alpha - 0.4)
              );
            }
          }
        }

        & #progress {
          display: none;

          &.active {
            display: flex;
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

          & #run-container {
            position: relative;
          }

          & #sign-in,
          & #run {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 200px;
            height: var(--bb-grid-size-12);
            background: light-dark(var(--p-15), var(--p-90));
            color: light-dark(var(--p-100), var(--p-30));
            border-radius: var(--bb-grid-size-12);
            font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
            padding: 0;
            opacity: 0.85;
            border: none;

            --transition-properties: opacity;
            transition: var(--transition);

            &.invisible {
              opacity: 0;
              pointer-events: none;
            }

            &.running {
              background: var(--light-dark-p-50) url(/images/progress-ui.svg)
                8px center / 16px 16px no-repeat;
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
              background: var(--light-dark-s-95);
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
                --background-color: var(--light-dark-p-80);
                --text-color: var(--light-dark-p-15);
              }

              & .controls {
                margin-left: var(--bb-grid-size-2);
                display: flex;
                align-items: flex-end;

                bb-speech-to-text {
                  --background-color: var(--light-dark-p-80);
                  --text-color: var(--light-dark-p-15);
                  --active-color: linear-gradient(
                    var(--light-dark-p-40),
                    transparent
                  );
                }

                & #continue {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-left: var(--bb-grid-size-2);
                  background: var(--light-dark-p-80);
                  color: var(--light-dark-p-15);
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

      & #consent {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1);
        overflow: scroll;
        scrollbar-width: none;
        padding-top: 10%;

        &::before {
          content: "";
          width: 50%;
          background: var(--bb-logo) center center / contain no-repeat;
          padding: var(--bb-grid-size-3);
          background-clip: content-box;
          border-radius: var(--bb-grid-size-5);
          box-sizing: border-box;
          flex: 1;
          max-height: calc(45cqh - 54px);
        }

        #consent-content-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        & h1 {
          background: var(--background-color, none);
          color: var(--light-dark-p-25, var(--light-dark-n-40));
          margin: var(--bb-grid-size-10) 0 var(--bb-grid-size-4) 0;
          flex: 0 0 auto;
          max-width: 80%;
          width: max-content;
          text-align: center;
          font: 500 var(--font-style, normal) var(--bb-title-large) /
            var(--bb-title-line-height-large)
            var(--font-family, var(--bb-font-family));
        }

        & p {
          flex: 0 0 auto;
          font: 400 var(--font-style) 16px / 20px var(--font-family);
          color: var(--light-dark-p-25, var(--light-dark-n-40));
          margin: 0 0 var(--bb-grid-size-3);

          max-width: 65%;
          width: max-content;
          text-align: center;
        }

        & button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 200px;
          height: var(--bb-grid-size-12);
          background: light-dark(var(--p-15), var(--p-90));
          color: light-dark(var(--p-100), var(--p-30));
          border-radius: var(--bb-grid-size-12);
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          padding: 0;
          opacity: 0.85;
          border: none;
          cursor: pointer;
          margin-top: var(--bb-grid-size-4);

          --transition-properties: opacity;
          transition: var(--transition);

          &:hover,
          &:focus {
            opacity: 1;
          }

          & .g-icon {
            margin-right: var(--bb-grid-size-2);
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
        border-color: var(--light-dark-n-80);
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        opacity: 0.7;
        color: var(--light-dark-n-0);

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
