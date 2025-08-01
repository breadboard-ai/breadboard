/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";
import { icons } from "../../styles/icons";

export const styles = [
  icons,
  css`
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

    #container {
      display: flex;
      flex-direction: column;
      align-items: center;

      width: 100%;
      height: 100%;
      background: var(--s-90, var(--bb-neutral-0));
      position: relative;
      container-type: size;

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

      & #board-activity-container {
        height: 100%;
        width: 100%;
        overflow: auto;
        position: relative;
        scroll-padding-bottom: 60px;
        scrollbar-width: none;
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
      }

      & #theme-edit {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--bb-grid-size-3) 12% var(--bb-grid-size-4) 12%;
        width: 100%;
        background: var(--s-90);
        border-top: 1px solid var(--s-70, var(--bb-neutral-400));

        &.empty {
          border-top: 1px solid var(--n-90, var(--bb-neutral-400));
        }

        & #share-app {
          margin-right: var(--bb-grid-size-3);
        }

        & #share-app,
        & #designer {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 auto;
          max-width: 200px;
          white-space: nowrap;

          height: var(--bb-grid-size-10);
          border-radius: var(--bb-grid-size-16);
          background: var(--n-100, var(--bb-neutral-0)) 8px center / 20px 20px
            no-repeat;
          color: var(--p-30, var(--bb-neutral-800));
          font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          border: none;
          padding: 0 var(--bb-grid-size-3);

          & .g-icon {
            margin-right: var(--bb-grid-size-2);
          }

          &[disabled] {
            opacity: 0.4;
          }

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              background-color: var(--s-98, var(--bb-neutral-200));
            }
          }
        }
      }

      & #content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        flex: 1;
        width: 100%;
        margin: 0 auto;

        overflow: auto;
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        position: relative;
        background: var(--s-90, var(--bb-neutral-0));

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
              font: 400 var(--bb-label-small) /
                var(--bb-label-line-height-small) var(--bb-font-family);
              margin-top: var(--bb-grid-size);
              height: var(--bb-grid-size-7);
              border: none;
              display: block;
              padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
              border-radius: var(--bb-grid-size-16);
              background: var(--bb-ui-100) var(--bb-icon-check) 8px center /
                20px 20px no-repeat;

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
              background: var(--bb-neutral-0) center center / 20px 20px
                no-repeat;
            }
          }

          & .value {
            color: var(--bb-neutral-900);
          }

          & .title {
            color: var(--bb-neutral-900);
            margin: 2px 0 var(--bb-grid-size) 0;
            font: 500 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
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
          background: url(/images/progress-ui.svg) 0 center / 20px 20px
            no-repeat;
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
  `,
];
