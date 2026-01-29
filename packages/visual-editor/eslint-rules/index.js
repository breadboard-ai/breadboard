/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Custom ESLint plugin for visual-editor SCA patterns.
 */

const scaConsumeRule = require("./sca-consume.js");

export default {
  rules: {
    "sca-consume-type": scaConsumeRule,
  },
};
