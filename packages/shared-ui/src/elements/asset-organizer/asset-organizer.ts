/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AssetOrganizer");

import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { Organizer } from "../../state";
import { repeat } from "lit/directives/repeat.js";
import { Asset, AssetPath } from "@breadboard-ai/types";
import { classMap } from "lit/directives/class-map.js";

const EXPANDED_KEY = "bb-asset-organizer-expanded";
const VIEWER_KEY = "bb-asset-organizer-viewer";

@customElement("bb-asset-organizer")
export class AssetOrganizer extends SignalWatcher(LitElement) {
  @property()
  accessor state: Organizer | null = null;

  @property({ reflect: true })
  accessor expanded = false;

  @property({ reflect: true })
  accessor showViewer = false;

  @state()
  accessor asset: Asset | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    #container {
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-2);
      display: flex;
      flex-direction: column;
      overflow: auto;
      width: 260px;
      height: var(--bb-grid-size-11);
      box-shadow: var(--bb-elevation-5);

      & #add-asset {
        opacity: 0;
        display: block;
        width: 0;
        height: 0;
      }

      & #add-asset-container {
        height: var(--bb-grid-size-11);
        display: flex;
        align-items: center;
        padding: 0 var(--bb-grid-size-3);
      }

      label[for="add-asset"] {
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        border-radius: var(--bb-grid-size-16);
        height: var(--bb-grid-size-7);
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-7);
        background: var(--bb-neutral-100) var(--bb-icon-add) 4px center / 20px
          20px no-repeat;
        border: 1px solid var(--bb-neutral-200);
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:hover,
        &:focus {
          background-color: Var(--bb-neutral-300);
        }
      }

      & header {
        display: flex;
        align-items: center;
        height: var(--bb-grid-size-11);
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-4);
        user-select: none;

        & h1 {
          flex: 1;
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          margin: 0;
          display: flex;
          align-items: center;

          &::before {
            content: "";
            display: block;
            width: 20px;
            height: 20px;
            background: var(--bb-icon-alternate-email) center center / 20px 20px
              no-repeat;
            margin-right: var(--bb-grid-size-2);
          }
        }

        & #toggle-viewer {
          cursor: pointer;
          display: none;
          border-radius: var(--bb-grid-size-16);
          align-items: center;
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          height: var(--bb-grid-size-7);
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
          background: var(--bb-icon-dock-to-right) 8px center / 20px 20px
            no-repeat;
          border: 1px solid transparent;
          margin-right: var(--bb-grid-size);
          transition:
            background-color 0.1s cubic-bezier(0, 0, 0.3, 1),
            border 0.1s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &.active {
            background-color: var(--bb-ui-100);
            border: 1px solid var(--bb-ui-300);
          }
        }

        & #toggle-expanded {
          width: 20px;
          height: 20px;
          flex: 0 0 auto;
          background: var(--bb-icon-expand-content) center center / 20px 20px
            no-repeat;
          border: none;
          font-size: 0;
          cursor: pointer;

          opacity: 0.5;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }

      & #assets {
        display: none;

        & #no-assets {
          color: var(--bb-neutral-900);
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          padding: var(--bb-grid-size-3) var(--bb-grid-size-3);
        }

        & > section {
          display: flex;
          flex-direction: column;
        }

        & menu {
          margin: 0;
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          list-style: none;
          flex: 1 0 auto;
          overflow-y: scroll;
          overflow-x: hidden;
          width: 100%;
          display: block;

          & li {
            display: flex;
            align-items: center;
            margin-bottom: var(--bb-grid-size);

            & .asset {
              flex: 1;
              height: var(--bb-grid-size-7);
              background: var(--bb-ui-100) var(--bb-icon-text) 4px center / 20px
                20px no-repeat;
              border-radius: var(--bb-grid-size);
              display: flex;
              align-items: center;
              font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);
              border: none;
              padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
              transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
              width: 100%;
              color: var(--bb-neutral-900);

              &.content {
                background: var(--bb-ui-100) var(--bb-icon-text) 4px center /
                  20px 20px no-repeat;
              }

              &.file {
                background: var(--bb-ui-100) var(--bb-icon-attach) 4px center /
                  20px 20px no-repeat;
              }

              &:not([disabled]) {
                cursor: pointer;
                background-color: var(--bb-neutral-0);

                &:hover,
                &:focus {
                  background-color: var(--bb-neutral-50);
                }
              }
            }

            & .delete {
              margin-left: var(--bb-grid-size-2);
              width: 20px;
              height: 20px;
              background: transparent var(--bb-icon-delete) center center / 20px
                20px no-repeat;
              font-size: 0;
              border: none;
              opacity: 0.5;
              transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
              cursor: pointer;

              &:hover,
              &:focus {
                opacity: 1;
              }
            }
          }
        }

        & #details {
          width: 100%;
          padding: var(--bb-grid-size-3);
          overflow-y: scroll;
          overflow-x: hidden;

          bb-multi-output {
            width: 100%;
          }
        }
      }
    }

    :host([expanded="true"]) {
      & #container {
        height: 464px;

        & header {
          border-bottom: 1px solid var(--bb-neutral-300);

          & #toggle-expanded {
            background: var(--bb-icon-collapse-content) center center / 20px
              20px no-repeat;
          }

          & #toggle-viewer {
            display: flex;
          }
        }

        & #controls {
          display: block;
          height: var(--bb-grid-size-13);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 var(--bb-grid-size-3);
          border-bottom: 1px solid var(--bb-neutral-300);
          user-select: none;
        }

        & #assets {
          display: block;
          flex: 1;
          overflow: auto;

          bb-multi-output {
            display: none;
          }
        }
      }
    }

    :host([showviewer="true"][expanded="true"]) {
      & #container {
        width: 600px;

        & #assets {
          display: grid;
          grid-template-columns: 232px 1fr;

          bb-multi-output {
            display: block;
          }
        }

        & #details {
          display: flex;
          border-left: 1px solid var(--bb-neutral-300);
        }
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    const isExpanded = globalThis.localStorage.getItem(EXPANDED_KEY);
    const showingViewer = globalThis.localStorage.getItem(VIEWER_KEY);
    if (isExpanded !== null) {
      this.expanded = isExpanded === "true";
    }

    if (showingViewer !== null) {
      this.showViewer = showingViewer === "true";
    }
  }

  #toggleExpandedState(force = false) {
    this.expanded = force ? true : !this.expanded;

    globalThis.localStorage.setItem(EXPANDED_KEY, `${this.expanded}`);
  }

  #toggleViewer(force = false) {
    this.showViewer = force ? true : !this.showViewer;

    globalThis.localStorage.setItem(VIEWER_KEY, `${this.showViewer}`);
  }

  #showAsset(asset: Asset) {
    this.#toggleExpandedState(true);
    this.#toggleViewer(true);

    this.asset = asset;
  }

  #deleting = false;
  async #deleteAsset(asset: AssetPath) {
    if (!this.state) {
      return;
    }

    this.#deleting = true;
    await this.state.removeGraphAsset(asset);
    this.#deleting = false;
  }

  render() {
    const outputs = this.asset ? { data: this.asset.data } : null;

    const assets = this.state?.graphAssets;

    return html`<div id="container">
      <header>
        <h1 @dblclick=${() => this.#toggleExpandedState()}>
          ${Strings.from("LABEL_TITLE")}
        </h1>
        <button
          id="toggle-viewer"
          class=${classMap({ active: this.showViewer })}
          @click=${() => this.#toggleViewer()}
        >
          ${Strings.from("COMMAND_TOGGLE_VIEWER")}
        </button>
        <button
          id="toggle-expanded"
          @click=${() => this.#toggleExpandedState()}
        >
          ${Strings.from("COMMAND_TOGGLE_EXPAND")}
        </button>
      </header>
      <section id="assets">
        <section>
          <div id="add-asset-container">
            <input
              type="file"
              id="add-asset"
              @input=${(evt: InputEvent) => {
                if (
                  !(evt.target instanceof HTMLInputElement) ||
                  !evt.target.files
                ) {
                  return;
                }

                const assetLoad = [...evt.target.files].map((file) => {
                  return new Promise<{
                    name: string;
                    type: string;
                    content: string | null;
                  }>((resolve) => {
                    const reader = new FileReader();
                    reader.addEventListener("loadend", () => {
                      resolve({
                        name: file.name,
                        type: file.type,
                        content: reader.result as string | null,
                      });
                    });
                    reader.readAsDataURL(file);
                  });
                });

                Promise.all(assetLoad).then((assets) => {
                  if (!this.state) {
                    return;
                  }

                  for (const asset of assets) {
                    this.state.addGraphAsset(asset.name, {
                      metadata: {
                        title: asset.name,
                        type: "file",
                      },
                      data: asset.content ?? "",
                    });
                  }
                });
              }}
            />
            <label for="add-asset">${Strings.from("COMMAND_ADD_ASSET")}</label>
          </div>
          ${assets && assets.size > 0
            ? html`<menu>
                ${repeat(assets, ([path, asset]) => {
                  return html`<li>
                    <button
                      class=${classMap({
                        asset: true,
                        [asset.metadata?.type ?? "generic"]: true,
                      })}
                      ?disabled=${asset === this.asset}
                      @click=${() => {
                        this.#showAsset(asset);
                      }}
                    >
                      ${asset.metadata?.title || path}
                    </button>
                    <button
                      class=${classMap({
                        delete: true,
                      })}
                      @click=${async () => {
                        if (this.#deleting) {
                          return;
                        }

                        if (this.asset && this.asset === asset) {
                          this.asset = null;
                        }

                        await this.#deleteAsset(path);
                      }}
                    >
                      Delete
                    </button>
                  </li>`;
                })}
              </menu>`
            : html`<div id="no-assets">
                ${Strings.from("LABEL_NO_ASSETS")}
              </div>`}
        </section>

        <section id="details">
          <bb-multi-output
            .outputs=${outputs}
            .message=${Strings.from("LABEL_WAITING_MESSAGE")}
          ></bb-multi-output>
        </section>
      </section>
    </div>`;
  }
}
