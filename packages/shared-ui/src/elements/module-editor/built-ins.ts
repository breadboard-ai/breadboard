/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Generate this.
export const builtIns = `
declare function encodeURIComponent(v: string): string;

declare module '@fetch' {
  /**
   * A built-in capability of Breadboard to fetch data.
   */
  export default function fetch(url: string|Request): Promise<Response>;
}

declare module '@secrets' {
  /**
   * A built-in capability of Breadboard to obtain secrets.
   */
  export default function secrets(sekrits: {
    keys: string[];
  }): Promise<Record<string, string>>;
}`;
