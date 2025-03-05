/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export default css`
  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @scope (.app-template) {
    :scope {
      --ease-out: cubic-bezier(0, 0, 0.3, 1);
      --duration: 0.3s;
      --transition-properties: all;
      --transition: var(--transition-properties) var(--duration) var(--ease-out);
    }
  }
`;
