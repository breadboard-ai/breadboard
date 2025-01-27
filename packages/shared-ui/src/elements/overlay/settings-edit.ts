/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  OverlayDismissedEvent,
  SettingsUpdateEvent,
} from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { map } from "lit/directives/map.js";
import {
  CustomSettingsElement,
  SETTINGS_TYPE,
  Settings,
} from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-settings-edit-overlay")
export class SettingsEditOverlay extends LitElement {
  @property()
  accessor settings: Settings | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();
  #selectNewestItemFor: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      --height: 300px;
    }

    form {
      display: flex;
      flex-direction: column;
      width: 85vw;
      max-width: 620px;
    }

    header {
      display: flex;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid var(--bb-neutral-300);
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
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-body-medium);
      background: var(--bb-neutral-50);
      color: var(--bb-neutral-600);
      display: block;
      margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
      border-radius: 60px;
      cursor: pointer;
    }

    input[type="radio"]:checked ~ label {
      background: var(--bb-ui-100);
      color: var(--bb-ui-700);
      cursor: auto;
    }

    input,
    textarea {
      font-size: var(--bb-body-x-small);
      font-family: var(--bb-font-family);
      border: 1px solid var(--bb-neutral-400);
      resize: none;
      line-height: 1.5;
      border-radius: var(--bb-grid-size);
    }

    textarea {
      height: 140px;
    }

    .settings {
      height: var(--height);
      position: relative;
    }

    .settings-group {
      height: var(--height);
      font-size: var(--bb-body-medium);
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
      background: var(--bb-ui-500);
      background-image: var(--bb-icon-resume-ui);
      background-size: 16px 16px;
      background-position: 8px 4px;
      background-repeat: no-repeat;
      color: var(--bb-neutral-0);
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px 0 28px;
      margin: 0;
    }

    input[type="radio"] {
      display: none;
    }

    input[type="radio"] ~ .settings-group-items {
      display: none;
    }

    input[type="radio"]:checked ~ .settings-group-items {
      display: grid;
      grid-template-columns: 1fr 1fr 24px;
      grid-auto-rows: min-content;
      row-gap: calc(var(--bb-grid-size) * 2);
      column-gap: calc(var(--bb-grid-size) * 2);
      height: var(--height);
      overflow-y: scroll;
      scrollbar-gutter: stable;
      width: 70%;
      position: absolute;
      top: 0;
      left: 30%;
      padding: calc(var(--bb-grid-size) * 4);
    }

    .settings-group-items {
      background: var(--bb-neutral-50);
      border-radius: calc(var(--bb-grid-size) * 2) 0 0
        calc(var(--bb-grid-size) * 2);
    }

    .settings-group-items .no-entries,
    .settings-group-items .description,
    .settings-group-items .custom-panel {
      grid-column: 1 / 4;
    }

    .settings-group-items .description {
      font-size: var(--bb-body-small);
      line-height: var(--bb-body-line-height-small);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
    }

    .settings-group-items > * {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
    }

    .setting-description {
      font-size: var(--bb-body-x-small);
      line-height: var(--bb-body-line-height-x-small);
    }

    .setting-name.hidden {
      display: none;
    }

    .setting-name.double,
    .setting-value.double {
      grid-column: 1 / 3;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .settings-group > li {
      width: 30%;
    }

    .delete {
      width: 16px;
      height: 16px;
      background: none;
      background-image: var(--bb-icon-delete);
      background-position: center center;
      background-repeat: no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
      margin-left: var(--bb-grid-size);
    }

    .delete:hover {
      opacity: 1;
    }

    input[type="text"],
    input[type="number"] {
      width: 100%;
    }

    #add-new-item {
      width: 16px;
      height: 16px;
      background: var(--bb-icon-add-circle) center center no-repeat;
      background-size: 16px 16px;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    #add-new-item:hover {
      opacity: 1;
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

  protected updated(): void {
    if (!this.#selectNewestItemFor || !this.#formRef.value) {
      return;
    }

    const sectionName = this.#selectNewestItemFor;
    this.#selectNewestItemFor = null;

    const section = this.#formRef.value.querySelector(`#items-${sectionName}`);
    if (!section) {
      return;
    }

    const inputs = section.querySelectorAll<HTMLInputElement>(
      `input[name^="setting-${sectionName}-name"]`
    );
    if (inputs.length === 0) {
      return;
    }

    const newestInput = inputs[inputs.length - 1];
    if (!newestInput) {
      return;
    }

    newestInput.focus();
    newestInput.select();
  }

  #addNewItem(name: keyof Settings, id: string) {
    if (!this.settings) {
      return;
    }

    const section = this.settings[name];
    if (!section) {
      return;
    }

    const itemName = `Item-${globalThis.crypto.randomUUID().slice(-6)}`;
    section.items.set(itemName, {
      name: itemName,
      value: "",
    });
    this.#selectNewestItemFor = id;
    this.requestUpdate();
  }

  #deleteItem(id: keyof Settings, itemId: string) {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    if (!this.settings) {
      return;
    }

    const section = this.settings[id];
    if (!section) {
      return;
    }
    section.items.delete(itemId);
    this.requestUpdate();
  }

  #validate(form: HTMLFormElement) {
    if (!this.settings) {
      return;
    }

    const data = new FormData(form);
    const seenItems = new Map<string, Set<string>>();
    for (const [name, value] of data) {
      if (name === "Setting") {
        continue;
      }

      const [, id, type, idx] = name.split("-");
      if (type !== "section") {
        continue;
      }

      if (typeof value !== "string") {
        continue;
      }

      const itemName = `setting-${id}-name-${idx}`;
      let items = seenItems.get(id);
      if (!items) {
        items = new Set<string>();
        seenItems.set(id, items);
      }

      const configurationName = data.get(itemName);
      if (!configurationName || typeof configurationName !== "string") {
        continue;
      }

      if (!items.has(configurationName)) {
        items.add(configurationName);
        continue;
      }

      const field = form.querySelector<HTMLObjectElement>(
        `[name="${itemName}"]`
      );
      field?.setCustomValidity("Field with same name already exists");
      return false;
    }
    return true;
  }

  #getUpdatedSettings(form: HTMLFormElement) {
    if (!this.settings) {
      return null;
    }

    const settings = structuredClone(this.settings);
    const data = new FormData(form);
    const seenItemsBySection = new Map<string, Set<string>>();
    for (const [name, section] of data) {
      if (name === "Setting") {
        continue;
      }

      const [, id, type, idx] = name.split("-");
      if (type !== "section") {
        continue;
      }

      if (typeof section !== "string") {
        continue;
      }

      const itemName = `setting-${id}-name-${idx}`;
      const itemValue = `setting-${id}-value-${idx}`;

      let seenItems = seenItemsBySection.get(section);
      if (!seenItems) {
        seenItems = new Set<string>();
        seenItemsBySection.set(section, seenItems);
      }

      const configurationName = data.get(itemName);
      const newConfigurationValue = data.get(itemValue);
      if (!configurationName || typeof configurationName !== "string") {
        continue;
      }

      seenItems.add(configurationName);
      const sectionName = section as keyof Settings;

      // Create the config item if it doesn't exist.
      let configurationItem =
        settings[sectionName].items.get(configurationName);
      if (!configurationItem) {
        configurationItem = { name: configurationName, value: "" };
        settings[sectionName].items.set(configurationName, configurationItem);
      }

      const configurationType = typeof configurationItem.value;
      switch (configurationType) {
        case "boolean": {
          configurationItem.value = newConfigurationValue !== null;
          break;
        }

        case "number": {
          if (newConfigurationValue === null) {
            configurationItem.value = 0;
            break;
          }

          if (typeof newConfigurationValue !== "string") {
            configurationItem.value = 0;
            break;
          }

          configurationItem.value = parseInt(newConfigurationValue, 10);
          break;
        }

        default: {
          if (newConfigurationValue === null) {
            break;
          }

          if (typeof newConfigurationValue !== "string") {
            break;
          }

          configurationItem.value = newConfigurationValue;
        }
      }
    }

    // Now clean any items that we didn't see on the way through.
    for (const section of Object.keys(settings)) {
      const itemsBySection = seenItemsBySection.get(section);
      if (!itemsBySection) {
        continue;
      }

      const sectionName = section as keyof Settings;
      for (const [name] of settings[sectionName].items) {
        if (itemsBySection.has(name)) {
          continue;
        }

        settings[sectionName].items.delete(name);
      }
    }

    return settings;
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

          const form = evt.target;
          this.#validate(form);

          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          const newSettings = this.#getUpdatedSettings(form);
          if (!newSettings) {
            return;
          }

          this.dispatchEvent(new SettingsUpdateEvent(newSettings));
        }}
      >
        <header>
          <h1>Settings</h1>
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

        <section class="settings">
          ${this.settings
            ? html`<ul class="settings-group">
                ${map(
                  Object.entries(this.settings),
                  ([name, { configuration, items }], idx) => {
                    const id = name.toLocaleLowerCase().replace(/\s/g, "_");
                    let addNewItem: HTMLTemplateResult | symbol = nothing;
                    if (configuration.extensible) {
                      addNewItem = html`<button
                        type="button"
                        id="add-new-item"
                        title="Add new item"
                        @click=${() =>
                          this.#addNewItem(name as keyof Settings, id)}
                      >
                        Add new item
                      </button>`;
                    }

                    return html`
                      <li>
                        <input
                          type="radio"
                          id="${id}"
                          name="setting"
                          ?checked=${idx === 0}
                          .value=${name}
                          @click=${(evt: Event) => {
                            if (!this.#formRef.value) {
                              return;
                            }

                            const form = this.#formRef.value;
                            this.#validate(form);
                            if (form.checkValidity()) {
                              return;
                            }

                            evt.preventDefault();

                            // At the point of clicking the browser seems to
                            // have notionally switched to the new section,
                            // making the current section (where the error
                            // resides) no longer visible. This means that an
                            // error is thrown indicating that the field may not
                            // be focused. To work around this we wait a frame
                            // to ensure that the click action has been
                            // prevented and the browser still has the erroring
                            // part of the form visible to the user.
                            requestAnimationFrame(() => {
                              form.reportValidity();
                            });
                          }}
                        />
                        <label for="${id}">${name}</label>
                        <section class="settings-group-items" id="items-${id}">
                          <p class="description">
                            ${configuration.description}
                          </p>
                          ${configuration.customElement
                            ? this.#renderCustomSettingsElement(
                                configuration.customElement,
                                name as SETTINGS_TYPE,
                                items
                              )
                            : items.size > 0
                              ? map(items.entries(), ([itemId, item], idx) => {
                                  const inName = html`
                                    ${configuration.nameEditable
                                      ? html`<input
                                          type="text"
                                          name="setting-${id}-name-${idx}"
                                          required
                                          @input=${(evt: Event) => {
                                            if (
                                              !(
                                                evt.target instanceof
                                                HTMLInputElement
                                              )
                                            ) {
                                              return;
                                            }

                                            evt.target.setCustomValidity("");
                                          }}
                                          .value=${item.name}
                                        />`
                                      : html`<input
                                            type="hidden"
                                            name="setting-${id}-name-${idx}"
                                            .value=${item.name}
                                          />${configuration.nameVisible
                                            ? item.name
                                            : ""}`}
                                    ${item.description
                                      ? html`<div class="setting-description">
                                          ${item.description}
                                        </div>`
                                      : nothing}
                                  `;
                                  let inValue: HTMLTemplateResult | symbol =
                                    nothing;
                                  switch (typeof item.value) {
                                    case "boolean": {
                                      inValue = html`<input
                                        type="checkbox"
                                        name="setting-${id}-value-${idx}"
                                        .checked=${item.value}
                                      />`;
                                      break;
                                    }

                                    case "number": {
                                      inValue = html`<input
                                        type="number"
                                        name="setting-${id}-value-${idx}"
                                        required
                                        .value=${item.value}
                                      />`;
                                      break;
                                    }

                                    default: {
                                      inValue = html`<input
                                        type="text"
                                        name="setting-${id}-value-${idx}"
                                        required
                                        .value=${item.value}
                                      />`;
                                      break;
                                    }
                                  }

                                  const deleteButton = configuration.extensible
                                    ? html`<button
                                        class="delete"
                                        type="button"
                                        @click=${() => {
                                          this.#deleteItem(
                                            name as keyof Settings,
                                            itemId
                                          );
                                        }}
                                      >
                                        Delete
                                      </button>`
                                    : nothing;

                                  const double =
                                    typeof item.value === "boolean" &&
                                    !configuration.extensible;
                                  return html` <input
                                      type="hidden"
                                      name="setting-${id}-section-${idx}"
                                      .value=${name}
                                    />

                                    <div
                                      class=${classMap({
                                        "setting-name": true,
                                        double,
                                        hidden: !configuration.nameVisible,
                                      })}
                                    >
                                      ${inName}
                                    </div>

                                    <div
                                      class=${classMap({
                                        "setting-value": true,
                                        double: !configuration.nameVisible,
                                      })}
                                    >
                                      ${inValue}
                                    </div>
                                    <div>${deleteButton}</div>`;
                                })
                              : html`<div class="no-entries">
                                  There are currently no entries
                                </div>`}
                          ${addNewItem}
                        </section>
                      </li>
                    `;
                  }
                )}
              </ul>`
            : html`No settings found`}
        </section>
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

  #renderCustomSettingsElement(
    elementName: string,
    settingsType: SETTINGS_TYPE,
    settingsItems: Settings[SETTINGS_TYPE]["items"]
  ) {
    const element = document.createElement(
      elementName
    ) as CustomSettingsElement;
    element.classList.add("custom-panel");
    element.settingsType = settingsType;
    element.settingsItems = settingsItems;
    return element;
  }
}
