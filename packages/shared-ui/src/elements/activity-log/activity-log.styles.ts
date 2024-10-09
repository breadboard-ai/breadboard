/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    background: #fff;

    --padding-x: calc(var(--bb-grid-size) * 4);
    --padding-y: var(--bb-grid-size-2);
  }

  :host > h1 {
    position: sticky;
    top: 0;
    font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
      var(--bb-font-family);
    margin: 0 0 var(--bb-grid-size) 0;
    padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
    background: white;
    z-index: 2;
    display: flex;
  }

  :host > h1 > span {
    flex: 1;
  }

  :host > h1::after {
    content: "";
    width: calc(100% - var(--padding-x) * 2);
    height: 1px;
    position: absolute;
    bottom: var(--bb-grid-size);
    left: var(--padding-x);
    background: #f6f6f6;
  }

  :host > h1 > a,
  a.download {
    font-size: var(--bb-label-small);
    color: var(--bb-neutral-500);
    text-decoration: none;
    user-select: none;
    cursor: pointer;
  }

  :host > h1 > a:hover,
  :host > h1 > a:active,
  a.download:hover,
  a.download:active {
    color: var(--bb-neutral-700);
  }

  #download-container {
    display: flex;
    justify-content: flex-end;
  }

  .activity-entry {
    padding: var(--padding-y) 0;
    position: relative;
    font-size: var(--bb-font-medium);
    user-select: none;
  }

  :host > .activity-entry {
    padding-left: var(--padding-x);
    padding-right: var(--padding-x);
  }

  :host > .activity-entry:last-of-type {
    padding-bottom: 120px;
  }

  .activity-entry.error {
    color: #cc0000;
    user-select: text;
  }

  .activity-entry h1 {
    font-size: var(--bb-text-regular);
    margin: 0;
    font-weight: 400;
  }

  .activity-entry h2 {
    font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
      var(--bb-font-family);
    color: var(--bb-neutral-600);
    margin: var(--bb-grid-size) 0 var(--bb-grid-size-2) 0;
  }

  .activity-entry h1 .newest-task {
    font-size: var(--bb-text-medium);
    font-weight: 300;
    margin-left: var(--bb-grid-size);
  }

  .activity-entry::after {
    content: "";
    width: calc(var(--bb-grid-size) * 4);
    height: calc(var(--bb-grid-size) * 4);
    border-radius: 50%;
    top: calc(var(--padding-y) + var(--bb-grid-size) - 3px);
    left: -2px;
    position: absolute;
    --background: var(--bb-nodes-400);
  }

  :host > .activity-entry::after {
    left: calc(var(--padding-x) + 10px);
  }

  .activity-entry.icon::after {
    width: calc(var(--bb-grid-size) * 7);
    height: calc(var(--bb-grid-size) * 7);
    left: calc(var(--padding-x) + 3px);
    top: calc(var(--padding-y) - var(--bb-grid-size));
    background: #fff var(--node-icon) center center no-repeat;
    background-size: 20px 20px;
    border: 1px solid #d9d9d9;
  }

  .activity-entry::before {
    --top: calc(var(--padding-y) + 5px);
    content: "";
    width: 2px;
    height: 100%;
    left: 5px;
    top: 0;
    height: 100%;
    position: absolute;
    background: var(--bb-neutral-300);
  }

  :host > .activity-entry::before {
    left: calc(var(--padding-x) + 17px);
  }

  .neural-activity {
    width: calc(var(--bb-grid-size) * 4);
    height: calc(var(--bb-grid-size) * 4);
    border-radius: 50%;
    display: inline-block;
    margin-left: -2px;
    margin-top: -2px;
    margin-right: var(--bb-grid-size-2);
    position: relative;
    z-index: 1;
    --background: var(--bb-nodes-400);
  }

  .neural-activity:last-of-type {
    margin-right: 0;
  }

  .neural-activity.error,
  .activity-entry.error::after {
    --background: var(--bb-warning-600);
  }

  .neural-activity.input,
  .activity-entry.input::after {
    --background: var(--bb-inputs-300);
  }

  .neural-activity.secret,
  .activity-entry.secret::after {
    --background: var(--bb-inputs-300);
  }

  .neural-activity.output,
  .activity-entry.output::after {
    --background: var(--bb-boards-300);
  }

  .neural-activity,
  .activity-entry::after {
    background: radial-gradient(
      var(--background) 0%,
      var(--background) 50%,
      transparent 50%
    );
  }

  .neural-activity.pending,
  .activity-entry.pending::after {
    box-shadow: 0 0 0 4px #3399ff40;
    box-sizing: border-box;
    background: radial-gradient(
        var(--background) 0%,
        var(--background) 50%,
        transparent 50%
      ),
      linear-gradient(#3399ff40, #3399ffff);
    animation: rotate 1s linear infinite forwards;
  }

  .activity-entry:first-of-type::before {
    top: var(--top);
    height: calc(100% - var(--top));
  }

  .activity-entry:last-of-type::before {
    height: var(--top);
  }

  .activity-entry:first-of-type:last-of-type::before {
    display: none;
  }

  .activity-entry > .content {
    padding-left: calc(var(--bb-grid-size) * 6);
  }

  :host > .activity-entry > .content {
    padding-left: calc(var(--bb-grid-size) * 10);
  }

  .subgraph-info {
    padding: var(--bb-grid-size-2) calc(var(--bb-grid-size) * 4);
  }

  .subgraph-info summary {
    margin-left: -20px;
    display: grid;
    grid-template-columns: 20px auto;
    align-items: center;
  }

  .subgraph-info summary::before {
    content: "";
    width: 20px;
    height: 20px;
    background: var(--bb-icon-arrow-right) center center / 20px 20px no-repeat;
    display: inline-block;
    margin: -5px 0 0 0;
  }

  .subgraph-info[open] > summary::before {
    background: var(--bb-icon-arrow-drop-down) -1px 6px / 20px 20px no-repeat;
  }

  .subgraph-info[open] > summary {
    margin-bottom: -20px;
  }

  .activity-summary {
    width: fit-content;
    position: relative;
  }

  .activity-summary::before {
    content: "";
    position: absolute;
    background: #ededed;
    border-radius: 8px;
    bottom: 6px;
    right: 2px;
    left: 1px;
    top: 1px;
    z-index: 0;
  }

  .subgraph-info[open] > summary .activity-summary {
    position: absolute;
    pointer-events: none;
    opacity: 0;
  }

  h1[data-message-id] {
    cursor: pointer;
    opacity: 1;
    transition: color 0.3s cubic-bezier(0, 0, 0.3, 1);
  }

  h1[data-message-id]:hover,
  h1[data-message-id]:focus {
    color: var(--bb-ui-600);
    transition-duration: 0.1s;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary {
    list-style: none;
  }

  .node-output details {
    padding: var(--bb-grid-size-2);
  }

  .node-output summary {
    font-size: var(--bb-text-small);
    margin: var(--bb-grid-size-2) 0;
    font-weight: normal;
  }

  .node-output details div {
    font-size: var(--bb-text-nano);
    font-family: var(--bb-font-family-mono);
    line-height: 1.65;
  }

  .node-output img {
    border-radius: var(--bb-grid-size);
    display: block;
    width: 100%;
    border: 1px solid var(--bb-neutral-300);
  }

  dl {
    margin: 0;
    padding: 0;
  }

  dd {
    display: flex;
    align-items: center;
    font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
      var(--bb-font-family);
    padding: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    margin: 0;
  }

  dt {
    font-size: var(--bb-text-medium);
  }

  dt .value {
    white-space: pre-line;
    border-radius: var(--bb-grid-size);
    padding: var(--bb-input-padding, var(--bb-grid-size-2));
    user-select: auto;
  }

  dt .value.output * {
    margin: var(--bb-grid-size) 0;
  }

  dt .value.input h1,
  dt .value.output h1 {
    font-size: var(--bb-title-large);
    margin: var(--bb-grid-size-3) 0 var(--bb-grid-size) 0;
  }

  dt .value.input h2,
  dt .value.output h2 {
    font-size: var(--bb-title-medium);
    margin: var(--bb-grid-size-3) 0 var(--bb-grid-size) 0;
  }

  dt .value.input h3,
  dt .value.input h4,
  dt .value.input h5,
  dt .value.output h3,
  dt .value.output h4,
  dt .value.output h5 {
    font-size: var(--bb-title-small);
    margin: 0 0 var(--bb-grid-size-2) 0;
  }

  dt .value.input p,
  dt .value.output p {
    font-size: var(--bb-body-medium);
    margin: 0 0 var(--bb-grid-size-2) 0;
    white-space: pre-line;
  }

  dt .value.input {
    border: 1px solid var(--bb-neutral-300);
    white-space: pre-line;
    max-height: 300px;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  dt .value.input.markdown,
  dt .value.output.markdown {
    white-space: normal;
    line-height: 1.5;
    user-select: text;
  }

  dt .value.input.markdown p,
  dt .value.output.markdown p {
    white-space: normal;
  }

  dt .value.input :first-child,
  dt .value.output :first-child {
    margin-top: 0;
  }

  pre {
    display: inline-block;
    margin: 0;
  }

  #click-run {
    font-size: var(--bb-text-small);
    color: #9c9c9c;
    padding: 0 var(--padding-x) var(--padding-y) var(--padding-x);
  }

  .user-required {
    position: relative;
  }

  .user-required::before {
    content: "";
    position: absolute;
    left: -20px;
    top: -10px;
    right: -10px;
    bottom: -10px;
    background: var(--bb-selected-color);
    border-radius: var(--bb-grid-size);
    animation: fadeOut 1s ease-out forwards;
  }

  .continue-button {
    background: var(--bb-continue-color) var(--bb-icon-resume-blue) 8px 4px /
      16px 16px no-repeat;
    color: var(--bb-ui-700);
    border-radius: var(--bb-grid-size-5);
    border: none;
    height: var(--bb-grid-size-6);
    padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
    margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
  }

  @keyframes slideIn {
    from {
      translate: 0 -5px;
      opacity: 0;
    }

    to {
      translate: 0 0;
      opacity: 1;
    }
  }

  @keyframes rotate {
    from {
      transform: rotate(0);
    }

    to {
      transform: rotate(360deg);
    }
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
