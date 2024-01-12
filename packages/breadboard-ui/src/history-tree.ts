/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HistoryEntry, HistoryEventType } from "./types.js";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";
import {
  AnyRunResult,
  NodeEndResult,
  NodeStartResult,
} from "@google-labs/breadboard/harness";
import { ProbeMessage } from "@google-labs/breadboard";

const enum STATE {
  COLLAPSED = "collapsed",
  EXPANDED = "expanded",
}

type RunResultWithPath = ProbeMessage | NodeStartResult | NodeEndResult;
const hasPath = (event: AnyRunResult): event is RunResultWithPath =>
  event.type === "nodestart" ||
  event.type === "nodeend" ||
  event.type === "graphstart" ||
  event.type === "graphend";

type RunResultWithState = NodeStartResult;
const hasStateInfo = (event: AnyRunResult): event is RunResultWithState =>
  event.type === "nodestart";

const pathToId = (path: number[], type: RunResultWithPath["type"]) => {
  const isGraphNode = type === "graphstart" || type === "graphend";
  if (path.length == 0 && isGraphNode) {
    if (type === "graphstart") {
      return `path-main-graph-start`;
    } else {
      return `path-main-graph-end`;
    }
  }

  return `path-${path.join("-")}`;
};

const isValidHistoryEntry = (event: AnyRunResult): boolean => {
  return (
    event.type === "nodestart" ||
    event.type === "nodeend" ||
    event.type === "graphstart" ||
    event.type === "graphend" ||
    event.type === "end"
  );
};

@customElement("bb-history-tree")
export class HistoryTree extends LitElement {
  @property({ reflect: false })
  messages: AnyRunResult[] | null = null;

  @property({ reflect: true })
  messagePosition = 0;

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

