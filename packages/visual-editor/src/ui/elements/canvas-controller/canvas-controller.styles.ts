/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";
import * as Styles from "../../styles/styles.js";

export const styles = [
  Styles.HostType.type,
  Styles.HostIcons.icons,
  Styles.HostColorsBase.baseColors,
  Styles.HostColorScheme.match,
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

    ui-splitter {
      overflow: hidden;
      contain: strict;
    }

    :host {
      display: grid;
      height: 100%;
      overscroll-behavior: contain;
      overflow: auto;
      color: var(--light-dark-n-10);
      contain: strict;
    }

    :host([showthemedesigner]) {
      & #graph-container::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        background: light-dark(
          oklch(from var(--n-10) l c h / 38%),
          oklch(from var(--n-0) l c h / 60%)
        );
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

    #content,
    #controls-activity,
    #create-view,
    #narrow-view {
      width: 100%;
      height: 100%;
      overflow: auto;
      position: relative;
      contain: strict;
    }

    #narrow-view {
      display: flex;
      flex-direction: column;
      padding: var(--bb-grid-size-3);

      & bb-prompt-view {
        flex: 0 0 auto;
        margin-bottom: var(--bb-grid-size-4);
        background: var(--light-dark-n-100);
      }

      & bb-step-list-view {
        flex: 1 1 auto;
        overflow: auto;
      }

      & bb-empty-state {
        position: relative;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding-top: 30vh;
      }

      & bb-flowgen-editor-input {
        flex: 0 0 auto;
        padding: var(--bb-grid-size-3) 0;
      }
    }

    #content.welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: var(--bb-grid-size-4);

      & bb-empty-state {
        position: relative;
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      & bb-flowgen-editor-input {
        flex: 0 0 auto;
        width: 100%;
        max-width: 540px;
        padding-bottom: var(--bb-grid-size-4);
      }
    }

    #create-view {
      display: grid;
      grid-template-columns: 1fr;
      &.welcome {
        grid-template-columns: none;
      }
    }

    #controls-activity {
      display: grid;
      grid-auto-rows: 1fr calc(var(--bb-grid-size) * 14);
      background: var(--light-dark-n-100);
    }

    #controls-activity-content {
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      overflow-y: scroll;
      scrollbar-gutter: stable;
    }

    #stop {
      background: var(--light-dark-n-100) var(--bb-icon-stop-circle) center
        center / 24px 24px no-repeat;
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
      border-top: 1px solid var(--light-dark-n-90);
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
      background: var(--light-dark-n-100);
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
      background: var(--light-dark-n-98);
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
      color: var(--light-dark-n-20);
    }

    .failed-to-load p {
      margin: 0;
      font-size: var(--bb-label-medium);
      font-weight: 400;
      color: var(--light-dark-n-98);
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
      background: var(--light-dark-p-98);
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
      background: light-dark(var(--n-100), var(--original-n-15));

      & #side-nav-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        height: var(--bb-grid-size-14);

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
          color: light-dark(var(--n-15), var(--n-70));
          height: 32px;
          border: none;
          margin: 0 var(--bb-grid-size-2);
          padding: 0 var(--bb-grid-size-3);
          position: relative;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.2s cubic-bezier(0, 0, 0.3, 1),
            color 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &[disabled] {
            color: light-dark(var(--n-15), var(--n-10));
            background: light-dark(var(--n-98), var(--n-80));
          }

          &[disabled] {
            cursor: auto;
          }

          &.invisible {
            opacity: 0.4;
            pointer-events: none;
          }
        }

        &.showing-preview {
          background: light-dark(var(--s-90), var(--p-30));
          border-bottom: 1px solid light-darK(var(--s-70), var(--p-50));

          & button {
            color: var(--p-15);

            &:hover,
            &[disabled] {
              background: light-dark(var(--p-98), var(--p-80));
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
        color: var(--light-dark-n-40);
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
          background: var(--light-dark-n-98);
        }
        &#close-edit-history:hover {
          color: var(--light-dark-n-10);
        }
      }
    }

    bb-edit-history-overlay {
      z-index: 3;
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
      border-bottom: 1px solid var(--light-dark-n-90);
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
      background-color: var(--light-dark-n-98);
      opacity: 1;
    }

    #section-nav {
      height: var(--bb-grid-size-14);
      border-bottom: 1px solid var(--light-dark-n-90);
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
        color: var(--light-dark-n-10);

        &[disabled] {
          opacity: 1;
          color: var(--light-dark-p-50);

          &::after {
            content: "";
            position: absolute;
            height: 3px;
            width: 100%;
            bottom: 0;
            left: 0;
            border-radius: var(--bb-grid-size) var(--bb-grid-size) 0 0;
            background: var(--light-dark-p-50);
          }
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover {
            color: var(--light-dark-p-30);
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
      color: var(--light-dark-n-100);
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
      background: var(--light-dark-n-100);
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
      background: var(--light-dark-n-100) var(--bb-icon-arrow-back) 6px center /
        20px 20px no-repeat;
      border: 1px solid var(--light-dark-n-98);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--light-dark-n-40);
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
        background-color: var(--light-dark-n-98);
        color: var(--light-dark-n-10);
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
