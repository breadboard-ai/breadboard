/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier, NodeRunState } from "@breadboard-ai/types";
import {
  HideTooltipEvent,
  ShowTooltipEvent,
  StateEvent,
} from "../../events/events";
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../styles/icons";
import { type } from "../../styles/host/type";
import { colorsLight } from "../../styles/host/colors-light";

@customElement("bb-node-run-control")
export class NodeRunControl extends LitElement {
  @property()
  accessor runState: NodeRunState | null = null;

  @property()
  accessor actionContext: "console" | "graph" | null = null;

  @property()
  accessor nodeId: NodeIdentifier | null = null;

  @property({ reflect: true, type: String })
  accessor active: "pre" | "current" | "post" | "error" = "pre";

  @property({ reflect: true, type: String })
  accessor controlAnimation: "none" | "rotate" = "none";

  static styles = [
    icons,
    type,
    colorsLight,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      :host([controlanimation="rotate"]) .node-controls {
        animation: rotate 1s linear infinite;

        &:hover {
          animation: none;
        }
      }

      .node-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        width: 24px;
        height: 24px;
        background: none;
        border: none;
        pointer-events: auto;
        opacity: 0.8;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
        position: relative;

        &::before {
          content: "";
          border-radius: 50%;
          background: oklch(from var(--n-0) l c h / 0.05);
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
        }

        &:hover {
          &:not([disabled])::before {
            opacity: 1;
          }

          & .g-icon::before {
            content: attr(data-hover-icon);
          }
        }

        &:not([disabled]) {
          cursor: pointer;
          opacity: 1;
        }

        > * {
          pointer-events: none;
        }

        & .g-icon {
          position: relative;

          &::before {
            content: attr(data-icon);
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("runState")) {
      const status = this.runState?.status;
      if (status === "failed" || status === "interrupted") {
        this.active = "error";
      }

      if (status === "working" || status === "waiting") {
        this.controlAnimation = "rotate";
      } else {
        this.controlAnimation = "none";
      }
    }
  }

  render() {
    if (!this.runState) {
      return null;
    }

    let disabled = false;
    let icon = "";
    let hoverIcon = "";
    let tooltip = "";

    switch (this.runState.status) {
      case "inactive": {
        tooltip = "";
        icon = "play_arrow";
        hoverIcon = "play_arrow";
        disabled = true;
        break;
      }

      case "ready": {
        tooltip = "Run this step only";
        icon = "play_arrow";
        hoverIcon = "play_arrow";
        break;
      }

      // TODO: Enable this state.
      // case "run": {
      //   tooltip = "Run from here";
      //   icon = "play_circle";
      //   hoverIcon = "play_circle";
      //   break;
      // }

      case "working":
      case "waiting": {
        tooltip = "Stop";
        hoverIcon = "stop";
        icon = "progress_activity";
        break;
      }

      case "succeeded": {
        tooltip = "Run this step only";
        hoverIcon = "play_arrow";
        icon = "play_arrow";
        break;
      }

      case "failed": {
        tooltip = "Re-run this step";
        hoverIcon = "play_arrow";
        icon = "play_arrow";
        break;
      }

      case "skipped": {
        tooltip = "Stop at this step";
        icon = "";
        hoverIcon = "pause";
        break;
      }

      case "interrupted": {
        tooltip = "Re-run this step";
        icon = "play_arrow";
        hoverIcon = "play_arrow";
        break;
      }

      case "breakpoint": {
        tooltip = "Don't stop at this step";
        icon = "pause";
        hoverIcon = "close";
        break;
      }

      default: {
        disabled = true;
        break;
      }
    }

    // We need to add these handlers to intercept the ones on the header. If we
    // don't do that here then clicking on any of these buttons will trigger the
    // translate/selection actions.
    return html`<button
      @click=${(evt: Event) => {
        evt.stopImmediatePropagation();
      }}
      @pointerover=${(evt: PointerEvent) => {
        if (!tooltip) {
          return;
        }

        this.dispatchEvent(
          new ShowTooltipEvent(tooltip, evt.clientX, evt.clientY)
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @pointerdown=${(evt: Event) => {
        this.dispatchEvent(new HideTooltipEvent());
        evt.stopImmediatePropagation();
      }}
      @pointerup=${(evt: Event) => {
        evt.stopImmediatePropagation();
        if (!this.nodeId) {
          return null;
        }

        this.dispatchEvent(
          new StateEvent({
            eventType: "node.action",
            nodeId: this.nodeId,
            // TODO: Bring back subgraphs.
            subGraphId: "",
            action: "primary",
            actionContext: this.actionContext,
          })
        );
      }}
      class="node-controls"
      ?disabled=${disabled}
    >
      <span
        class="g-icon filled round"
        data-icon=${icon}
        data-hover-icon=${hoverIcon}
      ></span>
    </button>`;
  }
}
