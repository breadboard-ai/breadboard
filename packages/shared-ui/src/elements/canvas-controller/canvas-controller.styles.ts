/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";

export const styles = [
  colorsLight,
  type,
  css`
    * {
      box-sizing: border-box;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacuty: 1;
      }
    }

    :host {
      display: grid;
      height: 100%;
      overscroll-behavior: contain;
      overflow: auto;
      color: var(--bb-neutral-900);
      contain: strict;
    }

    :host([showthemedesigner]) {
      & #graph-container::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        background: oklch(from var(--bb-neutral-900) l c h / 33%);
        width: 100%;
        height: 100%;
        z-index: 5;
        animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
      }

      & bb-app-theme-creator {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        right: var(--bb-grid-size-3);
        z-index: 6;
        height: calc(100% - var(--bb-grid-size-6));
        width: 25svw;
        min-width: 280px;
        max-width: 360px;
        animation: fadeIn 0.4s cubic-bezier(0, 0, 0.3, 1) 0.1s backwards;
      }
    }

    #controls-activity,
    #create-view {
      width: 100%;
      height: 100%;
      overflow: auto;
      position: relative;
      contain: strict;
    }

    #create-view {
      display: grid;
      grid-template-columns: 1fr;
      &.welcome {
        grid-template-columns: none;
      }

      & #create-view-popout {
        position: absolute;
        top: var(--bb-grid-size-3);
        right: var(--bb-grid-size-3);
        width: 50vw;
        height: var(--bb-grid-size-10);
        max-width: 258px;
        z-index: 10;
        display: grid;
        grid-template-rows: var(--bb-grid-size-10);
        border-radius: var(--bb-grid-size-16);
        overflow: hidden;
        background: var(--bb-neutral-0);
        box-shadow: var(--bb-elevation-1);

        &.wide {
          max-width: 400px;
        }

        & #create-view-popout-content {
          overflow: hidden;
          display: none;
        }

        & #create-view-popout-nav {
          background: var(--bb-neutral-0);
          position: relative;
          user-select: none;

          & #sections {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            height: 100%;
            padding: 0 var(--bb-grid-size);

            & .label {
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              flex: 1;
              text-align: right;
              padding-right: var(--bb-grid-size-8);
            }

            & button {
              height: 100%;
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              margin: 0 var(--bb-grid-size-2) 0 0;
              padding: 0 var(--bb-grid-size);
              color: var(--bb-neutral-700);
              background: none;
              border: none;
              position: relative;

              &[disabled] {
                color: var(--bb-neutral-900);

                &::after {
                  content: "";
                  display: block;
                  position: absolute;
                  bottom: 0;
                  left: 0;
                  height: 3px;
                  border-radius: 4px 4px 0 0;
                  background: var(--bb-ui-500);
                }
              }
            }

            & #run {
              min-width: 76px;
              height: var(--bb-grid-size-8);
              background: var(--bb-ui-500) var(--bb-icon-play-filled-inverted)
                8px center / 20px 20px no-repeat;
              color: #fff;
              border-radius: 20px;
              border: none;
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-9);
              opacity: 0.3;

              &.running {
                background: var(--bb-ui-500)
                  url(/images/progress-ui-inverted.svg) 8px center / 16px 16px
                  no-repeat;
              }

              &:not([disabled]) {
                cursor: pointer;
                opacity: 1;
              }
            }
          }

          & #create-view-popout-toggle {
            cursor: pointer;
            position: absolute;
            border: none;
            background: var(--bb-icon-expand-content) center center / 20px 20px
              no-repeat;
            width: 20px;
            height: 20px;
            font-size: 0;
            right: var(--bb-grid-size-3);
            top: 50%;
            translate: 0 -50%;
            opacity: 0.5;
            transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:hover,
            &:focus {
              opacity: 1;
            }
          }
        }

        & #input {
          --user-input-padding-left: 0;

          border-top: 1px solid var(--bb-neutral-300);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          display: grid;
          grid-template-columns: 1fr 32px;
          column-gap: var(--bb-grid-size-2);
          max-height: 385px;
          display: none;

          & .preamble {
            grid-column: 1 / 3;

            & h2 {
              color: var(--bb-neutral-900);
              margin: 0 0 var(--bb-grid-size-2) 0;
              font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);
            }
          }

          & .no-input-needed {
            display: flex;
            box-sizing: border-box;
            align-items: center;
            height: var(--bb-grid-size-9);
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);

            &::before {
              content: "";
              display: block;
              width: 22px;
              height: 22px;
              border: 1px solid var(--bb-neutral-600);
              margin-right: var(--bb-grid-size-2);
              background: var(--bb-neutral-0) var(--bb-icon-add) center center /
                20px 20px no-repeat;
              opacity: 0.4;
              border-radius: 50%;
            }

            &::after {
              display: flex;
              align-items: center;
              height: 100%;
              flex: 1;
              content: "No input needed";
              border-radius: var(--bb-grid-size-16);
              background: var(--bb-neutral-100);
              border: 1px solid var(--bb-neutral-400);
              color: var(--bb-neutral-900);
              padding: 0 var(--bb-grid-size-4);
              opacity: 0.4;
            }
          }

          & .continue-button {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--bb-ui-500) var(--bb-icon-send-inverted) center
              center / 18px 18px no-repeat;
            font-size: 0;
            border: none;
            filter: grayscale(1);
            opacity: 0.6;
            align-self: end;
            margin-bottom: 2px;

            &:not([disabled]) {
              cursor: pointer;
              filter: none;

              &:hover,
              &:focus {
                opacity: 1;
              }
            }
          }
        }

        &.expanded {
          max-width: 450px;
          grid-template-rows: 56px 1fr min-content;
          height: 100%;
          top: 0;
          right: 0;
          border-radius: 0;
          border-left: 1px solid var(--bb-neutral-300);
          box-shadow: var(--bb-elevation-5);

          & #create-view-popout-content {
            display: block;
            overflow-y: scroll;
            scrollbar-width: none;
          }

          & #create-view-popout-nav {
            border-bottom: 1px solid var(--bb-neutral-300);

            & #sections {
              padding-left: var(--bb-grid-size-4);
            }

            & #create-view-popout-toggle {
              background: var(--bb-icon-collapse-content) center center / 20px
                20px no-repeat;
            }
          }

          & #input {
            display: grid;
          }
        }
      }
    }

    #deploy-view {
      width: 100%;
      height: 100%;
      overflow: auto;
      position: absolute;
      top: 0;
      left: 0;
      background: var(--bb-neutral-0);
      z-index: 2;

      & #deploy-view-sidenav {
        background: var(--bb-neutral-0);
        border-right: 1px solid var(--bb-neutral-300);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-5);
        overflow: hidden;

        & .deploy-option {
          padding-left: var(--bb-grid-size-7);
          margin-bottom: var(--bb-grid-size-4);

          & select {
            display: block;
            border-radius: var(--bb-grid-size);
            background: var(--bb-neutral-0);
            padding: var(--bb-grid-size-2);
            border: 1px solid var(--bb-neutral-300);

            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
          }

          & label {
            color: var(--bb-neutral-900);
            font: 400 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
          }

          & p {
            font: 400 var(--bb-body-x-small) /
              var(--bb-body-line-height-x-small) var(--bb-font-family);
            margin: var(--bb-grid-size) 0;
          }

          &.layout {
            background: var(--bb-icon-style) 0 0 / 20px 20px no-repeat;
          }

          &.theme {
            background: var(--bb-icon-palette) 0 0 / 20px 20px no-repeat;
          }

          &.public {
            background: var(--bb-icon-visibility) 0 0 / 20px 20px no-repeat;

            & #visibility {
              display: none;

              & + #visibility-status {
                background: var(--bb-neutral-300);
                width: 42px;
                height: 24px;
                border-radius: var(--bb-grid-size-12);
                display: block;
                font-size: 0;
                position: relative;

                &::before,
                &::after {
                  content: "";
                  position: absolute;
                  left: 4px;
                  top: 4px;
                  width: 16px;
                  height: 16px;
                  background: var(--bb-neutral-0);
                  border-radius: 50%;
                  transition: transform 0.2s cubic-bezier(0, 0, 0.3, 1);
                }

                &::after {
                  background: var(--bb-icon-check) center center / 16px 16px
                    no-repeat;
                  transition:
                    transform 0.2s cubic-bezier(0, 0, 0.3, 1),
                    opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
                  opacity: 0;
                }
              }

              &:checked + #visibility-status {
                background: var(--bb-ui-500);

                &::before,
                &::after {
                  transform: translateX(18px);
                }

                &::after {
                  opacity: 1;
                }
              }
            }
          }

          &.share {
            background: var(--bb-icon-share) 0 0 / 20px 20px no-repeat;
          }

          & .deploy-share-url {
            display: grid;
            grid-template-columns: 1fr var(--bb-grid-size-5);
            column-gap: var(--bb-grid-size-2);

            & .url {
              font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);
              max-width: 200px;
              overflow: hidden;
              padding: var(--bb-grid-size-2);
              border: 1px solid var(--bb-neutral-300);
              border-radius: var(--bb-grid-size);
            }

            & button {
              width: 20px;
              height: 20px;
              font-size: 0;
              background: transparent var(--bb-icon-copy-to-clipboard) center
                center / 20px 20px no-repeat;
              border: none;
            }
          }
        }
      }

      & bb-app-controller {
        position: relative;
        width: 100%;
        height: 100%;
        z-index: 2;
      }

      & #no-items {
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        color: var(--bb-neutral-700);
        padding: var(--bb-grid-size-4);
      }
    }

    #controls-activity {
      display: grid;
      grid-auto-rows: 1fr calc(var(--bb-grid-size) * 14);
      background: var(--bb-neutral-0);
    }

    #controls-activity-content {
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      overflow-y: scroll;
      scrollbar-gutter: stable;
    }

    #stop {
      background: var(--bb-neutral-0) var(--bb-icon-stop-circle) center center /
        24px 24px no-repeat;
      height: 32px;
      width: 32px;
      font-size: 0;
      border: none;
      cursor: pointer;
    }

    #stop[disabled] {
      opacity: 0.4;
      cursor: auto;
    }

    #controls {
      border-top: 1px solid var(--bb-neutral-300);
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-label-large);
    }

    #controls {
      display: flex;
    }

    #value {
      padding: 0 calc(var(--bb-grid-size) * 2);
      display: flex;
      background: #d1cbff;
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      align-items: center;
      justify-content: center;
      margin-left: calc(var(--bb-grid-size) * 2);
      margin-top: calc(var(--bb-grid-size) * -0.5);
    }

    #max {
      font-size: var(--bb-text-pico);
      font-weight: normal;
    }

    #details {
      display: block;
      position: absolute;
      z-index: 100;
      background: var(--bb-neutral-0);
      padding: 10px;
      width: 90%;
      max-width: 35vw;
      height: calc(100svh - 220px);
      top: 90px;
      right: 10px;
      border: 1px solid #d9d9d9;
      border-radius: calc(var(--bb-grid-size) * 2);
      overflow-y: scroll;
      box-shadow:
        0px 1px 2px rgba(0, 0, 0, 0.3),
        0px 1px 3px 1px rgba(0, 0, 0, 0.15);
    }

    #details.portrait {
      bottom: 10px;
      max-width: 55vw;
      right: auto;
      height: calc(100% - 20px);
      top: auto;
      left: 10px;
    }

    .failed-to-load {
      background: var(--bb-neutral-100);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .failed-to-load h1 {
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
      font-size: var(--bb-title-large);
      font-weight: 500;
      color: var(--bb-neutral-800);
    }

    .failed-to-load p {
      margin: 0;
      font-size: var(--bb-label-medium);
      font-weight: 400;
      color: var(--bb-neutral-500);
    }

    .failed-to-load h1,
    .failed-to-load p {
      width: 80vw;
      max-width: 320px;
      text-align: center;
    }

    bb-activity-log-lite {
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-10)
        var(--bb-grid-size-4);
    }

    bb-module-editor {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 11;
      background: var(--bb-ui-50);
    }

    #side-nav,
    #graph-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    #side-nav {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      z-index: 2;
      background: var(--n-100);

      & #side-nav-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;

        height: var(--bb-grid-size-14);

        &.showing-preview {
          background: var(--s-90, var(--bb-neutral-0));
          border-bottom: 1px solid var(--s-80, var(--bb-neutral-300));

          & button {
            color: var(--p-15, var(--bb-neutral-900));

            &:hover,
            &[disabled] {
              background: var(--s-95, var(--bb-neutral-100));
            }
          }
        }

        > div {
          display: flex;
          padding: 0 var(--bb-grid-size-5);
        }

        & button {
          display: flex;
          align-items: center;
          border-radius: var(--bb-grid-size-16);
          font-size: 12px;
          background: none;
          color: var(--n-15, var(--bb-neutral-900));
          height: 32px;
          border: none;
          margin: 0 var(--bb-grid-size-2);
          padding: 0 var(--bb-grid-size-3);
          position: relative;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &[disabled] {
            background: var(--n-95, var(--bb-neutral-100));
          }

          &[disabled] {
            cursor: auto;
          }

          &.invisible {
            opacity: 0.4;
            pointer-events: none;
          }
        }

        & #share {
          width: 20px;
          height: 20px;
          background: var(--bb-icon-share) center center / 20px 20px no-repeat;
          font-size: 0;
          margin: 0 0 var(--bb-grid-size-3) 0;
          border: none;
          opacity: 0.5;
          padding: 0;
          margin-left: var(--bb-grid-size-2);
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              opacity: 1;
            }
          }
        }
      }

      & #side-nav-content {
        height: calc(100% - var(--bb-grid-size-14));

        & bb-entity-editor {
          position: relative;
          width: 100%;
          height: 100%;
          z-index: 2;
        }
      }
    }

    #edit-history-buttons {
      display: flex;
      justify-content: space-between;
      width: 100%;
      padding: var(--bb-grid-size-3);

      > button {
        align-items: center;
        background: none;
        border-radius: var(--bb-grid-size-2);
        border: none;
        color: var(--bb-neutral-700);
        cursor: pointer;
        display: flex;
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        transition:
          background-color 100ms,
          color 100ms;

        > .g-icon {
          font-size: calc(var(--bb-label-large) + 4px);
          font-variation-settings:
            "FILL" 0,
            "wght" 600,
            "GRAD" 0,
            "opsz" 48;
          margin-right: var(--bb-grid-size);
        }

        &#toggle-edit-history:hover {
          background: var(--bb-neutral-100);
        }
        &#close-edit-history:hover {
          color: var(--bb-neutral-900);
        }
      }
    }

    bb-edit-history-panel {
      width: 100%;
      margin-top: var(--bb-grid-size-4);
      padding: 0 var(--bb-grid-size-3) var(--bb-grid-size-4)
        var(--bb-grid-size-3);
      margin-bottom: calc(var(--bb-grid-size-4) * -1);
    }

    bb-workspace-outline,
    bb-graph-renderer {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      overflow: hidden;
    }

    #splitter {
      height: 100%;
      width: 100%;
    }

    #side-nav-title {
      height: var(--bb-grid-size-11);
      margin: 0;
      display: flex;
      align-items: center;
      padding: var(--bb-grid-size-2);
      font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      border-bottom: 1px solid var(--bb-neutral-300);
      justify-content: space-between;
    }

    #create-new {
      height: var(--bb-grid-size-7);
      border: none;
      background: transparent var(--bb-icon-add-circle) var(--bb-grid-size)
        center / 20px 20px no-repeat;
      margin: 0 0 0 var(--bb-grid-size-2);
      opacity: 0.7;
      cursor: pointer;
      border-radius: var(--bb-grid-size-12);
      transition: opacity 0.1s cubic-bezier(0, 0, 0.3, 1);
      padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-7);
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
    }

    #create-new:hover,
    #create-new:focus {
      background-color: var(--bb-neutral-50);
      opacity: 1;
    }

    #section-nav {
      height: var(--bb-grid-size-14);
      border-bottom: 1px solid var(--bb-neutral-300);
      display: flex;
      align-items: flex-end;
      justify-content: center;

      & button {
        padding: var(--bb-grid-size-6) var(--bb-grid-size) var(--bb-grid-size-2)
          var(--bb-grid-size);
        border: none;
        position: relative;
        margin: 0 var(--bb-grid-size-2);
        font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family);
        color: var(--bb-neutral-900);

        &[disabled] {
          opacity: 1;
          color: var(--bb-ui-500);

          &::after {
            content: "";
            position: absolute;
            height: 3px;
            width: 100%;
            bottom: 0;
            left: 0;
            border-radius: var(--bb-grid-size) var(--bb-grid-size) 0 0;
            background: var(--bb-ui-500);
          }
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover {
            color: var(--bb-ui-700);
          }
        }
      }
    }

    #toggle-activity[data-count]::before {
      content: attr(data-count);
      position: absolute;
      top: 2px;
      right: -14px;
      width: 18px;
      height: 18px;
      background: var(--bb-input-500);
      color: var(--bb-neutral-0);
      border-radius: 50%;
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      z-index: 100;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    #board-chat-container,
    #board-activity-container,
    #history-activity-container {
      height: 100%;
      overflow: auto;
      position: relative;
      scroll-padding-bottom: 60px;
    }

    #board-activity-container {
      padding: var(--bb-grid-size-2);
    }

    bb-event-details {
      background: var(--bb-neutral-0);
      position: absolute;
      top: 0px;
      left: 0px;
      width: 100%;
      /* min-height: 100%; */
      z-index: 15;
      padding: var(--bb-grid-size-4);
      height: 100%;
      overflow: scroll;
    }

    #back-to-console {
      position: absolute;
      top: 8px;
      right: 4px;
      background: var(--bb-neutral-0) var(--bb-icon-arrow-back) 6px center /
        20px 20px no-repeat;
      border: 1px solid var(--bb-neutral-100);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-700);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-8);
      margin-right: var(--bb-grid-size-2);
      border-radius: 50px;
      cursor: pointer;
      transition:
        background-color 0.2s cubic-bezier(0, 0, 0.3, 1),
        color 0.2s cubic-bezier(0, 0, 0.3, 1);

      &:hover,
      &:focus {
        background-color: var(--bb-neutral-100);
        color: var(--bb-neutral-900);
      }
    }

    bb-console-view {
      height: 100%;
      overflow: auto;
      position: relative;
      scroll-padding-bottom: 60px;
    }

    bb-capabilities-selector,
    #history-activity-container,
    bb-app-controller,
    bb-entity-editor {
      display: none;

      &.active {
        display: block;
      }
    }

    bb-console-view:not(.active) {
      display: none;
    }
  `,
];
