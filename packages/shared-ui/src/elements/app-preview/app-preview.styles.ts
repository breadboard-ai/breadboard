/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";

export const styles = css`
  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  * {
    box-sizing: border-box;
  }

  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  bb-chat {
    height: 100%;
  }

  #container {
    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    height: 100%;
    background: var(--bb-neutral-0);
    position: relative;
    padding: var(--bb-grid-size-4);

    & #status {
      padding: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-2);
      background: var(--bb-ui-50);
      color: var(--bb-ui-700);
      opacity: 0;
      transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-3);

      &.active {
        opacity: 1;
      }
    }

    --output-border-width: 1px;
    --output-border-color: var(--bb-neutral-300);
    --output-border-radius: var(--bb-grid-size-4);
    --output-padding: var(--bb-grid-size-5);

    & #controls {
      padding-bottom: var(--bb-grid-size-3);
      display: flex;
      align-item: flex-end;

      & #url,
      & #designer,
      & #details,
      & #output {
        border: none;
        border-radius: var(--bb-grid-size-16);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        height: var(--bb-grid-size-8);
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-8);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        margin: 0 var(--bb-grid-size);

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            background-color: var(--bb-neutral-50);
          }
        }
      }

      & #details {
        background: var(--bb-icon-edit) var(--bb-neutral-0) 8px center / 20px
          20px no-repeat;
      }

      & #designer {
        background: var(--bb-icon-palette) var(--bb-neutral-0) 8px center / 20px
          20px no-repeat;
      }

      & #url {
        background: var(--bb-icon-link) var(--bb-neutral-0) 8px center / 20px
          20px no-repeat;
      }

      & #output {
        padding: 0;
        width: 32px;
        height: 32px;

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            background-color: var(--bb-ui-50);
          }
        }

        &.app {
          background: var(--bb-icon-phone) var(--bb-neutral-0) center center /
            20px 20px no-repeat;
        }

        &.console {
          background: var(--bb-icon-list) var(--bb-neutral-0) center center /
            20px 20px no-repeat;
        }
      }
    }

    & #content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 100%;

      margin: 0 auto;
      max-width: 450px;
      max-height: 100%;
      aspect-ratio: 9/16;

      overflow: auto;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      position: relative;
      background: var(--background-color, var(--bb-neutral-0));
      border-radius: var(--bb-grid-size-4);

      &.active {
        border: 1px solid var(--bb-neutral-300);
      }

      & .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;

        & .loading-message {
          display: flex;
          align-items: center;
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          padding-left: var(--bb-grid-size-8);
          height: var(--bb-grid-size-5);
          background: url(/images/progress-ui.svg) 0 center / 20px 20px
            no-repeat;
        }
      }

      footer {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--bb-grid-size-2) var(--bb-grid-size-6);
        background: var(--bb-neutral-0);
        border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);
      }

      .user-input {
        & .input {
          flex: 1;

          & .title {
            font: 500 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
            margin: 2px 0 var(--bb-grid-size) 0;
          }
        }

        & #continue-button-container {
          display: flex;
          align-items: flex-end;

          & button {
            font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
              var(--bb-font-family);
            margin-top: var(--bb-grid-size);
            height: var(--bb-grid-size-7);
            border: none;
            display: block;
            padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
            border-radius: var(--bb-grid-size-16);
            background: var(--bb-ui-100) var(--bb-icon-check) 8px center / 20px
              20px no-repeat;

            &[disabled] {
              opacity: 0.4;
            }

            &:not([disabled]) {
              cursor: pointer;
              transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
              opacity: 0.7;

              &:hover,
              &:focus {
                opacity: 1;
              }
            }
          }
        }
      }

      .user-input,
      .user-output,
      .model-output,
      .status {
        animation: fadeIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

        & p {
          margin: 0 0 var(--bb-grid-size) 0;
        }
      }

      .status,
      .user-input,
      .user-output,
      .model-output {
        display: flex;

        & .icon {
          margin: 0 var(--bb-grid-size-2) 0 0;

          &::after {
            display: flex;
            content: "";
            width: var(--bb-grid-size-5);
            height: var(--bb-grid-size-5);
            border-radius: 50%;
            background: var(--bb-neutral-0) center center / 20px 20px no-repeat;
          }
        }

        & .value {
          color: var(--bb-neutral-900);
        }

        & .title {
          color: var(--bb-neutral-900);
          margin: 2px 0 var(--bb-grid-size) 0;
          font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
        }

        & label {
          color: var(--bb-neutral-500);
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          margin-bottom: var(--bb-grid-size-2);
        }
      }

      .status {
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        color: var(--bb-neutral-500);
        background: url(/images/progress-ui.svg) 0 center / 20px 20px no-repeat;
        padding-left: var(--bb-grid-size-7);
        display: flex;
        align-items: center;
        height: var(--bb-grid-size-7);
        margin: 0 0 var(--bb-grid-size-4) var(--bb-grid-size-7);
      }

      #initial-message {
        font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        text-align: center;
        color: var(--bb-neutral-700);
      }
    }
  }

  :host([showhistory="true"]) {
    #content #history #history-list {
      transform: none;
    }
  }
`;
