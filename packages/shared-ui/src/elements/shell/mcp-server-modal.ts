/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { Project } from "../../state";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../../styles/icons";
import { markdown } from "../../directives/markdown";
import { ok } from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";

@customElement("bb-mcp-servers-modal")
export class VEMCPServersModal extends SignalWatcher(LitElement) {
  @property()
  accessor project: Project | null = null;

  @property()
  accessor mode: "list" | "add" | "added" = "list";

  @state()
  accessor #loading = false;

  @state()
  accessor #status: HTMLTemplateResult | string | null = null;

  @query("form")
  accessor #form: HTMLFormElement | null = null;

  static styles = [
    type,
    colorsLight,
    icons,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        width: 80svw;
        max-width: 680px;
        max-height: 480px;
        overflow: scroll;
        scrollbar-width: none;

        & li {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          margin-bottom: var(--bb-grid-size-4);

          & h1 {
            margin: 0 0 var(--bb-grid-size) 0;
          }

          & p {
            margin: 0;
          }

          & input {
            display: none;
          }

          & label {
            border-radius: var(--bb-grid-size-2);
            padding: var(--bb-grid-size-3) var(--bb-grid-size-12)
              var(--bb-grid-size-3) var(--bb-grid-size-3);
            outline: 1px solid var(--n-80);
            cursor: pointer;
            opacity: 0.6;
            transition:
              opacity 0.2s cubic-bezier(0, 0, 0.3, 1),
              outline 0.2s cubic-bezier(0, 0, 0.3, 1);
            margin: 3px;
            position: relative;

            &:hover,
            &:focus {
              outline: 3px solid var(--n-60);
              opacity: 0.8;
            }

            &:has(+ input:checked) {
              outline: 3px solid var(--n-0);
              opacity: 1;
            }
          }

          & .delete {
            position: absolute;
            top: 8px;
            right: 4px;
            display: flex;
            align-items: center;
            padding: 0;
            color: var(--n-0);
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 50%;
            background: var(--n-100);
            white-space: nowrap;
            opacity: 0.7;
            transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:not([disabled]) {
              &:hover,
              &:focus {
                cursor: pointer;
                opacity: 1;
              }
            }
          }
        }
      }

      form {
        display: grid;
        row-gap: var(--bb-grid-size-3);
        align-items: start;
        grid-auto-rows: max-content;
        width: 80svw;
        max-width: 680px;

        & input {
          padding: var(--bb-grid-size-4);
          border-radius: var(--bb-grid-size-4);
          border: 1px solid var(--n-70);
          box-sizing: border-box;
        }

        & button[type="submit"] {
          display: none;
        }
      }

      #controls {
        padding: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
        display: flex;
        align-items: center;
        justify-content: end;

        & #status {
          flex: 1;
          display: flex;
          align-items: center;
          color: var(--n-0);
          margin: 0 0 var(--bb-grid-size-2) 0;

          & .g-icon {
            margin-right: var(--bb-grid-size-2);

            &.rotate {
              animation: rotate 1s linear forwards infinite;
            }
          }

