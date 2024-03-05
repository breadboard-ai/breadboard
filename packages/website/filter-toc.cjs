/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const { JSDOM } = require("jsdom");

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
    <div id="toc-container">
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

    for (const link of header.querySelectorAll('a')) {
      link.remove();
    }

    const name = header.textContent.replace(/\W$/, '');
    html += `<li><a href="#${toID(name)}">${name}</a></li>\n`;

    lastLevel = level;
  }

  html += "</ol>\n".repeat(lastLevel);
  html += `</div></aside>`;
  return html;
};
