/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastType } from "./events.js";

export class Toast extends HTMLElement {
  constructor(public message: string, public type: ToastType, timeout = 20000) {
    super();
    const root = this.attachShadow({ mode: "open" });

    let icon = "--bb-icon-info";
    switch (type) {
      case ToastType.ERROR:
        icon = "--bb-icon-error";
        break;

      case ToastType.WARNING:
        icon = "--bb-icon-warning";
        break;
    }

    root.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: calc(var(--bb-grid-size) * 10);
          right: calc(var(--bb-grid-size) * 10);
          display: block;
          background: rgb(255, 255, 255);
          border: 1px solid #E5E5E5;
          box-shadow: 0 7px 9px 0 rgba(0,0,0,0.16);
          border-radius: calc(var(--bb-grid-size) * 8);
          padding: calc(var(--bb-grid-size) * 5) calc(var(--bb-grid-size) * 8)
              calc(var(--bb-grid-size) * 5) calc(var(--bb-grid-size) * 12);

          animation: slideIn var(--bb-easing-duration-in) var(--bb-easing) forwards;
          max-width: 300px;
        }

        :host(.warning) {
          color: #FB8903;
        }

        :host(.error) {
          color: #FB0303;
        }

        :host(.toasted) {
          animation: slideOut var(--bb-easing-duration-out) var(--bb-easing) forwards;
        }

        :host::before {
          content: '';
          position: absolute;
          left: 16px;
          top: 17px;
          width: 24px;
          height: 24px;
          background: var(${icon}) center center no-repeat;
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
      </style>
      <div>
        ${message}
      </div>
    `;

    this.classList.add(type);

    setTimeout(() => {
      this.addEventListener(
        "animationend",
        () => {
          this.remove();
        },
        { once: true }
      );

      this.classList.add("toasted");
    }, timeout);
  }
}
