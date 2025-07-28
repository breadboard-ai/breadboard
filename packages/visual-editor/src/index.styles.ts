/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

export const styles = [
  BreadboardUI.Styles.HostType.type,
  BreadboardUI.Styles.HostColors.colorsLight,
  BreadboardUI.Styles.HostIcons.icons,
  css`
    * {
      box-sizing: border-box;
    }

    :host {
      --header-height: 0;
      flex: 1 0 auto;
      display: flex;
    }

    #container {
      display: grid;
      flex: 1 0 auto;
      grid-template-rows: auto;
    }

    bb-ve-header {
      z-index: 1;
      display: none;
    }

    @media (min-width: 600px) {
      :host {
        --header-height: var(--bb-grid-size-14);
      }

      #container {
        grid-template-rows: var(--header-height) auto;
      }

      bb-ve-header {
        display: block;
      }
    }

    #status-update-chip {
      z-index: 60;
      position: fixed;
      border-radius: var(--bb-grid-size-5);
      width: 40px;
      height: 40px;
      overflow: hidden;
      bottom: 24px;
      left: 24px;
      display: flex;
      align-items: center;
      padding: 0;
      transition: width 0.2s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
      white-space: nowrap;
      border: none;

      & > * {
        pointer-events: none;
      }

      &.urgent {
        animation: bounce 3s linear infinite 1.5s;
        border: 1px solid var(--e-80);
        background: var(--e-90);
        color: var(--e-40);

        &.no-bounce {
          animation: none;
        }
      }

      &.warning {
        border: 1px solid
          oklch(from var(--ui-warning-border-color) calc(l - 0.1) c h);
        background: oklch(from var(--ui-warning-background-color) l c h);
        color: var(--ui-warning-text-color);
      }

      & .g-icon {
        flex: 0 0 auto;
        width: 38px;
        height: 20px;
      }

      &:hover {
        animation: none;
        width: 160px;
      }
    }

    bb-toast {
      z-index: 2000;
    }

    .close-board {
      font-size: 0;
      width: 24px;
      height: 24px;
      background: var(--bb-icon-close) center center no-repeat;
      background-size: 16px 16px;
      border: 2px solid transparent;
      opacity: 0.6;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      border-radius: 50%;
    }

    .close-board:not([disabled]):hover {
      transition-duration: 0.1s;
      opacity: 1;
      background-color: var(--bb-neutral-200);
      border: 2px solid var(--bb-neutral-200);
    }

    #tab-edit {
      margin: 0 var(--bb-grid-size-4);
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      font-size: 0;
      cursor: pointer;
      background: transparent var(--bb-icon-edit) center center / 20px 20px
        no-repeat;
      opacity: 0.6;
      border: none;
      transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
    }

    #tab-edit:focus,
    #tab-edit:hover {
      opacity: 1;
    }

    #new-board {
      font-size: var(--bb-text-nano);
    }

    #undo,
    #redo,
    #save-board,
    #toggle-preview,
    #toggle-settings,
    #toggle-overflow-menu {
      color: var(--bb-neutral-700);
      padding: 0 16px 0 42px;
      font-size: var(--bb-text-medium);
      margin: 0 var(--bb-grid-size-4) 0 0;
      cursor: pointer;
      background: 12px center var(--bb-icon-download);
      background-repeat: no-repeat;
      height: var(--bb-grid-size-7);
      display: flex;
      align-items: center;
      text-decoration: none;
      border-radius: 20px;
      border: none;
      flex: 0 0 auto;
    }

    #toggle-board-item {
      height: var(--bb-grid-size-7);
      border: 1px solid var(--bb-neutral-300);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border-radius: var(--bb-grid-size-16);
      margin: 0 var(--bb-grid-size-2) 0 0;
      background: var(--bb-neutral-0);
      cursor: pointer;

      &.flow {
        background: var(--bb-icon-flowchart) 8px center / 20px 20px no-repeat;
      }

      &.step {
        background: var(--bb-icon-step) 8px center / 20px 20px no-repeat;
      }

      &.code {
        background: var(--bb-icon-code) 8px center / 20px 20px no-repeat;
      }
    }

    #undo:not([disabled]):hover,
    #redo:not([disabled]):hover,
    #undo:not([disabled]):focus,
    #redo:not([disabled]):focus,
    #save-board:not([disabled]):hover,
    #toggle-preview:not([disabled]):hover,
    #toggle-settings:not([disabled]):hover,
    #toggle-overflow-menu:not([disabled]):hover,
    #save-board:not([disabled]):focus,
    #toggle-preview:not([disabled]):focus,
    #toggle-settings:not([disabled]):focus,
    #toggle-overflow-menu:not([disabled]):focus {
      background-color: rgba(0, 0, 0, 0.1);
    }

    #save-board {
      background: 12px center var(--bb-icon-save-inverted);
      background-repeat: no-repeat;
    }

    #toggle-preview {
      background: 12px center var(--bb-icon-preview);
      background-repeat: no-repeat;
    }

    #undo,
    #redo,
    #toggle-overflow-menu {
      padding: 8px;
      font-size: 0;
      margin-right: 0;
      background: center center var(--bb-icon-more-vert);
      background-repeat: no-repeat;
      width: 32px;
    }

    #undo {
      background-image: var(--bb-icon-undo);
    }

    #redo {
      background-image: var(--bb-icon-redo);
    }

    #undo[disabled],
    #redo[disabled] {
      opacity: 0.5;
    }

    #toggle-preview.active {
      background-color: var(--bb-ui-800);
    }

    #toggle-settings {
      padding: var(--bb-grid-size-2);
      width: 32px;
      margin-right: 0;
      background: var(--bb-icon-settings) center center / 20px 20px no-repeat;
      font-size: 0;
    }

    #toggle-settings.active {
      background-color: var(--bb-neutral-100);
    }

    #new-board {
      font-size: var(--bb-text-small);
      text-decoration: underline;
    }

    #new-board:active {
      color: rgb(90, 64, 119);
    }

    #save-board[disabled],
    #get-log[disabled],
    #get-board[disabled],
    #toggle-preview[disabled],
    #save-board[disabled]:hover,
    #get-log[disabled]:hover,
    #get-board[disabled]:hover,
    #toggle-preview[disabled]:hover {
      opacity: 0.5;
      background-color: rgba(0, 0, 0, 0);
      pointer-events: none;
      cursor: auto;
    }

    bb-board-list {
      grid-column: 1 / 3;
    }

    header {
      background: var(--bb-neutral-0);
      border-bottom: 1px solid var(--bb-neutral-300);
      display: block;
      color: var(--bb-neutral-700);
      z-index: 1;
      width: 100%;
      overflow: hidden;
      height: 100%;
    }

    #missing-share-dialog,
    #tos-dialog {
      max-width: 480px;
      border-radius: var(--bb-grid-size-4);
      border: none;
      padding: 0;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);

      form {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: 100%;
        max-width: 90svw;
        margin: auto;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
      }

      h1 {
        display: flex;
        align-items: center;
        margin: 0;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        height: var(--bb-grid-size-14);
        border-bottom: 1px solid var(--bb-neutral-100);
        padding: 0 var(--bb-grid-size-6);
      }

      .share-content,
      .tos-content {
        flex-grow: 1;
        overflow-y: auto;
        max-height: 440px;
        padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
        font: 400 var(--bb-body-large) / var(--bb-body-line-height-large)
          var(--bb-font-family);
        outline: none;
      }

      .controls {
        display: flex;
        justify-content: flex-end;
        border-top: 1px solid var(--bb-neutral-100);
        padding: var(--bb-grid-size-6);
      }

      button {
        padding: var(--bb-grid-size-2);
        border: none;
        border-radius: var(--bb-grid-size);
        background-color: var(--bb-ui-600);
        color: white;

        &[disabled] {
          opacity: 0.5;
        }

        &:not([disabled]) {
          cursor: pointer;
        }
      }
    }

    #header-bar {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 0 var(--bb-grid-size-2) 0 0;

      & #tab-info {
        flex: 1;
        display: flex;
        align-items: center;
        height: 100%;

        & #logo {
          color: #404041;
          font-family: var(--bb-font-family);
          font-size: 20px;
          font-weight: 500;
          border: none;
          width: 24px;
          height: 24px;
          margin: 0 var(--bb-grid-size-4);
          background: var(--bb-logo) left center / 24px 24px no-repeat;
          padding: 0;

          & > .product-name {
            padding-left: 40px;
          }

          &:not([disabled]) {
            cursor: pointer;
          }
        }
      }

      & #tab-toggle {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;

        & button {
          display: flex;
          height: var(--bb-grid-size-7);
          align-items: center;
          font-size: 0;
          padding: 0;
          margin: 0;
          background: var(--bb-neutral-50);
          border: 1px solid var(--bb-neutral-300);
          border-radius: var(--bb-grid-size-16);

          &::before,
          &::after {
            display: flex;
            align-items: center;
            border-radius: var(--bb-grid-size-16);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-9);
            text-align: left;
            flex: 1;
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
            height: calc(var(--bb-grid-size-7) - 2px);
          }

          &::before {
            content: "Create";
            background: var(--bb-icon-flowchart) 10px center / 20px 20px
              no-repeat;
          }

          &::after {
            content: "App";
            background: var(--bb-icon-phone) 10px center / 20px 20px no-repeat;
          }

          &.create::before {
            background: var(--bb-ui-500) var(--bb-icon-flowchart-inverted) 10px
              center / 20px 20px no-repeat;
            color: var(--bb-neutral-0);
          }

          &.deploy::after {
            background: var(--bb-ui-500) var(--bb-icon-phone-inverted) 10px
              center / 20px 20px no-repeat;
            color: var(--bb-neutral-0);
          }
        }
      }

      & #tab-controls {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: flex-end;

        & #toggle-user-menu {
          height: var(--bb-grid-size-7);
          padding: 0;
          margin: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-2);
          background: none;
          border: none;
          cursor: pointer;

          & #user-pic {
            display: block;
            width: var(--bb-grid-size-7);
            height: var(--bb-grid-size-7);
            border-radius: 50%;
            pointer-events: none;
          }
        }
      }

      & bb-homepage-search-button {
        margin-right: var(--bb-grid-size-8);
      }
    }

    #header-bar[data-active="true"] h1::after {
      content: "";
      width: 48px;
      height: 1px;
      background: var(--bb-ui-700);
      bottom: -1px;
      left: 0;
      position: absolute;
    }

    #header-bar #tab-container {
      flex-grow: 1;
      display: flex;
      align-items: flex-end;
      margin: 0;
      height: 100%;
      overflow: hidden;
    }

    #tab-container .tab {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      background: linear-gradient(
        var(--bb-neutral-0) 86%,
        var(--bb-neutral-50)
      );
      color: var(--bb-neutral-800);
      margin: 0;
      height: calc(100% - var(--bb-grid-size) * 2);
      border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
      padding: var(--bb-grid-size);
      display: grid;
      grid-template-columns: 1fr 24px 32px;
      align-items: center;
      justify-items: center;
      user-select: none;
      margin-right: var(--bb-grid-size-2);
      opacity: 0.7;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    .tab-title {
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size) var(--bb-grid-size);
      border: 1px solid transparent;
      border-radius: var(--bb-grid-size);
      max-width: 320px;
      min-width: 10%;
      field-sizing: content;
      color: var(--bb-neutral-800);
      margin-right: var(--bb-grid-size-2);
      outline: none;
      background: transparent;

      &:hover {
        border: 1px solid var(--bb-neutral-500);
      }

      &:focus {
        border: 1px solid var(--bb-neutral-700);
      }
    }

    .save-status {
      display: none;
      align-items: center;
      height: var(--bb-grid-size-10);
      background: transparent;
      padding-left: var(--bb-grid-size-5);
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
    }

    .save-status.can-save,
    .save-status.readonly {
      display: flex;
    }

    .save-status.saving {
      background: transparent url(/images/progress-ui.svg) left center / 16px
        16px no-repeat;
    }

    .save-status.unsaved {
      background: transparent var(--bb-icon-pending) left center / 12px 12px
        no-repeat;
    }

    .save-status.saved {
      background: transparent var(--bb-icon-saved-local) left center / 16px 16px
        no-repeat;
    }

    .save-status.error {
      background: transparent var(--bb-icon-warning) left center / 16px 16px
        no-repeat;
    }

    .save-status.saved.remote {
      background: transparent var(--bb-icon-saved-remote) left center / 16px
        16px no-repeat;
    }

    .save-status.readonly {
      background: transparent var(--bb-icon-saved-readonly) left center / 16px
        16px no-repeat;
    }

    #content {
      background: var(--n-95);
      max-height: calc(100svh - var(--header-height));
      display: flex;
      flex-direction: column;
      position: relative;
    }

    iframe {
      grid-row: 1 / 3;
      grid-column: 1 / 3;
      margin: 0;
      border: none;
      width: 100%;
      height: 100%;
      display: block;
    }

    bb-overlay iframe {
      width: 80vw;
      height: 80vh;
      border-radius: 8px;
    }

    bb-board-activity-overlay {
      display: none;
    }

    :host([showboardactivityoverlay="true"]) bb-board-activity-overlay {
      display: block;
    }

    #user-overflow,
    #board-overflow,
    #board-items-overflow,
    bb-new-workspace-item-overlay {
      position: fixed;
      right: auto;
      bottom: auto;
      z-index: 20;
    }

    bb-app-controller {
      position: absolute;
      height: 100%;
      width: 100svw;
      left: 0;
      top: 0;
      overflow: hidden;
      display: none;

      &.active {
        z-index: 100;
        display: block;
      }
    }

    bb-project-listing {
      position: absolute;
      height: 100%;
      width: 100svw;
      left: 0;
      top: 0;
      overflow-x: hidden;
      overflow-y: scroll;
    }

    bb-focus-editor {
      z-index: 10;
    }

    bb-settings-edit-overlay {
      position: fixed;
    }

    #remix {
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-9);
      border-radius: var(--bb-grid-size-16);
      margin: 0 var(--bb-grid-size-2) 0 0;
      background: var(--bb-neutral-0);
      cursor: pointer;

      color: #004a77;
      font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      display: flex;
      align-items: center;
      border-radius: 100px;
      border: none;
      transition: background 0.2s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;

      background: var(--bb-icon-remix) var(--bb-grid-size-3) center / 18px 18px
        no-repeat #c2e7ff;

      &:hover,
      &:focus {
        background-color: #96d6ff;
      }
    }

    @keyframes bounce {
      0% {
        translate: 0 0;
      }

      3% {
        translate: 0 -23px;
      }

      5% {
        translate: 0 -28px;
      }

      8% {
        translate: 0 -23px;
      }

      10% {
        translate: 0 0;
      }

      13% {
        translate: 0 -14px;
      }

      15% {
        translate: 0 -17px;
      }

      18% {
        translate: 0 -14px;
      }

      20% {
        translate: 0 0;
      }

      25% {
        translate: 0 -7px;
      }

      25% {
        translate: 0 -10px;
      }

      28% {
        translate: 0 -7px;
      }

      30% {
        translate: 0 0;
      }

      35% {
        rotate: 0deg;
      }

      40% {
        rotate: 45deg;
      }

      45% {
        rotate: -45deg;
      }

      50% {
        rotate: 25deg;
      }

      55% {
        rotate: -25deg;
      }

      60% {
        rotate: 5deg;
      }

      65% {
        rotate: -5deg;
      }

      70% {
        rotate: 0deg;
      }
    }
  `,
] as CSSResultGroup;
