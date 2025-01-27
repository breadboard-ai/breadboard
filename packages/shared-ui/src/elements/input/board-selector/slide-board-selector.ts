/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { GraphIdentifier, InspectableGraph } from "@google-labs/breadboard";
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import {
  BoardChosenEvent,
  WorkspaceNewItemCreateRequestEvent,
} from "../../../events/events";
import { classMap } from "lit/directives/class-map.js";
import { getSubItemColor } from "../../../utils/subgraph-color";
import { styleMap } from "lit/directives/style-map.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";

const ITEM_HEIGHT = 24;

@customElement("bb-slide-board-selector")
export class SlideBoardSelector extends LitElement {
  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor value: GraphIdentifier | null = null;

  @state()
  accessor active = false;

  @state()
  private accessor selectedIndex: number | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      height: var(--bb-grid-size-5);
      position: relative;
    }

    :host([list]) {
      margin-left: var(--bb-grid-size);
    }

    :host([tree]) {
      margin-top: var(--bb-grid-size);
    }

    button.proxy,
    button.subgraph {
      display: inline-flex;
      align-items: center;
      border: none;
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      height: var(--bb-grid-size-5);
      cursor: pointer;
      white-space: nowrap;
      opacity: 0.4;
      transition: opacity 0.15s cubic-bezier(0, 0, 0.3, 1);
      padding: 0;
      width: 100%;
      background: transparent;
    }

    button.subgraph span {
      display: flex;
      align-items: center;
      white-space: nowrap;
      height: 100%;
      background: var(--subgraph-label-color, var(--bb-ui-50));
      color: var(--subgraph-label-text-color, var(--bb-neutral-800));
      border-radius: 40px;
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size);
    }

    button.subgraph.active,
    button.subgraph:hover,
    button.subgraph:focus {
      opacity: 1;
    }

    button.proxy {
      background: red;
      width: 100%;
      opacity: 1;
      padding-right: var(--bb-grid-size-5);
    }

    ul.proxy {
      list-style: none;
      padding: 0;
      background: var(--bb-neutral-0);
      margin: 0;
      position: fixed;
      left: var(--left, 0);
      top: var(--top, 0);
      z-index: 2;
      overflow-y: scroll;
      max-height: var(--bb-grid-size-5);
      opacity: 0;
    }

    :host(:not(.drag)) ul.proxy {
      scroll-snap-type: y mandatory;
    }

    ul.renderable {
      list-style: none;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-7) var(--bb-grid-size-2)
        var(--bb-grid-size-2);
      margin: 0;
      position: fixed;
      left: calc(var(--left, 0) + var(--bb-grid-size-2) * -1);
      top: calc(var(--top, 0) + var(--bb-grid-size-2) * -1);
      z-index: 1;
      border-radius: 16px;
      box-shadow: 0 0 0 1px var(--bb-neutral-300);
      background: var(--bb-neutral-0);
      transform: translateY(var(--y-offset));
    }

    ul.renderable::after {
      content: "";
      position: absolute;
      top: var(--bb-grid-size);
      left: var(--bb-grid-size);
      z-index: 3;
      border: 2px solid var(--bb-neutral-600);
      width: calc(100% - var(--bb-grid-size-3));
      height: var(--bb-grid-size-6);
      border-radius: var(--bb-grid-size-6);
      visibility: visible;
      pointer-events: none;
      transform: translateY(calc(var(--y-offset) * -1));
      background: var(--bb-icon-up-down) right center / 20px 20px no-repeat;
    }

    li {
      scroll-snap-stop: normal;
      scroll-snap-align: center;
      margin: 0 0 var(--bb-grid-size) 0;
      display: flex;
      width: 100%;
    }

    li:last-of-type {
      margin-bottom: 0;
    }

    button.subgraph[disabled] {
      opacity: 0.4;
      cursor: default;
    }

    button.proxy::before,
    button.subgraph span::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 16px 16px
        no-repeat;
      margin-right: var(--bb-grid-size);
    }

    button.subgraph.inverted span::before {
      background-image: var(--bb-icon-board-inverted);
    }
  `;

  #onMouseMoveBound = this.#onMouseMove.bind(this);
  #onMouseUpBound = this.#onMouseUp.bind(this);

  #listRef: Ref<HTMLUListElement> = createRef();
  #activeOnMouseDown = false;
  #hasMoved = false;
  #clickTarget: GraphIdentifier | null = null;

  #toggleActiveState(id: GraphIdentifier) {
    if (!this.active) {
      this.active = true;
      return;
    }

    this.active = false;
    this.dispatchEvent(new BoardChosenEvent(id));
  }

  #renderGraphButton(
    subGraphId: GraphIdentifier,
    graph: InspectableGraph,
    active = false
  ) {
    return html`<button
      class=${classMap({
        active,
        subgraph: true,
        inverted:
          getSubItemColor<number>(subGraphId, "text", true) === 0xffffff,
      })}
      style=${styleMap({
        "--subgraph-border-color": getSubItemColor(subGraphId, "border"),
        "--subgraph-label-color": getSubItemColor(subGraphId, "label"),
        "--subgraph-label-text-color": getSubItemColor(subGraphId, "text"),
      })}
      @click=${() => {
        this.#toggleActiveState(subGraphId);
      }}
    >
      <span>${graph.raw().title ?? "Untitled graph"}</span>
    </button>`;
  }

  #onMouseMove(evt: MouseEvent) {
    if (!this.#listRef.value) {
      return;
    }

    this.#hasMoved = true;
    this.#listRef.value.scrollTop -= evt.movementY;
  }

  #onMouseUp() {
    document.exitPointerLock();
    this.classList.remove("drag");
    this.removeEventListener("mousemove", this.#onMouseMoveBound);

    if (this.#activeOnMouseDown && !this.#hasMoved) {
      if (this.#clickTarget) {
        this.#toggleActiveState(this.#clickTarget);
      } else {
        this.dispatchEvent(new WorkspaceNewItemCreateRequestEvent());
      }
    } else if (this.#hasMoved) {
      if (this.selectedIndex === null) {
        return;
      }

      const subGraphs = Object.keys(this.graph?.graphs() ?? {});
      const idx = Math.round(this.selectedIndex ?? 0) - 1;
      const subGraph = subGraphs[idx];
      if (!subGraph) {
        this.dispatchEvent(new WorkspaceNewItemCreateRequestEvent());
        return;
      }

      this.#toggleActiveState(subGraph);
    }
  }

  async #startDragBehavior(
    evt: MouseEvent,
    subGraphId: GraphIdentifier | null
  ) {
    evt.preventDefault();
    evt.stopImmediatePropagation();
    await this.requestPointerLock();

    const bounds = this.getBoundingClientRect();
    this.style.setProperty("--left", `${bounds.left}px`);
    this.style.setProperty("--top", `${bounds.top}px`);

    this.#clickTarget = subGraphId;
    this.#activeOnMouseDown = this.active;
    this.#hasMoved = false;
    this.active = true;

    this.classList.add("drag");

    this.addEventListener("mousemove", this.#onMouseMoveBound);
    this.addEventListener("mouseup", this.#onMouseUpBound, {
      once: true,
    });
  }

  #renderMainGraphButton(subGraphId: GraphIdentifier, graph: InspectableGraph) {
    return html`<button
      class=${classMap({
        active: true,
        subgraph: true,
        inverted:
          getSubItemColor<number>(subGraphId, "text", true) === 0xffffff,
      })}
      style=${styleMap({
        "--subgraph-border-color": getSubItemColor(subGraphId, "border"),
        "--subgraph-label-color": getSubItemColor(subGraphId, "label"),
        "--subgraph-label-text-color": getSubItemColor(subGraphId, "text"),
      })}
      @mousedown=${(evt: MouseEvent) => {
        this.#startDragBehavior(evt, subGraphId);
      }}
    >
      <span>${graph.raw().title ?? "Untitled graph"}</span>
    </button>`;
  }

  #renderProxy(
    subGraphId: GraphIdentifier,
    graph: InspectableGraph,
    active = false
  ) {
    return html`<button
      class=${classMap({
        active,
        proxy: true,
      })}
      @mousedown=${(evt: MouseEvent) => {
        this.#startDragBehavior(evt, subGraphId);
      }}
    >
      ${graph.raw().title ?? "Untitled graph"}
    </button>`;
  }

  #onWindowMouseDownBound = this.#onWindowMouseDown.bind(this);
  #onWindowMouseDown(evt: Event) {
    if (evt.composedPath().includes(this)) {
      return;
    }

    this.active = false;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("active")) {
      if (this.active) {
        this.#setScrollTopOnNextUpdate = true;

        window.addEventListener("mousedown", this.#onWindowMouseDownBound, {
          once: true,
        });
      }
    }
  }

  #setScrollTopOnNextUpdate = false;
  protected updated(): void {
    const subGraphs = this.graph?.graphs() || {};
    const subGraphNames = Object.keys(subGraphs);
    if (this.#setScrollTopOnNextUpdate) {
      this.#setScrollTopOnNextUpdate = false;

      if (!this.#listRef.value) {
        return;
      }

      const index = subGraphNames.findIndex((id) => id === this.value);
      this.#listRef.value.scrollTop = (index + 1) * ITEM_HEIGHT;
    } else {
      this.style.setProperty(
        "--y-offset",
        `${(this.selectedIndex ?? 0) * -ITEM_HEIGHT}px`
      );
    }
  }

  render() {
    if (!this.value) {
      return nothing;
    }

    const subGraphs = this.graph?.graphs() || {};
    const subGraphsEntries = Object.entries(subGraphs);
    const subGraph = subGraphs[this.value];
    if (!subGraph) {
      return html`Select a board`;
    }

    if (!this.active) {
      return this.#renderMainGraphButton(this.value, subGraph);
    }

    return html` <ul class="renderable">
        <li>
          <button
            @mousedown=${(evt: MouseEvent) => {
              this.#startDragBehavior(evt, null);
            }}
            class=${classMap({
              subgraph: true,
              active: Math.floor(this.selectedIndex ?? 0) === 0,
            })}
          >
            <span>Create new...</span>
          </button>
        </li>
        ${map(subGraphsEntries, ([id, graph], idx) => {
          const isSelected = idx === Math.round(this.selectedIndex ?? 0) - 1;
          return html`<li>
            ${this.#renderGraphButton(id, graph, isSelected)}
          </li>`;
        })}
      </ul>
      <ul
        class="proxy"
        ${ref(this.#listRef)}
        @scroll=${(evt: Event) => {
          if (!(evt.target instanceof HTMLUListElement)) {
            return;
          }

          this.selectedIndex = evt.target.scrollTop / ITEM_HEIGHT;
        }}
      >
        <li>
          <button
            @mousedown=${(evt: MouseEvent) => {
              this.#startDragBehavior(evt, null);
            }}
            class=${classMap({ proxy: true })}
          >
            <span>Create new...</span>
          </button>
        </li>
        ${map(subGraphsEntries, ([id, graph], idx) => {
          const isSelected = idx === Math.floor(this.selectedIndex ?? 0) - 1;
          return html`<li>${this.#renderProxy(id, graph, isSelected)}</li>`;
        })}
      </ul>`;
  }
}
