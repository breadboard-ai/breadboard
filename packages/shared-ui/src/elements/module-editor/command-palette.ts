/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Command } from "../../types/types";
import { map } from "lit/directives/map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { CommandEvent, PaletteDismissedEvent } from "../../events/events";

@customElement("bb-command-palette")
export class CommandPalette extends LitElement {
  @property()
  commands: Command[] = [];

  @property()
  selectedIndex = 0;

  @property()
  filter: string | null = null;

  static styles = css`
    :host {
      display: block;
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size);
      padding: var(--bb-grid-size);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);
    }

    input {
      display: block;
      width: 100%;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    menu {
      background: none;
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 420px;
      overflow: auto;
    }

    menu li {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-2) var(--bb-grid-size-2)
        var(--bb-grid-size-7);
      border-radius: var(--bb-grid-size);
      margin: var(--bb-grid-size) 0 0 0;
      user-select: none;
      background: transparent none 4px center / 20px 20px no-repeat;
    }

    menu li.format {
      background-image: var(--bb-icon-braces);
    }

    menu li.open {
      background-image: var(--bb-icon-open-new);
    }

    menu li.save {
      background-image: var(--bb-icon-save);
    }

    menu li.add-circle {
      background-image: var(--bb-icon-add-circle);
    }

    menu li.selected {
      background-color: var(--bb-ui-50);
    }

    .no-options {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      font-style: italic;
      color: var(--bb-neutral-700);
    }
  `;

  #inputRef: Ref<HTMLInputElement> = createRef();
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #attemptFocus = false;

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("commands")) {
      this.#attemptFocus = true;
      this.selectedIndex = 0;
    }
  }

  #emitCurrentCommand() {
    const command = this.commands[this.selectedIndex];
    if (!command) {
      return;
    }

    this.dispatchEvent(
      new CommandEvent(command.name, command.secondaryAction ?? null)
    );
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (
      !this.shadowRoot ||
      !this.shadowRoot.activeElement ||
      !(this.shadowRoot.activeElement instanceof HTMLElement)
    ) {
      return;
    }

    switch (evt.key) {
      case "Escape": {
        this.dispatchEvent(new PaletteDismissedEvent());
        break;
      }

      case "Enter": {
        this.#emitCurrentCommand();
        break;
      }

      case "ArrowUp": {
        this.selectedIndex = this.#clamp(
          this.selectedIndex - 1,
          0,
          this.commands.length - 1
        );
        break;
      }

      case "Tab":
      case "ArrowDown": {
        evt.preventDefault();

        this.selectedIndex = this.#clamp(
          this.selectedIndex + 1,
          0,
          this.commands.length - 1
        );
        break;
      }
    }
  }

  #clamp(value: number, min: number, max: number) {
    if (value < min) {
      value = min;
    }

    if (value > max) {
      value = max;
    }

    return value;
  }

  protected updated(): void {
    if (!this.#inputRef.value || !this.#attemptFocus) {
      return;
    }

    this.#attemptFocus = false;
    this.#inputRef.value.select();
  }

  render() {
    let commands = this.commands;

    if (this.filter) {
      const filter = new RegExp(this.filter, "gim");
      commands = this.commands.filter(
        (command) => filter.test(command.name) || filter.test(command.title)
      );
    }

    return html`<input
        @input=${(evt: InputEvent) => {
          if (!(evt.target instanceof HTMLInputElement)) {
            return;
          }

          this.filter = evt.target.value ?? null;
        }}
        ${ref(this.#inputRef)}
        type="search"
      />

      ${commands.length
        ? html` <menu>
            ${map(commands, (command, idx) => {
              return html`<li
                @pointerover=${() => {
                  this.selectedIndex = idx;
                }}
                @click=${() => {
                  this.#emitCurrentCommand();
                }}
                class=${classMap({
                  [command.icon]: true,
                  selected: idx === this.selectedIndex,
                })}
                data-command=${command.name}
                data-secondary=${command.secondaryAction}
              >
                ${command.title}
              </li>`;
            })}
          </menu>`
        : html`<div class="no-options">No options available</div>`}`;
  }
}
