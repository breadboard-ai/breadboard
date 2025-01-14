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
      translate: var(--x) 0;
    }

    to {
      opacity: 1;
      translate: 0px 0px;
    }
  }

  * {
    box-sizing: border-box;
  }

  :host {
    background: var(--bb-neutral-0);
    position: relative;
  }

  #content {
    display: grid;
    grid-template-rows: 1fr min-content;
    margin: 0 auto;
    width: 100%;
    max-width: 860px;
    height: 100%;
    overflow: auto;
    padding: var(--bb-grid-size-8) var(--bb-grid-size-3);
    font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);

    #log {
      overflow-y: scroll;
      scrollbar-width: none;
    }

    #user-input {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-2) var(--bb-grid-size-4)
        var(--bb-grid-size-2);

      display: grid;
      grid-template-columns: 1fr 70px;
      column-gap: var(--bb-grid-size-2);
      min-height: 78px;

      & #container {
        border-radius: var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        padding: var(--bb-grid-size-4);
        display: flex;
        min-height: 100%;
        color: var(--bb-neutral-600);
      }

      & #continue-button-container {
        display: flex;
        align-items: flex-end;

        & button {
          font-size: 0;
          margin-bottom: var(--bb-grid-size-3);

          width: 32px;
          height: 32px;
          border: none;
          display: block;
          background: var(--bb-icon-send) center center / 32px 32px no-repeat;

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

    .user-output,
    .model-output,
    .status {
      margin-bottom: var(--bb-grid-size-4);
      width: max-content;
      max-width: 70%;
      animation: fadeIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

      & p {
        margin: 0 0 var(--bb-grid-size) 0;
      }
    }

    .status,
    .model-output {
      --x: -10px;
      display: flex;

      & .icon {
        margin: var(--bb-grid-size-6) var(--bb-grid-size-2) 0 0;

        &::after {
          display: flex;
          content: "";
          width: var(--bb-grid-size-12);
          height: var(--bb-grid-size-12);
          border-radius: 50%;
          border: 1px solid var(--bb-neutral-300);
          background: var(--bb-neutral-0) var(--bb-icon-smart-toy) center
            center / 36px 36px no-repeat;
        }
      }

      & .meta {
        padding-left: var(--bb-grid-size-5);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        margin-bottom: var(--bb-grid-size);
      }

      & .value {
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-5);
        background: var(--bb-neutral-100);
        color: var(--bb-neutral-900);
      }

      & label {
        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        margin-bottom: var(--bb-grid-size-2);
      }
    }

    .user-output {
      justify-self: end;
      --x: 10px;

      & .meta {
        padding-left: var(--bb-grid-size-5);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        margin-bottom: var(--bb-grid-size);
      }

      & .value {
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-5);
        background: var(--bb-ui-50);
        color: var(--bb-neutral-900);
      }
    }

    .status {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      border-radius: var(--bb-grid-size-5);
      color: var(--bb-neutral-900);
      border: 1px solid var(--bb-neutral-300);
      margin-left: calc(var(--bb-grid-size-15) - 2px);
    }

    #initial-message {
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      text-align: center;
    }
  }
`;
