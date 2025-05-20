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

  @keyframes shimmer {
    from {
      opacity: 0.7;
    }

    to {
      opacity: 0.8;
    }
  }

  @keyframes rotate {
    from {
      rotate: 0deg;
    }

    to {
      rotate: 360deg;
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
