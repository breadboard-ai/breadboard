/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Generate this.
export const builtIns = `
/**
 * A built-in capability of Breadboard to fetch data.
 */
declare module '@fetch' {
  export default function fetch(url: string): Promise<Response>;
}

declare module '@secrets' {
  export default function secrets(sekrits: {
    keys: string[];
  }): Promise<Record<string, string>>;
}`;
