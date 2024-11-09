/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encodes a text string as a valid component of a Uniform Resource Identifier (URI).
 * @param uriComponent A value representing an unencoded URI component.
 */
declare function encodeURIComponent(
  uriComponent: string | number | boolean
): string;

declare module "@fetch" {
  export type FetchInputs = {
    url: string;
  };

  /**
   * A built-in capability of Breadboard to fetch data.
   */
  export default function fetch(url: FetchInputs): Promise<Response>;
}

declare module "@secrets" {
  /**
   * A built-in capability of Breadboard to obtain secrets.
   */
  export default function secrets(sekrits: {
    keys: string[];
  }): Promise<Record<string, string>>;
}
