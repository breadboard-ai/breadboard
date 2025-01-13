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
    display: block;
    background: var(--bb-neutral-0);
    position: relative;
  }

  #click-run {
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    color: var(--bb-neutral-600);
  }

  .run-component {
    width: 20px;
    height: 20px;
    font-size: 0;
    border: none;
    background: transparent var(--bb-icon-play-filled) center center / 20px 20px
      no-repeat;
    margin-top: 2px;
    opacity: 0.7;
    margin-right: var(--bb-grid-size);
    cursor: pointer;
  }

  .run-component:focus,
  .run-component:hover {
    transition: opacity 0.1s cubic-bezier(0, 0, 0.3, 1);
    opacity: 1;
  }

  .activity-entry {
    position: relative;
    padding-top: var(--bb-grid-size-2);
  }

  .activity-entry:first-of-type {
    margin-top: 0;
  }

  :host([showdebugcontrols="false"]) > .activity-entry:last-of-type {
    padding-bottom: 60px;
  }

  .activity-entry.running + .activity-entry::before,
  .activity-entry.output + .activity-entry::before,
  .node-info .activity-entry::before,
  .activity-entry:first-of-type::before {
    display: none;
  }

  .activity-entry.secret {
    padding-top: 0;
    margin-top: calc(var(--bb-grid-size) * -2);
  }

  .activity-entry .node-info details {
    margin-left: var(--bb-grid-size-3);
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
  }

  .activity-entry .node-info details span {
    line-height: var(--bb-grid-size-5);
  }

  .activity-entry h1,
  .activity-entry .node-info {
    font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
      var(--bb-font-family);
    display: flex;
    align-items: center;
    margin: 0;
    padding: 4px 8px;
    border: 1px solid var(--bb-neutral-400);
    border-radius: 8px;
    background: var(--bb-neutral-0);
  }

  .activity-entry .node-info {
    display: block;
  }

  .activity-entry.node h1::before,
  .activity-entry .node-info summary::before {
    content: "";
    margin-right: var(--bb-grid-size-2);
    width: 20px;
    min-height: 20px;
    margin-top: 0;
  }

  .activity-entry .node-info summary::before {
    margin-top: 2px;
  }

  .activity-entry .node-info .activity-entry summary::before {
    margin-top: 1px;
  }

  .activity-entry .node-info summary {
    display: flex;
    align-items: flex-start;
  }

  .activity-entry .node-info summary span {
    flex: 1;
  }

  .activity-entry .node-info summary .details {
    width: 20px;
    height: 20px;
    font-size: 0;
    cursor: pointer;
    border: none;
    background: transparent var(--bb-icon-info-filled) center center / 20px 20px
      no-repeat;
    opacity: 0.2;
    transition: opacity 0.1s cubic-bezier(0, 0, 0.3, 1);
    margin-top: 2px;
  }

  .activity-entry .node-info summary .details:hover,
  .activity-entry .node-info summary .details:focus {
    opacity: 0.4;
  }

  .node summary::before,
  .activity-entry .activity-entry.node summary::before,
  .activity-entry.node h1::before {
    background: transparent var(--bb-icon-board) center -1px / 20px 20px
      no-repeat;
  }

  .node.specialist summary::before,
  .activity-entry .activity-entry.node.specialist summary::before,
  .activity-entry.node.specialist h1::before {
    background: transparent var(--bb-icon-smart-toy) center -1px / 20px 20px
      no-repeat;
  }

  .node.input summary::before,
  .activity-entry .activity-entry.node.input summary::before,
  .activity-entry.node.input h1::before {
    background: transparent var(--bb-icon-input) center center / 20px 20px
      no-repeat;
  }

  .node.runJavascript summary::before,
  .activity-entry .activity-entry.node.runJavascript summary::before,
  .activity-entry.node.runJavascript h1::before {
    background: transparent var(--bb-icon-javascript) center center / 20px 20px
      no-repeat;
  }

  .node.content summary::before,
  .activity-entry .activity-entry.node.content summary::before,
  .activity-entry.node.content h1::before {
    background: transparent var(--bb-icon-code-blocks) center center / 20px 20px
      no-repeat;
  }

  .node.secrets summary::before,
  .activity-entry .activity-entry.node.secrets summary::before,
  .activity-entry.node.secrets h1::before {
    background: transparent var(--bb-icon-secrets) center center / 20px 20px
      no-repeat;
  }

  .node.human summary::before,
  .activity-entry .activity-entry.node.human summary::before,
  .activity-entry.node.human h1::before {
    background: transparent var(--bb-icon-human) center -1px / 20px 20px
      no-repeat;
  }

  .node.urlTemplate summary::before,
  .activity-entry .activity-entry.node.urlTemplate summary::before,
  .activity-entry.node.urlTemplate h1::before {
    background: transparent var(--bb-icon-http) center -1px / 20px 20px
      no-repeat;
  }

  .node.fetch summary::before,
  .activity-entry .activity-entry.node.fetch summary::before,
  .activity-entry.node.fetch h1::before {
    background: transparent var(--bb-icon-fetch) center -1px / 20px 20px
      no-repeat;
  }

  .node.jsonata summary::before,
  .activity-entry .activity-entry.node.jsonata summary::before,
  .activity-entry.node.jsonata h1::before {
    background: transparent var(--bb-icon-jsonata) center -1px / 20px 20px
      no-repeat;
  }

  .node.output summary::before,
  .activity-entry .activity-entry.node.output summary::before,
  .activity-entry.node.output h1::before {
    background: transparent var(--bb-icon-output) center -1px / 20px 20px
      no-repeat;
  }

  .node.joiner summary::before,
  .activity-entry .activity-entry.node.joiner summary::before,
  .activity-entry.node.joiner h1::before {
    background: transparent var(--bb-icon-merge-type) center -1px / 20px 20px
      no-repeat;
  }

  .activity-entry h2 {
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    display: flex;
    align-items: center;
    margin: var(--bb-grid-size-2) 0 var(--bb-grid-size-3) 0;
    color: var(--bb-neutral-500);
  }

  .activity-entry .node-output,
  .activity-entry .edge {
    position: relative;
    padding: 0 0 0 38px;
    margin: var(--bb-grid-size-3) 0;
  }

  .activity-entry .node-output-container:not(.stored) .node-output[open] {
    padding-bottom: var(--bb-grid-size-5);
  }

  .activity-entry .node-output::before,
  .activity-entry .edge::before {
    content: "";
    width: 1px;
    background: var(--bb-neutral-400);
    height: calc(50% - 3px);
    position: absolute;
    top: 3px;
    left: 20px;
    transform: translateX(-0.5px);
  }

  .activity-entry:not(.output) .consumed .node-output::before {
    height: 100%;
  }

  .activity-entry .edge-status {
    background: var(--bb-neutral-400) var(--bb-icon-unknown-value-inverted)
      center center / 16px 16px no-repeat;
    width: 20px;
    height: 20px;
    position: absolute;
    top: calc(50% - 5px);
    left: 10px;
    border-radius: 50%;
  }

  .activity-entry .node-output-container {
    position: relative;
  }

  .activity-entry .node-status {
    width: 20px;
    height: 20px;
    position: absolute;
    top: calc(50% - 5px);
    left: 10px;
    border-radius: 50%;
  }

  .activity-entry .stored .node-status {
    background: var(--bb-human-600) var(--bb-icon-value-inverted) center
      center / 16px 16px no-repeat;
  }

  .activity-entry .consumed .node-status {
    background: var(--bb-input-600) var(--bb-icon-value-inverted) center
      center / 16px 16px no-repeat;
  }

  .activity-entry .stored .node-output::before {
    background: var(--bb-human-600);
    width: 2px;
  }

  .activity-entry .consumed .node-output::before {
    background: var(--bb-inputs-600);
    width: 2px;
  }

  .activity-entry::before,
  .activity-entry .node-output::after,
  .activity-entry .edge::after {
    content: "";
    width: var(--bb-grid-size-2);
    height: var(--bb-grid-size-2);
    border: 1px solid var(--bb-inputs-600);
    background: var(--bb-inputs-200);
    top: 3px;
    left: calc(var(--bb-grid-size) + 11px);
    position: absolute;
    display: block;
    border-radius: 50%;
  }

  .activity-entry::before {
    top: -13px;
  }

  .activity-entry.error {
    color: #cc0000;
    user-select: text;
  }

  .activity-entry.error .error-content {
    white-space: pre;
    border: 1px solid var(--bb-warning-200);
    background-color: var(--bb-warning-50);
    border-radius: var(--bb-grid-size-2);
    padding: var(--bb-grid-size-4);
    overflow-x: scroll;
    font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
      var(--bb-font-family-mono);
    margin-left: 28px;
    scrollbar-width: none;
  }

  summary {
    list-style: none;
    cursor: default;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary span.expandable {
    cursor: pointer;
  }

  .activity-entry .node-output summary {
    padding: var(--bb-grid-size-6) 0 var(--bb-grid-size-3) 0;
    cursor: pointer;
    color: var(--bb-neutral-600);
    transition: color 0.1s cubic-bezier(0, 0, 0.3, 1);
    display: flex;
    flex-direction: column;
  }

  .activity-entry .node-output summary.with-description {
    padding-top: 0;
  }

  .activity-entry .node-output summary h2 {
    margin: 0 0 var(--bb-grid-size-2);
  }

  .newest-task {
    padding: var(--bb-grid-size-2) 0 0 var(--bb-grid-size-2);
    display: flex;
    align-items: center;
  }

  .newest-task::before {
    content: "";
    width: 22px;
    height: 20px;
    background: url(/images/progress-ui.svg) center center / 16px 16px no-repeat;
    margin-right: var(--bb-grid-size-2);
  }

  summary .title {
    font: 600 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    margin-bottom: 2px;
  }

  summary .size {
    font: 600 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
  }

  .activity-entry .node-output summary:hover,
  .activity-entry .node-output summary:focus {
    color: var(--bb-neutral-800);
  }

  .activity-entry details[open] .node-output summary {
    padding-bottom: 0;
  }

  .user-required {
    position: relative;
  }

  .user-required::before {
    content: "";
    position: absolute;
    left: -4px;
    top: -4px;
    right: -8px;
    bottom: -8px;
    background: var(--bb-ui-100);
    border-radius: var(--bb-grid-size);
    animation: fadeOut 1s ease-out forwards;
  }

  .continue-button {
    background: var(--bb-ui-100) var(--bb-icon-resume-ui) 8px 4px / 16px 16px
      no-repeat;
    color: var(--bb-ui-700);
    border-radius: var(--bb-grid-size-5);
    border: none;
    height: var(--bb-grid-size-6);
    padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
    cursor: pointer;
    transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
    margin: var(--bb-grid-size) 0 0 38px;
  }

  .continue-button:focus,
  .continue-button:hover {
    background-color: var(--bb-ui-200);
  }

  .output-port {
    margin-bottom: var(--bb-grid-size-3);
    padding-left: 16px;
    position: relative;
  }

  .output-port::before {
    content: "";
    position: absolute;
    left: 2px;
    border-radius: var(--bb-grid-size-3);
    background: var(--bb-ui-100);
    width: 3px;
    top: 0;
    height: 100%;
  }

  .secrets .output-port * {
    font-family: var(--bb-font-family-mono);
  }

  .no-value {
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family-mono);
    color: var(--bb-neutral-500);
  }

  .output-port * {
    margin: var(--bb-grid-size) 0;
  }

  .output-port .value {
    overflow-x: scroll;
    scrollbar-width: none;
  }

  .output-port h1 {
    font: 600 var(--bb-title-large) / var(--bb-title-line-height-large)
      var(--bb-font-family);
    margin: var(--bb-grid-size-3) 0 var(--bb-grid-siz-2) 0;
  }

  .output-port h2 {
    font: 600 var(--bb-title-large) / var(--bb-title-line-height-large)
      var(--bb-font-family);
    margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
  }

  .output-port h3,
  .output-port h4,
  .output-port h5 {
    font: 600 var(--bb-title-small) / var(--bb-title-line-height-small)
      var(--bb-font-family);
    margin: var(--bb-grid-size) 0 var(--bb-grid-size) 0;
  }

  .output-port p {
    font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
      var(--bb-font-family);
    margin: 0 0 var(--bb-grid-size-2) 0;
    white-space: pre-line;
  }

  .output-port.markdown {
    white-space: normal;
    line-height: 1.5;
  }

  .output-port.markdown p {
    white-space: normal;
  }

  .output-port :first-child {
    margin-top: 0;
  }

  .output-port label {
    font: 600 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
  }

  .output-port:last-of-type {
    margin-bottom: 0;
  }

  #debug-rerun,
  #debug-stepnext,
  #debug-continue {
    color: var(--bb-input-700);
    border-radius: var(--bb-grid-size-5);
    border: none;
    height: var(--bb-grid-size-7);
    padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
    margin: var(--bb-grid-size) var(--bb-grid-size) 0 0;
    cursor: pointer;
    transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
  }

  #debug-rerun {
    background: var(--bb-input-100) var(--bb-icon-rerun) 8px center / 16px 16px
      no-repeat;
  }

  #debug-stepnext {
    background: var(--bb-input-100) var(--bb-icon-step-next) 8px center / 16px
      16px no-repeat;
  }

  #debug-continue {
    color: var(--bb-ui-700);
    background: var(--bb-ui-100) var(--bb-icon-resume-ui) 8px center / 16px 16px
      no-repeat;
  }

  #debug-rerun:focus,
  #debug-rerun:hover,
  #debug-stepnext:focus,
  #debug-stepnext:hover {
    background-color: var(--bb-input-200);
  }

  #debug-continue:focus,
  #debug-continue:hover {
    background-color: var(--bb-ui-200);
  }

  #debug-controls {
    background: var(--bb-neutral-0);
    position: sticky;
    bottom: 0;
    padding: var(--bb-grid-size-2) var(--bb-grid-size-2) var(--bb-grid-size-10)
      28px;
    margin-left: 0;
    z-index: 1;
  }

  #download-export,
  #export {
    color: var(--bb-neutral-700);
    border-radius: var(--bb-grid-size-5);
    border: none;
    height: var(--bb-grid-size-6);
    padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
    margin: 0 0 var(--bb-grid-size) var(--bb-grid-size-2);
    cursor: pointer;
    transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    display: flex;
    align-items: center;
    text-decoration: none;
  }

  #export {
    background: var(--bb-neutral-100) var(--bb-icon-file-export) 8px center /
      16px 16px no-repeat;
  }

  #download-export:hover,
  #download-export:focus,
  #export:hover,
  #export:focus {
    background-color: var(--bb-neutral-200);
  }

  #download-export {
    background: var(--bb-neutral-100) var(--bb-icon-download) 8px center / 16px
      16px no-repeat;
  }

  .export-container {
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: var(--bb-grid-size-8);
    color: var(--bb-neutral-700);
  }

  #clear-export {
    color: var(--bb-neutral-600);
    height: var(--bb-grid-size-6);
    padding: 0 var(--bb-grid-size);
    margin: 0 0 0 var(--bb-grid-size-2);
    cursor: pointer;
    transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    border: none;
    background: var(--bb-neutral-0);
  }

  @keyframes fadeOut {
    0% {
      opacity: 0;
    }

    25% {
      opacity: 0.15;
    }

    50% {
      opacity: 0;
    }

    75% {
      opacity: 0.15;
    }

    100% {
      opacity: 0;
    }
  }
`;
