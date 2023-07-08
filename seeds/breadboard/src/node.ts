/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class Node {
  wire(spec: string, to: Node): Node {
    return this;
  }
}
