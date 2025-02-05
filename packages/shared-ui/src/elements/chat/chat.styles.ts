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
    position: relative;
    display: block;

    --output-border-width: 1px;
    --output-border-color: var(--bb-neutral-300);
    --output-border-radius: var(--bb-grid-size-2);
    --output-padding: var(--bb-grid-size-6);
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
      display: flex;
      flex-direction: column;
      overflow-y: scroll;
      height: 100%;
      background: var(--bb-neutral-0);
      scroll-padding: 0 0 120px 0;

      &::before {
        content: "";
        display: block;
        flex: 1 1 auto;
        background: var(--bb-neutral-0);
        width: 100%;
      }

      & .user-output,
      & .system-output {
        animation: fadeIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

        flex: 0 0 auto;
        margin-bottom: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4) 0
          var(--bb-grid-size-4);

        & .title {
          margin: 0 0 var(--bb-grid-size-2) 0;
          font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          height: var(--bb-grid-size-5);
          display: flex;
          align-items: center;
        }

        & .entry-title {
          margin: 0 0 var(--bb-grid-size) 0;
          font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
          color: var(--bb-neutral-700);
        }

        & bb-llm-output-array {
          margin: 0 0 var(--bb-grid-size-2) 0;
        }

        & p {
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          margin: 0 0 var(--bb-grid-size) 0;
          font-size: var(--bb-text-medium);
        }

        &:last-of-type {
          margin-bottom: var(--bb-grid-size-16);
        }

        &.input .title::before,
        &.generative-audio .title::before,
        &.generative-code .title::before,
        &.generative-image .title::before,
        &.generative-text .title::before,
        &.generative .title::before {
          content: "";
          height: 20px;
          width: 20px;
          margin-right: var(--bb-grid-size-2);
        }

        &.input .title::before {
          background: var(--bb-icon-input) center center / 20px 20px no-repeat;
        }

        &.generative-audio .title::before {
          background: var(--bb-add-icon-generative-audio) center center / 20px
            20px no-repeat;
        }

        &.generative-code .title::before {
          background: var(--bb-add-icon-generative-code) center center / 20px
            20px no-repeat;
        }

        &.generative .title::before {
          background: var(--bb-add-icon-generative) center center / 20px 20px
            no-repeat;
        }

        &.generative-image .title::before {
          background: var(--bb-add-icon-generative-image) center center / 20px
            20px no-repeat;
        }

        &.generative-text .title::before {
          background: var(--bb-add-icon-generative-text) center center / 20px
            20px no-repeat;
        }
      }

      & .user-output {
        --output-border-width: 0;
        --output-border-color: var(--bb-neutral-300);
        --output-border-radius: var(--bb-grid-size-2);
        --output-padding: 0;
        --output-lite-border-color: transparent;
        --output-lite-background-color: transparent;
      }

      & .activity-entry {
        flex: 0 0 auto;
        margin-bottom: var(--bb-grid-size-2);

        &:last-of-type {
          margin-bottom: var(--bb-grid-size-12);
        }

        &.input .user-input .icon::after,
        &.input .user-output .icon::after {
          background-image: var(--bb-icon-input);
        }

        &.input,
        &.output,
        &.error {
          padding: var(--bb-grid-size-2) var(--bb-grid-size-4) 0
            var(--bb-grid-size-4);

          & h1 {
            margin: 0 0 var(--bb-grid-size-2) 0;
            font: 500 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
          }

          & .model-output {
            width: 100%;
            overflow: auto;

            & p:last-of-type {
              margin-bottom: var(--bb-grid-size-2);
            }

            & .icon::after {
              background-image: var(--bb-icon-smart-toy);
            }
          }
        }

        &.error {
          color: #cc0000;
          user-select: text;

          &.error-content {
            white-space: pre;
            border: 1px solid var(--bb-warning-200);
            background-color: var(--bb-warning-50);
            border-radius: var(--bb-grid-size-2);
            padding: var(--bb-grid-size-4);
            overflow-x: scroll;
            font: 400 var(--bb-body-x-small) /
              var(--bb-body-line-height-x-small) var(--bb-font-family-mono);
            margin-left: 28px;
            scrollbar-width: none;
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
    .model-output {
      animation: fadeIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

      & p {
        margin: 0 0 var(--bb-grid-size) 0;
      }
    }

    .status,
    .user-input,
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
        width: 100%;

        & bb-llm-output:only-child {
          margin-top: var(--bb-grid-size-4);
        }
      }

      & .title {
        display: flex;
        align-items: center;
        height: 20px;
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

    .user-output {
      display: flex;
      justify-content: flex-end;

      & h2 {
        color: var(--bb-neutral-700);
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        text-align: right;
        margin: 0 0 var(--bb-grid-size) 0;
        justify-content: flex-end;
      }

      & .value {
        border-radius: var(--bb-grid-size-4) var(--bb-grid-size)
          var(--bb-grid-size-4) var(--bb-grid-size-4);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-2)
          var(--bb-grid-size-2) var(--bb-grid-size-2);
        background: var(--bb-ui-100);
        color: var(--bb-neutral-900);
      }
    }

    .status {
      position: absolute;
      left: var(--bb-grid-size-4);
      bottom: 0;

      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      background: oklch(from var(--bb-neutral-900) l c h / 0.8)
        url(/images/progress-ui-inverted.svg) 12px center / 20px 20px no-repeat;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-2) var(--bb-grid-size-2)
        var(--bb-grid-size-11);
      width: calc(100% - var(--bb-grid-size-8));
      color: var(--bb-neutral-0);
      display: flex;
      align-items: center;
      border-radius: var(--bb-grid-size);
    }
  }

  #click-run {
    font: 400 var(--bb-body-large) / var(--bb-body-line-height-large)
      var(--bb-font-family);
    color: var(--bb-neutral-700);
    text-align: center;
    padding-top: var(--bb-grid-size-5);
  }

  :host([showhistory="true"]) {
    #content #history #history-list {
      transform: none;
    }
  }
`;
