/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { type } from "../../styles/host/type";
import { colorsLight } from "../../styles/host/colors-light";

@customElement("bb-empty-state")
export class EmptyState extends LitElement {
  static styles = [
    colorsLight,
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

      #headline {
        translate: 0 -3svh;
        font-size: min(4svw, 70px);
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

  render() {
    return html`<div id="top" class="message edu-sa-beginner">
        Add a step to get started <img src="/images/arrow-up.png" />
      </div>
      <div id="headline" class="sans-flex round w-500">
        Let&apos;s build your Opal
      </div>
      <div id="bottom" class="message edu-sa-beginner">
        ... or type what you want to build <img src="/images/arrow-down.png" />
      </div>`;
  }
}