          & .error {
            color: var(--e-40);
          }
        }

        & .cancel {
          height: 40px;
          border: none;
          background: transparent;

          color: var(--n-0);
          padding: 0 var(--bb-grid-size-4);
          border-radius: var(--bb-grid-size-16);
          margin-right: var(--bb-grid-size-3);

          &:not([disabled]) {
            &:hover,
            &:focus {
              cursor: pointer;
            }
          }
        }

        & .delete,
        & .add,
        & .save {
          display: flex;
          align-items: center;
          height: 40px;
          border: none;
          background: var(--n-0);
          border-radius: var(--bb-grid-size-16);
          color: var(--n-100);
          padding: 0 var(--bb-grid-size-4);

          & .g-icon {
            margin-right: var(--bb-grid-size-2);
          }

          &:not([disabled]) {
            &:hover,
            &:focus {
              cursor: pointer;
            }
          }
        }
      }

      .decision-message {
        max-width: 480px;
      }

      @keyframes rotate {
        0% {
          rotate: 0deg;
        }

        100% {
          rotate: 360deg;
        }
      }
    `,
  ];

  async #processForm() {
    this.#status = null;
    if (!this.project || !this.#form) {
      return;
    }

    if (!this.#form.checkValidity()) {
      this.#form.reportValidity();
      return;
    }

    const data = new FormData(this.#form);
    const url = data.get("url");
    if (!url || typeof url !== "string") {
      return;
    }

    const titleValue = data.get("title");
    let title: string | undefined = undefined;
    if (typeof titleValue === "string") {
      title = titleValue;
    }

    this.#status = html`<span class="g-icon filled round rotate"
        >progress_activity</span
      >
      Adding MCP Server`;
    try {
      this.#loading = true;

      const outcome = await this.project.mcp.add(url, title);
      if (!ok(outcome)) {
        this.#status = html`<span class="error">${outcome.$error}</span>`;
      } else {
        this.#status = null;
        this.mode = "added";
      }
    } catch (err) {
      console.warn(err);
      this.#status = html`<span class="error">An unknown error occured</span>`;
    } finally {
      this.#loading = false;
    }
  }

  #renderAddForm() {
    return html` <form
        @submit=${(evt: SubmitEvent) => {
          evt.preventDefault();
          this.#processForm();
        }}
      >
        <input
          class="sans-flex md-body-large round "
          placeholder="Enter an MCP Server URL"
          id="url"
          name="url"
          type="url"
          autocomplete="off"
          required
        />
        <input
          class="sans-flex md-body-large round "
          placeholder="Enter a title (optional)"
          id="title"
          name="title"
          type="text"
          autocomplete="off"
        />
        <button type="submit">Submit</button>
      </form>
      <div id="controls">
        ${this.#status ? html`<p id="status">${this.#status}</p>` : nothing}

        <button
          class="cancel md-label-large sans-flex"
          @click=${() => {
            this.#status = null;
            this.mode = "list";
          }}
        >
          Cancel
        </button>

        <button
          class="save md-label-large sans-flex"
          ?disabled=${this.#loading}
          @click=${this.#processForm}
          type="submit"
        >
          Add MCP Server
        </button>
      </div>`;
  }

  #renderList() {
    if (!this.project) {
      return html`MCP Server configuration unavailable`;
    }

    const servers = this.project.mcp.servers;
    if (!servers.value) {
      if (servers.status === "error") {
        return html`<p>Error loading MCP server list</p>`;
      }
      return html`<p>Loading ...</p>`;
    }

    return html` ${servers.value.size === 0
        ? html`<p>There are no MCP servers available</p>`
        : html`<ul>
            ${repeat(
              servers.value,
              ([id]) => id,
              ([id, server]) => {
                return html`<li>
                  <label for=${id}>
                    <h1 class="sans-flex w-500 round md-title-medium">
                      ${server.title}
                    </h1>
                    <div class="sans md-body-small">
                      ${markdown(server.description ?? "No description")}
                    </div>
                    <button
                      class="delete"
                      ?disabled=${!server.removable}
                      @click=${async () => {
                        if (
                          !confirm(
                            "Are you sure you want to delete this server from this list?"
                          )
                        ) {
                          return;
                        }
                        const removing = await this.project?.mcp.remove(id);
                        if (!ok(removing)) {
                          // TODO: Expose this in UI somehow.
                          console.error(
                            "Error deleting MCP server",
                            removing.$error
                          );
                        }
                      }}
                    >
                      <span class="g-icon filled round">delete</span>
                    </button>
                  </label>
                  <input
                    type="checkbox"
                    id=${id}
                    .checked=${!!server.registered}
                    @change=${(evt: Event) => {
                      if (
                        !(evt.target instanceof HTMLInputElement) ||
                        !this.project
                      ) {
                        return;
                      }

                      if (evt.target.checked) {
                        this.project.mcp.register(id);
                      } else {
                        this.project.mcp.unregister(id);
                      }
                    }}
                  />
                </li>`;
              }
            )}
          </ul>`}
      <div id="controls">
        <button
          class="delete md-label-large sans-flex"
          @click=${() => {
            this.#status = null;
            this.mode = "add";
          }}
        >
          <span class="g-icon filled round">add_box</span>Add New MCP Server...
        </button>
      </div>`;
  }

  #renderDecision() {
    return html`<p class="decision-message md-body-large">
        Great news! The MCP Server was added successfully. You can now register
        the Server to use it within this app.
      </p>

      <div id="controls">
        <button
          class="cancel md-label-large sans-flex"
          @click=${() => {
            this.#status = null;
            this.mode = "list";
          }}
        >
          Return to listing
        </button>

        <button
          class="add md-label-large sans-flex"
          @click=${() => {
            this.#status = null;
            this.mode = "add";
          }}
        >
          <span class="g-icon filled round">add_box</span>Add Another MCP
          Server...
        </button>
      </div>`;
  }

  render() {
    if (!this.project) {
      return nothing;
    }

    return html`<bb-modal
      .icon=${this.mode === "added" ? "check" : "robot_server"}
      .modalTitle=${this.mode === "list"
        ? "Manage MCP Servers"
        : this.mode === "added"
          ? "MCP Server added successfully"
          : "Add New MCP Server"}
      .showCloseButton=${true}
    >
      ${this.mode === "add"
        ? this.#renderAddForm()
        : this.mode === "added"
          ? this.#renderDecision()
          : this.#renderList()}
    </bb-modal>`;
  }
}
