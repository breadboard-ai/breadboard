/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeTypeIdentifier } from "@google-labs/graph-runner";
import { SafetyLabel } from './label.js';
import { SafetyLabelValue } from './types.js';

/**
 * Manual assignment of labels to node types.
 * 
 * Eventually this should be based on a system of verifiers, etc.
 * The key for now is that these labels can only be set by a trusted source, which is for now this file.
 */
export const trustedLabels: Map<NodeTypeIdentifier, SafetyLabel> = new Map([
    ["fetch", new SafetyLabel(SafetyLabelValue.UNTRUSTED)],
    ["run-javascript", new SafetyLabel(SafetyLabelValue.TRUSTED)],
  ]);
