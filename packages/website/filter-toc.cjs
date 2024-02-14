/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const { JSDOM } = require("jsdom");

const TEXT_NODE = 3;
module.exports = function (content) {
  const dom = new JSDOM(content);
  const headers = dom.window.document.querySelectorAll("h1,h2,h3,h4,h5");
  const toID = (name) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/gim, "")
      .replace(/\s/gim, "-");
  };

  let html = `<aside class="toc">
    <h1>Table of Contents</h1>
  `;
  let lastLevel = 0;
  for (const header of headers) {
    const { nodeName } = header;
    const level = Number.parseInt(nodeName[1]);
    if (Number.isNaN(level)) {
      continue;
    }

    if (level > lastLevel) {
      html += "<ol>\n".repeat(level - lastLevel);
    }

    if (level < lastLevel) {
      html += "</ol>\n".repeat(lastLevel - level);
    }

    for (const node of header.childNodes) {
      if (node.nodeType !== TEXT_NODE) {
        continue;
      }

      const name = node.textContent;
      html += `<li><a href="#${toID(name)}">${name}</a></li>\n`;
    }

    lastLevel = level;
  }

  html += "</ol>\n".repeat(lastLevel);
  html += `</aside>`;
  return html;
};
