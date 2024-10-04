/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const styles = css`
  * {
    box-sizing: border-box;
  }

  :host {
    flex: 1 0 auto;
    display: grid;
    grid-template-rows: calc(var(--bb-grid-size) * 12) auto;
  }

  bb-toast {
    z-index: 2000;
  }

  #show-nav {
    font-size: 0;
    width: 24px;
    height: 24px;
    background: var(--bb-icon-menu) center center no-repeat;
    border: none;
    margin-right: var(--bb-grid-size-2);
    cursor: pointer;
  }

  #close-board {
    font-size: 0;
    width: 20px;
    height: 20px;
    background: var(--bb-icon-close) center center no-repeat;
    background-size: 16px 16px;
    border: 2px solid transparent;
    margin-left: calc(var(--bb-grid-size) * 2);
    opacity: 0.6;
    transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    border-radius: 50%;
  }

  #close-board:not([disabled]) {
    cursor: pointer;
  }

  #close-board:not([disabled]):hover {
    transition-duration: 0.1s;
    opacity: 1;
    background-color: var(--bb-neutral-300);
    border: 2px solid var(--bb-neutral-300);
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
    color: var(--bb-neutral-50);
    padding: 0 16px 0 42px;
    font-size: var(--bb-text-medium);
    margin: 0 calc(var(--bb-grid-size) * 3) 0 0;
    cursor: pointer;
    background: 12px center var(--bb-icon-download);
    background-repeat: no-repeat;
    height: calc(100% - var(--bb-grid-size) * 4);
    display: flex;
    align-items: center;
    text-decoration: none;
    border-radius: 20px;
    border: none;
    flex: 0 0 auto;
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
    background: center center var(--bb-icon-more-vert-inverted);
    background-repeat: no-repeat;
    width: 32px;
  }

  #undo {
    background-image: var(--bb-icon-undo-inverted);
  }

  #redo {
    background-image: var(--bb-icon-redo-inverted);
  }

  #undo[disabled],
  #redo[disabled] {
    opacity: 0.5;
  }

  #toggle-preview.active {
    background-color: var(--bb-ui-800);
  }

  #toggle-settings {
    padding: var(--bb-grid-size-2) var(--bb-grid-size-3) var(--bb-grid-size-2)
      var(--bb-grid-size-8);
    margin-right: 0;
    background: var(--bb-icon-settings-inverted) 8px center / 20px 20px
      no-repeat;
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
  }

  #toggle-settings.active {
    background-color: var(--bb-ui-800);
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
    background: var(--bb-ui-600);
    display: block;
    color: var(--bb-neutral-50);
    z-index: 1;
    width: 100%;
    overflow: hidden;
    height: calc(var(--bb-grid-size) * 12);
  }

  #header-bar {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-3);
  }

  #header-bar h1 {
    font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
      var(--bb-font-family);
    margin-right: var(--bb-grid-size-6);
    padding-left: var(--bb-grid-size-7);
    margin-left: var(--bb-grid-size-2);
    background: url(/images/bb-logo-inverted.svg) left center no-repeat;
    height: 100%;
    display: flex;
    align-items: center;
  }

  #header-bar #tab-container {
    flex-grow: 1;
    display: flex;
    align-items: flex-end;
    margin: 0;
    height: 100%;
    overflow: hidden;
  }

  #tab-container h1 {
    font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
      var(--bb-font-family);
    background: var(--bb-neutral-0);
    color: var(--bb-neutral-800);
    margin: 0;
    height: calc(100% - var(--bb-grid-size) * 2);
    border-radius: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2) 0
      0;
    padding: 0 calc(var(--bb-grid-size) * 4);
    display: flex;
    align-items: center;
    user-select: none;
    margin-right: var(--bb-grid-size-2);
    opacity: 0.7;
    transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
  }

  #tab-container h1:hover {
    transition-duration: 0.1s;
  }

  #tab-container h1.active {
    opacity: 1;
  }

  #tab-container .save-status {
    margin-left: 8px;
    width: 20px;
    height: 20px;
    background: transparent;
    display: none;
  }

  #tab-container .save-status.can-save,
  #tab-container .save-status.readonly {
    display: block;
  }

  #tab-container .save-status.saving {
    background: transparent url(/images/progress-ui.svg) center center / 20px
      20px no-repeat;
  }

  #tab-container .save-status.unsaved {
    background: transparent var(--bb-icon-pending) center center / 12px 12px
      no-repeat;
  }

  #tab-container .save-status.saved {
    background: transparent var(--bb-icon-saved-local) center center / 20px 20px
      no-repeat;
  }

  #tab-container .save-status.error {
    background: transparent var(--bb-icon-warning) center center / 20px 20px
      no-repeat;
  }

  #tab-container .save-status.saved.remote {
    background: transparent var(--bb-icon-saved-remote) center center / 20px
      20px no-repeat;
  }

  #tab-container .save-status.readonly {
    background: transparent var(--bb-icon-saved-readonly) center center / 20px
      20px no-repeat;
  }

  #tab-container .back-to-main-board {
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: none;
    border: none;
    color: var(--bb-neutral-800);
    white-space: nowrap;
    font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
      var(--bb-font-family);
  }

  #tab-container .back-to-main-board:disabled {
    cursor: auto;
    color: var(--bb-neutral-800);
  }

  #tab-container .subgraph-name {
    display: flex;
    align-items: center;
  }

  #tab-container .subgraph-name::before {
    content: "";
    width: 20px;
    height: 20px;
    background: var(--bb-icon-next) center center no-repeat;
    background-size: 12px 12px;
  }

  #content {
    max-height: calc(100svh - var(--bb-grid-size) * 12);
    display: flex;
    flex-direction: column;
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
`;