      --depth-1: hsl(48deg, 60%, 98%);
      --depth-2: hsl(45deg, 60%, 96%);
      --depth-3: hsl(42deg, 60%, 94%);
      --depth-4: hsl(39deg, 60%, 92%);
      --depth-5: hsl(36deg, 60%, 90%);
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
      text-align: right;
      padding-right: calc(var(--bb-grid-size) * 5);
    }

    tbody tr[data-depth="0"].expanded td,
    tbody tr[data-depth="1"] td {
      background: var(--depth-1);
    }

    tbody tr[data-depth="1"].expanded td,
    tbody tr[data-depth="2"] td {
      background: var(--depth-2);
    }

    tbody tr[data-depth="2"].expanded td,
    tbody tr[data-depth="3"] td {
      background: var(--depth-3);
    }

    tbody tr[data-depth="3"].expanded td,
    tbody tr[data-depth="4"] td {
      background: var(--depth-4);
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
      background: var(--depth-1);
    }

    tbody tr[data-depth="1"]:hover td {
      background: var(--depth-2);
    }

    tbody tr[data-depth="2"]:hover td {
      background: var(--depth-3);
    }

    tbody tr[data-depth="3"]:hover td {
      background: var(--depth-4);
    }

    tbody tr[data-depth="4"]:hover td {
      background: var(--depth-5);
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

  #getTypeLabel(entry: HistoryEntry) {
    switch (entry.type) {
      case "graphstart":
        if (entry.data.path.length > 0) {
          return "Inner board started";
        }
        return "Board started";
      case "graphend":
        if (entry.data.path.length > 0) {
          return "Inner board finished";
        }
        return "Board finished";
      case "error":
        return "Error";
      case "skip":
        return "Skip";
      case "end":
        return "Complete";
      case "input":
        return "Input";
      case "output":
        return "Output";
      case "secret":
        return "Secret";
      default:
        return entry.data.node.type;
    }
  }

  #getNodeId(entry: HistoryEntry) {
    if (entry.type === "nodestart" || entry.type === "nodeend") {
      return entry.data.node.id;
    }

    return "";
  }

  #convertToHtml(
    entry: HistoryEntry,
    initiator: string | undefined = undefined,
    parent = "",
    last = false,
    depth = 0,
    visible = true
  ): HTMLTemplateResult {
    let dataOutput;
    if (entry.graphNodeData === null) {
      dataOutput = html`<span class="empty">(pending)</span>`;
    } else if (entry.graphNodeData === undefined) {
      dataOutput = html`<span class="empty">(none)</span>`;
    } else {
      dataOutput = html`${JSON.stringify(entry.graphNodeData)}`;
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

    const typeLabel = this.#getTypeLabel(entry);
    const entryClass = typeLabel.replaceAll(/\s/gim, "-").toLocaleLowerCase();
    const nodeId = this.#getNodeId(entry);

    return html`<tr
        class="${classMap({
          expanded,
          visible,
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
            class="${classMap({
              marker: true,
              [entry.type]: true,
              [entryClass]: true,
            })}"
          ></span>
          ${typeLabel}
        </td>
        <td class="id">${nodeId || html`<span class="empty">(none)</span>`}</td>
        <td class="initiator">
          ${initiator || html`<span class="empty">(none)</span>`}
        </td>
        <td class="value">${dataOutput}</td>
        <td>${this.#formatTime(entry.elapsedTime)}</td>
      </tr>
      ${entry.children.map((child, idx, items) =>
        this.#convertToHtml(
          child,
          nodeId || initiator,
          entry.id,
          idx === items.length - 1,
          depth + 1,
          visible && expanded
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
    if (entry.graphNodeData === null) {
      dataOutput = html`<span class="empty">(pending)</span>`;
    } else if (entry.graphNodeData === undefined) {
      dataOutput = html`<span class="empty">(none)</span>`;
    } else {
      dataOutput = html`${keyed(
        this.lastUpdate,
        html`<bb-json-tree
          .json=${entry.graphNodeData}
          autoExpand="true"
        ></bb-json-tree>`
      )}`;
    }

    const typeLabel = this.#getTypeLabel(entry);
    const nodeId = this.#getNodeId(entry);
    return html`<div id="selected">
      <section id="content">
        <header>
          <button
            @click=${() => (this.selected = null)}
            id="close"
            title="Close"
          >
            Close</button
          >${typeLabel} ${nodeId ? html`(${nodeId})` : nothing}
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

  #createHistoryEntry(event: AnyRunResult): HistoryEntry {
    const getNodeData = (): HistoryEntry["graphNodeData"] => {
      if (hasPath(event)) {
        if (hasStateInfo(event) && typeof event.data.state === "object") {
          const id = hasPath(event) ? event.data.node.id : "";
          const nodeValues = event.data.state.state.state.get(id);
          if (!nodeValues) {
            return null;
          }

          const nodeValue: Record<string, unknown[]> = {};
          for (const [key, value] of nodeValues.entries()) {
            nodeValue[key] = value;
          }

          return { inputs: nodeValue, outputs: {} };
        }

        return undefined;
      }

      return { inputs: event.data, outputs: {} };
    };

    const elapsedTime = 0;
    // globalThis.performance.now() - this.#lastHistoryEventTime;

    return {
      ...event,
      graphNodeData: getNodeData(),
      id: hasPath(event) ? pathToId(event.data.path, event.type) : "",
      guid: globalThis.crypto.randomUUID(),
      elapsedTime,
      children: [],
    };
  }

  #findParentHistoryEntry(
    path: number[],
    type: RunResultWithPath["type"],
    entries: HistoryEntry[]
  ) {
    let entryList = entries;
    for (let idx = 0; idx < path.length - 1; idx++) {
      const id = pathToId(path.slice(0, idx + 1), type);
      const parentId = entryList.findIndex((item) => item.id === id);
      if (parentId === -1) {
        console.warn(`Unable to find ID "${id}"`);
        return entries;
      }

      entryList = entryList[parentId].children;
    }

    return entryList;
  }

  #updateHistoryEntry(event: NodeEndResult, entries: HistoryEntry[]) {
    const id = pathToId(event.data.path, event.type);
    const entryList = this.#findParentHistoryEntry(
      event.data.path,
      event.type,
      entries
    );
    const existingEntry = entryList.find((item) => item.id === id);
    if (!existingEntry) {
      console.warn(`Unable to find ID "${id}"`);
      return;
    }

    // We may have a nodestart which leads into a graphstart of the same ID, but
    // we'll then receive a graphend before a nodeend against that same ID. This
    // can cause UI confusion so we double check here that if we have a graphend
    // or a nodeend that it tallies with a corresponding graphstart/nodestart.
    const typesMatch =
      existingEntry.type === HistoryEventType.NODESTART &&
      event.type === HistoryEventType.NODEEND;
    if (!typesMatch) {
      return;
    }

    (existingEntry as unknown as NodeEndResult).type = event.type;

    if (existingEntry.graphNodeData && "outputs" in event.data) {
      existingEntry.graphNodeData.outputs = event.data.outputs;
    }

    // Set any 'pending' values to none.
    if (existingEntry.graphNodeData === null) {
      existingEntry.graphNodeData = undefined;
    }

    // this.#lastHistoryEventTime = globalThis.performance.now();
  }

  render() {
    if (this.messages === null) {
      return html`There are no history entries yet.`;
    }

    this.#dataByGuid.clear();

    const entries: HistoryEntry[] = [];
    for (let m = 0; m < this.messagePosition; m++) {
      const message = this.messages[m];

      // Not all messages are shown in the history, so just skip over them here.
      // TODO: Make this configurable.
      if (!isValidHistoryEntry(message)) {
        continue;
      }

      if (message.type === "nodeend") {
        this.#updateHistoryEntry(message, entries);
        continue;
      }

      const entry = this.#createHistoryEntry(message);
      if (hasPath(message)) {
        let entryList = this.#findParentHistoryEntry(
          message.data.path,
          message.type,
          entries
        );
        const existingNode = entryList.find(
          (sibling) => sibling.id === pathToId(message.data.path, message.type)
        );

        // If there is an existing node, and this is either a graphstart/end node
        // then append an ID to it and make it a child of the existing one.
        if (existingNode) {
          message.data.path.push(existingNode.children.length);
          entry.id = pathToId(message.data.path, message.type);
          entryList = existingNode.children;
        }

        entryList.push(entry);
      } else {
        entries.push(entry);
      }
    }

    return html`<div id="history-list">
      <table cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <td>Type</td>
            <td class="id">ID</td>
            <td class="initiator">Initiator</td>
            <td class="value">Value</td>
            <td>Duration</td>
          </tr>
        </thead>
        <tbody>
          ${entries.length === 0
            ? html`<tr data-parent="">
                <td colspan="5">No entries</td>
              </tr>`
            : entries.map((entry) => {
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
