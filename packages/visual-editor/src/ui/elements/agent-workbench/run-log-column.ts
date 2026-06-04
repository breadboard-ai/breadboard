/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { STATUS } from "../../../sca/types.js";
import { StateEvent } from "../../events/events.js";
import * as Styles from "../../styles/styles.js";
import "./run-view.js";

@customElement("bb-run-log-column")
export class RunLogColumn extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @state()
  accessor historyExpanded = false;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-3);
        overflow: hidden;
      }

      header {
        display: flex;
        align-items: center;
        height: 48px;
        padding: 0 var(--bb-grid-size-4);
        border-bottom: 1px solid var(--light-dark-n-90);
        background: var(--light-dark-n-100);
        position: relative;
        flex-shrink: 0;
      }

      #agent-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;

        & .panel-title {
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);

          & h2 {
            margin: 0;
            font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
            color: var(--light-dark-n-20);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          & .g-icon {
            font-size: 20px;
            color: var(--light-dark-n-40);
          }
        }

        & .btn.primary {
          padding-left: var(--bb-grid-size-2);
        }
      }

      #controls {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        gap: var(--bb-grid-size-2);
        padding: 0 var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-10);
        border: 1px solid light-dark(var(--n-85), var(--n-40));
        background: light-dark(var(--n-100), var(--n-25));
        color: light-dark(var(--n-10), var(--n-90));
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        cursor: pointer;
        transition:
          background-color 0.2s,
          border-color 0.2s;
        height: 28px;

        &:hover:not([disabled]) {
          background: light-dark(var(--n-95), var(--n-30));
        }

        &[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &.primary {
          background: var(
            --bb-accent-color,
            light-dark(var(--p-40), var(--p-80))
          );
          color: light-dark(var(--n-100), var(--n-10));
          border-color: transparent;

          &:hover:not([disabled]) {
            background: light-dark(var(--p-30), var(--p-70));
          }
        }
      }

      #progress-bar {
        width: 100%;
        height: 4px;
        background: light-dark(var(--n-90), var(--n-30));
        border-radius: 2px;
        position: absolute;
        bottom: 0;
        left: 0;
        overflow: hidden;

        &::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: calc(var(--progress, 0) * 100%);
          background: var(
            --bb-accent-color,
            light-dark(var(--p-40), var(--p-80))
          );
          transition: width 0.3s ease;
        }
      }

      #history-section {
        border-bottom: 1px solid light-dark(var(--n-80), var(--n-70));
        background: light-dark(var(--n-98), var(--n-20));

        & summary {
          padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
          font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
          color: light-dark(var(--n-45), var(--n-80));
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: space-between;

          &::-webkit-details-marker {
            display: none;
          }

          & .g-icon {
            font-size: 16px;
            transition: transform 0.2s;
          }
        }

        &[open] summary .g-icon {
          transform: rotate(180deg);
        }
      }

      #history-list {
        max-height: 200px;
        overflow-y: auto;
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-2);
        border-top: 1px solid light-dark(var(--n-90), var(--n-30));
      }

      .run-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--bb-grid-size-2);
        border-radius: var(--bb-grid-size-2);
        background: light-dark(var(--n-100), var(--n-25));
        border: 1px solid light-dark(var(--n-90), var(--n-35));
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);

        & .status-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--bb-grid-size);
          font-weight: 500;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;

          &.completed {
            background: light-dark(var(--g-95), var(--g-25));
            color: light-dark(var(--g-20), var(--g-80));
          }

          &.failed {
            background: light-dark(var(--r-95), var(--r-25));
            color: light-dark(var(--r-20), var(--r-80));
          }

          &.running {
            background: light-dark(var(--b-95), var(--b-25));
            color: light-dark(var(--b-20), var(--b-80));
          }
        }

        & .time {
          color: light-dark(var(--n-45), var(--n-75));
        }

        & .summary {
          font-size: 11px;
          color: light-dark(var(--n-40), var(--n-80));
        }
      }

      #active-run-container {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        & bb-run-view {
          flex: 1;
          height: 100%;
        }
      }

      #empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        padding: var(--bb-grid-size-8);
        text-align: center;
        color: light-dark(var(--n-40), var(--n-80));
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);

        & .g-icon {
          font-size: 48px;
          margin-bottom: var(--bb-grid-size-4);
          color: light-dark(var(--n-70), var(--n-50));
        }
      }
    `,
  ];

  #onRunClick() {
    this.dispatchEvent(new StateEvent({ eventType: "board.restart" }));
  }

  #onStopClick() {
    this.dispatchEvent(new StateEvent({ eventType: "board.stop" }));
  }

  #formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  render() {
    if (!this.sca.controller) return nothing;

    const runController = this.sca.controller.run.main;
    const status = runController.status;
    const progress = runController.progress;
    const isRunning = status === STATUS.RUNNING || status === STATUS.PAUSED;

    // Retrieve all historical runs from agentContext
    const allRuns = this.sca.services.agentContext?.getAllRuns() ?? [];

    return html`
      <header>
        <div id="agent-info">
          <div class="panel-title">
            <span class="g-icon filled round">history</span>
            <h2>Runs</h2>
          </div>
          <div id="controls">
            ${isRunning
              ? html`
                  <button class="btn" @click=${this.#onStopClick}>
                    <span class="g-icon filled">stop</span> Stop
                  </button>
                `
              : html`
                  <button class="btn primary" @click=${this.#onRunClick}>
                    <span class="g-icon filled">play_arrow</span> Run
                  </button>
                `}
          </div>
        </div>
        ${isRunning
          ? html`
              <div id="progress-bar" style="--progress: ${progress}"></div>
            `
          : nothing}
      </header>

      ${allRuns.length > 0
        ? html`
            <details
              id="history-section"
              ?open=${this.historyExpanded}
              @toggle=${(e: Event) => {
                this.historyExpanded = (e.target as HTMLDetailsElement).open;
              }}
            >
              <summary>
                Run History (${allRuns.length})
                <span class="g-icon">keyboard_arrow_down</span>
              </summary>
              <div id="history-list">
                ${allRuns.map((run) => {
                  const turnCount = run.contents.filter(
                    (c) => c.role === "model"
                  ).length;
                  return html`
                    <div class="run-item">
                      <div
                        style="display: flex; flex-direction: column; gap: 4px;"
                      >
                        <span class="status-badge ${run.status}">
                          ${run.status === "completed"
                            ? "Completed"
                            : run.status === "failed"
                              ? "Failed"
                              : "Running"}
                        </span>
                        <span class="summary">
                          ${turnCount} turn${turnCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <span class="time"
                        >${this.#formatTime(run.startTime)}</span
                      >
                    </div>
                  `;
                })}
              </div>
            </details>
          `
        : nothing}

      <div id="active-run-container">
        ${runController.consoleState === "entries" || isRunning
          ? html` <bb-run-view .disclaimerContent=${""}></bb-run-view> `
          : html`
              <div id="empty-state">
                <span class="g-icon">play_circle_filled</span>
                <p>Click Run to start executing the agent.</p>
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-run-log-column": RunLogColumn;
  }
}
