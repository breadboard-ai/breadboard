/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal utils for Folio, providing a dummy logger to avoid breaking coordination.ts.
 */
export const Utils = {
  Logging: {
    getLogger() {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log(msg: any, label?: string) {
          console.log(`[${label || "Log"}]`, msg);
        },
      };
    },
    Formatter: {
      verbose(...args: unknown[]) {
        return args.join(" ");
      },
      warning(...args: unknown[]) {
        return args.join(" ");
      },
      error(...args: unknown[]) {
        return args.join(" ");
      },
      group(title: string, content: string) {
        return `${title}\n${content}`;
      },
    },
  },
};
