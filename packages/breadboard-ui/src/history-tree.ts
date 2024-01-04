/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HistoryEntry, HistoryEventType } from "./types.js";
import { classMap } from "lit/directives/class-map.js";

const enum STATE {
  COLLAPSED = "collapsed",
  EXPANDED = "expanded",
}

@customElement("bb-history-tree")
export class HistoryTree extends LitElement {
  @property({ reflect: false })
  history: HistoryEntry[] | null = null;

  @property()
  lastUpdate: number = Number.NaN;

  @state()
  expandCollapseState: Map<string, STATE> = new Map();

  @property({ reflect: false })
  selected: HistoryEntry | null = null;

  #dataByGuid: Map<string, HistoryEntry> = new Map();
  #autoExpand: Set<string> = new Set();
  #onKeyDownBound = this.#onKeyDown.bind(this);

  static styles = css`
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
      width: calc(var(--bb-grid-size) * 25);
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

    thead td.id {
      width: calc(var(--bb-grid-size) * 30);
    }

    tbody td.value {
      width: 100%;
      font-size: 0.95em;
      font-family: var(--bb-font-family-mono);
    }

    td:last-of-type {
      text-align: right;
      padding-right: calc(var(--bb-grid-size) * 5);
    }

    tbody tr.children.expanded td {
      background: #f0f0f0;
    }

    tbody tr:not([data-parent=""]) td {
      background: #fcfcfc;
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
      margin: 0 calc(var(--bb-grid-size) * 0.5) 0
        calc(var(--bb-grid-size) * 1.5);
    }

    tr .marker {
      width: 8px;
      height: 100%;
      display: inline-block;
      vertical-align: middle;
      position: relative;
      margin: 0 calc(var(--bb-grid-size) * 2) 0 0;
    }

    tr[data-depth="2"] .marker {
      translate: 4px 0;
    }

    tr[data-depth="3"] .marker,
    tr[data-depth="4"] .marker,
    tr[data-depth="5"] .marker {
      translate: 8px 0;
    }

    tr .marker::after {
      content: "";
      width: 8px;
      height: 8px;
      border: 1px solid #333;
      background: #fff;
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      translate: -50% -50%;
      box-sizing: border-box;
    }

    tr .marker.load::after {
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

    tr .marker.done::after {
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

    tr .marker.nodeend::after {
      border: 1px solid #ffab40;
      background: #fff2ccff;
    }

    tr .marker::before {
      background: #dadada;
    }

    tr[data-depth="2"] .marker::before,
    tr[data-depth="3"] .marker::before,
    tr[data-depth="4"] .marker::before,
    tr[data-depth="5"] .marker::before {
      background: #cbcbcb;
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
      background: #efefef;
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

  #formatTime(time: number) {
    if (time === 0) {
      return "-";
    }

    if (time > 1000) {
      time /= 1000;
      return time.toFixed(2) + "s";
    }

    return time.toFixed(1) + "ms";
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.selected = null;
  }

  #convertToHtml(
    entry: HistoryEntry,
    parent = "",
    last = false,
    depth = 0
  ): HTMLTemplateResult {
    let dataOutput;
    if (entry.data === null) {
      dataOutput = html`<span class="empty">(pending)</span>`;
    } else if (entry.data === undefined) {
      dataOutput = html`<span class="empty">(none)</span>`;
    } else {
      dataOutput = html`${JSON.stringify(entry.data)}`;
    }

    if (entry.type === HistoryEventType.NODESTART) {
      this.#autoExpand.add(entry.id);
    } else if (entry.type === HistoryEventType.NODEEND) {
      this.#autoExpand.delete(entry.id);
    }

    this.#dataByGuid.set(entry.guid, entry);

    // By default we will use the expand-collapse state to decide what to
    // do with the entry. If there is no entry then we fall back to the
    // set of auto-expand entries and see if it's there.
    const expanded = this.expandCollapseState.has(entry.id)
      ? this.expandCollapseState.get(entry.id) === STATE.EXPANDED
      : this.#autoExpand.has(entry.id);

    return html`<tr
        class="${classMap({
          expanded,
          visible: this.expandCollapseState.has(parent)
            ? this.expandCollapseState.get(parent) === STATE.EXPANDED
            : this.#autoExpand.has(parent),
          children: entry.children.length > 0,
          last: last,
        })}"
        id="${entry.id || nothing}"
        data-parent="${parent}"
        data-guid="${entry.guid}"
        data-depth="${depth}"
        @click="${this.#selectRow}"
      >
        <td>
          <span class="toggle"
            >${entry.children.length > 0
              ? html`<input
                  @input=${this.#toggleRow}
                  value="${entry.id}"
                  class="toggle"
                  type="checkbox"
                  ?checked=${expanded}
                />`
              : nothing}</span
          >
          <span
            class="${classMap({ marker: true, [entry.type]: true })}"
          ></span>
          ${entry.summary}
        </td>
        <td class="id">
          ${entry.nodeId || html`<span class="empty">(none)</span>`}
        </td>
        <td class="value">${dataOutput}</td>
        <td>${this.#formatTime(entry.elapsedTime)}</td>
      </tr>
      ${entry.children.map((child, idx, items) =>
        this.#convertToHtml(
          child,
          entry.id,
          idx === items.length - 1,
          depth + 1
        )
      )}`;
  }

  #selectRow(evt: Event) {
    if (!(evt.target instanceof HTMLElement)) {
      return;
    }

    if (evt.target.classList.contains("toggle")) {
      return;
    }

    let guid;
    let target: HTMLElement | null = evt.target;
    do {
      guid = target.dataset.guid;
      if (guid) {
        break;
      }
      target = target.parentElement;
    } while (target);

    if (!guid) {
      return;
    }

    this.selected = this.#dataByGuid.get(guid) || null;
  }

  #toggleRow(evt: Event) {
    if (!(evt.target instanceof HTMLInputElement)) {
      return;
    }

    this.expandCollapseState.set(
      evt.target.value,
      evt.target.checked ? STATE.EXPANDED : STATE.COLLAPSED
    );

    this.requestUpdate();
  }

  #convertSelectedToHtml(entry: HistoryEntry) {
    let dataOutput;
    if (entry.data === null) {
      dataOutput = html`<span class="empty">(pending)</span>`;
    } else if (entry.data === undefined) {
      dataOutput = html`<span class="empty">(none)</span>`;
    } else {
      dataOutput = html`<bb-json-tree
        .json=${entry.data}
        autoExpand="true"
      ></bb-json-tree>`;
    }

    return html`<div id="selected">
      <section id="content">
        <header>
          <button
            @click=${() => (this.selected = null)}
            id="close"
            title="Close"
          >
            X</button
          >${entry.summary} ${entry.nodeId ? html`(${entry.nodeId})` : nothing}
        </header>

        <div id="data">${dataOutput}</div>
      </section>
    </div>`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  render() {
    if (this.history === null) {
      return html`There are no history entries yet.`;
    }

    this.#dataByGuid.clear();

    return html`<div id="history-list">
      <table cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <td>Type</td>
            <td class="id">ID</td>
            <td class="value">Value</td>
            <td>Duration</td>
          </tr>
        </thead>
        <tbody>
          ${this.history.map((entry) => {
            return this.#convertToHtml(entry);
          })}
        </tbody>
      </table>
      <div>
        ${this.selected ? this.#convertSelectedToHtml(this.selected) : nothing}
      </div>
    </div>`;
  }
}
