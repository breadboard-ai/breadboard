/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastType } from "../../../sca/types.js";
import { LitElement, html, css, PropertyValueMap } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property } from "lit/decorators.js";
import * as Styles from "../../styles/styles.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

@customElement("bb-toast")
export class Toast extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ type: Boolean })
  accessor closing = false;

  @property({ reflect: true })
  accessor toastId: string | null = null;

  @property({ reflect: true })
  accessor type: ToastType = ToastType.INFORMATION;

  @property()
  accessor message = "";

  @property()
  accessor offset = 0;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      :host {
        position: fixed;
        bottom: calc(var(--bb-grid-size) * 10);
        right: calc(var(--bb-grid-size) * 10);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--light-dark-n-0);
        color: var(--light-dark-n-100);
        box-shadow:
          0 2px 3px 0 rgba(0, 0, 0, 0.13),
          0 7px 9px 0 rgba(0, 0, 0, 0.16);
        border-radius: calc(var(--bb-grid-size) * 8);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-6)
          var(--bb-grid-size-3) var(--bb-grid-size-5);
        translate: 0 calc(var(--offset) * var(--bb-grid-size-16) * -1);
        transition: translate 0.2s cubic-bezier(0, 0, 0.3, 1);
        animation: slideIn 0.15s cubic-bezier(0, 0, 0.3, 1) forwards;
        max-width: min(360px, 80vw);
        z-index: 1000;
      }

      :host([type="warning"]) {
        color: var(--light-dark-e-90);
      }

      :host([type="error"]) {
        color: var(--light-dark-e-80);
      }

      :host(.toasted) {
        animation: slideOut 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
      }

      p {
        margin: 0;
      }

      .g-icon {
        flex-shrink: 0;
        margin-right: var(--bb-grid-size-2);

        .rotate {
          animation: rotate 1s linear infinite;
        }
      }

      @keyframes slideIn {
        from {
          transform: translateY(20px);
          opacity: 0;
        }

        to {
          transform: none;
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: none;
          opacity: 1;
        }

        to {
          transform: translateY(-20px);
          opacity: 0;
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

  protected willUpdate(changedProperties: PropertyValueMap<this>): void {
    if (changedProperties.has("closing") && this.closing) {
      // Trigger a closing animation and, on completion, inform the controller
      // that the toast has finished it's closing animation.
      this.classList.add("toasted");
      this.addEventListener(
        "animationend",
        () => {
          if (!this.toastId) return;
          this.sca.controller.global.toasts.untoast(this.toastId);
        },
        { once: true }
      );
    }
  }

  render() {
    if (this.offset !== 0) {
      this.style.setProperty("--offset", this.offset.toString());
    }

    let icon;
    switch (this.type) {
      case ToastType.INFORMATION:
        icon = "info";
        break;
      case ToastType.ERROR:
        icon = "error";
        break;
      case ToastType.WARNING:
        icon = "warning";
        break;
      case ToastType.PENDING:
        icon = "progress_activity";
        break;
    }

    return html` <span
        class=${classMap({
          "g-icon": true,
          round: true,
          filled: true,
          rotate: this.type === ToastType.PENDING,
        })}
        >${icon}</span
      >
      <p class="sans-flex round md-title-small">${this.message}</p>`;
  }
}
