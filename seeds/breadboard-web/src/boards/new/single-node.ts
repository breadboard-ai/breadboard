/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { core } from "@google-labs/core-kit";

export const graph = core.passthrough({ foo: "bar" });

// This would be typically used as "await graph", not as a (serialized) graph.
// Hence no example.

export const example = undefined;

export default await graph.serialize({ title: "New: Single node" });
