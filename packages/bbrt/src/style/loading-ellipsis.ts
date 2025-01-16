/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

/**
 * Provides the ".loading-ellipsis" class which renders an animated ellipsis.
 */
export const loadingEllipsisStyle = css`
  .loading-ellipsis::after {
    content: ".";
    animation: loading-ellipsis 1s steps(4, end) infinite;
  }

  @keyframes loading-ellipsis {
    15% {
      content: ".";
    }
    30% {
      content: "..";
    }
    45% {
      content: "...";
    }
    100% {
      content: /* NBSP */ "\\00A0";
    }
  }
`;
