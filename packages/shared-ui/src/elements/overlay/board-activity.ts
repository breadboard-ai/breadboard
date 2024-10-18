/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SettingsStore } from "../../types/types.js";
import {
  GraphProvider,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
} from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";

const MAXIMIZE_KEY = "bb-board-activity-overlay-maximized";
const DOCK_KEY = "bb-board-activity-overlay-docked";
const PERSIST_KEY = "bb-board-activity-overlay-persist";

@customElement("bb-board-activity-overlay")
export class BoardActivityOverlay extends LitElement {
  @property()
  run: InspectableRun | null = null;

  @property()
  hideLast = false;

  @property()
  showDebugControls = false;

  @property()
  nextNodeId: string | null = null;

  @property()
  location = { x: 10, y: 10 };

  @property()
  inputsFromLastRun: InspectableRunInputs | null = null;

  @property()
  settings: SettingsStore | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  @property()
  persist = false;

  @property()
  events: InspectableRunEvent[] | null = null;

  @state()
  debugEvent: InspectableRunEvent | null = null;

  #contentScrollTop = 0;
  #contentRef: Ref<HTMLDivElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      z-index: 20;
    }

    #content {
      width: 100%;
      max-height: none;
      flex: 1;
      overflow-y: auto;
      position: relative;
    }

    #container {
      padding: var(--bb-grid-size-4) var(--bb-grid-size-3) var(--bb-grid-size)
        var(--bb-grid-size-3);
      height: 40svh;
    }

    #back-to-activity {
      background: var(--bb-ui-50) var(--bb-icon-arrow-back) 6px center / 20px
        20px no-repeat;
      border: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-ui-600);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-8);
      margin-right: var(--bb-grid-size-2);
      border-radius: 50px;
      cursor: pointer;
      transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
    }

    #back-to-activity:hover,
    #back-to-activity:focus {
      background-color: var(--bb-ui-100);
    }

    bb-activity-log.collapsed {
      overflow: hidden;
      height: 0;
    }

    bb-event-details {
      background: var(--bb-neutral-0);
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      min-height: 100%;
      z-index: 1;
      padding: var(--bb-grid-size-4);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.persist = globalThis.localStorage.getItem(PERSIST_KEY) === "true";
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (!changedProperties.has("run")) {
      return;
    }

    this.debugEvent = null;
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has("debugEvent") && this.#contentRef.value) {
      if (changedProperties.get("debugEvent") === null) {
        this.#contentRef.value.scrollTop = 0;
      } else {
        this.#contentRef.value.scrollTop = this.#contentScrollTop;
      }
    }
  }

  render() {
    const events = maybeTrimNodestart(this.run?.events ?? [], this.hideLast);
    const eventPosition = events.length - 1;

    return html`<bb-drag-dock-overlay
      .dockable=${true}
      .dock=${{ top: true, left: false, bottom: true, right: true }}
      .overlayIcon=${"activity"}
      .overlayTitle=${"Board activity"}
      .maximizeKey=${MAXIMIZE_KEY}
      .dockKey=${DOCK_KEY}
      .persistable=${true}
      .persist=${this.persist}
      @bbpersisttoggle=${() => {
        this.persist = !this.persist;
        globalThis.localStorage.setItem(PERSIST_KEY, this.persist.toString());
      }}
    >
      ${this.debugEvent
        ? html`<button
            id="back-to-activity"
            slot="back-button"
            @pointerdown=${(evt: PointerEvent) => {
              evt.stopImmediatePropagation();
            }}
            @pointerup=${(evt: PointerEvent) => {
              evt.stopImmediatePropagation();
            }}
            @click=${() => {
              this.debugEvent = null;
            }}
          >
            Back
          </button>`
        : nothing}
      <div id="content" ${ref(this.#contentRef)}>
        <div id="container">
          <bb-board-activity
            class=${classMap({ collapsed: this.debugEvent !== null })}
            .run=${this.run}
            .events=${events}
            .eventPosition=${eventPosition}
            .inputsFromLastRun=${this.inputsFromLastRun}
            .showExtendedInfo=${true}
            .settings=${this.settings}
            .showLogTitle=${false}
            .logTitle=${"Run Board"}
            .providers=${this.providers}
            .providerOps=${this.providerOps}
            .showDebugControls=${this.showDebugControls}
            .nextNodeId=${this.nextNodeId}
            @pointerdown=${(evt: PointerEvent) => {
              const [top] = evt.composedPath();
              if (!(top instanceof HTMLElement) || !top.dataset.messageId) {
                return;
              }
              evt.stopImmediatePropagation();
              const id = top.dataset.messageId;
              const event = this.run?.getEventById(id);
              if (!event) {
                // TODO: Offer the user more information.
                console.warn(`Unable to find event with ID "${id}"`);
                return;
              }
              if (event.type !== "node") {
                return;
              }

              this.#contentScrollTop = this.#contentRef.value?.scrollTop ?? 0;
              this.debugEvent = event;
            }}
            name="Board"
          ></bb-board-activity>
          ${this.debugEvent
            ? html`<bb-event-details
                .event=${this.debugEvent}
              ></bb-event-details>`
            : nothing}
        </div>
      </div>
    </bb-drag-dock-overlay>`;
  }
}

/**
 * A helper that trims the last incomplete event (the event that does not have
 * a closing `nodeend`) when asked.
 *
 * This is used to remove the "next up" item in the activity log when we are
 * stepping through the nodes step by step.
 */
function maybeTrimNodestart(events: InspectableRunEvent[], hideLast: boolean) {
  const last = events.at(-1);
  if (last?.type === "node" && !last.end && hideLast) {
    return events.slice(0, -1);
  }
  return events;
}
