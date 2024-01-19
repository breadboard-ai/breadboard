/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  HarnessProbeResult,
  HarnessRunResult,
} from "@google-labs/breadboard/harness";
import { map } from "lit/directives/map.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { MessageTraversalEvent } from "../../events/events.js";
import { repeat } from "lit/directives/repeat.js";
import { guard } from "lit/directives/guard.js";

type RunResultWithPath = HarnessProbeResult;
const hasPath = (event: HarnessRunResult): event is RunResultWithPath =>
  event.type === "nodestart" ||
  event.type === "nodeend" ||
  event.type === "graphstart" ||
  event.type === "graphend";

const pathToId = (path: number[]) => {
  if (path.length == 0) {
    return "root";
  }

  return path.join("-");
};

type TrackName = string;
type ColumnIdx = number;
type MessageIdx = number;

@customElement("bb-timeline-controls")
export class TimelineControls extends LitElement {
  @property({ reflect: false })
  messages: HarnessRunResult[] | null = null;

  @property({ reflect: true })
  messagePosition = 0;

  @property({ reflect: true })
  narrow = false;

  #timeline = new Map<TrackName, Map<ColumnIdx, MessageIdx>>();
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: auto;
      position: relative;
      user-select: none;
      --entry-padding-x: 3px;
      --entry-padding-y: 3px;
      --entry-width: 18px;
      --entry-height: 18px;
      --header-width: 120px;
      --entry-dot-size: 8px;
    }

    #tracks.narrow {
      --entry-padding-x: 1px;
      --entry-width: 6px;
      --entry-height: 18px;
      --entry-dot-size: 2px;
    }

    #tracks {
      min-width: 100%;
    }

    #marker {
      position: absolute;
      top: 0;
      left: calc(var(--header-width) + var(--x) * var(--entry-width));
      height: max(100%, calc(var(--rows) * var(--entry-height)));
      width: var(--entry-width);
      background: rgba(113, 106, 162, 0.08);
      z-index: 1;
    }

    :host::after {
      content: "";
      height: 100%;
      width: 1px;
      background: #f3f3f3;
      position: absolute;
      top: 0;
      left: calc(var(--header-width) - 1px);
      z-index: 3;
    }

    .filler,
    .track {
      height: calc(var(--entry-height) - 1px);
      font-size: var(--bb-text-pico);
      width: max(
        100%,
        calc(var(--header-width) + var(--count) * var(--entry-width))
      );
      border-bottom: 1px solid #f3f3f3;
    }

    .filler {
      height: calc(100% - var(--rows) * var(--entry-height) - 1px);
      border-bottom: none;
    }

    .header {
      position: sticky;
      width: var(--header-width);
      height: calc(100% + 1px);
      background: rgb(255, 255, 255);
      border-bottom: 1px solid #f3f3f3;
      border-right: 1px solid #f3f3f3;
      box-sizing: border-box;
      padding: 0 calc(var(--bb-grid-size) * 4);
      white-space: nowrap;
      display: flex;
      align-items: center;
      left: 0;
      z-index: 4;
    }

    .filler .header {
      border-bottom: none;
    }

    .entry {
      left: calc(var(--header-width) - 1px + var(--x) * var(--entry-width));
      top: calc(-1px + var(--y) * var(--entry-height));
      position: absolute;
      width: calc(var(--entry-width) + 1px);
      height: calc(var(--entry-height) + 1px);
      box-sizing: border-box;
      border: 1px solid transparent;

      --entry-background-height: calc(
        var(--entry-height) - var(--entry-padding-y) * 2
      );
      --entry-background-cap-width: calc(
        var(--entry-width) - var(--entry-padding-x)
      );
    }

    .entry.nodestart,
    .entry.graphend,
    .entry.graphstart,
    .entry.end {
      border-left: 1px solid #f3f3f3;
    }

    .entry.end {
      border-right: 1px solid #f3f3f3;
    }

    .entry.nodestart::before {
      content: "";
      width: var(--entry-background-cap-width);
      position: absolute;
      background: rgb(253 243 213);
      border-radius: 20px 0 0 20px;
      height: var(--entry-background-height);
      left: var(--entry-padding-x);
      top: 50%;
      translate: 0 -50%;
    }

    .entry.nodeend::before {
      content: "";
      width: calc(
        var(--backfill, 0) * var(--entry-width) +
          var(--entry-background-cap-width) - 1px
      );
      position: absolute;
      background: rgb(253 243 213);
      border-radius: 0 20px 20px 0;
      height: var(--entry-background-height);
      left: calc(var(--backfill, 0) * var(--entry-width) * -1);
      top: 50%;
      translate: 0 -50%;
    }

    .entry:not(.nodestart):not(.nodeend)::before {
      content: "";
      width: calc(100% + 1px);
      position: absolute;
      background: rgb(253 243 213);
      height: var(--entry-background-height);
      left: 0;
      top: 50%;
      translate: 0 -50%;
    }

    .entry.nodestart.input::before,
    .entry.nodeend.input::before,
    .entry:not(.nodestart):not(.nodeend).input::before {
      background: rgb(231 238 250);
    }

    .entry.nodestart.output::before,
    .entry.nodeend.output::before,
    .entry:not(.nodestart):not(.nodeend).output::before {
      background: rgb(228 243 221);
    }

    .entry.nodestart.secrets::before,
    .entry.nodeend.secrets::before,
    .entry:not(.nodestart):not(.nodeend).secrets::before {
      background: rgb(246 239 239);
    }

    .entry:not(.nodestart):not(.nodeend).graphstart::before,
    .entry:not(.nodestart):not(.nodeend).graphend::before,
    .entry:not(.nodestart):not(.nodeend).secrets::before,
    .entry:not(.nodestart):not(.nodeend).secret::before,
    .entry:not(.nodestart):not(.nodeend).end::before {
      background: none;
    }

    .entry::after {
      content: "";
      width: var(--entry-dot-size);
      height: var(--entry-dot-size);
      border: 1px solid #666;
      background: #eee;
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      translate: -50% -50%;
      box-sizing: border-box;
    }

    .entry.nodestart::after,
    .entry.nodeend::after {
      border: 1px solid hsl(33.6, 100%, 52.5%);
      background: hsl(44.7, 100%, 80%);
    }

    .entry.graphstart::after,
    .entry.graphend::after {
      background: rgb(110, 84, 139);
      border: 1px solid rgb(90, 64, 119);
    }

    .entry.error::after {
      background: #cc0000;
      border: 1px solid #cc0000;
    }

    .entry.result::after {
      background: #ffa500;
      border: 1px solid #ffa500;
    }

    .entry.input::after {
      background: #c9daf8ff;
      border: 1px solid #3c78d8;
    }

    .entry.secret::after,
    .entry.secrets::after {
      background: #f4cccc;
      border: 1px solid #db4437;
    }

    .entry.output::after {
      background: #b6d7a8ff;
      border: 1px solid #38761d;
    }

    .entry.load::after,
    .entry.end::after {
      background: var(--bb-done-color);
      border: 1px solid var(--bb-done-color);
    }

    .drag-receiver {
      position: absolute;
      width: var(--entry-width);
      top: 0;
      left: calc(var(--header-width) + var(--x) * var(--entry-width));
      height: 100%;
      z-index: 5;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("pointerdown", this.#onPointerDownBound);
    document.body.addEventListener("pointermove", this.#onPointerMoveBound);
    document.body.addEventListener("pointerup", this.#onPointerUpBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    document.body.removeEventListener("pointermove", this.#onPointerMoveBound);
    document.body.removeEventListener("pointerup", this.#onPointerUpBound);
  }

  #isDragging = false;
  #onPointerDown(evt: PointerEvent) {
    this.#isDragging = true;
    this.#dispatchTraversalEventIfNeeded(evt);
  }

  #onPointerMove(evt: PointerEvent) {
    if (!this.#isDragging) {
      return;
    }

    this.#dispatchTraversalEventIfNeeded(evt);
  }

  #onPointerUp() {
    this.#isDragging = false;
  }

  #dispatchTraversalEventIfNeeded(evt: PointerEvent) {
    const [top] = evt.composedPath();
    if (!(top instanceof HTMLElement)) {
      return;
    }

    const { idx } = top.dataset;
    if (!idx) {
      return;
    }

    this.dispatchEvent(new MessageTraversalEvent(parseInt(idx, 10)));
  }

  render() {
    if (!this.messages) {
      return nothing;
    }

    this.#timeline.clear();

    let column = 0;
    let rows = 0;
    let lastPath = null;
    let markerX = 0;
    let markerIdx = this.messagePosition;
    if (markerIdx >= 0 && markerIdx >= this.messages.length) {
      markerIdx = this.messages.length - 1;
    }

    for (let m = 0; m < this.messages.length; m++) {
      const message = this.messages[m];
      let trackName: string | null = null;
      if (!hasPath(message)) {
        trackName = lastPath;
      } else {
        trackName = pathToId(message.data.path.slice(0, -1));
      }

      // Track with no preceding nodestart.
      if (!trackName) {
        continue;
      }

      // At a nodeend point stop tracking the path so that the next node
      // gets a fresh start.
      if (message.type === "nodeend") {
        lastPath = null;
      } else {
        lastPath = trackName;
      }

      let entries = this.#timeline.get(trackName);
      if (!entries) {
        entries = new Map();
        this.#timeline.set(trackName, entries);
        rows++;
      }

      if (m === markerIdx) {
        markerX = column;
      }

      entries.set(column, m);
      column++;
    }

    const timeline = () => html` ${repeat(
        this.#timeline.entries(),
        (trackName) => trackName,
        ([trackName, entries], row) => {
          let currentType = "";
          let lastNodeType = "";
          let lastNodeColumn = 0;
          return html`<div class="track">
            <div class="header">
              ${trackName === "root"
                ? "Main Board"
                : `Sub Board (${trackName})`}
            </div>
            ${map(entries, ([column, messageIdx]) => {
              if (!this.messages) {
                return nothing;
              }

              const message = this.messages[messageIdx];
              if (message.type === "nodestart") {
                currentType = message.data.node.type;
                lastNodeColumn = column;
              }

              const styles: {
                "--x": number;
                "--y": number;
                "--backfill"?: number;
              } = { ["--x"]: column, ["--y"]: row };

              // Special-case: the last node was a nodestart, but it doesn't have an
              // adjacent index. This implies that it's something like an invoke
              // node and therefore the start of a subgraph. As such we prefill
              // the gap so that it implies the continuation of the invoke on the
              // parent board.
              if (
                message.type === "nodeend" &&
                lastNodeType === "nodestart" &&
                lastNodeColumn !== column - 1
              ) {
                const backfill = column - lastNodeColumn - 1;
                styles["--backfill"] = backfill;
              }

              const tmpl = html`<div
                  class=${classMap({
                    entry: true,
                    [message.type]: true,
                    [currentType]: true,
                  })}
                  style=${styleMap(styles)}
                ></div>
                <div
                  class="drag-receiver"
                  data-idx=${messageIdx}
                  style=${styleMap({ ["--x"]: column })}
                  title="${"id" in message ? message.id : ""}"
                ></div>`;

              if (message.type === "nodeend") {
                currentType = "";
              }

              lastNodeType = message.type;

              return tmpl;
            })}
          </div>`;
        }
      )}
      <div
        class="filler"
        style=${styleMap({
          ["--rows"]: rows,
        })}
      >
        <div class="header"></div>
      </div>`;

    const marker = () => html`<div
      id="marker"
      style=${styleMap({
        ["--x"]: markerX,
        ["--rows"]: rows,
      })}
    ></div>`;

    return html`<div
      id="tracks"
      class=${classMap({ narrow: this.narrow })}
      style=${styleMap({ ["--count"]: column })}
    >
      ${guard([this.messages.length], timeline)}
      ${guard([this.messagePosition], marker)};
    </div>`;
  }
}
