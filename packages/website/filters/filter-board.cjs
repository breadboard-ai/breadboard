/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

module.exports = function (content, params) {
  if (params === "" || params === undefined || params === null) {
    params = "{}";
  }

  try {
    const validAttributes = ["collapseNodesByDefault"];
    const opts = JSON.parse(params);
    const attributes = Object.entries(opts).reduce((curr, [name, value]) => {
      if (!validAttributes.includes(name)) {
        return curr;
      }

      return curr + ` ${name}=${value}`;
    }, "");

    return `<bb-board-embed url="${content}" ${attributes}></bb-board-embed>`;
  } catch (err) {
    return "Error: Unable to embed board (" + err + ")";
  }
};
