/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";

export const styles = css`
  * {
    box-sizing: border-box;
  }

  :host {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 8px;
    height: 100%;
    margin: 8px;
    overscroll-behavior: contain;
    --diagram-display: flex;
  }

  @media (orientation: portrait) {
    :host {
      grid-template-columns: initial;
      grid-template-rows: 0.4fr 0.6fr;
      row-gap: 8px;
    }
  }

  #diagram {
    width: 100%;
    height: 100%;
    overflow: auto;
    border: 1px solid rgb(227, 227, 227);
    border-radius: calc(var(--bb-grid-size) * 5);
    display: var(--diagram-display);
  }

  #rhs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: var(--rhs-top) 8px var(--rhs-mid) 8px var(
        --rhs-bottom
      );
    column-gap: calc(var(--bb-grid-size) * 2);
    overflow: auto;
  }

  #controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  #run-status {
    font-size: var(--bb-text-pico);
    margin-left: calc(var(--bb-grid-size) * 2);
    text-transform: uppercase;
    text-align: center;
    background: #eee;
    border-radius: calc(var(--bb-grid-size) * 3);
    padding: var(--bb-grid-size);
    font-weight: bold;
    border: 1px solid rgb(230 230 230);
    margin-top: -3px;
    height: 22px;
  }

  #run-status {
    width: 70px;
  }

  #run-status.running {
    border: 1px solid rgb(174 206 161);
    color: rgb(31 56 21);
    background: rgb(223 239 216);
  }

  #run-status.paused {
    border: 1px solid rgb(248 193 122);
    color: rgb(192 116 19);
    background: rgb(255, 242, 204);
  }

  #inputs,
  #outputs,
  #timeline,
  #history {
    border: 1px solid rgb(227, 227, 227);
    border-radius: calc(var(--bb-grid-size) * 5);
    overflow: auto;
    background: rgb(255, 255, 255);
  }

  #timeline,
  #inputs,
  #outputs {
    display: flex;
    flex-direction: column;
  }

  #timeline {
    grid-column: 1 / 3;
  }

  #history {
    display: grid;
    grid-column: 1 / 3;
  }

  .drag-handle {
    cursor: ns-resize;
    grid-column: 1 / 3;
  }

  #timeline h1 {
    font-size: var(--bb-text-small);
    font-weight: bold;
    margin: 0;
  }

  #inputs header,
  #outputs h1,
  #history h1 {
    font-size: var(--bb-text-small);
    font-weight: bold;
    margin: 0;
    padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
    border-bottom: 1px solid rgb(227, 227, 227);
    position: sticky;
    top: 0;
    background: rgb(255, 255, 255);
    z-index: 1;
    min-height: calc(var(--bb-grid-size) * 10);
    display: flex;
    align-items: center;
  }

  #inputs header {
    display: flex;
    align-items: center;
  }

  #timeline header {
    display: flex;
    padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
    border-bottom: 1px solid rgb(227, 227, 227);
  }

  #timeline label[for="narrow"],
  #narrow {
    font-size: var(--bb-text-small);
    margin: 0 var(--bb-grid-size) * 2);
    align-self: center;
  }

  #timeline header h1,
  #inputs header h1 {
    font-size: var(--bb-text-small);
    font-weight: bold;
    margin: 0;
    flex: 1;
    align-self: center;
  }

  #inputs #input-options {
    display: flex;
  }

  #inputs #input-options input {
    margin: 0 var(--bb-grid-size);
  }

  #inputs-list,
  #outputs-list,
  #history-list {
    scrollbar-gutter: stable;
    overflow-y: auto;
    font-size: var(--bb-text-small);
  }

  #inputs-list,
  #outputs-list {
    padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
  }

  #node-information {
    display: flex;
    flex-direction: column;
    position: absolute;
    bottom: 20px;
    left: 20px;
    max-width: calc(var(--bb-grid-size) * 90);
    max-height: 40%;
    border-radius: calc(var(--bb-grid-size) * 6);
    background: rgb(255, 255, 255);
    padding: calc(var(--bb-grid-size) * 4);
    border: 1px solid rgb(204, 204, 204);
    box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.13),
      0 7px 9px 0 rgba(0, 0, 0, 0.16);
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  #node-information h1 {
    font-size: var(--bb-text-medium);
    margin: 0;
    font-weight: 400;
    padding: 0 0 0 calc(var(--bb-grid-size) * 8);
    line-height: calc(var(--bb-grid-size) * 6);
    cursor: pointer;
    background: var(--bb-icon-info) 0 0 no-repeat;
  }

  #node-information dl {
    margin: calc(var(--bb-grid-size) * 2) 0;
    padding-right: calc(var(--bb-grid-size) * 5);
    display: grid;
    grid-template-columns: fit-content(50px) 1fr;
    column-gap: calc(var(--bb-grid-size) * 2);
    row-gap: calc(var(--bb-grid-size) * 1);
    font-size: var(--bb-text-nano);
    width: 100%;
    flex: 1;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  #node-information dd {
    margin: 0;
    font-weight: bold;
  }

  #node-information pre {
    font-size: var(--bb-text-nano);
    white-space: pre-wrap;
    margin: 0;
  }

  #node-information #close {
    position: absolute;
    right: calc(var(--bb-grid-size) * 3);
    top: calc(var(--bb-grid-size) * 4);
    width: 24px;
    height: 24px;
    background: var(--bb-icon-close) center center no-repeat;
    border: none;
    font-size: 0;
    opacity: 0.5;
    cursor: pointer;
  }

  #node-information #close:hover {
    opacity: 1;
  }

  #value {
    min-width: 60px;
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

  #continue {
    background: rgb(209, 203, 255);
    border-radius: calc(var(--bb-grid-size) * 3);
    font-size: var(--bb-text-small);
    font-weight: bold;
    height: calc(var(--bb-grid-size) * 5);
    border: none;
  }
`;
