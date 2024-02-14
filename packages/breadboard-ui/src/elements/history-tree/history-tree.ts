/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HistoryEntry, HistoryEventType } from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { keyed } from "lit/directives/keyed.js";
import {
  HarnessRunResult,
  HarnessProbeResult,
} from "@google-labs/breadboard/harness";
import {
  NodeEndProbeMessage,
  NodeStartProbeMessage,
  traversalResultFromStack,
} from "@google-labs/breadboard";
import { styles as historyTreeStyles } from "./history-tree.styles.js";
import { ClientRunResult } from "@google-labs/breadboard/remote";

const enum STATE {
  COLLAPSED = "collapsed",
  EXPANDED = "expanded",
}

type RunResultWithPath = HarnessProbeResult;
const hasPath = (event: HarnessRunResult): event is RunResultWithPath =>
  event.type === "nodestart" ||
  event.type === "nodeend" ||
  event.type === "graphstart" ||
  event.type === "graphend";

type RunResultWithState = ClientRunResult<NodeStartProbeMessage>;
const hasStateInfo = (event: HarnessRunResult): event is RunResultWithState =>
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

const isValidHistoryEntry = (event: HarnessRunResult): boolean => {
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
  messages: HarnessRunResult[] | null = null;

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

  static styles = historyTreeStyles;

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

  #createHistoryEntry(event: HarnessRunResult): HistoryEntry {
    const getNodeData = (): HistoryEntry["graphNodeData"] => {
      if (hasPath(event)) {
        if (hasStateInfo(event) && typeof event.state === "object") {
          const id = hasPath(event) ? event.data.node.id : "";
          const traversalResult = traversalResultFromStack(event.state);
          if (!traversalResult) {
            return null;
          }
          const nodeValues = traversalResult.state.state.get(id);
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

    return {
      ...event,
      graphNodeData: getNodeData(),
      id: hasPath(event) ? pathToId(event.data.path, event.type) : "",
      guid: globalThis.crypto.randomUUID(),
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

  #updateHistoryEntry(event: NodeEndProbeMessage, entries: HistoryEntry[]) {
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

    (existingEntry as unknown as NodeEndProbeMessage).type = event.type;

    if (existingEntry.graphNodeData && "outputs" in event.data) {
      existingEntry.graphNodeData.outputs = event.data.outputs;
    }

    // Set any 'pending' values to none.
    if (existingEntry.graphNodeData === null) {
      existingEntry.graphNodeData = undefined;
    }
  }

  render() {
    if (this.messages === null) {
      return html`There are no history entries yet.`;
    }

    this.#dataByGuid.clear();

    const entries: HistoryEntry[] = [];
    for (let m = 0; m <= this.messagePosition; m++) {
      const message = this.messages[m];

      // Not all messages are shown in the history, so just skip over them here.
      // TODO: Make this configurable.
      if (!message || !isValidHistoryEntry(message)) {
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
          </tr>
        </thead>
        <tbody>
          ${entries.length === 0
            ? html`<tr data-parent="">
                <td colspan="4">No entries</td>
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
