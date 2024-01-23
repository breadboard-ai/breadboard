/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";

export const styles = css`
  :host {
    font-size: var(--bb-text-nano, 12px);
    position: relative;
    overflow: auto;
  }

  * {
    box-sizing: border-box;
  }

  #history-list {
    overflow-y: scroll;
    scrollbar-gutter: stable;
    height: 100%;
  }

  .empty {
    font-family: var(--bb-font-family);
    font-style: italic;
    color: #777;
  }

  table {
    width: 100%;
    min-width: 1px;
    padding: 0;
    margin: 0;
    table-layout: fixed;
    cursor: default;
  }

  thead,
  tr,
  td {
    padding: 0;
    margin: 0;
  }

  thead {
    position: sticky;
    top: 0;
    font-weight: bold;
    z-index: 1;
  }

  thead tr {
    height: calc(var(--bb-grid-size) * 6);
  }

  thead td:first-of-type {
    padding-left: calc(var(--bb-grid-size) * 11.5);
    width: calc(var(--bb-grid-size) * 35);
  }

  thead td:last-of-type {
    padding-right: calc(var(--bb-grid-size) * 5);
  }

  thead td {
    background: #fff;
    border-bottom: 1px solid #e3e3e3;
  }

  td {
    background: #fff;
    border-bottom: 1px solid #ebebeb;
    height: calc(var(--bb-grid-size) * 8);
    max-width: 100%;
    min-width: 1px;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    vertical-align: baseline;
    line-height: calc(var(--bb-grid-size) * 8);
    padding-right: calc(var(--bb-grid-size) * 1);
  }

  thead td.id,
  thead td.initiator {
    width: calc(var(--bb-grid-size) * 30);
  }

  tbody td.value {
    width: 100%;
    font-size: 0.95em;
    font-family: var(--bb-font-family-mono);
  }

  td:last-of-type {
    padding-right: calc(var(--bb-grid-size) * 5);
  }

  tbody tr[data-depth="0"].expanded td,
  tbody tr[data-depth="1"] td {
    background: var(--bb-depth-1);
  }

  tbody tr[data-depth="1"].expanded td,
  tbody tr[data-depth="2"] td {
    background: var(--bb-depth-2);
  }

  tbody tr[data-depth="2"].expanded td,
  tbody tr[data-depth="3"] td {
    background: var(--bb-depth-3);
  }

  tbody tr[data-depth="3"].expanded td,
  tbody tr[data-depth="4"] td {
    background: var(--bb-depth-4);
  }

  tbody tr:not([data-parent=""]) {
    display: none;
  }

  tbody tr:not([data-parent=""]).visible {
    display: table-row;
  }

  tr .toggle {
    width: 16px;
    height: 16px;
    display: inline-block;
    vertical-align: middle;
    position: relative;
    margin: 0 calc(var(--bb-grid-size) * 0.5) 0 calc(var(--bb-grid-size) * 1.5);
  }

  tr .marker {
    width: 8px;
    height: 100%;
    display: inline-block;
    vertical-align: middle;
    position: relative;
    margin: 0 calc(var(--bb-grid-size) * 2) 0 0;
  }

  tr .marker::after {
    content: "";
    width: 8px;
    height: 8px;
    border: 1px solid #666;
    background: #eee;
    border-radius: 50%;
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    box-sizing: border-box;
  }

  tr .marker.nodeend::after {
    border: 1px solid hsl(33.6, 100%, 52.5%);
    background: hsl(44.7, 100%, 80%);
  }

  tr .marker.graphstart::after,
  tr .marker.graphend::after {
    background: rgb(110, 84, 139);
    border: 1px solid rgb(90, 64, 119);
  }

  tr .marker.error::after {
    background: #cc0000;
    border: 1px solid #cc0000;
  }

  tr .marker.result::after {
    background: #ffa500;
    border: 1px solid #ffa500;
  }

  tr .marker.input::after {
    background: #c9daf8ff;
    border: 1px solid #3c78d8;
  }

  tr .marker.secrets::after {
    background: #f4cccc;
    border: 1px solid #db4437;
  }

  tr .marker.output::after {
    background: #b6d7a8ff;
    border: 1px solid #38761d;
  }

  tr .marker.load::after,
  tr .marker.end::after {
    background: var(--bb-done-color);
    border: 1px solid var(--bb-done-color);
  }

  tr .marker.nodestart::after {
    background: radial-gradient(
        var(--bb-progress-color-faded) 0%,
        var(--bb-progress-color-faded) 60%,
        transparent 60%,
        transparent 100%
      ),
      conic-gradient(transparent 0deg, var(--bb-progress-color) 360deg),
      linear-gradient(
        var(--bb-progress-color-faded),
        var(--bb-progress-color-faded)
      );

    border: none;
    animation: rotate 0.5s linear infinite;
  }

  tr .marker::before {
    background: #dadada;
  }

  tr.children.expanded .marker::before,
  tr:not([data-parent=""]) .marker::before {
    content: "";
    width: 2px;
    height: calc(100% + 2px);
    position: absolute;
    top: -1px;
    left: 50%;
    translate: -50% 0;
    box-sizing: border-box;
  }

  tr[data-parent=""].children.expanded .marker::before {
    height: 50%;
    translate: -50% 100%;
  }

  tr:not(.children) .marker.nodestart::before,
  tr[data-depth="0"].last .marker:not(.nodestart)::before,
  tr[data-depth="1"].last .marker:not(.nodestart)::before {
    height: 50%;
  }

  tr.children .toggle {
    background: var(--bb-icon-expand) center center no-repeat;
    background-size: contain;
  }

  tr.children.expanded .toggle {
    background: var(--bb-icon-collapse) center center no-repeat;
    background-size: contain;
  }

  tr .toggle input {
    opacity: 0;
    margin: 0;
    vertical-align: top;
  }

  tbody tr:hover td {
    background: var(--bb-depth-1);
  }

  tbody tr[data-depth="1"]:hover td {
    background: var(--bb-depth-2);
  }

  tbody tr[data-depth="2"]:hover td {
    background: var(--bb-depth-3);
  }

  tbody tr[data-depth="3"]:hover td {
    background: var(--bb-depth-4);
  }

  tbody tr[data-depth="4"]:hover td {
    background: var(--bb-depth-5);
  }

  #selected {
    overflow: auto;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    position: absolute;
    z-index: 2;
    pointer-events: none;
  }

  #content {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 80%;
    background: #fff;
    box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    overflow: auto;
  }

  #content header {
    position: sticky;
    top: 0;
    background: #fcfcfc;
    border-bottom: 1px solid #e3e3e3;
    height: calc(var(--bb-grid-size) * 6);
    line-height: calc(var(--bb-grid-size) * 6);
  }

  #content header #close {
    background: var(--bb-icon-close) center center no-repeat;
    background-size: contain;
    vertical-align: middle;
    width: 14px;
    height: 14px;
    font-size: 0;
    border: none;
    padding: 0;
    margin: 0 calc(var(--bb-grid-size) * 2);
  }

  #content #data {
    padding: calc(var(--bb-grid-size) * 2);
    padding-bottom: calc(var(--bb-grid-size) * 4);
    overflow-y: scroll;
    scrollbar-gutter: stable;
    box-sizing: border-box;
  }

  @keyframes rotate {
    from {
      transform: rotate(0);
    }

    to {
      transform: rotate(360deg);
    }
  }
`;
