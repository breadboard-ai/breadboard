/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  GraphProviderConnectRequestEvent,
  OverlayDismissedEvent,
  SettingsUpdateEvent,
} from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SETTINGS_TYPE, Settings } from "../../types/types.js";

@customElement("bb-first-run-overlay")
export class FirstRunOverlay extends LitElement {
  @property()
  settings: Settings | null = null;

  @property()
  boardServerUrl: string | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();

  static styles = css`
    :host {
      display: block;
    }

    form {
      display: flex;
      flex-direction: column;
      width: 85vw;
      max-width: 420px;
    }

    header {
      display: flex;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid var(--bb-neutral-300);
      margin: 0 0 var(--bb-grid-size) 0;
    }

    h1 {
      flex: 1;
      font-size: var(--bb-title-medium);
      margin: 0;
    }

    header .close {
      width: 16px;
      height: 16px;
      background: var(--bb-icon-close) center center no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    header .close:hover {
      transition-duration: 0.1s;
      opacity: 1;
    }

    label {
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 4);
      font-size: var(--bb-label-small);
      color: var(--bb-ui-600);
    }

    input,
    textarea {
      margin: var(--bb-grid-size) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-body-small);
      font-family: var(--bb-font-family);
      border: 1px solid var(--bb-neutral-400);
      resize: none;
      line-height: 1.5;
      border-radius: var(--bb-grid-size);
    }

    textarea {
      height: 140px;
    }

    #controls {
      display: flex;
      justify-content: flex-end;
      margin: var(--bb-grid-size-2) var(--bb-grid-size-4) var(--bb-grid-size-4);
    }

    p {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0 0 var(--bb-grid-size-4) 0;
      padding: 0 var(--bb-grid-size-4);
    }

    p:first-of-type {
      margin-top: var(--bb-grid-size-2);
    }

    .cancel {
      background: var(--bb-neutral-200);
      color: var(--bb-neutral-600);
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px;
      margin-right: calc(var(--bb-grid-size) * 2);
    }

    input[type="submit"] {
      background: var(--bb-continue-color);
      background-image: var(--bb-icon-resume-blue);
      background-size: 16px 16px;
      background-position: 8px 4px;
      background-repeat: no-repeat;
      color: #246db5;
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px 0 28px;
      margin: 0;
    }
  `;

  protected firstUpdated(): void {
    if (!this.#formRef.value) {
      return;
    }

    const input = this.#formRef.value.querySelector(
      "input"
    ) as HTMLInputElement;
    if (!input) {
      return;
    }

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  render() {
    return html`<bb-overlay>
      <form
        ${ref(this.#formRef)}
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key === "Enter" && evt.metaKey && this.#formRef.value) {
            const form = this.#formRef.value;
            if (!form.checkValidity()) {
              form.reportValidity();
              return;
            }

            form.dispatchEvent(new SubmitEvent("submit"));
          }
        }}
        @submit=${(evt: SubmitEvent) => {
          evt.preventDefault();
          if (!(evt.target instanceof HTMLFormElement)) {
            return;
          }

          if (!this.settings) {
            return null;
          }

          const data = new FormData(evt.target);
          const settings = structuredClone(this.settings);

          const geminiKey = data.get("gemini-key");
          if (geminiKey && typeof geminiKey === "string") {
            let setting =
              settings[SETTINGS_TYPE.SECRETS].items.get("GEMINI_KEY");
            setting = setting
              ? { ...setting, value: geminiKey }
              : { name: "GEMINI_KEY", value: geminiKey };

            settings[SETTINGS_TYPE.SECRETS].items.set("GEMINI_KEY", setting);
          }

          const boardServerApiKey = data.get("board-server-api-key");
          if (this.boardServerUrl && URL.canParse(this.boardServerUrl)) {
            this.dispatchEvent(
              new GraphProviderConnectRequestEvent(
                "RemoteGraphProvider",
                this.boardServerUrl,
                boardServerApiKey && typeof boardServerApiKey === "string"
                  ? boardServerApiKey
                  : undefined
              )
            );
          }

          const defaultToTrue = [
            "Collapse Nodes by Default",
            "Hide Embedded Board Selector When Empty",
            "Hide Advanced Ports on Nodes",
            "Show Node Shortcuts",
          ];

          for (const name of defaultToTrue) {
            let setting = settings[SETTINGS_TYPE.GENERAL].items.get(name);
            setting = setting
              ? { ...setting, value: true }
              : { name, value: true };

            settings[SETTINGS_TYPE.GENERAL].items.set(name, setting);
          }

          const modelSetting =
            settings[SETTINGS_TYPE.INPUTS].items.get("model");
          if (!modelSetting) {
            settings[SETTINGS_TYPE.INPUTS].items.set("model", {
              name: "model",
              value: "gemini-1.5-flash-latest",
            });
          }

          this.dispatchEvent(new SettingsUpdateEvent(settings));
        }}
      >
        <header>
          <h1>Welcome to Breadboard!</h1>
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="close"
            type="button"
          >
            Close
          </button>
        </header>

        <p>
          To help you quickly prototype your next generative AI experience, you
          can enter your Gemini key below. It's optional, but it will make
          things a bit smoother for you.
        </p>

        <p>
          Your key will be stored locally in your browser and can be changed or
          removed at any time in the app's settings. If you're not sure what
          this is, no worries, you can skip it for now.
        </p>

        <input
          name="gemini-key"
          type="text"
          placeholder="Enter your Gemini key here (optional)"
        />

        ${this.boardServerUrl
          ? html`<input
              name="board-server-api-key"
              type="text"
              placeholder="Enter your Board Server API key here (optional)"
            />`
          : nothing}

        <div id="controls">
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="cancel"
            type="button"
          >
            Skip for now
          </button>
          <input type="submit" value="Let's Go!" />
        </div>
      </form>
    </bb-overlay>`;
  }
}
