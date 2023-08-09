/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeTypeIdentifier } from "@google-labs/graph-runner";
import { Label, LabelValue } from "./label.js";

/**
 * Manual assignment of labels to node types.
 *
 * Eventually this should be based on a system of verifiers, etc.
 * The key for now is that these labels can only be set by a trusted source,
 * which is for now this file.
 */

interface TrustedLabels {
  node?: Label;
  incoming?: Record<string, Label>;
  outgoing?: Record<string, Label>;
}

export const trustedLabels: Record<NodeTypeIdentifier, TrustedLabels> = {
  fetch: {
    outgoing: {
      response: new Label({ integrity: LabelValue.UNTRUSTED }),
    },
  },
  runJavascript: {
    node: new Label({ integrity: LabelValue.TRUSTED }),
  },
};
