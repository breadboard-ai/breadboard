/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html } from "lit";

export { notebookLmIcon, discordIcon };

/**
 * NotebookLM icon as an inline SVG TemplateResult.
 * Uses `fill: currentColor` so the icon color is controlled by CSS `color`.
 */
const notebookLmIcon = html`<svg
  width="20"
  height="20"
  viewBox="0 0 20 20"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M5.33 8.852C6.329 7.398 8.037 6.429 10 6.429c3.125 0 5.6 2.453 5.6 5.408V15H17v-3.163C17 8.028 13.833 5 10 5s-7 3.028-7 6.837V15h1.4c0-1.578 1.254-2.857 2.8-2.857 1.546 0 2.8 1.279 2.8 2.857h1.4c0-2.367-1.88-4.286-4.2-4.286-.885 0-1.705.28-2.382.756.67-1.274 2.083-2.184 3.782-2.184 2.38 0 4.2 1.786 4.2 3.857V15h1.4v-1.857c0-2.978-2.568-5.286-5.6-5.286a5.825 5.825 0 0 0-3.27.995z"
    fill="currentColor"
  />
</svg>`;

/**
 * Discord logo icon as an inline SVG TemplateResult.
 * Uses `fill: currentColor` so the icon color is controlled by CSS `color`.
 */
const discordIcon = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  width="20"
  height="20"
  viewBox="0 0 126.644 96"
>
  <path
    d="M81.15 0a73.742 73.742 0 0 0-3.36 6.794 97.868 97.868 0 0 0-28.994 0A67.874 67.874 0 0 0 45.437 0a105.547 105.547 0 0 0-26.14 8.057C2.779 32.53-1.691 56.373.53 79.887a105.038 105.038 0 0 0 32.05 16.088 76.912 76.912 0 0 0 6.87-11.063c-3.738-1.389-7.35-3.131-10.81-5.152.91-.657 1.794-1.338 2.653-1.995a75.255 75.255 0 0 0 64.075 0c.86.707 1.743 1.389 2.652 1.995a68.772 68.772 0 0 1-10.835 5.178A76.903 76.903 0 0 0 94.056 96a104.99 104.99 0 0 0 32.051-16.063c2.626-27.277-4.496-50.917-18.817-71.855A103.923 103.923 0 0 0 81.175.05L81.15 0ZM42.28 65.414c-6.238 0-11.416-5.657-11.416-12.653s4.976-12.679 11.391-12.679 11.517 5.708 11.416 12.679c-.101 6.97-5.026 12.653-11.39 12.653Zm42.078 0c-6.264 0-11.391-5.657-11.391-12.653s4.975-12.679 11.39-12.679S95.85 45.79 95.749 52.761c-.1 6.97-5.026 12.653-11.39 12.653Z"
    fill="currentColor"
  />
</svg>`;
