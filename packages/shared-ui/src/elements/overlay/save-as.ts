/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  GraphProviderSaveBoardEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import {
  GraphDescriptor,
  GraphProvider,
  blankLLMContent,
} from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";

@customElement("bb-save-as-overlay")
export class SaveAsOverlay extends LitElement {
  @property()
  panelTitle: string = "Save As...";

  @property()
  graph: GraphDescriptor | null = null;

  @property()
  boardFileName: string | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  selectedProvider = "IDBGraphProvider";

  @property()
  selectedLocation = "default";

  @property()
  providerOps = 0;

  @property()
  isNewBoard = false;

  #formRef: Ref<HTMLFormElement> = createRef();
  #fileNameRef: Ref<HTMLInputElement> = createRef();

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

    input[type="text"],
    textarea,
    select {
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
      margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4)
        calc(var(--bb-grid-size) * 4);
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

    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: var(--bb-grid-size-2);
      align-items: center;
    }

    .split div {
      display: flex;
      align-items: center;
    }

    .split label {
      margin-right: var(--bb-grid-size);
    }

    .split select,
    .split input,
    .split textarea {
      margin: 0;
    }
  `;

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ providers: GraphProvider[] }>
      | Map<PropertyKey, unknown>
  ): void {
    // Only show providers to which the user can send files.
    if (changedProperties.has("providers")) {
      this.providers = [...this.providers].filter(
        (provider) => provider.extendedCapabilities().modify
      );
    }
  }

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

  #createUrl(provider: string, location: string) {
    return `${provider}::${location}`;
  }

  #parseUrl(url: string) {
    return url.split("::");
  }

  #generateFileName(title: string | undefined) {
    if (!title) {
      return "untitled-board";
    }

    let fileName = title.toLocaleLowerCase().replace(/[^a-zA-Z0-9_-]/gim, "-");
    if (!fileName.endsWith(".json")) {
      fileName += ".bgl.json";
    } else if (!fileName.endsWith(".bgl.json")) {
      fileName = fileName.replace(".json", ".bgl.json");
    }

    return fileName;
  }

  render() {
    const selected = this.#createUrl(
      this.selectedProvider,
      this.selectedLocation
    );

    const title =
      this.graph && this.graph.title
        ? `${this.graph.title}${this.isNewBoard ? "" : " Copy"}`
        : "Untitled Board";

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

          const form = evt.target;
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const data = new FormData(evt.target);
          const title = data.get("title") as string | null;
          const fileName = data.get("filename") as string | null;
          const provider = data.get("provider") as string | null;
          const graph = this.graph || blankLLMContent();

          if (!(title && provider && fileName && graph)) {
            return;
          }

          const [providerName, location] = this.#parseUrl(provider);
          const chosenProvider = this.providers.find(
            (provider) => provider.name === providerName
          );
          const chosenLocation = chosenProvider?.items().get(location);

          let fileExists = false;

          // Start with a simple match check.
          if (
            chosenLocation?.items.get(fileName) ||
            chosenLocation?.items.get(`${fileName}.json`) ||
            chosenLocation?.items.get(`${fileName}.bgl.json`)
          ) {
            fileExists = true;
          }

          // If that fails, try a slightly more involved check.
          if (!fileExists && chosenLocation?.items) {
            for (const item of chosenLocation.items.values()) {
              if (!item.mine) {
                continue;
              }

              fileExists =
                item.url.endsWith(fileName) ||
                item.url.endsWith(`${fileName}.json`) ||
                item.url.endsWith(`${fileName}.bgl.json`);

              if (fileExists) {
                break;
              }
            }
          }

          if (fileExists) {
            if (this.#fileNameRef.value) {
              this.#fileNameRef.value.setCustomValidity(
                "A file by this name already exists"
              );
              this.#fileNameRef.value.reportValidity();
            }

            return;
          }

          graph.title = title;
          this.dispatchEvent(
            new GraphProviderSaveBoardEvent(
              providerName,
              location,
              fileName,
              graph
            )
          );
        }}
      >
        <header>
          <h1>${this.panelTitle}</h1>
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

        <label>Provider</label>
        <select name="provider" .value=${this.selectedProvider}>
          ${map(this.providers, (provider) => {
            return html`${map(provider.items(), ([location, store]) => {
              const value = `${provider.name}::${location}`;
              const isSelectedOption = value === selected;
              return html`<option ?selected=${isSelectedOption} .value=${value}>
                ${store.title}
              </option>`;
            })}`;
          })}
        </select>

        <label>Title</label>
        <input
          name="title"
          type="text"
          required
          @input=${(evt: Event) => {
            if (!this.#fileNameRef.value) {
              return;
            }

            if (this.#fileNameRef.value.dataset["userEdited"]) {
              return;
            }

            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.#fileNameRef.value.value = this.#generateFileName(
              evt.target.value
            );
          }}
          .value=${title}
        />

        <label>File name</label>
        <input
          ${ref(this.#fileNameRef)}
          name="filename"
          type="text"
          required
          pattern="^[a-zA-Z0-9_\\-]+.bgl.json$"
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            evt.target.setCustomValidity("");
            evt.target.dataset["userEdited"] = "true";
          }}
          .value=${this.#generateFileName(title)}
        />

        <div id="controls">
          <button
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
            class="cancel"
            type="button"
          >
            Cancel
          </button>
          <input type="submit" value="Save" />
        </div>
      </form>
    </bb-overlay>`;
  }
}
