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
    background: var(--bb-ui-50);
    position: relative;
    display: block;
    padding: var(--bb-grid-size-12);

    --output-border-width: 1px;
    --output-border-color: var(--bb-neutral-300);
    --output-border-radius: var(--bb-grid-size-4);
    --output-padding: var(--bb-grid-size-5);
  }

  #content {
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    width: 100%;
    max-width: 640px;
    height: 100%;
    overflow: auto;
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);
    position: relative;

    & header {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-6);
      border-radius: var(--bb-grid-size-4) var(--bb-grid-size-4) 0 0;
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
      height: var(--bb-grid-size-11);
      display: flex;
      flex-direction: row;
      align-items: center;

      & h1 {
        font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        color: var(--bb-neutral-900);
        margin: 0;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      & #menu,
      & #share,
      & #clear {
        width: 20px;
        height: 20px;
        font-size: 0;
        padding: 0;
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

      & #menu {
        width: 24px;
        height: 24px;
        margin-right: var(--bb-grid-size-4);
        background: transparent var(--bb-icon-menu) center center / 24px 24px
          no-repeat;
      }

      & #share {
        margin: 0 var(--bb-grid-size-4);
        background: transparent var(--bb-icon-share) center center / 20px 20px
          no-repeat;
      }

      & #clear {
        background: transparent var(--bb-icon-sweep) center center / 20px 20px
          no-repeat;
      }
    }

    & #log {
      overflow-y: scroll;
      flex: 1;
      background: var(--bb-neutral-0);
      border-left: 1px solid var(--bb-neutral-300);
      border-right: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-4) var(--bb-grid-size-6);

      & .activity-entry {
        margin-bottom: var(--bb-grid-size-6);

        &.input .user-input .icon::after,
        &.input .user-output .icon::after {
          background-image: var(--bb-icon-input);
        }

        &.output .model-output .icon::after {
          background-image: var(--bb-icon-smart-toy);
        }
      }
    }

    & #history {
      position: absolute;
      left: 1px;
      top: 1px;
      height: calc(100% - 2px);
      width: 230px;
      overflow: hidden;
      pointer-events: none;

      & #history-list {
        pointer-events: auto;
        height: 100%;
        background: var(--bb-neutral-0);
        border-right: 1px solid var(--bb-neutral-300);
        width: 100%;
        transition: transform 1.2s cubic-bezier(0, 0, 0.3, 1);
        transform: translateX(-100%) translateX(-2px);
        overflow-y: scroll;
        scrollbar-width: none;
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-4) 0 0 var(--bb-grid-size-4);

        & h1 {
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          margin: 2px 0 var(--bb-grid-size-2) 0;
        }

        & ul {
          padding: 0;
          margin: 0;
          list-style: none;

          & li {
            font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
            margin-bottom: var(--bb-grid-size);
            padding: var(--bb-grid-size) var(--bb-grid-size-2);
            border-radius: var(--bb-grid-size-16);
            background: var(--bb-ui-50);
          }
        }
      }
    }

    footer {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-6);
      background: var(--bb-neutral-0);
      border-radius: 0 0 var(--bb-grid-size-4) var(--bb-grid-size-4);
      border: 1px solid var(--bb-neutral-300);
    }

    .user-input {
      & .input {
        flex: 1;

        & .title {
          font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
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

  :host([showhistory="true"]) {
    #content #history #history-list {
      transform: none;
    }
  }
`;
