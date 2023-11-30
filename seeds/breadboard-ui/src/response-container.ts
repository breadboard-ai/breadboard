/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class ResponseContainer extends HTMLElement {
  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          padding-top: calc(var(--bb-grid-size) * 6);
        }

        ::slotted(*) {
          position: relative;
          padding-bottom: calc(var(--bb-grid-size) * 4);
          padding-left: calc(var(--bb-grid-size) * 6); 
          margin-right: calc(var(--bb-grid-size) * 12);
        }

        ::slotted(bb-output) {
          padding-bottom: calc(var(--bb-grid-size) * 10);
        }

        ::slotted(*)::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: var(--bb-grid-size);
          height: 100%;
          background: rgb(244, 244, 244);
          translate: -50% 0;
        }

        ::slotted(:first-child)::before {
          height: calc(100% - var(--bb-grid-size) * 3);
          top: calc(var(--bb-grid-size) * 3);
        }

        ::slotted(:last-child)::before {
          height: calc(var(--bb-grid-size) * 4);
        }

        ::slotted(bb-input:first-child)::before {
          height: max(0px, calc(100% - var(--bb-grid-size) * 9));
          top: calc(var(--bb-grid-size) * 9);
        }

        ::slotted(bb-input:last-child)::before {
          height: max(0px, calc(var(--bb-grid-size) * 10));
        }

        ::slotted(:only-child)::before {
          display: none;
        }

        ::slotted(*)::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          translate: -50% calc(var(--bb-grid-size) * 3.5);
          width: calc(var(--bb-grid-size) * 4);
          height: calc(var(--bb-grid-size) * 4);
          border-radius: 50%;
          background: var(--bb-highlight-color);
        }

        ::slotted(bb-input)::after {
          translate: -50% calc(var(--bb-grid-size) * 9.5);
        }

        ::slotted(bb-result)::after {
          background: var(--bb-result-color);
        }

        ::slotted(bb-done)::after {
          background: var(--bb-done-color);
        }

        ::slotted(bb-output)::after {
          background: var(--bb-output-color);
        }

        ::slotted(bb-error)::after {
          background: var(--bb-error-color);
        }

        ::slotted(bb-progress)::after {
          background: radial-gradient(
                var(--bb-progress-color) 0%,
                var(--bb-progress-color) 40%,
                var(--bb-progress-color-faded) 40%,
                var(--bb-progress-color-faded) 58%,
                transparent 58.1%,
                transparent 100%
              )
              no-repeat,
            conic-gradient(var(--bb-progress-color) 0deg, var(--bb-progress-color) 90deg, transparent 91deg)
              no-repeat,
            linear-gradient(var(--bb-progress-color-faded), var(--bb-progress-color-faded)) no-repeat;

          animation: rotate 1s linear infinite;
        }
      </style>
      <slot></slot>
    `;
  }

  clearContents() {
    const children = Array.from(this.querySelectorAll("*"));
    for (const child of children) {
      child.remove();
    }
  }
}
