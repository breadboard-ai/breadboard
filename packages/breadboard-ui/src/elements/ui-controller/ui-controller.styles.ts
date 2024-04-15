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
  }

  #controls-activity {
    display: grid;
    grid-template-rows: auto calc(var(--bb-grid-size) * 14);
  }

  #diagram {
    border-right: 1px solid #d9d9d9;
  }

  #run {
    background: var(--bb-selected-color);
    color: #fff;
    border-radius: 20px;
    border: none;
    font-size: var(--bb-label-large);
    padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 8);
  }

  #run[disabled] {
    opacity: 0.4;
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
    border: 1px solid #d9d9d9;
    border-radius: calc(var(--bb-grid-size) * 2);
    overflow-y: scroll;
    box-shadow:
      0px 1px 2px rgba(0, 0, 0, 0.3),
      0px 1px 3px 1px rgba(0, 0, 0, 0.15);
    margin-bottom: 40px;
    margin-right: 40px;
  }

  #details.active {
    display: block;
  }

  .failed-to-load {
    background: var(--bb-neutral-100);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
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
`;
