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
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      width: 100%;
      padding-bottom: var(--bb-grid-size-3);
      height: var(--bb-grid-size-11);
      position: relative;

      &::after {
        content: "";
        height: 1px;
        bottom: var(--bb-grid-size-3);
        position: absolute;
        left: calc(-1 * var(--output-padding));
        width: calc(100% + 2 * var(--output-padding));
        background: var(--bb-neutral-200);
      }

      & > div > button {
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        background: none;
        color: var(--bb-neutral-600);
        height: 32px;
        border: none;
        margin: 0 var(--bb-grid-size-2);
        padding: 0 var(--bb-grid-size-2);
        position: relative;
        display: inline-flex;
        align-items: flex-start;
        cursor: pointer;

        &[disabled] {
          color: var(--bb-neutral-900);
          cursor: auto;

          &::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            border-radius: var(--bb-grid-size) var(--bb-grid-size) 0 0;
            background: var(--bb-ui-500);
            height: 3px;
          }
        }
      }

      & #share {
        width: 20px;
        height: 20px;
        background: var(--bb-icon-share) center center / 20px 20px no-repeat;
        font-size: 0;
        margin: 0 0 var(--bb-grid-size-3) 0;
        border: none;
        opacity: 0.5;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }
    }

    & #theme-edit {
      padding: var(--bb-grid-size-3) 0 var(--bb-grid-size-4) 0;
      width: 100%;
      max-width: 450px;

      & #designer {
        height: var(--bb-grid-size-8);
        border-radius: var(--bb-grid-size-16);
        background: var(--bb-icon-edit) var(--bb-neutral-100) 8px center / 20px
          20px no-repeat;
        color: var(--bb-neutral-800);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        border: none;
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: var(--bb-neutral-200);
          }
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
