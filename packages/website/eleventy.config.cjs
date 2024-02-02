/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const markdownItGitHubAlerts = require("markdown-it-github-alerts");
const markdownItGitHubHeadings = require("markdown-it-github-headings");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (eleventyConfig) {
  eleventyConfig.addFilter("toc", require("./filter-toc.cjs"));
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.amendLibrary("md", (mdLib) => {
    mdLib.use(markdownItGitHubAlerts, { icons: "" });
    mdLib.use(markdownItGitHubHeadings, {
      prefix: "",
      linkIcon: `<div class="anchor-icon">Link</div>`,
    });

    return mdLib;
  });
};
