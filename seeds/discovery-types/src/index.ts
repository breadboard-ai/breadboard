/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import prettier from "prettier";

import { fromDoc, DiscoveryDoc } from "./converter.js";

export const toTypes = (o: unknown) => {
  const doc = o as DiscoveryDoc;
  const types = fromDoc(doc);
  const formatted = prettier.format(types, {
    parser: "typescript",
    arrowParens: "always",
    printWidth: 80,
    semi: true,
    tabWidth: 2,
    trailingComma: "es5",
    useTabs: false,
  });
  return formatted;
};
