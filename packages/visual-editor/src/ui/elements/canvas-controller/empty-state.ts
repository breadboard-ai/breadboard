/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type } from "../../styles/host/type.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { ShowVideoModalEvent } from "../../events/events.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { SCA } from "../../../sca/sca.js";

@customElement("bb-empty-state")
export class EmptyState extends SignalWatcher(LitElement) {
  @property({ type: Boolean, reflect: true })
  accessor narrow = false;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    baseColors,
    type,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        position: absolute;
        background: transparent;
        z-index: 100;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
      }

      :host([narrow]) {
        justify-content: center;
      }

      .edu-sa-beginner {
        font-family: "Edu SA Beginner", cursive;
        font-optical-sizing: auto;
        font-weight: 600;
        font-style: normal;
        font-size: min(2svw, 24px);
        padding: 20px 64px;
        background: var(--ui-custom-o-20);
        box-shadow: 0px 12px 20px rgba(0, 0, 0, 0.08);
      }

      .message {
        position: relative;

        & img {
          position: absolute;
        }
      }

      /* Hide message callouts on narrow screens */
      :host([narrow]) .message {
        display: none;
      }

      #top {
        translate: -210px 130px;
        rotate: -5deg;

        animation: fadeIn 1.5s cubic-bezier(0, 0, 0.3, 1) 1.5s forwards;
        opacity: 0;

        & img {
          transform-origin: 0 0;
          right: -83px;
          top: -30px;
          scale: 50% 50%;
        }
      }

      #bottom {
        translate: 70px -230px;
        rotate: 8deg;

        animation: fadeIn 1.5s cubic-bezier(0, 0, 0.3, 1) 4s forwards;
        opacity: 0;

        & img {
          left: 50%;
          transform-origin: 0 0;
          translate: -50% calc(100% - 10px);
          bottom: 0;
          scale: 50% 50%;
        }
      }

      #agent-variant {
        position: absolute;
        bottom: 90px;
        left: 110px;
        rotate: 8deg;

        animation: fadeIn 1.5s cubic-bezier(0, 0, 0.3, 1) 4s forwards;
        opacity: 0;

        & img {
          left: 0%;
          transform-origin: 0px 0px;
          translate: 3% calc(100% + 30px);
          bottom: 0px;
          scale: 0.5;
          rotate: 190deg;
        }
      }

      #headline {
        translate: 0 -4svh;
        font-size: min(3.5svw, 60px);
        text-align: center;
      }

      :host([narrow]) #headline {
        translate: 0;
        font-size: 36px;
        line-height: 53px;
      }

      #tag {
        translate: 0 -3.4svh;
        font-size: min(2svw, 24px);
        text-align: center;

        & a {
          color: var(--ui-custom-o-100);
          text-decoration: none;
          pointer-events: auto;
        }
      }

      :host([narrow]) #tag {
        translate: 0;
        font-size: 20px;
        line-height: 53px;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  private renderTop() {
    return html`<div id="top" class="message edu-sa-beginner">
        Add a step to get started <img src="/images/arrow-up.png" />
      </div>
      <div>
        <div id="headline" class="sans-flex round w-500">
          Let&apos;s build your app
        </div>
        <div id="tag" class="sans-flex round w-500">
          Take a look at our
          <a
            @click=${(evt: Event) => {
              evt.preventDefault();
              this.dispatchEvent(new ShowVideoModalEvent());
            }}
            href="https://youtube.com/watch?v=NWNNDvehBIU"
            >demo video</a
          >
        </div>
      </div> `;
  }

  private renderBottomNLMarker() {
    return html`<div id="bottom" class="message edu-sa-beginner">
      ... or type what you want to build <img src="/images/arrow-down.png" />
    </div>`;
  }

  private renderBottomPlaceholder() {
    return html`<div id="bottom" class=""></div>`;
  }

  private renderBottomAgentMarker() {
    return [
      this.renderBottomPlaceholder(),
      html` <div id="agent-variant" class="message edu-sa-beginner">
        ... or chat with Opie<img src="/images/arrow-up.png" />
      </div>`,
    ];
  }

  render() {
    if (!this.sca.controller.isHydrated) return nothing;

    if (this.sca.env.flags.get("enableGraphEditorAgent")) {
      if (this.sca.controller.editor.graphEditingAgent.open) {
        return [this.renderTop(), this.renderBottomPlaceholder()];
      }
      return [this.renderTop(), this.renderBottomAgentMarker()];
    }

    return [this.renderTop(), this.renderBottomNLMarker()];
  }
}
