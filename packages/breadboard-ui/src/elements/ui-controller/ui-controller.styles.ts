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
    height: 100%;
    overscroll-behavior: contain;
    overflow: auto;
    --diagram-display: flex;
  }

  #controls-activity,
  #diagram {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    display: grid;
    grid-template-rows: calc(var(--bb-grid-size) * 10) auto;
  }

  #diagram {
    border-right: 1px solid #d9d9d9;
  }

  #run {
    background: #987EE5;
    color: #FFF;
    border-radius: 20px;
    border: none;
    height: 100%;
    padding: 0 calc(var(--bb-grid-size) * 4);
  }

  #run[disabled] {
    opacity: 0.4;
  }

  #controls,
  #breadcrumbs {
    border-bottom: 1px solid #d9d9d9;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: calc(var(--bb-grid-size) * 1.5);
    font-size: var(--bb-text-medium);
  }

  #controls {
    display: flex;
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
    overflow: auto;
    background: rgb(255, 255, 255);
  }

  #timeline,
  #inputs,
  #outputs,
  #history {
    display: flex;
    flex-direction: column;
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

  #inputs-list {
    position: absolute;
    bottom: 20px;
    width: calc(100% - 20px);
    max-width: min(80vw, 520px);
  }

  #inputs-list,
  #outputs-list {
    padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
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

  #continue {
    background: rgb(209, 203, 255);
    border-radius: calc(var(--bb-grid-size) * 3);
    font-size: var(--bb-text-small);
    font-weight: bold;
    height: calc(var(--bb-grid-size) * 5);
    border: none;
  }

  #details {
    display: none;
    position: fixed;
    z-index: 100;
    background: #fff;
    padding: 10px;
    width: auto;
    height: calc(100% - var(--top));
    max-height: 50vh;
    top: var(--top, 0);
    left: var(--left, 0);
    border: 1px solid #D9D9D9;
    border-radius: calc(var(--bb-grid-size) * 2);
    overflow-y: scroll;
    box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15);
    margin-bottom: 40px;
    margin-right: 40px;
  }

  #details.active {
    display: block;
  }
`;
