/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, render } from "lit";

export function escape(str: string | null | undefined) {
  const frag = document.createElement("div");
  render(html`${str}`, frag);

  return frag.innerHTML;
}

export function unescape(str: string | null | undefined) {
  if (!str) {
    return "";
  }

  const frag = document.createElement("div");
  frag.innerHTML = str;
  return frag.textContent;
}
