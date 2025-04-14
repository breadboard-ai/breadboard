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

    --user-input-padding-left: var(--bb-grid-size-3);
    --output-value-padding-x: var(--bb-grid-size-2);
    --output-value-padding-y: var(--bb-grid-size-2);
  }

  #click-run {
    font: 400 var(--bb-body-large) / var(--bb-body-line-height-large)
      var(--bb-font-family);
    color: var(--bb-neutral-700);
    text-align: center;
    margin-top: var(--bb-grid-size-3);
  }

  .run-component {
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    margin-right: var(--bb-grid-size-4);
    cursor: pointer;
    overflow: hidden;
  }

  .activity-entry {
    &.input,
    &.output,
    &.combine-outputs {
      & .run-component {
        color: var(--bb-input-700);
      }
    }

    &.generative,
    &.generative-image,
    &.generative-text,
    &.generative-audio,
    &.generative-code {
      & .run-component {
        color: var(--bb-generative-700);
      }
    }
  }

  .user-output {
    position: relative;
    padding-top: var(--bb-grid-size-2);
    display: flex;
    justify-content: flex-end;

    --output-border-width: 0;
    --output-border-color: var(--bb-neutral-300);
    --output-border-radius: var(--bb-grid-size-2);
    --output-padding: 0;
    --output-lite-border-color: transparent;
    --output-lite-background-color: transparent;

    & .output-container {
      border-radius: var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-4) var(--bb-grid-size-4);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-2) var(--bb-grid-size-2)
        var(--bb-grid-size-2);
      background: var(--bb-ui-100);
      color: var(--bb-neutral-900);
      overflow: scroll;
      scrollbar-width: none;
    }
  }

  .activity-entry {
    position: relative;
    padding-top: var(--bb-grid-size-2);

    --output-padding: var(--bb-grid-size-5);
  }

  .activity-entry:first-of-type {
    margin-top: 0;
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

  .activity-entry {
    & h1,
    & .node-info {
      min-height: var(--bb-grid-size-8);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      display: flex;
      margin: 0;
      border-radius: var(--bb-grid-size);
      color: var(--bb-neutral-700);
      position: relative;
      border: 1px solid var(--bb-neutral-100);
      flex-direction: column;

      & summary {
        position: relative;
        z-index: 1;
      }

      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: var(--bb-grid-size-8);
        border-radius: var(--bb-grid-size);
        background: var(--bb-neutral-100);
        z-index: 0;
      }
    }

    &.input .node-info::before,
    &.output .node-info::before,
    &.combine-outputs .node-info::before {
      background: var(--bb-input-50);
    }

    &.generative .node-info::before,
    &.generative-audio .node-info::before,
    &.generative-code .node-info::before,
    &.generative-text .node-info::before,
    &.generative-image .node-info::before {
      background: var(--bb-generative-50);
    }
  }

  .activity-entry.node h1::before,
  .activity-entry .node-info summary::before {
    content: "";
    margin-right: var(--bb-grid-size-2);
    width: 20px;
    min-height: 20px;
    margin-top: 0;
  }

  .activity-entry .node-info .activity-entry summary::before {
    margin-top: 1px;
  }

  .activity-entry .node-info summary {
    display: flex;
    align-items: center;
    padding: var(--bb-grid-size) var(--bb-grid-size-2);
    flex: 1 1 auto;
  }

  .activity-entry .node-info summary span {
    flex: 1;
  }

  .activity-entry {
    & .node-info summary .details {
      width: 20px;
      height: 20px;
      cursor: pointer;
      border: none;
      transition: opacity 0.1s cubic-bezier(0, 0, 0.3, 1);
      padding: 0;
      overflow: hidden;
      background: none;
    }

    &.input .node-info summary .details,
    &.output .node-info summary .details,
    &.combine-outputs .node-info summary .details {
      color: var(--bb-input-700);
    }

    &.generative .node-info summary .details,
    &.generative-audio .node-info summary .details,
    &.generative-code .node-info summary .details,
    &.generative-text .node-info summary .details,
    &.generative-image .node-info summary .details {
      color: var(--bb-generative-700);
    }
  }

  .node summary::before,
  .activity-entry .activity-entry.node summary::before,
  .activity-entry.node h1::before {
    background: transparent var(--bb-icon-board) center center / 20px 20px
      no-repeat;
  }

  .node.specialist summary::before,
  .activity-entry .activity-entry.node.specialist summary::before,
  .activity-entry.node.specialist h1::before {
    background: transparent var(--bb-icon-smart-toy) center center / 20px 20px
      no-repeat;
  }

  .node.input summary::before,
  .activity-entry .activity-entry.node.input summary::before,
  .activity-entry.node.input h1::before {
    background: transparent var(--bb-icon-input) center center / 20px 20px
      no-repeat;
  }

  .node.generative summary::before,
  .activity-entry .activity-entry.node.generative summary::before,
  .activity-entry.node.generative h1::before {
    background: transparent var(--bb-add-icon-generative) center center / 20px
      20px no-repeat;
  }

  .node.generative-audio summary::before,
  .activity-entry .activity-entry.node.generative-audio summary::before,
  .activity-entry.node.generative-audio h1::before {
    background: transparent var(--bb-add-icon-generative-audio) center center /
      20px 20px no-repeat;
  }

  .node.generative-code summary::before,
  .activity-entry .activity-entry.node.generative-code summary::before,
  .activity-entry.node.generative-code h1::before {
    background: transparent var(--bb-add-icon-generative-code) center center /
      20px 20px no-repeat;
  }

  .node.generative-text summary::before,
  .activity-entry .activity-entry.node.generative-text summary::before,
  .activity-entry.node.generative-text h1::before {
    background: transparent var(--bb-add-icon-generative-text) center center /
      20px 20px no-repeat;
  }

  .node.generative-image summary::before,
  .activity-entry .activity-entry.node.generative-image summary::before,
  .activity-entry.node.generative-image h1::before {
    background: transparent var(--bb-add-icon-generative-image) center center /
      20px 20px no-repeat;
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
    background: transparent var(--bb-icon-human) center center / 20px 20px
      no-repeat;
  }

  .node.urlTemplate summary::before,
  .activity-entry .activity-entry.node.urlTemplate summary::before,
  .activity-entry.node.urlTemplate h1::before {
    background: transparent var(--bb-icon-http) center center / 20px 20px
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
    margin: 0;
  }

  .activity-entry .node-output-container:not(.stored) .node-output {
    padding: var(--bb-grid-size) var(--bb-grid-size-3);
  }

  .activity-entry:not(.output) .consumed .node-output::before {
    height: 100%;
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
    padding: var(--bb-grid-size-2) 0;
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
    position: relative;
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

  .output-port .value.markdown {
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

    &:last-of-type {
      margin-bottom: 0;
    }
  }

  .output-port.markdown {
    white-space: normal;
    line-height: 1.5;

    & a {
      color: var(--bb-ui-700);
    }

    & h1 {
      font: 500 var(--bb-title-large) / var(--bb-title-line-height-large)
        var(--bb-font-family);

      margin: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
    }

    & h2 {
      font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);

      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
    }

    & h3,
    & h4,
    & h5 {
      font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);

      margin: var(--bb-grid-size-3) 0 var(--bb-grid-size-2) 0;
    }

    & p {
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);

      margin: 0 0 var(--bb-grid-size-2) 0;
      white-space: pre-line;

      & strong:only-child {
        margin: var(--bb-grid-size-2) 0 0 0;
      }
    }

    & h1:first-of-type,
    & h2:first-of-type,
    & h3:first-of-type,
    & h4:first-of-type,
    & h5:first-of-type {
      margin-top: 0;
    }

    & p:last-of-type {
      margin-bottom: 0;
    }
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
