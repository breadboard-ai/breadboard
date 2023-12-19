/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { Task } from "@lit/task";
import { customElement, property, state } from "lit/decorators.js";
import { Board } from "@google-labs/breadboard";
import * as Builder from "../builder/index.js";

import "./elements/board-wizard.js";
import { WizardCompleteEvent } from "./events/events.js";

@customElement("bb-web-builder")
export class WebBuilder extends LitElement {
  @property()
  url: string | null = null;

  @state()
  configuration: Record<string, unknown> | null = null;

  static styles = css`
    :host {
      --bb-accent-color: #6b5484;

      display: flex;
      height: 100%;
      justify-content: center;
      align-items: center;
    }

    #finished {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    a {
      color: var(--bb-accent-color);
      text-decoration: none;
      margin-bottom: 24px;
      display: block;
    }

    #finished a:first-of-type {
      font-weight: bold;
    }

    #again {
      font-size: 0.65rem;
    }

    form {
      display: grid;
      row-gap: 16px;
    }

    fieldset {
      border-radius: 8px;
      border: 1px solid #ddd;
    }

    legend {
      font-weight: bold;
    }
  `;

  #boardLoader = new Task(this, {
    task: async ([url]) => {
      if (!url) {
        throw new Error("Unable to load board - URL not set");
      }

      return await Board.load(url);
    },
    args: () => [this.url],
  });

  #zipCreator = new Task(this, {
    task: async ([configuration]) => {
      if (!configuration || !this.url) {
        throw new Error("Unable to create ZIP - Configuration not set");
      }

      const response = await fetch(this.url);
      configuration["board"] = await response.text();

      return await Builder.createZip(configuration);
    },
    args: () => [this.configuration],
  });

  render() {
    if (this.url) {
      if (this.configuration) {
        return this.#zipCreator.render({
          initial: () => html`Waiting to create ZIP`,
          pending: () => html`Creating ZIP`,
          complete: (zip: Blob) => {
            if (!this.configuration) {
              throw new Error("No configuration available");
            }

            const url = URL.createObjectURL(zip);
            return html`<div id="finished">
              <a href="${url}" download="${this.configuration.packageName}"
                >Download your zip</a
              ><a id="again" href="/">Try another URL?</a>
            </div>`;
          },
          error: () => html`There was an error loading the board`,
        });
      } else {
        return this.#boardLoader.render({
          initial: () => html`Waiting to load board`,
          pending: () => html`Loading board`,
          complete: (board) => {
            return html`<bb-board-wizard
              @breadbuddywizardcomplete=${this.#onWizardComplete}
              .board=${board}
            ></bb-board-wizard>`;
          },
          error: () =>
            html`There was an error loading the board.
              <a href="/">Make another app?</a>`,
        });
      }
    } else {
      return html`<form @submit="${this.#onFormSubmit}">
        <fieldset>
          <legend>Board URL</legend>
          <div>
            <input type="text" name="url" placeholder="Enter a board URL" />
            <input type="submit" />
          </div>
        </fieldset>
      </form>`;
    }
  }

  #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();
    if (!(evt.target instanceof HTMLFormElement)) {
      return;
    }

    const data = new FormData(evt.target);
    const url = data.get("url");
    if (!url) {
      return;
    }

    this.url = url.toString();

    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("board", this.url);
    window.history.replaceState(null, "", pageUrl);
  }

  #onWizardComplete(evt: WizardCompleteEvent) {
    this.configuration = evt.configuration;
  }
}
