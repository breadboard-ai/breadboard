/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { icons } from "../../styles/icons.js";
import { styleMap } from "lit/directives/style-map.js";

import "./opie-avatar.js";
import "./chat-panel.js";
import "../effects/radial-glow.js";
import type { ChatPanel } from "./chat-panel.js";

if ("registerProperty" in CSS) {
  const props: Array<[string, string, string]> = [
    ["--blob-size", "<length>", "-100px"],
    ["--blob-x", "<percentage>", "10%"],
    ["--blob-y", "<percentage>", "85%"],
    ["--blob-blur", "<length>", "100px"],
  ];
  for (const [name, syntax, initialValue] of props) {
    CSS.registerProperty({ name, syntax, inherits: true, initialValue });
  }
}

export { GraphEditingChat };

/**
 * Outer orchestrator for the graph editing chat. Handles positioning,
 * the Opie avatar, radial glow entrance, and blob-reveal animation.
 * All chat content is rendered by the child `<bb-chat-panel>`.
 */
@customElement("bb-graph-editing-chat")
class GraphEditingChat extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  readonly #panelRef = createRef<ChatPanel>();

  static styles = [
    icons,
    css`
      :host {
        position: absolute;
        bottom: var(--bb-grid-size-7);
        left: var(--bb-grid-size-4);
        z-index: 9999;
        font-family: "Google Sans", sans-serif;
      }

      radial-glow {
        z-index: 10;
      }

      /* ── Layout ── */

      #chat-container {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--bb-grid-size-2);

        & #chat-panel {
          animation: slide-up 0.15s ease-out both 0.07s;
        }
      }

      /* ── Shadow reveal ── */

      .panel-shadow {
        position: relative;
        animation: shadow-in 0.2s ease-out both 0.7s;
        z-index: 20;
      }

      .bubble-tail {
        position: absolute;
        bottom: -12px;
        left: 20px;
        width: 0;
        height: 0;
        border-left: 14px solid transparent;
        border-right: 14px solid transparent;
        border-top: 14px solid var(--light-dark-n-100);
        animation: tail-slide 0.15s ease-out both 0.2s;
        z-index: 20;
      }

      @keyframes tail-slide {
        from {
          transform: translateY(-12px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes shadow-in {
        from {
          filter: drop-shadow(0px 2px 4px rgb(0 0 0 / 0))
            drop-shadow(0px 8px 12px rgb(0 0 0 / 0));
        }
        to {
          filter: drop-shadow(0px 2px 6px rgb(0 0 0 / 0.1))
            drop-shadow(0px 8px 12px rgb(0 0 0 / 0.05));
        }
      }

      /* ── Blob reveal mask ── */

      bb-chat-panel {
        --blob-x: 10%;
        --blob-y: 85%;
        --blob-size: -300px;
        --blob-blur: 300px;

        animation:
          blob-move-x 1s ease-out both 0.15s,
          blob-move-y 1s ease-in both 0.15s,
          blob-grow 0.85s ease-out both 0.07s,
          blob-sharpen 0.65s ease-out both 0.3s;
        mask-image: radial-gradient(
          circle at var(--blob-x) var(--blob-y),
          #000 var(--blob-size),
          transparent calc(var(--blob-size) + var(--blob-blur))
        );
        -webkit-mask-image: radial-gradient(
          circle at var(--blob-x) var(--blob-y),
          #000 var(--blob-size),
          transparent calc(var(--blob-size) + var(--blob-blur))
        );
      }

      @keyframes slide-up {
        from {
          translate: 0 0;
        }

        to {
          translate: 0 calc(-4 * var(--bb-grid-size));
        }
      }

      @keyframes blob-move-x {
        from {
          --blob-x: 10%;
        }
        to {
          --blob-x: 50%;
        }
      }
      @keyframes blob-move-y {
        from {
          --blob-y: 85%;
        }
        to {
          --blob-y: 50%;
        }
      }
      @keyframes blob-grow {
        from {
          --blob-size: -300px;
        }
        to {
          --blob-size: 600px;
        }
      }
      @keyframes blob-sharpen {
        from {
          --blob-blur: 300px;
        }
        to {
          --blob-blur: 0px;
        }
      }

      /* ── Opie avatar row ── */

      #opie-row {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        margin-left: 14px;
      }

      #opie-row bb-opie-avatar {
        flex-shrink: 0;
      }
    `,
  ];

  render() {
    const { parsedUrl } = this.sca.controller.router;
    const agent = this.sca.controller.editor.graphEditingAgent;

    // Hide entirely when not viewing a graph (e.g. home page)
    if (parsedUrl.page !== "graph") {
      return nothing;
    }

    // If the graph changed, reset the loop
    if (agent.currentFlow !== parsedUrl.flow) {
      this.sca.actions.graphEditingAgent.resetGraphEditingAgent();
      agent.currentFlow = parsedUrl.flow ?? null;
    }

    const opie = html`<bb-opie-avatar
      ?highlighted=${agent.open}
      @click=${() => {
        agent.open = !agent.open;
        if (!agent.open) {
          return;
        }

        agent.open = true;
        agent.showGreeting();
        // Re-focus after Lit update completes
        this.updateComplete.then(() => {
          this.#panelRef.value?.focus();
        });
      }}
    ></bb-opie-avatar>`;

    return html`
      <div id="chat-container">
        ${agent.open
          ? html`
              <div id="chat-panel">
                <radial-glow
                  glow-size="32"
                  border-radius="16px"
                  style=${styleMap({
                    "--start-angle": "140deg",
                    "--glow-duration": "1.3s",
                    "--mask-sweep": "360deg",
                    "--color-sweep": "360deg",
                    "--glow-colors": `var(--n-100) 0%,
                    var(--t-70) 30%,
                    var(--p-70) 50%,
                    var(--t-70) 70%,
                    var(--n-100) 100%`,
                  })}
                >
                  <div class="panel-shadow">
                    <bb-chat-panel
                      ${ref(this.#panelRef)}
                      @animationend=${this.#onRevealComplete}
                    ></bb-chat-panel>
                    <div class="bubble-tail"></div>
                  </div>
                </radial-glow>
              </div>
            `
          : nothing}
        <div id="opie-row">
          ${agent.processing
            ? html`<radial-glow
                continuous
                glow-size="12"
                border-radius="50%"
                style=${styleMap({
                  "--start-angle": "140deg",
                  "--glow-duration": "1.3s",
                  "--mask-sweep": "360deg",
                  "--color-sweep": "360deg",
                  "--glow-colors": `var(--n-100) 0%,
                    var(--t-70) 30%,
                    var(--p-70) 50%,
                    var(--t-70) 70%,
                    var(--n-100) 100%`,
                })}
                >${opie}</radial-glow
              >`
            : opie}
        </div>
      </div>
    `;
  }

  #onRevealComplete(e: AnimationEvent) {
    if (e.animationName !== "blob-move-x") return;
    const panel = this.#panelRef.value;
    if (!panel) return;
    panel.style.maskImage = "none";
    panel.style.webkitMaskImage = "none";
  }
}
