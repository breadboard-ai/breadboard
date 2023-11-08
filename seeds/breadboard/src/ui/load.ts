/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type LoadArgs = {
  title: string;
  description?: string;
  version?: string;
  diagram?: string;
  url?: string;
};

const createLink = (url?: string) => {
  if (!url) return "";
  const linkUrl = new URL(window.location.href);
  if (linkUrl.searchParams.has("board")) return "";
  linkUrl.searchParams.set("board", url);
  return `<a href="${linkUrl}"> 🔗</a>`;
};

export class Load extends HTMLElement {
  constructor({ title, description = "", version = "", url = "" }: LoadArgs) {
    super();
    if (version) version = `version: ${version}`;
    const root = this.attachShadow({ mode: "open" });
    const link = createLink(url);
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        h2 {
          font-weight: var(--bb-title-font-weight, normal);
        }
        h2 a {
          text-decoration: none;
        }
      </style>
      <h2>${title}${link}</h2>
      <p>${description}</p>
      <p>${version}</p>
    `;
  }
}
