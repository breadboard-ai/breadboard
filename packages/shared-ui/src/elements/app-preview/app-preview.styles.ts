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

  #theme-management {
    position: absolute;
    top: 32px;
    left: 32px;
    background: var(--bb-neutral-0);
    border-radius: 4px;
    border: 1px solid var(--bb-neutral-300);
    z-index: 10;
  }

  #app-url {
    width: 25svw;
    min-width: 280px;
    max-width: 360px;
    user-select: none;
    border-bottom: 1px solid var(--bb-neutral-300);

    & h1 {
      grid-column: 1 / 3;
      background: var(--bb-icon-phone) 8px center / 20px 20px no-repeat;
      display: flex;
      align-items: center;
      justify-content: space-between;
      list-style: none;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size) var(--bb-grid-size-3) var(--bb-grid-size)
        var(--bb-grid-size-8);
    }

    & button {
      width: 20px;
      height: 20px;
      border: none;
      font-size: 0;
      background: var(--bb-neutral-0) var(--bb-icon-copy-to-clipboard) center
        center / 20px 20px no-repeat;
      opacity: 0.5;

      &:not([disabled]) {
        cursor: pointer;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:hover,
        &:focus {
          opacity: 1;
        }
      }
    }

    & #url-container {
      display: grid;
      grid-template-columns: 1fr 20px;
      column-gap: var(--bb-grid-size-2);
      padding: 0 var(--bb-grid-size-3) var(--bb-grid-size-3)
        var(--bb-grid-size-3);
      align-items: center;

      & #url {
        display: block;
        width: 100%;
        border-radius: var(--bb-grid-size);
        background: var(--bb-neutral-0);
        color: var(--bb-neutral-900);
        padding: var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        resize: none;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
      }
    }
  }

  #container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--bb-ui-50);
    position: relative;
    padding: var(--bb-grid-size-12);

    --output-border-width: 1px;
    --output-border-color: var(--bb-neutral-300);
    --output-border-radius: var(--bb-grid-size-4);
    --output-padding: var(--bb-grid-size-5);

    & #content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
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
      border: 1px solid var(--bb-neutral-300);

      & .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100svw;

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

      & #controls {
        display: flex;
        align-items: center;
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 2;

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
          background: transparent var(--bb-icon-share) center center / 20px 20px
            no-repeat;
        }

        & #clear {
          margin: 0 var(--bb-grid-size-4);
          background: transparent var(--bb-icon-replay) center center / 20px
            20px no-repeat;
        }
      }

      & #log {
        overflow-y: scroll;
        flex: 1;
        scrollbar-width: none;
        position: relative;

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

        & #splash {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100%;

          &::before {
            content: "";
            width: 100%;
            flex: 1;
            background: var(--splash-screen, url(/images/app/generic-flow.jpg))
              center center / cover no-repeat;
            mask-image: linear-gradient(
              to bottom,
              rgba(255, 0, 255, 1) 0%,
              rgba(255, 0, 255, 1) 70%,
              rgba(255, 0, 255, 0.75) 80%,
              rgba(255, 0, 255, 0.4) 90%,
              rgba(255, 0, 255, 0) 100%
            );
          }

          & h1 {
            background: var(--background-color, none);
            border-radius: var(--bb-grid-size-2);
            font: 500 italic 32px / 42px serif;
            color: var(--primary-color, var(--bb-neutral-700));
            margin: 0 0 var(--bb-grid-size-3);
            flex: 0 0 auto;
            max-width: 80%;
            width: max-content;
            text-align: center;
          }

          & p {
            flex: 0 0 auto;
            font: 400 italic var(--bb-body-large) /
              var(--bb-body-line-height-large) serif;
            color: var(--primary-color, var(--bb-neutral-700));
            margin: 0 0 var(--bb-grid-size-3);

            max-width: 65%;
            width: max-content;
            text-align: center;
          }
        }
      }

      & #input {
        --user-input-padding-left: 0;

        display: flex;
        justify-content: center;
        position: relative;

        background: var(--background-color, var(--bb-neutral-0));
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        min-height: 100px;
        max-height: 385px;
        overflow: auto;

        &.active {
          background: oklch(
            from var(--background-color, var(--bb-neutral-0)) calc(l + 0.1) c h
          );
        }

        & bb-user-input {
          flex: 1 1 auto;
        }

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
          background: var(--secondary-color, var(--bb-ui-500))
            var(--bb-icon-send-inverted) center center / 18px 18px no-repeat;
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

        & #run {
          min-width: 76px;
          height: var(--bb-grid-size-10);
          background: var(--primary-color, var(--bb-ui-50))
            var(--bb-add-icon-generative) 12px center / 16px 16px no-repeat;
          color: var(--primary-text-color, var(--bb-ui-700));
          border-radius: 20px;
          border: 1px solid var(--primary-color, var(--bb-ui-100));
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-9);
          opacity: 0.3;

          &.running {
            background: var(--bb-ui-500) url(/images/progress-ui.svg) 8px
              center / 16px 16px no-repeat;
          }

          &:not([disabled]) {
            cursor: pointer;
            opacity: 1;
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
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
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

    #controls {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      display: flex;
      border-top: 1px solid var(--bb-neutral-300);

      button {
        display: block;
        font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family);

        border-radius: var(--bb-grid-size-16);
        color: var(--bb-neutral-900);
        background-color: var(--bb-neutral-50);
        border: none;
        height: var(--bb-grid-size-7);
        padding: 0 var(--bb-grid-size-3);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        margin-right: var(--bb-grid-size-2);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: var(--bb-neutral-100);
          }
        }

        &#revert {
          background: none;
          font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
          color: var(--bb-neutral-600);
        }
      }
    }
  }

  :host([showhistory="true"]) {
    #content #history #history-list {
      transform: none;
    }
  }
`;
