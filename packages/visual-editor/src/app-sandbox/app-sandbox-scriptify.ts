/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { toFunctionString, scriptifyFunction };

const toFunctionString = (
  fn: (...unknown: []) => unknown,
  replacements?: [string, string][]
) => {
  let str = fn.toString();
  if (replacements) {
    for (const [key, value] of replacements) {
      // Note this doesn't provide any kind of automatic escaping or quoting,
      // it's just raw string substitution.
      str = str.replaceAll(key, value);
    }
  }
  return str;
};

const scriptifyFunction = (
  fn: (...unknown: []) => unknown,
  replacements?: [string, string][]
) => `<script>( ${toFunctionString(fn, replacements)} )();</script>`;
