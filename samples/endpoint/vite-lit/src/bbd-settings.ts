import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

type SettingsData = {
  url: string;
  key: string;
};

const SETTINGS_LOCAL_STORAGE_KEY = "settings";

@customElement("bbd-settings")
export class Settings extends LitElement {
  @property()
  data: SettingsData = this.#readSettings();

  render() {
    const { url, key } = this.data;
    const leaveOpen = !url || !key;
    return html`<details ?open=${leaveOpen}>
      <summary>Settings</summary>
      <form @submit=${this.#onSubmit}>
        <label
          >Board URL:
          <input
            type="text"
            name="url"
            placeholder="e.g. example.com/boards/@name/board.bgl.json"
            .value=${url}
          />
        </label>
        <label
          >Board Server API Key:
          <input
            type="text"
            name="key"
            .value=${key}
            placeholder="e.g. bb-<long-number>"
          />
        </label>
        <button type="submit">Save</button>
      </form>
    </details>`;
  }

  #updateSettings(data: SettingsData) {
    localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(data));
    this.data = data;
  }

  #readSettings() {
    return JSON.parse(
      localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY) || "{}"
    ) as SettingsData;
  }

  #onSubmit(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries()) as SettingsData;
    this.#updateSettings(data);
  }

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }

    label {
      display: block;
      margin-bottom: 1rem;
    }

    input {
      width: 100%;
      padding: 0.5rem;
      font-size: 1rem;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-settings": Settings;
  }
}
