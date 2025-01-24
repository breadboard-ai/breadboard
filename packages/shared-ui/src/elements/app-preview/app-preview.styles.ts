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

  bb-chat {
    height: 100%;
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

      & #menu {
        width: 24px;
        height: 24px;
        margin-right: var(--bb-grid-size-4);
        background: transparent var(--bb-icon-menu) center center / 24px 24px
          no-repeat;
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

      & #controls {
        display: flex;
        align-items: center;

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

        & #share {
          margin: 0 var(--bb-grid-size-4);
          background: transparent var(--bb-icon-share) center center / 20px 20px
            no-repeat;
        }

        & #clear {
          background: transparent var(--bb-icon-sweep) center center / 20px 20px
            no-repeat;
        }

        & #run {
          min-width: 76px;
          height: var(--bb-grid-size-7);
          background: var(--bb-ui-500) var(--bb-icon-play-filled-inverted) 8px
            center / 20px 20px no-repeat;
          color: #fff;
          border-radius: 20px;
          border: none;
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-9);
          opacity: 0.3;

          &.running {
            background: var(--bb-ui-500) url(/images/progress-ui-inverted.svg)
              8px center / 16px 16px no-repeat;
          }

          &:not([disabled]) {
            cursor: pointer;
            opacity: 1;
          }
        }
      }
    }

    & #log {
      overflow-y: scroll;
      flex: 1;
      background: var(--bb-neutral-0);
      border-left: 1px solid var(--bb-neutral-300);
      border-right: 1px solid var(--bb-neutral-300);
      scrollbar-width: none;

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

    & #input {
      --user-input-padding-left: 0;

      background: var(--bb-neutral-0);
      border-top: 1px solid var(--bb-neutral-300);
      border-left: 1px solid var(--bb-neutral-300);
      border-right: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      display: grid;
      grid-template-columns: 1fr 32px;
      column-gap: var(--bb-grid-size-2);
      max-height: 385px;
      overflow: auto;

      & .preamble {
        grid-column: 1 / 3;

        & h2 {
          color: var(--bb-neutral-900);
          margin: 0 0 var(--bb-grid-size-2) 0;
          font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
        }
      }

      & .no-input-needed {
        display: flex;
        box-sizing: border-box;
        align-items: center;
        height: var(--bb-grid-size-9);
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);

        &::before {
          content: "";
          display: block;
          width: 22px;
          height: 22px;
          border: 1px solid var(--bb-neutral-600);
          margin-right: var(--bb-grid-size-2);
          background: var(--bb-neutral-0) var(--bb-icon-add) center center /
            20px 20px no-repeat;
          opacity: 0.4;
          border-radius: 50%;
        }

        &::after {
          display: flex;
          align-items: center;
          height: 100%;
          flex: 1;
          content: "No input needed";
          border-radius: var(--bb-grid-size-16);
          background: var(--bb-neutral-100);
          border: 1px solid var(--bb-neutral-400);
          color: var(--bb-neutral-900);
          padding: 0 var(--bb-grid-size-4);
          opacity: 0.4;
        }
      }

      & .continue-button {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--bb-ui-500) var(--bb-icon-send-inverted) center
          center / 18px 18px no-repeat;
        font-size: 0;
        border: none;
        filter: grayscale(1);
        opacity: 0.6;
        align-self: end;
        margin-bottom: 2px;

        &:not([disabled]) {
          cursor: pointer;
          filter: none;

          &:hover,
          &:focus {
            opacity: 1;
          }
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
      border-radius: var(--bb-grid-size-4) 0 0 var(--bb-grid-size-4);

      & #history-list {
        pointer-events: auto;
        height: 100%;
        background: var(--bb-neutral-0);
        border-right: 1px solid var(--bb-neutral-300);
        width: 100%;
        transition: transform 0.2s cubic-bezier(0, 0, 0.3, 1);
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
